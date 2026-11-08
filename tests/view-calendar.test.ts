import { describe, it, expect } from 'vitest';
import { parseMonth, monthGrid, eventsByDay, mergeEvents, hrefOf, kindGroup, prevMonth, nextMonth, eventRow } from '../src/lib/view/calendar';
import type { CalendarEvent } from '../src/lib/apt/schedule';

const ev = (date: string, endDate?: string, kind: CalendarEvent['kind'] = 'rank1', ref = 'apt:P1'): CalendarEvent =>
  ({ date, ...(endDate ? { endDate } : {}), kind, ref, title: '시흥 거모' });

describe('parseMonth', () => {
  it('YYYY-MM 이고 ±12개월 안이면 그대로', () => {
    expect(parseMonth('2026-11', '2026-11-07')).toBe('2026-11');
    expect(parseMonth('2027-11', '2026-11-07')).toBe('2027-11');
    expect(parseMonth('2025-11', '2026-11-07')).toBe('2025-11');
  });
  it('범위 밖·형식 오류는 null', () => {
    for (const v of ['2027-12', '2025-10', '2026-13', '2026-1', 'abc', undefined]) expect(parseMonth(v, '2026-11-07')).toBeNull();
  });
  it('앞뒤 달', () => {
    expect(prevMonth('2026-01')).toBe('2025-12');
    expect(nextMonth('2026-12')).toBe('2027-01');
  });
});

describe('monthGrid', () => {
  it('2026-11 은 일요일(1일)부터, 5주', () => {
    const g = monthGrid('2026-11');
    expect(g[0][0]).toBe('2026-11-01');
    expect(g.length).toBe(5);
    expect(g[4].filter(Boolean).at(-1)).toBe('2026-11-30');
    expect(g.every((w) => w.length === 7)).toBe(true);
  });
  it('2026-12 는 화요일 시작이라 앞 두 칸이 비어 있다', () => {
    const g = monthGrid('2026-12');
    expect(g[0].slice(0, 3)).toEqual([null, null, '2026-12-01']);
  });
});

describe('eventsByDay (Review Focus 5)', () => {
  it('여러 날 일정은 매일 칸에', () => {
    const days = eventsByDay([ev('2026-11-16', '2026-11-18')], '2026-11');
    expect(Object.keys(days).sort()).toEqual(['2026-11-16', '2026-11-17', '2026-11-18']);
  });
  it('지난달에 시작한 일정이 이번 달 칸에도 보인다', () => {
    const days = eventsByDay([ev('2026-10-30', '2026-11-02')], '2026-11');
    expect(Object.keys(days).sort()).toEqual(['2026-11-01', '2026-11-02']);
  });
  it('다음 달로 넘어가는 일정은 이번 달 끝까지만', () => {
    const days = eventsByDay([ev('2026-11-30', '2026-12-02')], '2026-11');
    expect(Object.keys(days)).toEqual(['2026-11-30']);
  });
  it('끝날이 시작보다 앞서는 잘못된 값은 시작일 하루만', () => {
    expect(Object.keys(eventsByDay([ev('2026-11-05', '2026-11-01')], '2026-11'))).toEqual(['2026-11-05']);
  });
  it('mergeEvents 는 이번 달·지난달 묶음의 같은 일정을 하나로', () => {
    expect(mergeEvents([ev('2026-11-01')], [ev('2026-11-01'), ev('2026-11-02')]).length).toBe(2);
  });
});

describe('링크·그룹', () => {
  it('ref → 주소', () => {
    expect(hrefOf('apt:2026000557')).toBe('/apt/2026000557');
    expect(hrefOf('lh:0000061174')).toBe('/lh/0000061174');
    expect(hrefOf('ipo:00123456')).toBe('/ipo/00123456');
    expect(hrefOf('apt:null')).toBeNull();
    expect(hrefOf('x')).toBeNull();
  });
  it('그룹', () => {
    expect(kindGroup('rank1')).toBe('apt');
    expect(kindGroup('lh-receipt')).toBe('lh');
    expect(kindGroup('ipo-listing')).toBe('ipo');
  });
  it('eventRow', () => {
    expect(eventRow(ev('2026-11-16', '2026-11-26'))).toMatchObject({ dateText: '2026.11.16(월) ~ 11.26(목)', kindLabel: '1순위', href: '/apt/P1', group: 'apt' });
  });
});
