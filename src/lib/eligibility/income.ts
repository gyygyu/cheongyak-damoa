// 소득 기준표: 전년도 도시근로자 가구당 월평균 소득 100%(원). 근거·출처는 docs/special-supply-rules.md
// 주택공급규칙 제40조 ②: 태아를 포함한 가구원 수가 4명 이상이면 가구원수별 값(이하 같다) — 모든 유형 공통으로 쓴다.
export interface IncomeTable {
  year: number;
  /** 이 표를 쓰기 시작하는 공고일(YYYY-MM-DD). 그 전 공고는 표가 없는 것으로 본다 */
  effectiveFrom?: string;
  source: string;
  upTo3: number;                  // 3명 이하
  bySize: Record<string, number>; // "4" ~ "8"
  perExtra: number;               // 8명 초과 1명당 더하는 값
}

export function baseIncome(t: IncomeTable, size: number): number | null {
  if (!Number.isInteger(size) || size < 1) return null;
  if (size <= 3) return t.upTo3;
  if (size <= 8) return t.bySize[String(size)] ?? null;
  const eight = t.bySize['8'];
  return eight == null ? null : eight + (size - 8) * t.perExtra;
}

/** 소득이 기준의 percent% 이하인가 — 반올림 없이 정수 곱으로 비교. 판단할 수 없으면 null */
export function withinIncome(t: IncomeTable, size: number, percent: number, income: number | null): boolean | null {
  const base = baseIncome(t, size);
  if (base == null || income == null || !Number.isFinite(income) || income < 0) return null;
  return income * 100 <= base * percent;
}

/** 공고일이 속한 해의 표(적용 시작일 이후 공고만). 없으면 null(소득 요건은 '확인 필요') */
export function incomeTableFor(tables: readonly IncomeTable[], noticeDate: string | null): IncomeTable | null {
  if (!noticeDate) return null;
  const year = Number(noticeDate.slice(0, 4));
  const t = tables.find((x) => x.year === year);
  if (!t || (t.effectiveFrom != null && noticeDate < t.effectiveFrom)) return null;
  return t;
}
