export type DataSourceMode = "api" | "fixture";

type ResolveDataSourceModeOptions = {
  value: string | undefined;
  environment: string | undefined;
  variableName: string;
};

export function resolveDataSourceMode({
  value,
  environment,
  variableName,
}: ResolveDataSourceModeOptions): DataSourceMode {
  const mode = value?.trim().toLowerCase();

  if (mode === "api") return "api";

  if (mode === "fixture" && (environment === "development" || environment === "test")) {
    return "fixture";
  }

  if (mode === "fixture") {
    throw new Error(
      `${variableName}=fixture is available only in development or test; deployed environments must set ${variableName}=api.`,
    );
  }

  throw new Error(
    `Set ${variableName}=api for deployed environments. Local development and test may explicitly use ${variableName}=fixture.`,
  );
}
