// 홈 타임라인 (spec §7): 오늘·이번 주 일정, 마감 임박, 최근 경쟁률
import type { HomeBundle } from './bundle-types';
import { eventRow, hrefOf, type EventRow } from './calendar';
import { formatRate } from './format';
import { daysBetween } from '../date';

export interface HomeView {
  today: string; todayRows: EventRow[]; closingRows: EventRow[]; weekRows: EventRow[];
  top: { name: string; href: string; place: string; rate: string }[];
}

const CLOSING_DAYS = 2;
const RECEIPT = new Set(['special', 'rank1', 'rank2', 'lh-receipt', 'ipo-sub']);

export function homeView(b: HomeBundle | null, today: string): HomeView {
  const events = b?.events ?? [];
  const rows = events.map((e) => ({ e, r: eventRow(e) }));
  const running = rows.filter(({ r }) => r.date <= today && (r.endDate ?? r.date) >= today);
  return {
    today,
    todayRows: running.map(({ r }) => r),
    closingRows: rows
      .filter(({ e, r }) => RECEIPT.has(e.kind) && (r.endDate ?? r.date) >= today && daysBetween(today, r.endDate ?? r.date) <= CLOSING_DAYS && r.date <= today)
      .map(({ r }) => r),
    weekRows: rows.filter(({ r }) => r.date > today).map(({ r }) => r),
    top: (b?.topCompetition ?? []).map((c) => ({
      name: c.name ?? c.pblancNo,
      href: hrefOf(`apt:${c.pblancNo}`) ?? '/competition',
      place: [c.sido, c.sigungu].filter(Boolean).join(' '),
      rate: formatRate(c.maxRate, null),
    })),
  };
}
