type InternalApiAuthOptions = {
  cookie: string | null;
  bypassSecret?: string;
  requestOrigin?: string;
  destinationUrl: string;
};

/** Builds credentials for a server-side request to this same deployment. */
export function buildInternalApiHeaders({
  cookie,
  bypassSecret,
  requestOrigin,
  destinationUrl,
}: InternalApiAuthOptions): Record<string, string> {
  const requestHeaders: Record<string, string> = {
    Accept: "application/json",
  };

  let isSameOrigin = false;
  if (requestOrigin) {
    try {
      isSameOrigin = new URL(destinationUrl).origin === requestOrigin;
    } catch {
      isSameOrigin = false;
    }
  }

  if (isSameOrigin && cookie) requestHeaders.cookie = cookie;
  if (isSameOrigin && bypassSecret) {
    requestHeaders["x-vercel-protection-bypass"] = bypassSecret;
  }

  return requestHeaders;
}
