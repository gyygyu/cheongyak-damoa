// 의무보호예수 반환 ↔ 공모주 (spec §9): 종목코드, 안 되면 법인등록번호. 맞추지 못하면 버린다. 해석 없이 사실만 쓴다.
export interface LockupRow { stockCode: string | null; crno: string | null; releaseDate: string; shareKind: string; shares: number }
export interface IpoIds { corpCode: string; stockCode: string | null; crno: string | null }

export function normalizeStockCode(s: string | null): string | null {
  const t = (s ?? '').trim().replace(/^A/i, '');
  return /^\d{1,6}$/.test(t) ? t.padStart(6, '0') : null;
}

export function normalizeCrno(s: string | null): string | null {
  const t = (s ?? '').replace(/[-\s]/g, '');
  return /^\d{13}$/.test(t) && !/^0+$/.test(t) ? t : null; // 외국법인은 0000000000000
}

export function matchLockups(rows: LockupRow[], ipos: IpoIds[]): (LockupRow & { corpCode: string })[] {
  const byStock = new Map<string, string>();
  const byCrno = new Map<string, string>();
  for (const i of ipos) {
    const s = normalizeStockCode(i.stockCode);
    const c = normalizeCrno(i.crno);
    if (s) byStock.set(s, i.corpCode);
    if (c) byCrno.set(c, i.corpCode);
  }
  const out: (LockupRow & { corpCode: string })[] = [];
  for (const r of rows) {
    const s = normalizeStockCode(r.stockCode);
    const c = normalizeCrno(r.crno);
    const corpCode = (s && byStock.get(s)) || (c && byCrno.get(c)) || null;
    if (corpCode) out.push({ ...r, corpCode });
  }
  return out;
}
