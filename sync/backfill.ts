// 실거래 백필 (spec §3): 12개월 × 전국 시군구를 실행마다 조금씩. 진행 위치는 KV backfill:trade
import type { LawdTable } from '../src/lib/region/lawd';
import { addMonths } from '../src/lib/date';
import type { TradeJob } from './collect';

export const BACKFILL_MONTHS = 12;
export interface BackfillState { base: string; index: number }

const ymOf = (date: string): string => date.slice(0, 7).replace('-', '');

export function recentMonths(today: string): string[] {
  return [ymOf(today), ymOf(addMonths(today, -1))];
}

export function sigunguCodes(table: LawdTable): string[] {
  return [...new Set(table
    .map(([code]) => code)
    .filter((c) => c.slice(5) === '00000' && c.slice(2, 5) !== '000')
    .map((c) => c.slice(0, 5)))].sort();
}

export function nextBackfill(state: BackfillState | null, lawds: string[], today: string, max: number): { jobs: TradeJob[]; state: BackfillState; done: boolean } {
  const current = ymOf(addMonths(today, -1));
  // 한 바퀴를 다 돌았고 기준월이 지났으면 새 기준월로 처음부터 (매달 새로 신고된 거래를 채운다)
  if (state && state.base !== current && state.index >= BACKFILL_MONTHS * lawds.length) state = { base: current, index: 0 };
  const base = state?.base ?? current;
  const baseDate = `${base.slice(0, 4)}-${base.slice(4)}-01`;
  const months = Array.from({ length: BACKFILL_MONTHS }, (_, i) => ymOf(addMonths(baseDate, -i)));
  const all = months.flatMap((ym) => lawds.map((lawd) => ({ lawd, ym })));
  const start = Math.min(state?.index ?? 0, all.length);
  const end = Math.min(all.length, start + max);
  return { jobs: all.slice(start, end), state: { base, index: end }, done: end >= all.length };
}
