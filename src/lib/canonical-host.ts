// 대표 주소(SITE_URL)가 아닌 주소(workers.dev, www, http)로 들어오면 같은 경로로 넘길 곳. 넘길 필요가 없으면 null
const LOCAL = new Set(['localhost', '127.0.0.1', '[::1]']);

export function canonicalRedirect(requestUrl: string, siteUrl: string): string | null {
  if (!siteUrl) return null;
  const req = new URL(requestUrl);
  const site = new URL(siteUrl);
  if (LOCAL.has(req.hostname) || site.hostname.endsWith('.workers.dev') || LOCAL.has(site.hostname)) return null;
  if (req.hostname === site.hostname && req.protocol === site.protocol) return null;
  return new URL(req.pathname + req.search, site.origin).toString();
}
