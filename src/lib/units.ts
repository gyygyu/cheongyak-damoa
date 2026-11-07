// 면적·금액 표기 (spec §7: 면적은 "84㎡(25평)", 숫자는 tabular-nums)
const SQM_PER_PYEONG = 3.3058;

export const sqmToPyeong = (m2: number): number => Math.round((m2 / SQM_PER_PYEONG) * 10) / 10;

export function formatArea(m2: number): string {
  const sqm = Math.round(m2 * 100) / 100;
  return `${sqm}㎡(${Math.round(m2 / SQM_PER_PYEONG)}평)`;
}

export const perSqmToPerPyeong = (manwonPerSqm: number): number => Math.round(manwonPerSqm * SQM_PER_PYEONG);

export function formatManwon(n: number): string {
  if (n === 0) return '0원';
  const eok = Math.floor(n / 10000);
  const man = n % 10000;
  const parts: string[] = [];
  if (eok) parts.push(`${eok.toLocaleString('ko-KR')}억`);
  if (man) parts.push(`${man.toLocaleString('ko-KR')}만`);
  return `${parts.join(' ')}원`;
}
