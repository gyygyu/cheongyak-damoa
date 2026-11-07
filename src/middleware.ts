import { defineMiddleware } from 'astro:middleware';
import { env } from 'cloudflare:workers';
import { cacheKeyUrl } from './lib/cache-key';
import { canonicalRedirect } from './lib/canonical-host';

// Workers 응답은 자동으로 CDN 캐시되지 않으므로 Cache API 로 직접 저장한다 (지원금다모아 방식)
export const onRequest = defineMiddleware(async (context, next) => {
  const { request } = context;
  const target = import.meta.env.DEV ? null : canonicalRedirect(request.url, env.SITE_URL);
  if (target) return Response.redirect(target, 301);

  const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  if (import.meta.env.DEV || request.method !== 'GET' || !cache) return next();

  const key = new Request(cacheKeyUrl(request.url, __BUILD_ID__));
  const hit = await cache.match(key);
  if (hit) return hit;

  const response = await next();
  if (response.status === 200 && (response.headers.get('Cache-Control') ?? '').includes('s-maxage')) {
    context.locals.cfContext.waitUntil(cache.put(key, response.clone()));
  }
  return response;
});
