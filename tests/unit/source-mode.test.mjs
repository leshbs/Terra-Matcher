import assert from "node:assert/strict";
import test from "node:test";

const { resolveDataSourceMode } = await import("../../lib/source-mode.ts");

test("accepts API mode in production", () => {
  assert.equal(
    resolveDataSourceMode({
      value: "api",
      environment: "production",
      variableName: "COMPARISON_DATA_SOURCE",
    }),
    "api",
  );
});

test("rejects an unset production data source", () => {
  assert.throws(
    () =>
      resolveDataSourceMode({
        value: undefined,
        environment: "production",
        variableName: "COMPARISON_DATA_SOURCE",
      }),
    /COMPARISON_DATA_SOURCE=api/,
  );
});

test("rejects fixture mode in production", () => {
  assert.throws(
    () =>
      resolveDataSourceMode({
        value: "fixture",
        environment: "production",
        variableName: "EXPLORER_DATA_SOURCE",
      }),
    /fixture.*development/i,
  );
});

test("allows explicit fixture mode only in development and test", () => {
  for (const environment of ["development", "test"]) {
    assert.equal(
      resolveDataSourceMode({
        value: "fixture",
        environment,
        variableName: "EXPLORER_DATA_SOURCE",
      }),
      "fixture",
    );
  }
});

test("rejects unknown source modes", () => {
  assert.throws(
    () =>
      resolveDataSourceMode({
        value: "offline",
        environment: "development",
        variableName: "COMPARISON_DATA_SOURCE",
      }),
    /COMPARISON_DATA_SOURCE.*api.*fixture/i,
  );
});
