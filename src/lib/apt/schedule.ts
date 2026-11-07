// 공고 일정 → 캘린더 일정 (spec §6 calendar:YYYY-MM)
import type { AptSchedule } from './status';

export type EventKind = 'special' | 'rank1' | 'rank2' | 'winner' | 'contract'
  | 'lh-receipt' | 'ipo-sub' | 'ipo-refund' | 'ipo-listing' | 'ipo-lockup';

export interface CalendarEvent { date: string; endDate?: string; kind: EventKind; ref: string; title: string }

function ev(kind: EventKind, ref: string, title: string, start: string | null, end?: string | null): CalendarEvent[] {
  if (!start) return [];
  return [{ date: start, ...(end && end !== start ? { endDate: end } : {}), kind, ref, title }];
}

export function aptEvents(ref: string, title: string, s: AptSchedule): CalendarEvent[] {
  return [
    ...ev('special', ref, title, s.specialStart, s.specialEnd),
    ...ev('rank1', ref, title, s.rank1Start, s.rank1End),
    ...ev('rank2', ref, title, s.rank2Start, s.rank2End),
    ...ev('winner', ref, title, s.winnerDate),
    ...ev('contract', ref, title, s.contractStart, s.contractEnd),
  ];
}

export function groupByMonth(events: CalendarEvent[]): Record<string, CalendarEvent[]> {
  const out: Record<string, CalendarEvent[]> = {};
  for (const e of [...events].sort((a, b) => a.date.localeCompare(b.date))) (out[e.date.slice(0, 7)] ??= []).push(e);
  return out;
}
