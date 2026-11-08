// 월 캘린더 칸과 일정 줄 (spec §7). 묶음은 시작일 달에만 들어 있으므로(groupByMonth) 화면은 지난달 묶음도 함께 읽는다
import type { CalendarEvent, EventKind } from '../apt/schedule';
import { addMonths, daysBetween } from '../date';
import { formatDay, formatRange, KIND_LABEL } from './format';
import { normalizeComplexName } from '../normalize-name';

export type EventGroup = 'apt' | 'lh' | 'ipo';
export const kindGroup = (kind: EventKind): EventGroup => (kind === 'lh-receipt' ? 'lh' : kind.startsWith('ipo-') ? 'ipo' : 'apt');

export function hrefOf(ref: string): string | null {
  const m = /^(apt|lh|ipo):(.+)$/.exec(ref);
  if (!m || m[2] === 'null') return null;
  return `/${m[1]}/${encodeURIComponent(m[2])}`;
}

// 시도 짧은 이름 (일정 줄 지역 글자). 표에 없는 이름은 그대로 보인다
const SIDO_SHORT: Record<string, string> = {
  서울특별시: '서울', 부산광역시: '부산', 대구광역시: '대구', 인천광역시: '인천', 전남광주통합특별시: '전남광주', 광주광역시: '광주',
  대전광역시: '대전', 울산광역시: '울산', 세종특별자치시: '세종', 경기도: '경기', 강원특별자치도: '강원', 충청북도: '충북',
  충청남도: '충남', 전북특별자치도: '전북', 전라남도: '전남', 경상북도: '경북', 경상남도: '경남', 제주특별자치도: '제주',
};
export function placeLabel(sido: string | null | undefined, sigungu: string | null | undefined): string | null {
  if (!sido) return null;
  return [SIDO_SHORT[sido] ?? sido, sigungu].filter(Boolean).join(' ');
}

export interface EventRow {
  date: string; endDate: string | null; dateText: string; kind: EventKind; kindLabel: string; title: string; href: string | null; group: EventGroup;
  place: string | null; sido: string | null;
}
export function eventRow(e: CalendarEvent): EventRow {
  const endDate = e.endDate && e.endDate > e.date ? e.endDate : null;
  return {
    date: e.date, endDate, dateText: formatRange(e.date, endDate), kind: e.kind, kindLabel: KIND_LABEL[e.kind] ?? e.kind, title: e.title, href: hrefOf(e.ref), group: kindGroup(e.kind),
    place: placeLabel(e.sido, e.sigungu), sido: e.sido ?? null,
  };
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


// ── D-day (DESIGN.md 패턴: 오늘 = 강조색, D-3 이내 = amber, 지난 것 = muted) ──
export type Tone = 'today' | 'soon' | 'later' | 'past';
const SOON_DAYS = 3;
const PAST_LABEL_DAYS = 7;

export function dday(today: string, date: string): { label: string | null; tone: Tone } {
  const n = daysBetween(today, date);
  if (n === 0) return { label: '오늘', tone: 'today' };
  if (n > 0) return { label: `D-${n}`, tone: n <= SOON_DAYS ? 'soon' : 'later' };
  return { label: -n <= PAST_LABEL_DAYS ? `D+${-n}` : null, tone: 'past' };
}

function closeNote(today: string, end: string): { note: string; noteTone: Tone } {
  const d = dday(today, end);
  if (d.tone === 'today') return { note: '오늘 마감', noteTone: 'today' };
  if (d.tone === 'past') return { note: '마감', noteTone: 'past' };
  return { note: `마감 ${d.label}`, noteTone: d.tone };
}

// ── 같은 단지 겹침 빼기 ──
// 청약홈 공고와 LH 공고는 sync 의 matchLh(정규화 이름이 같을 때만)로 잇는데, 제목 꾸밈말이 달라 못 이은 공고가
// 홈·캘린더에 두 번 나온다. 화면에서만 꾸밈말을 뺀 이름 + 기간 겹침으로 한 번 더 걸러 낸다(청약홈 쪽을 남김).
const RECEIPT = new Set<EventKind>(['special', 'rank1', 'rank2', 'lh-receipt', 'ipo-sub']);
const NOISE = /지구|공공분양주택|공공분양|본청약|입주자모집공고|모집공고/g;

export function complexKey(title: string): string {
  return normalizeComplexName(title).replace(/(\d)bl(?![a-z])/g, '$1블록').replace(NOISE, '');
}

const endOf = (e: CalendarEvent): string => (e.endDate && e.endDate > e.date ? e.endDate : e.date);

export function dedupeEvents(events: CalendarEvent[]): CalendarEvent[] {
  const aptReceipts = events
    .filter((e) => RECEIPT.has(e.kind) && kindGroup(e.kind) === 'apt')
    .map((e) => ({ key: complexKey(e.title), from: e.date, to: endOf(e) }));
  const seen = new Set<string>();
  const out: CalendarEvent[] = [];
  for (const e of events) {
    const key = complexKey(e.title);
    if (!key) { out.push(e); continue; }
    const id = `${key}|${e.kind}|${e.date}|${endOf(e)}`;
    if (seen.has(id)) continue;
    if (e.kind === 'lh-receipt' && aptReceipts.some((a) => a.key === key && a.from <= endOf(e) && e.date <= a.to)) continue;
    seen.add(id);
    out.push(e);
  }
  return out;
}

// ── 날짜별 목록 줄 ──
export interface ListRow extends EventRow {
  end: boolean; // 여러 날 접수의 마감일 줄
  meta: string | null; // 여러 날 일정이면 기간 글자
  note: string | null; // 진행 중이거나 마감일인 접수: '마감 D-2'·'오늘 마감'
  noteTone: Tone | null;
}

const KIND_ORDER: EventKind[] = ['special', 'rank1', 'rank2', 'winner', 'contract', 'lh-receipt', 'ipo-sub', 'ipo-refund', 'ipo-listing', 'ipo-lockup'];
const kindRank = (r: ListRow): number => (r.end ? 100 : 0) + KIND_ORDER.indexOf(r.kind);
export const byKind = (a: ListRow, b: ListRow): number => kindRank(a) - kindRank(b) || a.title.localeCompare(b.title, 'ko');

export function listRow(e: CalendarEvent, today: string, end = false): ListRow {
  const r = eventRow(e);
  const last = r.endDate ?? r.date;
  const receipt = RECEIPT.has(e.kind) && r.endDate !== null;
  const showNote = receipt && (end || (r.date <= today && today <= last));
  return { ...r, end, meta: r.endDate ? r.dateText : null, ...(showNote ? closeNote(today, last) : { note: null, noteTone: null }) };
}

export function monthRows(events: CalendarEvent[], ym: string, today: string): Record<string, ListRow[]> {
  const out: Record<string, ListRow[]> = {};
  const monthStart = `${ym}-01`;
  const monthEnd = `${ym}-${pad(lastDay(ym))}`;
  const push = (d: string, row: ListRow) => (out[d] ??= []).push(row);
  for (const e of events) {
    const last = endOf(e);
    if (last < monthStart || e.date > monthEnd) continue;
    const endRow = RECEIPT.has(e.kind) && last > e.date && last <= monthEnd;
    if (e.date >= monthStart) push(e.date, listRow(e, today));
    else if (!endRow) push(monthStart, listRow(e, today)); // 지난달에 시작해 이어지는 일정은 1일에
    if (endRow) push(last, listRow(e, today, true));
  }
  for (const rows of Object.values(out)) rows.sort(byKind);
  return out;
}

// ── 달력 칸: 종류별 건수 ──
export interface DayCount { key: string; label: string; count: number; group: EventGroup }
const COUNT_LABEL: Record<EventKind, string> = {
  special: '특별공급', rank1: '1순위', rank2: '2순위', winner: '발표', contract: '계약',
  'lh-receipt': 'LH 접수', 'ipo-sub': '공모주 청약', 'ipo-refund': '환불', 'ipo-listing': '상장', 'ipo-lockup': '보호예수',
};
const END_LABEL: Record<EventGroup, string> = { apt: '마감', lh: 'LH 마감', ipo: '공모주 마감' };

export function dayCounts(rowsByDay: Record<string, ListRow[]>): Record<string, DayCount[]> {
  const out: Record<string, DayCount[]> = {};
  for (const [d, rows] of Object.entries(rowsByDay)) {
    const m = new Map<string, DayCount>();
    for (const r of rows) {
      const key = r.end ? `end-${r.group}` : r.kind;
      const c = m.get(key) ?? { key, label: r.end ? END_LABEL[r.group] : COUNT_LABEL[r.kind], count: 0, group: r.group };
      c.count++;
      m.set(key, c);
    }
    out[d] = [...m.values()];
  }
  return out;
}

// ── 아래 목록: 날짜 머리 + 줄. 이번 달이면 오늘 전 날짜는 '지난 일정'으로 접는다 ──
export interface CalDay { date: string; id: string; label: string; dday: string | null; tone: Tone; rows: ListRow[] }
export const dayId = (d: string): string => `d-${d}`;
export const shortDay = (d: string): string => formatDay(d).slice(5);

export function calDay(date: string, today: string, rows: ListRow[]): CalDay {
  const d = dday(today, date);
  return { date, id: dayId(date), label: shortDay(date), dday: d.label, tone: d.tone, rows };
}

export function dayList(rowsByDay: Record<string, ListRow[]>, ym: string, today: string): { past: CalDay[]; pastCount: number; days: CalDay[] } {
  const all = Object.keys(rowsByDay).sort().map((d) => calDay(d, today, rowsByDay[d]));
  const fold = today.slice(0, 7) === ym;
  const past = fold ? all.filter((d) => d.date < today) : [];
  return { past, pastCount: past.reduce((n, d) => n + d.rows.length, 0), days: fold ? all.filter((d) => d.date >= today) : all };
}

// ── 날짜 목록을 달력 줄(일~토) 단위로 묶는다. 휴대폰은 달력 칸이 없어 목록이 길어지므로 첫 주만 펼치고 나머지는 접는다 ──
export interface CalWeek { id: string; label: string; count: number; open: boolean; days: CalDay[] }

export function weekGroups(days: CalDay[], ym: string): CalWeek[] {
  const weeks: CalWeek[] = [];
  for (const row of monthGrid(ym)) {
    const inMonth = row.filter((d): d is string => d !== null);
    const ds = days.filter((d) => inMonth.includes(d.date));
    if (!ds.length) continue;
    const first = inMonth[0];
    weeks.push({
      id: `w-${first}`, label: `${shortDay(first)} ~ ${shortDay(inMonth[inMonth.length - 1])}`,
      count: ds.reduce((n, d) => n + d.rows.length, 0), open: weeks.length === 0, days: ds,
    });
  }
  return weeks;
}
