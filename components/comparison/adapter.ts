import "server-only";

import { cache } from "react";
import fixtureJson from "@/data/fixtures/comparison-demo.json";
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
  const raw = process.env.COMPARISON_DATA_SOURCE?.trim().toLowerCase();
  return raw === "api" ? "api" : "fixture";
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

function resolveFetchUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }

  const origin =
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

async function loadApiDataset(scenarioId?: string): Promise<ComparisonDataset> {
  const pathOrUrl = resolveComparisonApiUrl(scenarioId);
  const url = resolveFetchUrl(pathOrUrl);

  let response: Response;
  try {
    response = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
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
  /** When true, never fall back to the fixture (useful for tests). */
  strict?: boolean;
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

    if (options?.strict) {
      throw new Error(failure.message);
    }

    console.warn(
      "[comparison-adapter] API source failed; falling back to fixture.",
      failure,
    );

    warnings.push(
      `${failure.message} Showing the local fixture until the backend payload is available.`,
    );

    return {
      dataset: loadFixtureDataset(),
      source: {
        ...SOURCE_INFO.fixture,
        label: "Fixture fallback",
        description: `${SOURCE_INFO.fixture.description} Active because the API source failed.`,
      },
      warnings,
      failure,
    };
  }
}

const loadComparisonBundleCached = cache(
  async (scenarioId: string | undefined, strict: boolean) =>
    loadComparisonBundleUncached({ scenarioId, strict }),
);

/**
 * Loads the comparison UI dataset from fixture or API.
 * API mode falls back to the local fixture so the demo path stays intact
 * when Anggota 1 endpoints are not ready yet.
 *
 * Cached per request so generateMetadata + page share one load.
 */
export async function loadComparisonBundle(options?: {
  scenarioId?: string;
  /** When true, never fall back to the fixture (useful for tests). */
  strict?: boolean;
}): Promise<ComparisonBundle> {
  return loadComparisonBundleCached(
    options?.scenarioId,
    options?.strict ?? false,
  );
}

/** Always-available local fixture for generateStaticParams and unit tests. */
export function getLocalComparisonFixture(): ComparisonDataset {
  return loadFixtureDataset();
}
