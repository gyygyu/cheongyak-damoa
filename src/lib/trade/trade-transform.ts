// 국토부 실거래(매매·분양권) XML → trade / presale_trade 행 (spec §5·§9)
import { type Raw, type DbRow, str, int } from '../raw';
import { parseDealAmount, parseArea } from './amount';
import { ymd, normalizeDate } from '../date';
import { tradeKeys } from './trade-key';

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" };
const unescape = (s: string) => s.replace(/&(amp|lt|gt|quot|apos|#39);/g, (_, k: string) => ENT[k]);

export function parseMolitXml(xml: string): { resultCode: string | null; totalCount: number; items: Raw[] } {
  const code = xml.match(/<resultCode>([^<]*)<\/resultCode>/);
  const total = xml.match(/<totalCount>(\d+)<\/totalCount>/);
  const items: Raw[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const item: Raw = {};
    for (const t of m[1].matchAll(/<([A-Za-z0-9_]+)>([^<]*)<\/\1>/g)) item[t[1]] = unescape(t[2]);
    items.push(item);
  }
  return { resultCode: code ? code[1].trim() : null, totalCount: total ? Number(total[1]) : 0, items };
}

// 계약일: 년·월·일이 실제 날짜일 때만
function contractDate(r: Raw): string | null {
  const [y, m, d] = [int(r.dealYear), int(r.dealMonth), int(r.dealDay)];
  return y && m && d ? normalizeDate(ymd(y, m, d)) : null;
}

// 해제일 "26.10.20" → 2026-10-20
function cancelDate(v: unknown): string | null {
  const m = str(v)?.match(/^(\d{2})\.(\d{1,2})\.(\d{1,2})$/);
  return m ? normalizeDate(ymd(2000 + Number(m[1]), m[2], m[3])) : null;
}

interface Base { sgg: string; dong: string; jibun: string | null; name: string; area: number; floor: number | null; date: string; amount: number; cancelled: 0 | 1 }

function base(r: Raw): Base | null {
  const sgg = str(r.sggCd), dong = str(r.umdNm), name = str(r.aptNm);
  const area = parseArea(str(r.excluUseAr)), amount = parseDealAmount(str(r.dealAmount)), date = contractDate(r);
  if (!sgg || !dong || !name || area === null || amount === null || !date) return null;
  return { sgg, dong, jibun: str(r.jibun), name, area, floor: int(r.floor), date, amount, cancelled: str(r.cdealType) ? 1 : 0 };
}

function withKeys<T extends { b: Base }>(list: T[]): (T & { key: string })[] {
  const keys = tradeKeys(list.map(({ b }) => ({ lawdCd: b.sgg, dong: b.dong, jibun: b.jibun ?? '', name: b.name, area: b.area, floor: b.floor, contractDate: b.date, amount: b.amount })));
  return list.map((x, i) => ({ ...x, key: keys[i] }));
}

export function toTradeRows(items: Raw[]): DbRow[] {
  const list = items.flatMap((r) => { const b = base(r); return b ? [{ r, b }] : []; });
  return withKeys(list).map(({ r, b, key }) => ({
    trade_key: key, lawd_cd: b.sgg, umd_cd: str(r.umdCd), dong: b.dong, jibun: b.jibun, apt_seq: str(r.aptSeq), name: b.name,
    area: b.area, floor: b.floor, contract_date: b.date, amount: b.amount, build_year: int(r.buildYear),
    cancelled: b.cancelled, cancel_date: cancelDate(r.cdealDay),
  }));
}

export function toPresaleRows(items: Raw[]): DbRow[] {
  const list = items.flatMap((r) => { const b = base(r); return b ? [{ r, b }] : []; });
  return withKeys(list).map(({ r, b, key }) => ({
    trade_key: key, sgg_cd: b.sgg, dong: b.dong, jibun: b.jibun, name: b.name, area: b.area, floor: b.floor,
    contract_date: b.date, amount: b.amount, kind: str(r.ownershipGbn), cancelled: b.cancelled,
  }));
}
