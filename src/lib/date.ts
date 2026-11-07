// 날짜는 YYYY-MM-DD 문자열로만 다룬다 (시간대 문제 피하기 — 계산은 UTC 자정 기준)
const pad = (n: number | string, w = 2) => String(n).padStart(w, '0');
export const ymd = (y: number | string, m: number | string, d: number | string): string => `${pad(y, 4)}-${pad(m)}-${pad(d)}`;

function valid(y: number, m: number, d: number): boolean {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

export function normalizeDate(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim();
  const m = t.match(/^(\d{4})(\d{2})(\d{2})$/) ?? t.match(/^(\d{4})\s*[-.]\s*(\d{1,2})\s*[-.]\s*(\d{1,2})/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return valid(y, mo, d) ? ymd(y, mo, d) : null;
}

const toUtc = (date: string) => Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)));

export function addMonths(date: string, n: number): string {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7)) - 1 + n;
  const d = Number(date.slice(8, 10));
  const ty = y + Math.floor(m / 12);
  const tm = ((m % 12) + 12) % 12;
  const last = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  return ymd(ty, tm + 1, Math.min(d, last));
}

export const daysBetween = (a: string, b: string): number => Math.round((toUtc(b) - toUtc(a)) / 86_400_000);

export const todayKst = (now: Date = new Date()): string => new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
