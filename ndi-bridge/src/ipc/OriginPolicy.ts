const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

export function isAllowedLocalOrigin(origin: string | undefined): boolean {
  if (!origin || origin === "null") return true;
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== "http:") return false;
    const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
    return LOCAL_HOSTNAMES.has(hostname);
  } catch {
    return false;
  }
}
