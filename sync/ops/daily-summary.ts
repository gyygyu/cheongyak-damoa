// 매일 점검의 집계 — 네트워크 없이 시험할 수 있는 부분 (지원금다모아 sync/ops/daily-summary.ts 를 청약다모아에 맞춰 새로 씀)
import { SITE } from '../../src/lib/site-meta';

export interface RumRow {
  count: number;
  sum: { visits: number };
  dimensions: { requestPath: string; refererHost: string; deviceType: string; countryName: string };
}
export interface RumSummary {
  views: number; visits: number;
  referers: Record<string, number>; devices: Record<string, number>; tabs: Record<string, number>;
  topPages: { path: string; views: number }[];
}

const SELF_HOST = new URL(SITE.url).hostname;
export function refererLabel(host: string): string {
  if (!host) return '직접';
  if (/naver/.test(host)) return '네이버';
  if (/google/.test(host)) return '구글';
  if (/daum/.test(host)) return '다음';
  if (host === SELF_HOST || host.endsWith(`.${SELF_HOST}`)) return '사이트 안';
  return host;
}

const TABS: [RegExp, string][] = [
  [/^\/$/, '홈'],
  [/^\/apt\//, '단지 상세'],
  [/^\/lh\//, 'LH 공고'],
  [/^\/competition\b/, '경쟁률'],
  [/^\/calendar\b/, '캘린더'],
  [/^\/ipo\b/, '공모주'],
  [/^\/(region|trade)\b/, '실거래·지역'],
  [/^\/eligibility\b/, '자격 판정'],
];
export const tabOf = (path: string): string => TABS.find(([re]) => re.test(path))?.[1] ?? '기타';

function decodePath(p: string): string {
  try { return decodeURIComponent(p); } catch { return p; }
}
const add = (o: Record<string, number>, k: string, n: number) => { if (n > 0) o[k] = (o[k] ?? 0) + n; };

export function summarizeRum(rows: RumRow[]): RumSummary {
  const s: RumSummary = { views: 0, visits: 0, referers: {}, devices: {}, tabs: {}, topPages: [] };
  const pages: Record<string, number> = {};
  for (const r of rows) {
    const path = decodePath(r.dimensions.requestPath);
    s.views += r.count;
    s.visits += r.sum.visits;
    add(s.referers, refererLabel(r.dimensions.refererHost), r.sum.visits);
    add(s.devices, r.dimensions.deviceType, r.sum.visits);
    add(s.tabs, tabOf(path), r.count);
    add(pages, path, r.count);
  }
  s.topPages = Object.entries(pages).map(([path, views]) => ({ path, views })).sort((a, b) => b.views - a.views).slice(0, 5);
  return s;
}

export const LOG_HEADER = '# 방문 기록\n\n'
  + 'Cloudflare 웹 분석(RUM) 표본 추정치, 한국 날짜. `npm run ops:daily -- --write-log` 가 하루 한 줄씩 붙인다.\n\n'
  + '| 날짜 | 방문 | 조회 | 네이버 | 구글 | 직접 | 상세 비중 | 판정 조회 | 많이 본 페이지 |\n'
  + '|---|---|---|---|---|---|---|---|---|\n';

export function logRow(date: string, s: RumSummary, names: Record<string, string>): string {
  const detail = s.views > 0 ? Math.round(((s.tabs['단지 상세'] ?? 0) / s.views) * 100) : 0;
  const top = s.topPages.map((p) => {
    const id = p.path.match(/^\/apt\/([^/?#]+)/)?.[1];
    return `${(id && names[id]) || p.path} ${p.views}`;
  }).join(', ');
  const r = s.referers;
  return `| ${date} | ${s.visits} | ${s.views} | ${r['네이버'] ?? 0} | ${r['구글'] ?? 0} | ${r['직접'] ?? 0} | ${detail}% | ${s.tabs['자격 판정'] ?? 0} | ${top} |`;
}

export function appendLogRow(existing: string | null, date: string, row: string): string | null {
  if (existing === null) return `${LOG_HEADER}${row}\n`;
  if (existing.includes(`| ${date} |`)) return null;
  return `${existing.replace(/\s*$/, '\n')}${row}\n`;
}

const KST = 9 * 3600 * 1000;
export const yesterdayKst = (now: Date): string => new Date(now.getTime() + KST - 86400 * 1000).toISOString().slice(0, 10);

export function previousDays(date: string, n: number): string[] {
  const t = Date.parse(`${date}T00:00:00Z`);
  return Array.from({ length: n }, (_, i) => new Date(t - (i + 1) * 86400 * 1000).toISOString().slice(0, 10));
}

const fmt = (n: number) => n.toLocaleString('en-US');
export function limitLine(label: string, used: number, limit: number): string {
  const pct = Math.round((used / limit) * 100);
  return `${label} ${fmt(used)} / ${fmt(limit)} (${pct}%)${pct > 70 ? ' ⚠ 70% 넘음' : ''}`;
}

// 동기화가 KV 에 남긴 하루 사용량(meta:kvhash·meta:d1rows 의 {date, used}) — 다른 날 기록이면 0
export const dayUsage = (v: { date: string; used: number } | null, day: string): number => (v && v.date === day ? v.used : 0);

export interface RunInfo { name: string; conclusion: string | null; status: string; created_at: string }
export function actionsLatest(runs: RunInfo[]): { name: string; latest: string; at: string; failures: number }[] {
  const out = new Map<string, { name: string; latest: string; at: string; failures: number }>();
  for (const r of runs) {
    let e = out.get(r.name);
    if (!e) {
      const at = new Date(Date.parse(r.created_at) + KST).toISOString().slice(0, 16).replace('T', ' ');
      e = { name: r.name, latest: r.conclusion ?? r.status, at, failures: 0 };
      out.set(r.name, e);
    }
    if (r.conclusion === 'failure') e.failures++;
  }
  return [...out.values()];
}

export function repoFromRemote(url: string): string | null {
  const m = /github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(url.trim());
  return m ? `${m[1]}/${m[2]}` : null;
}
