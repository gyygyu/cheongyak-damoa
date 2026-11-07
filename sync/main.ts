// 동기화 진입점 (spec §4·§10): npm run sync -- --target local|remote [--fixtures sync/fixtures] [--dry-run] [--today YYYY-MM-DD]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import type { DbRow } from '../src/lib/raw';
import { buildLawdIndex, resolveAddress, type LawdTable } from '../src/lib/region/lawd';
import { extractJibun } from '../src/lib/region/jibun';
import { matchLh } from '../src/lib/apt/lh-match';
import { matchPresale, type NoticeLoc } from '../src/lib/trade/presale-match';
import { addMonths, todayKst } from '../src/lib/date';
import { upsertSql, type Row } from './sql';
import { withHash, keyBy, diffRows, hashQuerySql, guardCount } from './diff';
import { redactKeys, getText } from './http';
import { buildBundles, selectKvWrites, type Dataset, type KvManifest } from './bundles';
import { collectApplyhome, collectCompetition, collectLh, collectTrades, collectAccount, minHouseNo, type Fetch, type TradeJob } from './collect';
import { fixtureFetch } from './fixture-fetch';
import { nextMeta, ALERT_AFTER, type SourceMeta } from './failures';
import { nextBackfill, sigunguCodes, recentMonths, type BackfillState } from './backfill';
import { wranglerStore, type Store } from './store';

export const TABLES: Record<string, string[]> = {
  apt_notice: ['pblanc_no'],
  apt_model: ['pblanc_no', 'model_no'],
  apt_competition: ['pblanc_no', 'model_no', 'rank', 'residence'],
  apt_special_status: ['pblanc_no', 'model_no', 'special_type', 'residence'],
  trade: ['trade_key'],
  presale_trade: ['trade_key'],
  presale_link: ['trade_key'],
  lh_notice: ['lh_id'],
  lh_supply: ['lh_id', 'supply_type', 'house_ty'],
  account_stats: ['base_month', 'region', 'account_kind', 'area_kind'],
};

const SOURCES = ['applyhome', 'competition', 'lh', 'trade', 'account'] as const;
type SourceName = (typeof SOURCES)[number];
const ROW_CAP = 70_000;
const BACKFILL_PER_RUN = 60;
const TRADE_EMPTY_MIN_JOBS = 10;

export interface SyncReport {
  sources: Record<SourceName, SourceMeta & { applied: boolean; reason?: string }>;
  rowsWritten: number; kvPut: number; kvDeferred: number; alerts: string[];
}

export interface SyncOptions { store: Store; fetch: Fetch; keys: string[]; today: string; now: string; lawdTable: LawdTable; backfillMax?: number }

const sqlList = (vals: string[]) => vals.map((v) => `'${v.replace(/'/g, "''")}'`).join(', ');
const parse = <T>(v: string | null): T | null => (v ? (JSON.parse(v) as T) : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

class Guarded extends Error {}

export async function runSync(o: SyncOptions): Promise<SyncReport> {
  const { store, fetch, keys, today, now } = o;
  const idx = buildLawdIndex(o.lawdTable);
  const metas = parse<Record<string, SourceMeta>>(await store.kvGet('meta:sources')) ?? {};
  const report: SyncReport = { sources: {} as SyncReport['sources'], rowsWritten: 0, kvPut: 0, kvDeferred: 0, alerts: [] };
  const changedLawds = new Set<string>();

  async function apply(table: string, rows: DbRow[], where = ''): Promise<void> {
    const keyCols = TABLES[table];
    const hashed = rows.map((r) => withHash(r as Row, now));
    const prev = new Map((await store.query<{ k: string; hash: string }>(`${hashQuerySql(table, keyCols)}${where}`)).map((r) => [r.k, r.hash]));
    let changed = diffRows(hashed, keyBy(keyCols), prev);
    const room = Math.max(0, ROW_CAP - report.rowsWritten);
    if (changed.length > room) changed = changed.slice(0, room);
    if (table === 'trade') for (const r of changed) changedLawds.add(String(r.lawd_cd));
    await store.exec(upsertSql(table, keyCols, changed));
    report.rowsWritten += changed.length;
  }

  function guard(name: SourceName, count: number): void {
    const g = guardCount(count, metas[name]?.lastCount ?? null);
    if (!g.ok) throw new Guarded(g.reason);
  }

  async function source(name: SourceName, run: () => Promise<number>): Promise<boolean> {
    try {
      const count = await run();
      metas[name] = nextMeta(metas[name], { ok: true, count }, now);
      report.sources[name] = { ...metas[name], applied: true };
      return true;
    } catch (err) {
      const msg = redactKeys(err instanceof Error ? err.message : String(err), keys);
      metas[name] = nextMeta(metas[name], { ok: false, error: msg }, now);
      report.sources[name] = { ...metas[name], applied: false, reason: msg };
      if (metas[name].failures === ALERT_AFTER) report.alerts.push(`${name}: ${ALERT_AFTER}회 연속 실패 — ${msg}`);
      return false;
    }
  }

  const key = keys[0] ?? '';
  const noticesInDb = () => store.query<DbRow>('SELECT * FROM apt_notice');

  await source('applyhome', async () => {
    const r = await collectApplyhome(fetch, key, today, idx);
    guard('applyhome', r.notices.length);
    await apply('apt_notice', r.notices);
    await apply('apt_model', r.models);
    return r.notices.length;
  });

  await source('competition', async () => {
    const notices = (await noticesInDb()).filter((n) => (str(n.notice_date) ?? '') >= addMonths(today, -2));
    const models = await store.query<DbRow>('SELECT pblanc_no, model_no, house_ty FROM apt_model');
    const byTy = new Map(models.map((m) => [`${m.pblanc_no}|${m.house_ty}`, String(m.model_no)]));
    const r = await collectCompetition(fetch, key, minHouseNo(notices), (p, ty) => byTy.get(`${p}|${ty}`) ?? null);
    guard('competition', r.competition.length + r.special.length);
    await apply('apt_competition', r.competition);
    await apply('apt_special_status', r.special);
    return r.competition.length + r.special.length;
  });

  await source('lh', async () => {
    const r = await collectLh(fetch, key, idx);
    guard('lh', r.notices.length);
    const apt = (await noticesInDb()).map((n) => ({ pblancNo: String(n.pblanc_no), lawdCd: str(n.lawd_cd), noticeDate: str(n.notice_date), name: String(n.name) }));
    const rows = r.notices.map((n) => ({
      ...n,
      pblanc_no: n.kind === 'sale'
        ? matchLh({ id: String(n.lh_id), kind: 'sale', lawdCd: str(n.lawd_cd), noticeDate: str(n.posted_date), name: String(n.title) }, apt, idx.cityOf)
        : null,
    }));
    await apply('lh_notice', rows);
    await apply('lh_supply', r.supply);
    return r.notices.length;
  });

  const backfillPrev = parse<BackfillState>(await store.kvGet('backfill:trade'));
  let backfillNext = backfillPrev;
  await source('trade', async () => {
    const lawds = [...new Set((await noticesInDb()).map((n) => str(n.lawd_cd)).filter((v): v is string => v !== null))];
    const recent: TradeJob[] = lawds.flatMap((lawd) => recentMonths(today).map((ym) => ({ lawd, ym })));
    const bf = nextBackfill(backfillPrev, sigunguCodes(o.lawdTable), today, o.backfillMax ?? BACKFILL_PER_RUN);
    const jobs = [...recent, ...bf.jobs];
    const r = await collectTrades(fetch, key, jobs);
    if (jobs.length >= TRADE_EMPTY_MIN_JOBS && r.trades.length === 0) throw new Guarded(`작업 ${jobs.length}개에서 0건`);
    const lawdsTouched = [...new Set(r.trades.map((t) => String(t.lawd_cd)))];
    await apply('trade', r.trades, lawdsTouched.length ? ` WHERE lawd_cd IN (${sqlList(lawdsTouched)})` : ' WHERE 0');
    await apply('presale_trade', r.presale);
    const locs: NoticeLoc[] = (await noticesInDb()).map((n) => {
      const res = str(n.address) ? resolveAddress(idx, String(n.address)) : null;
      return { pblancNo: String(n.pblanc_no), lawdCd: str(n.lawd_cd), dong: str(n.dong), jibun: res ? extractJibun(res.rest) : null, name: String(n.name) };
    });
    const links = r.presale.map((p) => {
      const m = matchPresale({ sggCd: String(p.sgg_cd ?? ''), dong: String(p.dong ?? ''), jibun: String(p.jibun ?? ''), name: String(p.name ?? '') }, locs, idx.cityOf);
      return { trade_key: p.trade_key, pblanc_no: m.pblancNo, method: m.method };
    });
    await apply('presale_link', links);
    backfillNext = bf.state;
    return r.trades.length + r.presale.length;
  });

  await source('account', async () => {
    const rows = await collectAccount(fetch, key, today);
    guard('account', rows.length);
    await apply('account_stats', rows);
    return rows.length;
  });

  // 묶음: D1 에서 다시 읽는다 (실패한 출처는 직전 값)
  const from = addMonths(today, -12);
  const notices = await store.query<DbRow>(`SELECT * FROM apt_notice WHERE notice_date >= '${from}' OR notice_date IS NULL`);
  const inNotices = `pblanc_no IN (SELECT pblanc_no FROM apt_notice WHERE notice_date >= '${from}' OR notice_date IS NULL)`;
  const scope = new Set<string>(changedLawds);
  for (const n of notices) {
    const l = str(n.lawd_cd);
    if (!l) continue;
    scope.add(l);
    const city = idx.cityOf.get(l) ?? l;
    scope.add(city);
    for (const [gu, c] of idx.cityOf) if (c === city) scope.add(gu);
  }
  const lhNotices = await store.query<DbRow>(`SELECT * FROM lh_notice WHERE posted_date >= '${from}' OR posted_date IS NULL`);
  const ds: Dataset = {
    notices,
    models: await store.query<DbRow>(`SELECT * FROM apt_model WHERE ${inNotices}`),
    competition: await store.query<DbRow>(`SELECT * FROM apt_competition WHERE ${inNotices}`),
    special: await store.query<DbRow>(`SELECT * FROM apt_special_status WHERE ${inNotices}`),
    trades: scope.size ? await store.query<DbRow>(`SELECT * FROM trade WHERE lawd_cd IN (${sqlList([...scope])}) AND contract_date >= '${from}'`) : [],
    presaleLinks: await store.query<DbRow>(`SELECT * FROM presale_link WHERE pblanc_no IS NOT NULL AND ${inNotices}`),
    presale: await store.query<DbRow>(`SELECT * FROM presale_trade WHERE trade_key IN (SELECT trade_key FROM presale_link WHERE pblanc_no IS NOT NULL AND ${inNotices})`),
    lhNotices,
    lhSupply: await store.query<DbRow>(`SELECT * FROM lh_supply WHERE lh_id IN (SELECT lh_id FROM lh_notice WHERE posted_date >= '${from}' OR posted_date IS NULL)`),
    account: await store.query<DbRow>('SELECT * FROM account_stats'),
  };
  const bundles = buildBundles(ds, { today, cityOf: idx.cityOf });
  const prevManifest = parse<KvManifest>(await store.kvGet('meta:kvhash'));
  const sel = selectKvWrites(bundles, prevManifest, { today });
  await store.kvPut([
    ...sel.put,
    { key: 'meta:sources', value: JSON.stringify(metas) },
    { key: 'backfill:trade', value: JSON.stringify(backfillNext ?? { base: '', index: 0 }) },
    { key: 'meta:kvhash', value: JSON.stringify(sel.manifest) },
  ]);
  report.kvPut = sel.put.length;
  report.kvDeferred = sel.deferred.length;
  return report;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const target = arg('target') === 'remote' ? 'remote' : 'local';
  const fixtures = arg('fixtures');
  const dryRun = process.argv.includes('--dry-run');
  const key = process.env.DATA_GO_KR_KEY ?? '';
  if (!fixtures && !key) throw new Error('DATA_GO_KR_KEY 가 없습니다 (.env 또는 GitHub Secrets)');
  const outDir = 'sync/.out';
  mkdirSync(outDir, { recursive: true });
  const report = await runSync({
    store: wranglerStore(target, outDir, dryRun),
    fetch: fixtures ? fixtureFetch(fixtures) : (url) => getText(url, [key]),
    keys: fixtures ? [] : [key],
    today: arg('today') ?? todayKst(),
    now: new Date().toISOString(),
    lawdTable: JSON.parse(readFileSync('content/lawd/lawd.json', 'utf8')),
    backfillMax: fixtures ? 100_000 : undefined,
  });
  writeFileSync(`${outDir}/report.json`, JSON.stringify(report, null, 2));
  if (report.alerts.length) writeFileSync(`${outDir}/alerts.json`, report.alerts.join('\n'));
  for (const [name, s] of Object.entries(report.sources)) console.log(`${name}: ${s.applied ? '반영' : `건너뜀 (${s.reason})`}`);
  console.log(`D1 ${report.rowsWritten}행, KV ${report.kvPut}건 (미룸 ${report.kvDeferred})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(redactKeys(err instanceof Error ? err.message : String(err), [process.env.DATA_GO_KR_KEY ?? '']));
    process.exit(1);
  });
}
