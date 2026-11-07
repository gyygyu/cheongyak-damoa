import type { APIRoute } from 'astro';
import { getStream } from '../../server/kv';
import { KV_KEYS } from '../../lib/kv-keys';

// 출처별 갱신 시각 — 바닥글 스크립트가 읽는다. 파싱하지 않고 그대로 넘긴다
export const GET: APIRoute = async () => {
  const body = await getStream(KV_KEYS.sources);
  if (!body) return new Response('{}', { status: 503, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  return new Response(body, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300, s-maxage=300' } });
};
