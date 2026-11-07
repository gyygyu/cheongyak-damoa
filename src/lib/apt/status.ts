// 공고 단계 (spec §5 상태: 정상·정정·취소·종료). 정정은 배지(corrected)로만, 단계는 일정으로 정한다.
export interface AptSchedule {
  specialStart: string | null; specialEnd: string | null;
  rank1Start: string | null; rank1End: string | null;
  rank2Start: string | null; rank2End: string | null;
  winnerDate: string | null; contractStart: string | null; contractEnd: string | null;
}

export type AptPhase = 'upcoming' | 'open' | 'closed' | 'cancelled';

export function aptPhase(s: AptSchedule, state: 'normal' | 'corrected' | 'cancelled', today: string): { phase: AptPhase; corrected: boolean } {
  const corrected = state === 'corrected';
  if (state === 'cancelled') return { phase: 'cancelled', corrected };
  const starts = [s.specialStart, s.rank1Start, s.rank2Start].filter((d): d is string => !!d).sort();
  const ends = [s.specialEnd, s.rank1End, s.rank2End].filter((d): d is string => !!d).sort();
  if (!starts.length || today < starts[0]) return { phase: 'upcoming', corrected };
  const last = ends.at(-1) ?? starts.at(-1)!;
  return { phase: today > last ? 'closed' : 'open', corrected };
}
