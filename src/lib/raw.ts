// 공공데이터 응답 값 다루기 — 빈 문자열·공백·'-' 는 값 없음으로 본다
export type Raw = Record<string, unknown>;
export type DbRow = Record<string, string | number | null>;

export function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  return t === '' || t === '-' ? null : t;
}

export function int(v: unknown): number | null {
  const t = str(v)?.replace(/,/g, '');
  return t && /^-?\d+$/.test(t) ? Number(t) : null;
}

export function num(v: unknown): number | null {
  const t = str(v)?.replace(/,/g, '');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function yn(v: unknown): 0 | 1 | null {
  const t = str(v)?.toUpperCase();
  return t === 'Y' ? 1 : t === 'N' ? 0 : null;
}
