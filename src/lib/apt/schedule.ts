// 공고 일정 → 캘린더 일정 (spec §6 calendar:YYYY-MM)
import type { AptSchedule } from './status';

export type EventKind = 'special' | 'rank1' | 'rank2' | 'winner' | 'contract'
  | 'lh-receipt' | 'ipo-sub' | 'ipo-refund' | 'ipo-listing' | 'ipo-lockup';

// sido·sigungu: 일정 줄에 지역을 보이고 지역으로 거르려고 담는다 (없으면 키를 뺀다 — 묶음 크기)
export interface CalendarEvent { date: string; endDate?: string; kind: EventKind; ref: string; title: string; sido?: string; sigungu?: string }
export interface EventPlace { sido: string | null; sigungu: string | null }

export const placeFields = (p?: EventPlace): Pick<CalendarEvent, 'sido' | 'sigungu'> =>
  ({ ...(p?.sido ? { sido: p.sido } : {}), ...(p?.sido && p.sigungu ? { sigungu: p.sigungu } : {}) });

function ev(kind: EventKind, ref: string, title: string, start: string | null, end: string | null | undefined, place: Pick<CalendarEvent, 'sido' | 'sigungu'>): CalendarEvent[] {
  if (!start) return [];
  return [{ date: start, ...(end && end !== start ? { endDate: end } : {}), kind, ref, title, ...place }];
}

export function aptEvents(ref: string, title: string, s: AptSchedule, place?: EventPlace): CalendarEvent[] {
  const p = placeFields(place);
  return [
    ...ev('special', ref, title, s.specialStart, s.specialEnd, p),
    ...ev('rank1', ref, title, s.rank1Start, s.rank1End, p),
    ...ev('rank2', ref, title, s.rank2Start, s.rank2End, p),
    ...ev('winner', ref, title, s.winnerDate, null, p),
    ...ev('contract', ref, title, s.contractStart, s.contractEnd, p),
  ];
}

export function groupByMonth(events: CalendarEvent[]): Record<string, CalendarEvent[]> {
  const out: Record<string, CalendarEvent[]> = {};
  for (const e of [...events].sort((a, b) => a.date.localeCompare(b.date))) (out[e.date.slice(0, 7)] ??= []).push(e);
  return out;
}
