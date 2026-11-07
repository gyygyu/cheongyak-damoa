// 지번 해석 (분양권 매칭 1차 키, spec §9)
export interface Jibun { san: boolean; main: number; sub: number }

const JIBUN = /^(산)?\s*0*(\d+)(?:-0*(\d+))?(?:번지)?$/;

export function parseJibun(s: string): Jibun | null {
  const m = s.trim().match(JIBUN);
  if (!m) return null;
  return { san: !!m[1], main: Number(m[2]), sub: m[3] ? Number(m[3]) : 0 };
}

export const jibunKey = (j: Jibun): string => `${j.san ? '산' : ''}${j.main}-${j.sub}`;

export function extractJibun(rest: string): Jibun | null {
  const words = rest.trim().split(/\s+/);
  // "산 5" 처럼 띄어 쓴 산 지번
  if (words[0] === '산' && words[1]) return parseJibun(`산${words[1]}`);
  return words[0] ? parseJibun(words[0]) : null;
}
