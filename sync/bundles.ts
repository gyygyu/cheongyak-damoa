// D1 행 → 화면용 KV 묶음 (spec §6), 바뀐 묶음만 고르는 쓰기 예산 (spec §10). 순수 함수
import type { DbRow } from '../src/lib/raw';
import { aptPhase, type AptSchedule } from '../src/lib/apt/status';
import { aptEvents, groupByMonth, type CalendarEvent } from '../src/lib/apt/schedule';
import { nearbyPrice, type TradeRecord } from '../src/lib/trade/nearby';
import { SIDO_ALIAS } from '../src/lib/region/lawd';
import { addMonths } from '../src/lib/date';
import { fnv64 } from '../src/lib/hash';

export interface Dataset {
  notices: DbRow[]; models: DbRow[]; competition: DbRow[]; special: DbRow[];
  trades: DbRow[]; presale: DbRow[]; presaleLinks: DbRow[];
  lhNotices: DbRow[]; lhSupply: DbRow[]; account: DbRow[];
}
export interface KvWrite { key: string; value: string }
export interface BundleCtx { today: string; cityOf: ReadonlyMap<string, string> }

export const MAX_VALUE_BYTES = 50_000;
const HOME_DAYS = 7;
const TOP_N = 10;
const COMPETITION_MAX = 200;

const s = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const n = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const bytes = (v: string): number => new TextEncoder().encode(v).length;

function strip(r: DbRow): DbRow {
  const { hash: _h, updated_at: _u, ...rest } = r;
  return rest;
}

function groupBy(rows: DbRow[], key: (r: DbRow) => string | null): Map<string, DbRow[]> {
  const out = new Map<string, DbRow[]>();
  for (const r of rows) {
    const k = key(r);
    if (k === null) continue;
    const list = out.get(k);
    if (list) list.push(r);
    else out.set(k, [r]);
  }
  return out;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function scheduleOf(r: DbRow): AptSchedule {
  return {
    specialStart: s(r.special_start), specialEnd: s(r.special_end),
    rank1Start: s(r.rank1_start), rank1End: s(r.rank1_end),
    rank2Start: s(r.rank2_start), rank2End: s(r.rank2_end),
    winnerDate: s(r.winner_date), contractStart: s(r.contract_start), contractEnd: s(r.contract_end),
  };
}

const stateOf = (v: unknown): 'normal' | 'corrected' | 'cancelled' => (v === 'corrected' || v === 'cancelled' ? v : 'normal');

export function fitValue(obj: Record<string, unknown>, listKey: string): string {
  let json = JSON.stringify(obj);
  if (bytes(json) < MAX_VALUE_BYTES) return json;
  const list = [...((obj[listKey] as unknown[] | undefined) ?? [])];
  while (list.length > 0) {
    list.length = Math.min(list.length - 1, Math.floor(list.length * 0.9));
    json = JSON.stringify({ ...obj, [listKey]: list, truncated: true });
    if (bytes(json) < MAX_VALUE_BYTES) return json;
  }
  throw new Error(`KV 값이 50KB 를 넘음 (${listKey} 를 다 덜어도)`);
}

const toTradeRecord = (r: DbRow): TradeRecord => ({
  lawdCd: s(r.lawd_cd) ?? '', dong: s(r.dong) ?? '', area: n(r.area) ?? 0, contractDate: s(r.contract_date) ?? '',
  amount: n(r.amount) ?? 0, buildYear: n(r.build_year), cancelled: r.cancelled === 1,
});

interface CompSummary { pblancNo: string; name: string | null; sido: string | null; sigungu: string | null; noticeDate: string | null; maxRate: number | null; applicants: number; supply: number }

function competitionSummaries(ds: Dataset): CompSummary[] {
  const byNotice = groupBy(ds.competition, (r) => s(r.pblanc_no));
  const out: CompSummary[] = [];
  for (const nt of ds.notices) {
    const rows = byNotice.get(s(nt.pblanc_no) ?? '');
    if (!rows) continue;
    const rates = rows.map((r) => n(r.rate)).filter((v): v is number => v !== null);
    out.push({
      pblancNo: s(nt.pblanc_no)!, name: s(nt.name), sido: s(nt.sido), sigungu: s(nt.sigungu), noticeDate: s(nt.notice_date),
      maxRate: rates.length ? Math.max(...rates) : null,
      applicants: rows.reduce((a, r) => a + (n(r.applicants) ?? 0), 0),
      supply: rows.reduce((a, r) => a + (n(r.supply_count) ?? 0), 0),
    });
  }
  return out.sort((a, b) => (b.noticeDate ?? '').localeCompare(a.noticeDate ?? '') || a.pblancNo.localeCompare(b.pblancNo));
}

function lhEvent(r: DbRow): CalendarEvent[] {
  const start = s(r.receipt_start);
  if (!start) return [];
  const end = s(r.receipt_end);
  return [{ date: start, ...(end && end !== start ? { endDate: end } : {}), kind: 'lh-receipt', ref: `lh:${s(r.lh_id)}`, title: s(r.title) ?? '' }];
}

function sidoOfRegion(region: string): string {
  const w = region.split(' ')[0];
  return SIDO_ALIAS[w] ?? w;
}

export function buildBundles(ds: Dataset, ctx: BundleCtx): KvWrite[] {
  const { today, cityOf } = ctx;
  const out: KvWrite[] = [];
  const put = (key: string, obj: Record<string, unknown>, listKey: string) => out.push({ key, value: fitValue(obj, listKey) });

  const tradeFrom = addMonths(today, -12);
  const recentTrades = ds.trades.filter((r) => (s(r.contract_date) ?? '') >= tradeFrom && (s(r.contract_date) ?? '') <= today);
  const tradeRecords = recentTrades.map(toTradeRecord);
  const modelsBy = groupBy(ds.models, (r) => s(r.pblanc_no));
  const compBy = groupBy(ds.competition, (r) => s(r.pblanc_no));
  const specialBy = groupBy(ds.special, (r) => s(r.pblanc_no));
  const presaleByKey = new Map(ds.presale.map((r) => [s(r.trade_key) ?? '', r]));
  const presaleBy = groupBy(ds.presaleLinks, (r) => s(r.pblanc_no));
  const lhBy = groupBy(ds.lhNotices, (r) => s(r.pblanc_no));
  const lhSupplyBy = groupBy(ds.lhSupply, (r) => s(r.lh_id));
  const unmatchedLh = ds.lhNotices.filter((r) => s(r.pblanc_no) === null);

  // apt:{공고번호}
  const phaseOf = new Map<string, string>();
  for (const nt of ds.notices) {
    const no = s(nt.pblanc_no);
    if (!no) continue;
    const { phase, corrected } = aptPhase(scheduleOf(nt), stateOf(nt.state), today);
    phaseOf.set(no, phase);
    const lawdCd = s(nt.lawd_cd);
    const models = (modelsBy.get(no) ?? []).map((m) => {
      const area = n(m.area_excl);
      return { ...strip(m), nearby: lawdCd && area !== null ? nearbyPrice({ lawdCd, dong: s(nt.dong), area }, tradeRecords, today, cityOf) : null };
    });
    const presale = (presaleBy.get(no) ?? [])
      .map((l) => presaleByKey.get(s(l.trade_key) ?? ''))
      .filter((r): r is DbRow => r !== undefined)
      .map(strip)
      .sort((a, b) => (s(b.contract_date) ?? '').localeCompare(s(a.contract_date) ?? ''));
    put(`apt:${no}`, {
      notice: strip(nt), phase, corrected, models,
      competition: (compBy.get(no) ?? []).map(strip),
      special: (specialBy.get(no) ?? []).map(strip),
      lhLinks: (lhBy.get(no) ?? []).map((l) => ({ lhId: s(l.lh_id), title: s(l.title), url: s(l.url) })),
      presale,
    }, 'presale');
  }

  // lh:{ID} — 청약홈 공고와 못 맞춘 LH 공고
  for (const lh of unmatchedLh) {
    const id = s(lh.lh_id);
    if (!id) continue;
    put(`lh:${id}`, { notice: strip(lh), supply: (lhSupplyBy.get(id) ?? []).map(strip) }, 'supply');
  }

  // calendar:YYYY-MM
  const events: CalendarEvent[] = [
    ...ds.notices.flatMap((nt) => aptEvents(`apt:${s(nt.pblanc_no)}`, s(nt.name) ?? '', scheduleOf(nt))),
    ...unmatchedLh.flatMap(lhEvent),
  ];
  for (const [month, list] of Object.entries(groupByMonth(events))) put(`calendar:${month}`, { month, events: list }, 'events');

  // home, competition
  const until = addDays(today, HOME_DAYS);
  const homeEvents = [...events]
    .filter((e) => e.date <= until && (e.endDate ?? e.date) >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.ref.localeCompare(b.ref));
  const summaries = competitionSummaries(ds);
  const recentFrom = addMonths(today, -2);
  const top = summaries
    .filter((c) => c.maxRate !== null && (c.noticeDate ?? '') >= recentFrom)
    .sort((a, b) => (b.maxRate ?? 0) - (a.maxRate ?? 0))
    .slice(0, TOP_N);
  put('home', { today, events: homeEvents, topCompetition: top }, 'events');
  put('competition', { items: summaries.slice(0, COMPETITION_MAX) }, 'items');

  // stats:account (최신 기준월)
  const latest = ds.account.reduce((m, r) => ((s(r.base_month) ?? '') > m ? (s(r.base_month) ?? '') : m), '');
  const accountRows = ds.account.filter((r) => s(r.base_month) === latest).map(strip);
  put('stats:account', { baseMonth: latest || null, rows: accountRows }, 'rows');

  // region:{시도}, region:{시도}:{시군구}
  const noticeSummary = (nt: DbRow) => ({ pblancNo: s(nt.pblanc_no), name: s(nt.name), sigungu: s(nt.sigungu), noticeDate: s(nt.notice_date), phase: phaseOf.get(s(nt.pblanc_no) ?? '') ?? null });
  const bySido = groupBy(ds.notices, (r) => s(r.sido));
  for (const [sido, list] of bySido) {
    put(`region:${sido}`, {
      sido,
      notices: list.map(noticeSummary).sort((a, b) => (b.noticeDate ?? '').localeCompare(a.noticeDate ?? '')),
      account: accountRows.filter((r) => sidoOfRegion(s(r.region) ?? '') === sido),
    }, 'notices');
  }
  const tradesByLawd = groupBy(recentTrades, (r) => s(r.lawd_cd));
  const bySigungu = groupBy(ds.notices, (r) => (s(r.sido) && s(r.sigungu) ? `${s(r.sido)}:${s(r.sigungu)}` : null));
  for (const [key, list] of bySigungu) {
    const lawds = [...new Set(list.map((r) => s(r.lawd_cd)).filter((v): v is string => v !== null))];
    const dongs = lawds.flatMap((lawdCd) =>
      [...groupBy(tradesByLawd.get(lawdCd) ?? [], (r) => s(r.dong))].map(([dong, rows]) => ({
        lawdCd, dong, count: rows.length,
        last: rows.reduce((m, r) => ((s(r.contract_date) ?? '') > m ? (s(r.contract_date) ?? '') : m), ''),
      })),
    ).sort((a, b) => b.count - a.count || a.dong.localeCompare(b.dong));
    put(`region:${key}`, { notices: list.map(noticeSummary), dongs }, 'dongs');
  }

  // trade:{시군구코드}:{법정동}
  for (const [k, rows] of groupBy(recentTrades, (r) => (s(r.lawd_cd) && s(r.dong) ? `${s(r.lawd_cd)}:${s(r.dong)}` : null))) {
    const [lawdCd, dong] = k.split(':');
    const complexes = [...groupBy(rows, (r) => s(r.name))].map(([name, list]) => ({
      name,
      buildYear: n(list[0].build_year),
      trades: list
        .map((r) => ({ date: s(r.contract_date), area: n(r.area), floor: n(r.floor), amount: n(r.amount), cancelled: r.cancelled === 1 }))
        .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')),
    })).sort((a, b) => (b.trades[0].date ?? '').localeCompare(a.trades[0].date ?? '') || a.name.localeCompare(b.name));
    put(`trade:${k}`, { lawdCd, dong, complexes }, 'complexes');
  }

  return out;
}

export interface KvManifest { date: string; used: number; hashes: Record<string, string> }

export function selectKvWrites(
  writes: KvWrite[],
  prev: KvManifest | null,
  opts: { today: string; budget?: number; dailyCap?: number; reserve?: number },
): { put: KvWrite[]; deferred: string[]; manifest: KvManifest } {
  const budget = opts.budget ?? 400;
  const dailyCap = opts.dailyCap ?? 800;
  const reserve = opts.reserve ?? 3;
  const used = prev && prev.date === opts.today ? prev.used : 0;
  const hashes = { ...(prev?.hashes ?? {}) };
  const changed = writes.map((w) => ({ w, h: fnv64(w.value) })).filter(({ w, h }) => hashes[w.key] !== h);
  const ordered = [...changed.filter(({ w }) => !w.key.startsWith('trade:')), ...changed.filter(({ w }) => w.key.startsWith('trade:'))];
  const put: KvWrite[] = [];
  const deferred: string[] = [];
  for (const { w, h } of ordered) {
    const isTrade = w.key.startsWith('trade:');
    const fits = put.length + reserve < budget && (!isTrade || used + put.length + 1 + reserve < dailyCap);
    if (!fits) {
      deferred.push(w.key);
      continue;
    }
    put.push(w);
    hashes[w.key] = h;
  }
  return { put, deferred, manifest: { date: opts.today, used: used + put.length + reserve, hashes } };
}
