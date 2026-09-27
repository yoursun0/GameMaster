import 'server-only';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function loopbackOrigin(value: string): URL | null {
  try {
    const url = new URL(value);
    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    if (url.username || url.password || !LOOPBACK_HOSTS.has(hostname)) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

export function originAllowed(
  originHeader: string | null,
  appOrigin: string,
): boolean {
  if (!originHeader) {
    return false;
  }
  if (originHeader === appOrigin) {
    return true;
  }
  // Dev binds 127.0.0.1 while APP_ORIGIN stays localhost. Same scheme and port
  // are one local app; a public APP_ORIGIN never matches a loopback Origin.
  const requestOrigin = loopbackOrigin(originHeader);
  const configured = loopbackOrigin(appOrigin);
  if (!requestOrigin || !configured) {
    return false;
  }
  return (
    requestOrigin.protocol === configured.protocol &&
    requestOrigin.port === configured.port
  );
}
