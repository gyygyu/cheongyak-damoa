// DART 증권신고서(지분증권) 판 고르기 (spec §9): 접수번호가 가장 늦은 판을 쓰고, 정정은 이력에 남긴다.
// 머리말 [기재정정]·[발행조건확정] 등 대괄호가 붙은 판은 모두 정정으로 본다
export interface Filing { rceptNo: string; reportNm: string; rceptDt: string }
export interface Revision { rceptNo: string; rceptDt: string; corrected: boolean }

export const isEquityFiling = (reportNm: string): boolean => /증권신고서\s*\(지분증권\)/.test(reportNm);

export function pickFiling(filings: Filing[]): { latest: Filing; revisions: Revision[] } | null {
  const eq = filings.filter((f) => isEquityFiling(f.reportNm)).sort((a, b) => a.rceptNo.localeCompare(b.rceptNo));
  if (!eq.length) return null;
  return {
    latest: eq.at(-1)!,
    revisions: eq.map((f) => ({ rceptNo: f.rceptNo, rceptDt: f.rceptDt, corrected: /^\s*\[/.test(f.reportNm) })),
  };
}
