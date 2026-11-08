// 월 캘린더 칸과 일정 줄 (spec §7). 묶음은 시작일 달에만 들어 있으므로(groupByMonth) 화면은 지난달 묶음도 함께 읽는다
import type { CalendarEvent, EventKind } from '../apt/schedule';
import { addMonths, daysBetween } from '../date';
import { formatRange, KIND_LABEL } from './format';

export type EventGroup = 'apt' | 'lh' | 'ipo';
export const kindGroup = (kind: EventKind): EventGroup => (kind === 'lh-receipt' ? 'lh' : kind.startsWith('ipo-') ? 'ipo' : 'apt');

export function hrefOf(ref: string): string | null {
  const m = /^(apt|lh|ipo):(.+)$/.exec(ref);
  if (!m || m[2] === 'null') return null;
  return `/${m[1]}/${encodeURIComponent(m[2])}`;
}

export interface EventRow { date: string; endDate: string | null; dateText: string; kindLabel: string; title: string; href: string | null; group: EventGroup }
export function eventRow(e: CalendarEvent): EventRow {
  const endDate = e.endDate && e.endDate > e.date ? e.endDate : null;
  return { date: e.date, endDate, dateText: formatRange(e.date, endDate), kindLabel: KIND_LABEL[e.kind] ?? e.kind, title: e.title, href: hrefOf(e.ref), group: kindGroup(e.kind) };
}

const YM = /^(\d{4})-(0[1-9]|1[0-2])$/;
export function parseMonth(raw: string | undefined, today: string): string | null {
  if (!raw || !YM.test(raw)) return null;
  const now = today.slice(0, 7);
  const min = addMonths(`${now}-01`, -12).slice(0, 7);
  const max = addMonths(`${now}-01`, 12).slice(0, 7);
  return raw >= min && raw <= max ? raw : null;
}
export const prevMonth = (ym: string): string => addMonths(`${ym}-01`, -1).slice(0, 7);
export const nextMonth = (ym: string): string => addMonths(`${ym}-01`, 1).slice(0, 7);

const pad = (n: number) => String(n).padStart(2, '0');
const lastDay = (ym: string): number => new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).getUTCDate();

export function monthGrid(ym: string): (string | null)[][] {
  const first = new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7) - 1, 1)).getUTCDay();
  const cells: (string | null)[] = [...Array(first).fill(null)];
  for (let d = 1; d <= lastDay(ym); d++) cells.push(`${ym}-${pad(d)}`);
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
}

export function mergeEvents(...lists: CalendarEvent[][]): CalendarEvent[] {
  const seen = new Map<string, CalendarEvent>();
  for (const e of lists.flat()) seen.set(`${e.ref}|${e.kind}|${e.date}`, e);
  return [...seen.values()].sort((a, b) => a.date.localeCompare(b.date) || a.ref.localeCompare(b.ref));
}

export function eventsByDay(events: CalendarEvent[], ym: string): Record<string, EventRow[]> {
  const out: Record<string, EventRow[]> = {};
  const monthStart = `${ym}-01`;
  const monthEnd = `${ym}-${pad(lastDay(ym))}`;
  for (const e of events) {
    const row = eventRow(e);
    const end = row.endDate ?? row.date;
    const from = row.date > monthStart ? row.date : monthStart;
    const to = end < monthEnd ? end : monthEnd;
    if (from > to) continue;
    const n = daysBetween(from, to);
    for (let i = 0; i <= n; i++) {
      const d = `${ym}-${pad(Number(from.slice(8, 10)) + i)}`;
      (out[d] ??= []).push(row);
    }
  }
  return out;
}
