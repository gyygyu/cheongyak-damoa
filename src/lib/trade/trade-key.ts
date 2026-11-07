// 거래 해시: 출처에 고유번호가 없어 필드를 합쳐 만든다. 겹치면 순번 (spec §5)
import { fnv64 } from '../hash';

export interface TradeKeyFields {
  lawdCd: string; dong: string; jibun: string; name: string;
  area: number; floor: number | null; contractDate: string; amount: number;
}

export function tradeKeys(rows: TradeKeyFields[]): string[] {
  const seen = new Map<string, number>();
  return rows.map((r) => {
    const base = fnv64([r.lawdCd, r.dong, r.jibun, r.name, r.area, r.floor ?? '', r.contractDate, r.amount].join('|'));
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  });
}
