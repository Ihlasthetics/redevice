const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

function isSafeOrigin(url: URL) {
  return (
    url.protocol === "https:" ||
    (url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname))
  );
}

export function buildPassportUrl({
  passportId,
  currentHref,
  configuredOrigin,
}: {
  passportId: string;
  currentHref: string;
  configuredOrigin?: string;
}) {
  const currentUrl = new URL(currentHref);
  let baseUrl = currentUrl;
  let configurationWarning: string | null = null;

  if (configuredOrigin?.trim()) {
    try {
      const candidate = new URL(configuredOrigin);

      if (isSafeOrigin(candidate)) {
        baseUrl = candidate;
      } else {
        configurationWarning =
          "VITE_PUBLIC_APP_ORIGIN must use HTTPS (or HTTP only for localhost); using the current page instead.";
      }
    } catch {
      configurationWarning =
        "VITE_PUBLIC_APP_ORIGIN is not a valid URL; using the current page instead.";
    }
  }

  const url = new URL(baseUrl.origin);
  url.pathname = currentUrl.pathname;
  url.searchParams.set("passport", passportId);
  url.hash = "passport-title";

  return {
    url: url.toString(),
    isLocalOnly: LOOPBACK_HOSTS.has(url.hostname),
    configurationWarning,
  };
}
