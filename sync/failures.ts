// 출처별 마지막 성공·연속 실패 (spec §10). 3회 연속 실패면 GitHub 이슈
export interface SourceMeta { lastSuccess: string | null; failures: number; lastCount: number | null; lastError?: string }
export type SourceResult = { ok: true; count: number } | { ok: false; error: string };
export const ALERT_AFTER = 3;

export function nextMeta(prev: SourceMeta | undefined, r: SourceResult, now: string): SourceMeta {
  if (r.ok) return { lastSuccess: now, failures: 0, lastCount: r.count };
  return { lastSuccess: prev?.lastSuccess ?? null, failures: (prev?.failures ?? 0) + 1, lastCount: prev?.lastCount ?? null, lastError: r.error.slice(0, 500) };
}
