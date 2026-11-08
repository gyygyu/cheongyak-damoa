import type { APIRoute } from 'astro';
import { todayKst } from '../../lib/date';

// /calendar → 이번 달 (한국 날짜)
export const GET: APIRoute = () =>
  new Response(null, { status: 302, headers: { Location: `/calendar/${todayKst().slice(0, 7)}`, 'Cache-Control': 'no-store' } });
