// 매일 점검 한 줄 명령. 읽기만 한다(--write-log 일 때 docs/traffic-log.md 에 한 줄 붙이는 것만 씀). 배포 뒤에 켠다 (spec §12)
//   npm run ops:daily
//   npm run ops:daily -- --date 2026-11-20 --write-log
// .env: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, GH_TOKEN — 값은 출력하지 않는다
import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { d1Query, kvGetText } from './cloudflare';
import type { KvManifest } from './bundles';
import { SITE } from '../src/lib/site-meta';
import {
  summarizeRum, logRow, appendLogRow, yesterdayKst, previousDays, limitLine, actionsLatest, repoFromRemote, dayUsage,
  type RumRow, type RunInfo,
} from './ops/daily-summary';

const LOG_PATH = 'docs/traffic-log.md';
const WORKFLOWS = ['sync'];
const LIVE_PATHS = ['/', '/calendar', '/competition', '/region', '/ipo', '/eligibility', '/sitemap.xml', '/robots.txt'];

async function graphql<T>(query: string): Promise<T> {
  const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const body = await res.json() as { data?: { viewer: { accounts: T[] } }; errors?: unknown };
  const acc = body.data?.viewer.accounts[0];
  if (!acc) throw new Error(`Cloudflare GraphQL 오류: ${JSON.stringify(body.errors).slice(0, 300)}`);
  return acc;
}
const account = () => `accounts(filter:{accountTag:"${process.env.CLOUDFLARE_ACCOUNT_ID}"})`;

async function rumDay(date: string): Promise<RumRow[]> {
  const acc = await graphql<{ rumPageloadEventsAdaptiveGroups: RumRow[] }>(`{ viewer { ${account()} {
    rumPageloadEventsAdaptiveGroups(limit:5000, filter:{date:"${date}"}) { count sum { visits } dimensions { requestPath refererHost deviceType countryName } }
  } } }`);
  return acc.rumPageloadEventsAdaptiveGroups;
}
async function rumTotals(date: string): Promise<{ views: number; visits: number }> {
  const acc = await graphql<{ rumPageloadEventsAdaptiveGroups: { count: number; sum: { visits: number } }[] }>(`{ viewer { ${account()} {
    rumPageloadEventsAdaptiveGroups(limit:1, filter:{date:"${date}"}) { count sum { visits } }
  } } }`);
  const g = acc.rumPageloadEventsAdaptiveGroups[0];
  return { views: g?.count ?? 0, visits: g?.sum.visits ?? 0 };
}

interface CfUsage {
  workersInvocationsAdaptive: { sum: { requests: number; errors: number }; quantiles: { cpuTimeP50: number; cpuTimeP99: number }; dimensions: { scriptName: string; status: string } }[];
  d1AnalyticsAdaptiveGroups: { sum: { rowsRead: number; rowsWritten: number } }[];
}
async function cfUsage(date: string): Promise<CfUsage> {
  return graphql<CfUsage>(`{ viewer { ${account()} {
    workersInvocationsAdaptive(limit:100, filter:{date:"${date}"}) { sum { requests errors } quantiles { cpuTimeP50 cpuTimeP99 } dimensions { scriptName status } }
    d1AnalyticsAdaptiveGroups(limit:100, filter:{date:"${date}"}) { sum { rowsRead rowsWritten } }
  } } }`);
}

async function actionRuns(): Promise<RunInfo[]> {
  const remote = spawnSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' }).stdout.trim();
  const repo = repoFromRemote(remote);
  if (!repo || !process.env.GH_TOKEN) throw new Error('GitHub 저장소 주소나 GH_TOKEN 이 없습니다');
  const res = await fetch(`https://api.github.com/repos/${repo}/actions/runs?per_page=100`, {
    headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'cheongyak-ops' },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const body = await res.json() as { workflow_runs: (RunInfo & { path: string })[] };
  return body.workflow_runs.map((r) => ({ ...r, name: r.path.replace(/^.*\//, '').replace(/\.ya?ml$/, '') }));
}

async function liveCheck(base: string, path: string): Promise<string> {
  try {
    const res = await fetch(`${base}${encodeURI(path)}`, { headers: { 'User-Agent': 'cheongyak-ops-check' }, redirect: 'manual' });
    const type = res.headers.get('content-type') ?? '';
    let note = '';
    if (type.includes('html')) {
      const html = await res.text();
      const title = html.match(/<title>([^<]*)<\/title>/)?.[1]?.trim() ?? '(제목 없음)';
      const notice = html.includes('참고용이며 최종 자격과 가격은') ? '' : ' · 안내 문구 없음';
      note = ` — ${title.slice(0, 50)}${notice}`;
    } else {
      await res.arrayBuffer();
    }
    const ok = res.status === 200 || (path === '/calendar' && res.status === 302);
    return `${ok ? '✓' : '✗'} ${res.status} ${path}${note}`;
  } catch (e) {
    return `✗ 실패 ${path} — ${(e as Error).message}`;
  }
}

async function section(title: string, body: () => Promise<string[]>): Promise<void> {
  console.log(`\n## ${title}`);
  try {
    for (const line of await body()) console.log(line);
  } catch (e) {
    console.log(`(확인 못 함) ${(e as Error).message}`);
  }
}

const parse = <T>(s: string | null): T | null => { try { return s ? JSON.parse(s) as T : null; } catch { return null; } };

async function main() {
  const { values } = parseArgs({ options: { date: { type: 'string' }, 'write-log': { type: 'boolean', default: false } } });
  const date = values.date ?? yesterdayKst(new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`날짜 형식은 YYYY-MM-DD: ${date}`);
  console.log(`# ${SITE.name} 매일 점검 — ${date} (한국 날짜)`);

  await section('방문 (Cloudflare RUM, 표본 추정치)', async () => {
    const s = summarizeRum(await rumDay(date));
    const past = await Promise.all(previousDays(date, 7).map(rumTotals));
    const avg = (k: 'visits' | 'views') => (past.reduce((a, p) => a + p[k], 0) / past.length).toFixed(1);
    const ids = s.topPages.map((p) => p.path.match(/^\/apt\/([0-9A-Za-z_-]+)$/)?.[1]).filter((x): x is string => !!x);
    const names: Record<string, string> = {};
    if (ids.length) {
      for (const r of d1Query<{ pblanc_no: string; name: string }>(`SELECT pblanc_no, name FROM apt_notice WHERE pblanc_no IN (${ids.map((i) => `'${i}'`).join(',')})`, 'remote')) names[r.pblanc_no] = r.name;
    }
    const row = logRow(date, s, names);
    const lines = [
      `방문 ${s.visits} · 조회 ${s.views} (앞 7일 평균 방문 ${avg('visits')} · 조회 ${avg('views')})`,
      `유입(방문): ${Object.entries(s.referers).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') || '없음'}`,
      `기기(방문): ${Object.entries(s.devices).map(([k, v]) => `${k} ${v}`).join(', ') || '없음'}`,
      `탭별 조회: ${Object.entries(s.tabs).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') || '없음'}`,
      `기록 줄: ${row}`,
    ];
    if (values['write-log']) {
      const next = appendLogRow(existsSync(LOG_PATH) ? readFileSync(LOG_PATH, 'utf8') : null, date, row);
      if (next === null) lines.push(`${LOG_PATH}: 이미 ${date} 줄이 있어 그대로 둠`);
      else { writeFileSync(LOG_PATH, next); lines.push(`${LOG_PATH}: ${date} 줄을 붙임`); }
    }
    return lines;
  });

  await section('Cloudflare 사용량 (무료 한도 대비)', async () => {
    const u = await cfUsage(date);
    const w = u.workersInvocationsAdaptive;
    const requests = w.reduce((a, r) => a + r.sum.requests, 0);
    const errors = w.reduce((a, r) => a + r.sum.errors, 0);
    const d1 = u.d1AnalyticsAdaptiveGroups.reduce((a, r) => ({ read: a.read + r.sum.rowsRead, written: a.written + r.sum.rowsWritten }), { read: 0, written: 0 });
    // 동기화가 남긴 그날(UTC) 사용량 — 동기화 기록은 UTC 날짜라 date 와 하루 어긋날 수 있다
    const kv = parse<KvManifest>(kvGetText('meta:kvhash', 'remote'));
    const d1Sync = parse<{ date: string; used: number }>(kvGetText('meta:d1rows', 'remote'));
    return [
      limitLine('Worker 요청', requests, 100_000),
      `Worker 오류 ${errors}건 · CPU(ms) 중앙값·p99: ${w.map((r) => `${r.dimensions.status} ${(r.quantiles.cpuTimeP50 / 1000).toFixed(1)}·${(r.quantiles.cpuTimeP99 / 1000).toFixed(1)}`).join(', ') || '-'}`,
      limitLine('D1 읽은 행', d1.read, 5_000_000),
      limitLine('D1 쓴 행', d1.written, 100_000),
      limitLine(`KV 쓰기(동기화 기록 ${kv?.date ?? '-'})`, dayUsage(kv, kv?.date ?? ''), 1_000),
      limitLine(`D1 쓴 행(동기화 기록 ${d1Sync?.date ?? '-'})`, dayUsage(d1Sync, d1Sync?.date ?? ''), 100_000),
    ];
  });

  await section('자동 작업 (GitHub Actions 최근 100회 안)', async () => {
    const latest = actionsLatest(await actionRuns()).filter((a) => WORKFLOWS.includes(a.name));
    const missing = WORKFLOWS.filter((n) => !latest.some((a) => a.name === n));
    return [
      ...latest.map((a) => `${a.latest === 'success' ? '✓' : a.latest === 'failure' ? '✗' : '…'} ${a.name}: 최근 ${a.latest} (${a.at})${a.failures ? ` · 실패 ${a.failures}회` : ''}`),
      ...missing.map((n) => `- ${n}: 최근 100회 안에 실행 없음`),
    ];
  });

  await section('실서버 응답', async () => {
    const base = (process.env.SITE_URL ?? SITE.url).replace(/\/$/, '');
    return Promise.all(LIVE_PATHS.map((p) => liveCheck(base, p)));
  });
}

await main();
