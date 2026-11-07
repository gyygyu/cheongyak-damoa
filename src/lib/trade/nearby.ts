// 주변 시세 (spec §9): 같은 법정동·최근 12개월·준공 10년 이내·해제 제외·전용 ±10㎡ → ㎡당 중위가
// 5건 미만이면 시군구(시 단위 공고는 그 시의 구 전체)로 넓히고, 그래도 5건 미만이면 '비교 자료 부족(n건)'
import { addMonths } from '../date';
import { median } from './median';
import { sameSigungu } from '../region/lawd';

export interface TradeRecord {
  lawdCd: string; dong: string; area: number; contractDate: string;
  amount: number; buildYear: number | null; cancelled: boolean;
}

export type NearbyResult =
  | { scope: 'dong' | 'sigungu'; count: number; medianPerSqm: number }
  | { scope: 'insufficient'; count: number }
  | { scope: 'none'; count: 0 };

const MIN = 5;
const AREA_TOL = 10;
const MAX_AGE = 10;

export function nearbyPrice(target: { lawdCd: string; dong: string | null; area: number }, trades: TradeRecord[], asOf: string, cityOf: ReadonlyMap<string, string>): NearbyResult {
  if (!target.lawdCd) return { scope: 'none', count: 0 };
  const from = addMonths(asOf, -12);
  const minYear = Number(asOf.slice(0, 4)) - MAX_AGE;
  const pool = trades.filter((r) =>
    sameSigungu(r.lawdCd, target.lawdCd, cityOf) && !r.cancelled &&
    r.contractDate >= from && r.contractDate <= asOf &&
    r.buildYear !== null && r.buildYear >= minYear &&
    Math.abs(r.area - target.area) <= AREA_TOL + 1e-9);

  const pick = (rows: TradeRecord[], scope: 'dong' | 'sigungu'): NearbyResult | null =>
    rows.length >= MIN ? { scope, count: rows.length, medianPerSqm: Math.round(median(rows.map((r) => r.amount / r.area))!) } : null;

  if (target.dong) {
    const hit = pick(pool.filter((r) => r.dong === target.dong), 'dong');
    if (hit) return hit;
  }
  return pick(pool, 'sigungu') ?? { scope: 'insufficient', count: pool.length };
}
