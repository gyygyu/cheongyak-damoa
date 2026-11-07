// 출처별 수집 (spec §3). fetch 는 주입한다 — 실서버는 sync/http.ts getText, 시험은 sync/fixture-fetch.ts
import { serviceKeyParam } from './http';
import type { Raw, DbRow } from '../src/lib/raw';
import type { LawdIndex } from '../src/lib/region/lawd';
import { addMonths } from '../src/lib/date';
import { toNoticeRow, toModelRow } from '../src/lib/apt/notice-transform';
import { toCompetitionRow, toSpecialStatusRows } from '../src/lib/apt/competition-transform';
import { parseMolitXml, toTradeRows, toPresaleRows } from '../src/lib/trade/trade-transform';
import { mergeLh, lhListItems, toLhNoticeRow, toLhSupplyRows } from '../src/lib/apt/lh-transform';
import { toAccountRows } from '../src/lib/apt/account-transform';

export type Fetch = (url: string) => Promise<{ status: number; body: string }>;

const OD = 'https://api.odcloud.kr/api';
const MOLIT = 'https://apis.data.go.kr/1613000';
const LH = 'https://apis.data.go.kr/B552555';
const PER_PAGE = 500;
const MOLIT_ROWS = 1000;
const LH_PAGE = 50;

async function getBody(fetch: Fetch, url: string): Promise<string> {
  const r = await fetch(url);
  if (r.status !== 200) throw new Error(`HTTP ${r.status}: ${r.body.slice(0, 200)}`);
  return r.body;
}

async function getJson(fetch: Fetch, url: string): Promise<unknown> {
  const body = await getBody(fetch, url);
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`JSON 아님: ${body.slice(0, 200)}`);
  }
}

export async function odcloudAll(fetch: Fetch, key: string, path: string, cond: Record<string, string>, maxPages = 20): Promise<Raw[]> {
  const conds = Object.entries(cond).map(([k, v]) => `&${encodeURIComponent(`cond[${k}]`)}=${encodeURIComponent(v)}`).join('');
  const out: Raw[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const j = (await getJson(fetch, `${OD}/${path}?serviceKey=${serviceKeyParam(key)}&page=${page}&perPage=${PER_PAGE}${conds}`)) as { data?: unknown; matchCount?: unknown };
    const data = Array.isArray(j.data) ? (j.data as Raw[]) : [];
    out.push(...data);
    const total = typeof j.matchCount === 'number' ? j.matchCount : 0;
    if (data.length === 0 || out.length >= total) return out;
  }
  throw new Error(`${path}: 페이지 상한 ${maxPages} 초과`);
}

const notNull = <T>(v: T | null): v is T => v !== null;

export async function collectApplyhome(fetch: Fetch, key: string, today: string, idx: LawdIndex): Promise<{ notices: DbRow[]; models: DbRow[] }> {
  const raws = await odcloudAll(fetch, key, 'ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancDetail', { 'RCRIT_PBLANC_DE::GTE': addMonths(today, -2) });
  const notices = raws.map((r) => toNoticeRow(r, idx)).filter(notNull);
  if (notices.length === 0) return { notices, models: [] };
  const minNo = minHouseNo(notices);
  const models = (await odcloudAll(fetch, key, 'ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancMdl', { 'HOUSE_MANAGE_NO::GTE': minNo }))
    .map(toModelRow).filter(notNull);
  return { notices, models };
}

export function minHouseNo(notices: DbRow[]): string {
  return notices.map((n) => String(n.house_manage_no ?? '')).filter(Boolean).sort()[0] ?? '0';
}

export async function collectCompetition(
  fetch: Fetch, key: string, minNo: string, modelNoOf: (pblancNo: string, houseTy: string) => string | null,
): Promise<{ competition: DbRow[]; special: DbRow[] }> {
  const cond = { 'HOUSE_MANAGE_NO::GTE': minNo };
  const competition = (await odcloudAll(fetch, key, 'ApplyhomeInfoCmpetRtSvc/v1/getAPTLttotPblancCmpet', cond)).map(toCompetitionRow).filter(notNull);
  const special = (await odcloudAll(fetch, key, 'ApplyhomeInfoCmpetRtSvc/v1/getAPTSpsplyReqstStus', cond)).flatMap((r) => toSpecialStatusRows(r, modelNoOf));
  return { competition, special };
}

export async function collectLh(fetch: Fetch, key: string, idx: LawdIndex): Promise<{ notices: DbRow[]; supply: DbRow[] }> {
  const k = serviceKeyParam(key);
  const notices: DbRow[] = [];
  const supply: DbRow[] = [];
  for (const tp of ['05', '06']) {
    const list = lhListItems(await getJson(fetch, `${LH}/lhLeaseNoticeInfo1/lhLeaseNoticeInfo1?serviceKey=${k}&PG_SZ=${LH_PAGE}&PAGE=1&UPP_AIS_TP_CD=${tp}`));
    for (const item of list) {
      const q = ['SPL_INF_TP_CD', 'CCR_CNNT_SYS_DS_CD', 'PAN_ID', 'UPP_AIS_TP_CD']
        .map((f) => `&${f}=${encodeURIComponent(String(item[f] ?? ''))}`).join('');
      const detail = await getJson(fetch, `${LH}/lhLeaseNoticeDtlInfo1/getLeaseNoticeDtlInfo1?serviceKey=${k}${q}`).then(mergeLh, () => null);
      const row = toLhNoticeRow(item, detail, idx);
      if (!row) continue;
      notices.push(row);
      const spl = await getJson(fetch, `${LH}/lhLeaseNoticeSplInfo1/getLeaseNoticeSplInfo1?serviceKey=${k}${q}`).then(mergeLh, () => null);
      if (spl) supply.push(...toLhSupplyRows(String(row.lh_id), spl));
    }
  }
  return { notices, supply };
}

export interface TradeJob { lawd: string; ym: string }

async function molitAll(fetch: Fetch, key: string, path: string, job: TradeJob): Promise<Raw[]> {
  const out: Raw[] = [];
  for (let page = 1; page <= 50; page++) {
    const xml = await getBody(fetch, `${MOLIT}/${path}?serviceKey=${serviceKeyParam(key)}&LAWD_CD=${job.lawd}&DEAL_YMD=${job.ym}&numOfRows=${MOLIT_ROWS}&pageNo=${page}`);
    const r = parseMolitXml(xml);
    if (r.resultCode !== '000' && r.resultCode !== '00') throw new Error(`${path} ${job.lawd}/${job.ym}: resultCode ${r.resultCode}`);
    out.push(...r.items);
    if (r.items.length === 0 || out.length >= r.totalCount) return out;
  }
  throw new Error(`${path} ${job.lawd}/${job.ym}: 페이지 상한 초과`);
}

export async function collectTrades(fetch: Fetch, key: string, jobs: TradeJob[]): Promise<{ trades: DbRow[]; presale: DbRow[] }> {
  const trades: DbRow[] = [];
  const presale: DbRow[] = [];
  for (const job of jobs) {
    trades.push(...toTradeRows(await molitAll(fetch, key, 'RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev', job)));
    presale.push(...toPresaleRows(await molitAll(fetch, key, 'RTMSDataSvcSilvTrade/getRTMSDataSvcSilvTrade', job)));
  }
  return { trades, presale };
}

export async function collectAccount(fetch: Fetch, key: string, today: string): Promise<DbRow[]> {
  const cond = { 'DELNG_OCCRRNC_YM::GTE': addMonths(today, -3).slice(0, 7).replace('-', '') };
  const svc = 'ApplyhomeBnkbStatSvc/v1';
  const all = await odcloudAll(fetch, key, `${svc}/getBnkbAcnutAllStat`, cond);
  const deposit = await odcloudAll(fetch, key, `${svc}/getBnkbAcnutDpstStat`, cond);
  const subscribe = await odcloudAll(fetch, key, `${svc}/getBnkbAcnutSbscrbStat`, cond);
  return toAccountRows(all, deposit, subscribe);
}
