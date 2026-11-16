import assert from "node:assert/strict";
import test from "node:test";

import { buildInternalApiHeaders } from "../../lib/internal-api-auth.ts";

test("forwards Vercel session cookies to same-origin API requests", () => {
  assert.deepEqual(
    buildInternalApiHeaders({
      cookie: "_vercel_jwt=authenticated-session",
      requestOrigin: "https://preview.example.vercel.app",
      destinationUrl: "https://preview.example.vercel.app/api/scenarios/example/rankings",
    }),
    {
      Accept: "application/json",
      cookie: "_vercel_jwt=authenticated-session",
    },
  );
});

test("uses the server-only automation secret when Vercel provides one", () => {
  assert.deepEqual(
    buildInternalApiHeaders({
      cookie: null,
      bypassSecret: "server-only-bypass-secret",
      requestOrigin: "https://preview.example.vercel.app",
      destinationUrl: "https://preview.example.vercel.app/api/scenarios/example/rankings",
    }),
    {
      Accept: "application/json",
      "x-vercel-protection-bypass": "server-only-bypass-secret",
    },
  );
});

test("never forwards a Vercel session cookie to an external comparison API", () => {
  assert.deepEqual(
    buildInternalApiHeaders({
      cookie: "_vercel_jwt=authenticated-session",
      bypassSecret: "server-only-bypass-secret",
      requestOrigin: "https://preview.example.vercel.app",
      destinationUrl: "https://api.example.com/rankings",
    }),
    { Accept: "application/json" },
  );
});
