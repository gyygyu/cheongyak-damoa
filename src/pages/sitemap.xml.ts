import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { SITEMAP_PREFIXES, pathOfKey, staticPaths, sitemapXml } from '../lib/view/sitemap';
import { setPublicCache } from '../server/cache';
import { todayKst } from '../lib/date';

// KV list 는 무료 하루 1,000회 — 응답을 하루 캐시해 한 지역 캐시당 하루 몇 번만 부른다
export const GET: APIRoute = async () => {
  const paths = staticPaths(todayKst());
  for (const prefix of SITEMAP_PREFIXES) {
    let cursor: string | undefined;
    do {
      const page = await env.KV.list({ prefix, cursor });
      for (const k of page.keys) {
        const p = pathOfKey(k.name);
        if (p) paths.push(p);
      }
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor && paths.length < 45_000);
  }
  const headers = new Headers({ 'Content-Type': 'application/xml; charset=utf-8' });
  setPublicCache(headers, 86_400);
  return new Response(sitemapXml(env.SITE_URL, paths), { headers });
};
