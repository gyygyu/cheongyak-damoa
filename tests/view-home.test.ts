import { describe, it, expect } from 'vitest';
import { homeView, HOME_LIMIT } from '../src/lib/view/home';
import type { HomeBundle } from '../src/lib/view/bundle-types';
import type { CalendarEvent } from '../src/lib/apt/schedule';

const T = '2026-11-07';
const b: HomeBundle = {
  today: T,
  events: [
    { date: '2026-11-05', endDate: '2026-11-08', kind: 'lh-receipt', ref: 'lh:L1', title: '화성 임대' },
    { date: '2026-11-07', kind: 'special', ref: 'apt:P1', title: '수원 영통' },
    { date: '2026-11-02', endDate: '2026-11-16', kind: 'rank1', ref: 'apt:P3', title: '시흥거모지구 S-1블록 공공분양(본청약)' },
    { date: '2026-11-02', endDate: '2026-11-17', kind: 'lh-receipt', ref: 'lh:L2', title: '시흥거모 S-1블록 공공분양주택 입주자모집공고' },
    { date: '2026-11-12', kind: 'rank1', ref: 'apt:P2', title: '시흥 거모' },
    { date: '2026-11-12', kind: 'winner', ref: 'apt:P4', title: '과천 B' },
    { date: '2026-11-14', kind: 'winner', ref: 'apt:P5', title: '이번 주 밖' },
  ],
  topCompetition: Array.from({ length: 7 }, (_, i) => ({ pblancNo: `P${9 + i}`, name: `과천 ${i}`, sido: '경기도', sigungu: '과천시', noticeDate: '2026-10-01', maxRate: 120.5 - i, applicants: 1000, supply: 8 })),
};

describe('homeView', () => {
  it('오늘 칸에는 오늘 시작·진행 중 일정을 마감이 가까운 순으로, 진행 중 접수에는 마감 D-day', () => {
    const v = homeView(b, T);
    expect(v.days[0]).toMatchObject({ date: T, dday: '오늘', tone: 'today', label: '11.07(토)' });
    expect(v.days[0].rows.map((r) => r.title)).toEqual(['수원 영통', '화성 임대', '시흥거모지구 S-1블록 공공분양(본청약)']);
    expect(v.days[0].rows[1]).toMatchObject({ note: '마감 D-1', noteTone: 'soon' });
    expect(v.days[0].rows[2]).toMatchObject({ note: '마감 D-9', noteTone: 'later' });
  });
  it('같은 단지의 청약홈·LH 일정은 한 번만 (청약홈 쪽)', () => {
    const refs = homeView(b, T).days.flatMap((d) => d.rows.map((r) => r.href));
    expect(refs).not.toContain('/lh/L2');
    expect(refs).toContain('/apt/P3');
  });
  it('앞으로 엿새 안의 일정은 날짜별로 묶고 D-day 를 단다', () => {
    const v = homeView(b, T);
    expect(v.days.map((d) => [d.date, d.dday, d.tone])).toEqual([[T, '오늘', 'today'], ['2026-11-12', 'D-5', 'later']]);
    expect(v.days[1].rows.map((r) => r.kindLabel)).toEqual(['1순위', '당첨자 발표']);
  });
  it('요약 숫자: 이번 주 접수 공고 수·발표 공고 수 (중복 뺀 뒤)', () => {
    expect(homeView(b, T).stats).toEqual({ receipts: 4, winners: 1 });
  });
  it(`목록은 ${HOME_LIMIT}줄까지만, 나머지는 건수로`, () => {
    const many: CalendarEvent[] = Array.from({ length: 12 }, (_, i) => ({ date: '2026-11-09', kind: 'rank1', ref: `apt:M${i}`, title: `단지 ${i}` }));
    const v = homeView({ ...b, events: many }, T);
    expect(v.days.flatMap((d) => d.rows).length).toBe(HOME_LIMIT);
    expect(v.more).toBe(12 - HOME_LIMIT);
    expect(v.calendarHref).toBe('/calendar/2026-11');
  });
  it('최근 경쟁률은 다섯 개까지', () => {
    const v = homeView(b, T);
    expect(v.top.length).toBe(5);
    expect(v.top[0]).toEqual({ name: '과천 0', href: '/apt/P9', place: '경기도 과천시', rate: '120.5 : 1' });
  });
  it('묶음이 없으면 빈 목록 (Review Focus 3)', () => {
    const v = homeView(null, T);
    expect([v.days, v.top].every((x) => x.length === 0)).toBe(true);
    expect(v.stats).toEqual({ receipts: 0, winners: 0 });
    expect(v.more).toBe(0);
  });
});
