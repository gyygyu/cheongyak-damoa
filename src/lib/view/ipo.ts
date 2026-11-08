// 공모주 목록·상세 (spec §7, §13). 사실만 — 의견·예상 수익·추천 금지.
// 지금은 DART 키가 없고 보호예수 수집이 꺼져 있어 ipo: 묶음과 ipo-* 일정이 없다 → 화면은 빈 안내
import type { IpoBundle, CalendarBundle } from './bundle-types';
import type { InfoRow } from './apt';
import { eventRow, type EventRow } from './calendar';
import { formatDay, formatRange, formatCount } from './format';

export const IPO_DISCLAIMER = '투자 권유가 아닙니다.';

export interface IpoView {
  name: string; market: string; stateBadge: string | null; schedule: InfoRow[]; price: InfoRow[];
  underwriters: string; revisions: { date: string; note: string }[]; lockup: { date: string; kind: string; shares: string }[];
}

export const formatWon = (n: number | null): string => (n === null ? '-' : `${n.toLocaleString('ko-KR')}원`);

export function ipoEvents(bundles: (CalendarBundle | null)[]): EventRow[] {
  return bundles
    .flatMap((b) => b?.events ?? [])
    .filter((e) => e.kind.startsWith('ipo-'))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(eventRow);
}

function revisionsOf(json: string | null): { date: string; note: string }[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json) as unknown;
    if (!Array.isArray(v)) return [];
    return v
      .filter((r): r is { date?: unknown; note?: unknown } => typeof r === 'object' && r !== null)
      .map((r) => ({ date: formatDay(typeof r.date === 'string' ? r.date : null), note: typeof r.note === 'string' ? r.note : '정정' }));
  } catch {
    return [];
  }
}

export function ipoView(b: IpoBundle): IpoView {
  const i = b.ipo;
  const schedule: InfoRow[] = [];
  if (i.sub_start || i.sub_end) schedule.push({ label: '청약', value: formatRange(i.sub_start, i.sub_end) });
  if (i.listing_date) schedule.push({ label: '상장', value: formatDay(i.listing_date) });
  if (i.offer_shares !== null) schedule.push({ label: '공모 주식 수', value: `${formatCount(i.offer_shares)}주` });
  const price: InfoRow[] = [];
  if (i.price_low !== null || i.price_high !== null) price.push({ label: '희망 공모가', value: `${formatWon(i.price_low)} ~ ${formatWon(i.price_high)}` });
  if (i.price_final !== null) price.push({ label: '확정 공모가', value: formatWon(i.price_final) });
  return {
    name: i.name,
    market: i.market ?? '-',
    stateBadge: i.state === 'cancelled' ? '철회' : i.state === 'corrected' ? '정정' : null,
    schedule,
    price,
    underwriters: i.underwriters ?? '-',
    revisions: revisionsOf(i.revisions),
    lockup: (b.lockup ?? []).map((l) => ({ date: formatDay(l.release_date), kind: l.share_kind, shares: l.shares !== null ? `${formatCount(l.shares)}주` : '-' })),
  };
}
