// 홈 (DESIGN.md Operate 화면): 머리 줄 요약 숫자 + 이번 주 일정(날짜 머리·D-day, 몇 줄만) + 최근 경쟁률 몇 개
import type { HomeBundle } from './bundle-types';
import type { CalendarEvent, EventKind } from '../apt/schedule';
import { byKind, calDay, dedupeEvents, hrefOf, listRow, shortDay, type CalDay, type ListRow } from './calendar';
import { formatRate } from './format';
import { daysBetween } from '../date';

export const HOME_LIMIT = 8; // 이 줄 수를 넘으면 '전체 일정 보기'로 캘린더에 넘긴다
const WEEK_DAYS = 6; // 오늘 포함 7일
const TOP_N = 5;
const RECEIPT = new Set<EventKind>(['special', 'rank1', 'rank2', 'lh-receipt', 'ipo-sub']);

export interface HomeView {
  today: string; todayText: string;
  stats: { receipts: number; winners: number };
  days: CalDay[]; more: number; calendarHref: string;
  top: { name: string; href: string; place: string; rate: string }[];
}

const endOf = (e: CalendarEvent): string => (e.endDate && e.endDate > e.date ? e.endDate : e.date);

export function homeView(b: HomeBundle | null, today: string): HomeView {
  const events = dedupeEvents(b?.events ?? []);
  const inWeek = (d: string) => daysBetween(today, d) <= WEEK_DAYS;
  const live = events.filter((e) => inWeek(e.date) && endOf(e) >= today);

  // 오늘 칸: 오늘 시작·진행 중 일정을 마감이 가까운 순으로. 그 뒤 날짜는 시작일마다
  const todayRows = live.filter((e) => e.date <= today)
    .map((e) => ({ row: listRow(e, today), last: endOf(e) }))
    .sort((a, b) => a.last.localeCompare(b.last) || byKind(a.row, b.row))
    .map((x) => x.row);
  const later: Record<string, ListRow[]> = {};
  for (const e of live.filter((x) => x.date > today)) (later[e.date] ??= []).push(listRow(e, today));
  const groups: [string, ListRow[]][] = Object.keys(later).sort().map((d) => [d, later[d].sort(byKind)]);
  if (todayRows.length) groups.unshift([today, todayRows]);

  let left = HOME_LIMIT;
  let total = 0;
  const days: CalDay[] = [];
  for (const [d, rows] of groups) {
    total += rows.length;
    if (left > 0) days.push(calDay(d, today, rows.slice(0, left)));
    left -= Math.min(left, rows.length);
  }

  const refs = (pred: (e: CalendarEvent) => boolean) => new Set(live.filter(pred).map((e) => e.ref)).size;
  return {
    today,
    todayText: shortDay(today),
    stats: { receipts: refs((e) => RECEIPT.has(e.kind)), winners: refs((e) => e.kind === 'winner' && e.date >= today) },
    days,
    more: total - days.reduce((n, d) => n + d.rows.length, 0),
    calendarHref: `/calendar/${today.slice(0, 7)}`,
    top: (b?.topCompetition ?? []).slice(0, TOP_N).map((c) => ({
      name: c.name ?? c.pblancNo,
      href: hrefOf(`apt:${c.pblancNo}`) ?? '/competition',
      place: [c.sido, c.sigungu].filter(Boolean).join(' '),
      rate: formatRate(c.maxRate, null),
    })),
  };
}
