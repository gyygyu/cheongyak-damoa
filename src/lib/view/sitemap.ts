// 사이트맵 (spec §12: 배포 뒤 서치콘솔에 낸다). KV 키 목록 → 화면 주소
// ipo: 는 아직 만드는 쪽이 없어(DART 키 없음) 넣지 않는다 — 묶음이 생기면 접두어와 /ipo/{corp} 를 더한다
import { regionHref, tradeHref } from './region';

export const SITEMAP_PREFIXES = ['apt:', 'lh:', 'region:', 'trade:'] as const;

const enc = encodeURIComponent;
export function pathOfKey(key: string): string | null {
  const [kind, ...rest] = key.split(':');
  if (rest.some((p) => !p)) return null;
  if ((kind === 'apt' || kind === 'lh') && rest.length === 1) return `/${kind}/${enc(rest[0])}`;
  if (kind === 'region' && (rest.length === 1 || rest.length === 2)) return regionHref(rest[0], rest[1]);
  if (kind === 'trade' && rest.length === 2) return tradeHref(rest[0], rest[1]);
  return null;
}

export const staticPaths = (today: string): string[] => ['/', '/competition', '/region', '/ipo', '/eligibility', `/calendar/${today.slice(0, 7)}`];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export function sitemapXml(base: string, paths: string[]): string {
  const root = base.replace(/\/+$/, '');
  const urls = paths.map((p) => `<url><loc>${esc(root + p)}</loc></url>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}
