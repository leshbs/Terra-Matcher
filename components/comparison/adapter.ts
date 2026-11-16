import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import fixtureJson from "@/data/fixtures/comparison-demo.json";
import { buildInternalApiHeaders } from "@/lib/internal-api-auth";
import { resolveDataSourceMode } from "@/lib/source-mode";
import {
  comparisonDatasetSchema,
  comparisonFixtureSchema,
  type ComparisonDataSourceInfo,
  type ComparisonDataset,
  type ComparisonSourceFailure,
} from "./contracts";

export type ComparisonSourceMode = "fixture" | "api";

export type ComparisonBundle = {
  dataset: ComparisonDataset;
  source: ComparisonDataSourceInfo;
  warnings: string[];
  failure: ComparisonSourceFailure | null;
};

const SOURCE_INFO: Record<ComparisonSourceMode, ComparisonDataSourceInfo> = {
  fixture: {
    mode: "fixture",
    label: "Local fixture",
    description:
      "Bundled comparison-demo.json. Set COMPARISON_DATA_SOURCE=api when Anggota 1 exposes the production payload.",
    isFixture: true,
  },
  api: {
    mode: "api",
    label: "Backend API",
    description:
      "Live comparison dataset from the configured API endpoint. Validated against the same UI contract as the fixture.",
    isFixture: false,
  },
};

function createFailure(
  code: ComparisonSourceFailure["code"],
  message: string,
  detail?: string,
): ComparisonSourceFailure {
  return { code, message, detail };
}

function isSourceFailure(error: unknown): error is ComparisonSourceFailure {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error
  );
}

/**
 * Accepts either a bare ComparisonDataset or the team API envelope:
 * { data: ComparisonDataset, meta?: { modelRunId, modelVersion } }
 */
export function parseComparisonApiPayload(
  payload: unknown,
): ComparisonDataset {
  const bare = comparisonDatasetSchema.safeParse(payload);
  if (bare.success) return bare.data;

  if (payload !== null && typeof payload === "object" && "data" in payload) {
    const nested = comparisonDatasetSchema.safeParse(
      (payload as { data: unknown }).data,
    );
    if (nested.success) return nested.data;
  }

  throw createFailure(
    "CONTRACT",
    "Comparison API response does not match the UI dataset contract.",
  );
}

function loadFixtureDataset(): ComparisonDataset {
  const parsed = comparisonFixtureSchema.safeParse(fixtureJson);

  if (!parsed.success) {
    console.error(
      "[comparison-adapter] Invalid fixture data.",
      parsed.error.format(),
    );
    throw new Error(
      "Comparison fixture does not match the comparison data contract.",
    );
  }

  return parsed.data;
}

export function resolveComparisonSourceMode(): ComparisonSourceMode {
  return resolveDataSourceMode({
    value: process.env.COMPARISON_DATA_SOURCE,
    environment: process.env.NODE_ENV,
    variableName: "COMPARISON_DATA_SOURCE",
  });
}

/**
 * Absolute or root-relative URL that returns a ComparisonDataset
 * (optionally wrapped as { data, meta }).
 *
 * Supports `{scenarioId}` interpolation in COMPARISON_API_URL.
 * Defaults to `/api/scenarios/{id}/rankings` or `/api/compare`.
 */
export function resolveComparisonApiUrl(scenarioId?: string): string {
  const configured = process.env.COMPARISON_API_URL?.trim();
  if (configured) {
    return configured.replace("{scenarioId}", scenarioId ?? "");
  }

  const id = scenarioId?.trim();
  if (id) {
    return `/api/scenarios/${encodeURIComponent(id)}/rankings`;
  }

  return "/api/compare";
}

function resolveFetchUrl(pathOrUrl: string, requestOrigin?: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }

  const origin =
    requestOrigin ||
    process.env.COMPARISON_API_ORIGIN?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.VERCEL_URL?.trim();

  if (!origin) {
    throw createFailure(
      "CONFIG",
      "COMPARISON_API_ORIGIN or NEXT_PUBLIC_APP_URL is required for server-side API mode.",
    );
  }

  const normalizedOrigin = origin.startsWith("http")
    ? origin
    : `https://${origin}`;

  return new URL(pathOrUrl, normalizedOrigin).toString();
}

function getRequestOrigin(incomingHeaders: Headers): string | undefined {
  const host = incomingHeaders.get("host");
  if (!host) return undefined;

  const protocol = incomingHeaders.get("x-forwarded-proto")?.split(",")[0] || "https";
  return `${protocol}://${host}`;
}

async function loadApiDataset(scenarioId?: string): Promise<ComparisonDataset> {
  const pathOrUrl = resolveComparisonApiUrl(scenarioId);
  const incomingHeaders = await headers();
  const requestOrigin = getRequestOrigin(incomingHeaders);
  const url = resolveFetchUrl(pathOrUrl, requestOrigin);
  const requestHeaders = buildInternalApiHeaders({
    cookie: incomingHeaders.get("cookie"),
    bypassSecret: process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
    requestOrigin,
    destinationUrl: url,
  });

  let response: Response;
  try {
    response = await fetch(url, {
      cache: "no-store",
      headers: requestHeaders,
    });
  } catch (error) {
    throw createFailure(
      "UNAVAILABLE",
      "Comparison API could not be reached.",
      error instanceof Error ? error.message : undefined,
    );
  }

  if (!response.ok) {
    throw createFailure(
      "UNAVAILABLE",
      `Comparison API returned HTTP ${response.status}.`,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw createFailure(
      "INVALID_DATA",
      "Comparison API response was not valid JSON.",
    );
  }

  try {
    return parseComparisonApiPayload(payload);
  } catch (error) {
    if (isSourceFailure(error)) throw error;

    throw createFailure(
      "CONTRACT",
      "Comparison API response failed validation.",
    );
  }
}

async function loadComparisonBundleUncached(options?: {
  scenarioId?: string;
}): Promise<ComparisonBundle> {
  const mode = resolveComparisonSourceMode();
  const warnings: string[] = [];

  if (mode === "fixture") {
    return {
      dataset: loadFixtureDataset(),
      source: SOURCE_INFO.fixture,
      warnings,
      failure: null,
    };
  }

  try {
    const dataset = await loadApiDataset(options?.scenarioId);
    return {
      dataset,
      source: SOURCE_INFO.api,
      warnings,
      failure: null,
    };
  } catch (error) {
    const failure = isSourceFailure(error)
      ? error
      : createFailure(
          "UNAVAILABLE",
          "Comparison API failed for an unknown reason.",
        );

    throw new Error(failure.message);
  }
}

const loadComparisonBundleCached = cache(
  async (scenarioId: string | undefined) =>
    loadComparisonBundleUncached({ scenarioId }),
);

/**
 * Loads the comparison UI dataset from an explicit local fixture or the API.
 * API errors remain visible to the route error boundary.
 */
export async function loadComparisonBundle(options?: {
  scenarioId?: string;
}): Promise<ComparisonBundle> {
  return loadComparisonBundleCached(options?.scenarioId);
}

/** Local fixture access is restricted by resolveComparisonSourceMode(). */
export function getLocalComparisonFixture(): ComparisonDataset {
  return loadFixtureDataset();
}
