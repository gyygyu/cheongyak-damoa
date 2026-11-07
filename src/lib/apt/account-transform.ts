// 청약통장 통계 3종 → account_stats 행 (spec §5). 출처마다 지역 단위가 달라 지역명 규칙을 나눈다
import { type Raw, type DbRow, str, int } from '../raw';

const month = (v: unknown): string | null => { const m = str(v)?.match(/^(\d{4})(\d{2})$/); return m ? `${m[1]}-${m[2]}` : null; };
const local = (r: Raw): string | null => {
  const sido = str(r.SIDO_NM), area = str(r.SUBSCRPT_AREA_CODE_NM);
  if (!sido) return area;
  return !area || area === sido ? sido : `${sido} ${area}`;
};
const add = (a: number | null, b: number | null) => (b === null ? a : (a ?? 0) + b);

export function toAccountRows(all: Raw[], deposit: Raw[], subscribe: Raw[]): DbRow[] {
  const map = new Map<string, DbRow>();
  const put = (r: Raw, region: string | null, area: string, v: { subscribers?: number | null; rank1?: number | null; rank2?: number | null }) => {
    const base = month(r.DELNG_OCCRRNC_YM), kind = str(r.DPST_ITEM_NM);
    if (!base || !region || !kind) return;
    const key = [base, region, kind, area].join('|');
    const row = map.get(key) ?? { base_month: base, region, account_kind: kind, area_kind: area, subscribers: null, rank1: null, rank2: null };
    row.subscribers = add(row.subscribers as number | null, v.subscribers ?? null);
    row.rank1 = add(row.rank1 as number | null, v.rank1 ?? null);
    row.rank2 = add(row.rank2 as number | null, v.rank2 ?? null);
    map.set(key, row);
  };
  for (const r of all) put(r, str(r.SUBSCRPT_AREA_CODE_NM), str(r.BLNC_SECD) ?? '', { rank1: int(r.RNK1_ACNUT_CO), rank2: int(r.RNK2_ACNUT_CO) });
  for (const r of deposit) put(r, local(r), '', { rank1: int(r.RNK1_ACNUT_CO), rank2: int(r.RNK2_ACNUT_CO) });
  for (const r of subscribe) put(r, local(r), str(r.BLNC_SECD) ?? '', { subscribers: int(r.ACNUT_CO) });
  return [...map.values()];
}
