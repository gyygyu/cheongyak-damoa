// 국토부 실거래 금액(만원, "82,500")·면적("84.9512") 해석 (spec §10)
export function parseDealAmount(s: string | number | null | undefined): number | null {
  if (typeof s === 'number') return Number.isInteger(s) && s > 0 ? s : null;
  const t = (s ?? '').replace(/[,\s]/g, '');
  return /^\d+$/.test(t) && Number(t) > 0 ? Number(t) : null;
}

export function parseArea(s: string | number | null | undefined): number | null {
  const n = typeof s === 'number' ? s : Number((s ?? '').trim() || NaN);
  return Number.isFinite(n) && n > 0 ? n : null;
}
