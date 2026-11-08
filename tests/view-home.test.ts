import { describe, it, expect } from 'vitest';
import { homeView } from '../src/lib/view/home';
import type { HomeBundle } from '../src/lib/view/bundle-types';

const b: HomeBundle = {
  today: '2026-11-07',
  events: [
    { date: '2026-11-05', endDate: '2026-11-08', kind: 'lh-receipt', ref: 'lh:L1', title: '화성 임대' },
    { date: '2026-11-07', kind: 'special', ref: 'apt:P1', title: '수원 영통' },
    { date: '2026-11-12', kind: 'rank1', ref: 'apt:P2', title: '시흥 거모' },
  ],
  topCompetition: [{ pblancNo: 'P9', name: '과천 A', sido: '경기도', sigungu: '과천시', noticeDate: '2026-10-01', maxRate: 120.5, applicants: 1000, supply: 8 }],
};

describe('homeView', () => {
  it('오늘 진행 중인 일정, 마감 임박(2일 안에 끝남), 이번 주 예정으로 나눈다', () => {
    const v = homeView(b, '2026-11-07');
    expect(v.todayRows.map((r) => r.title)).toEqual(['화성 임대', '수원 영통']);
    expect(v.closingRows.map((r) => r.title)).toEqual(['화성 임대', '수원 영통']);
    expect(v.weekRows.map((r) => r.title)).toEqual(['시흥 거모']);
  });
  it('최근 경쟁률', () => {
    expect(homeView(b, '2026-11-07').top[0]).toEqual({ name: '과천 A', href: '/apt/P9', place: '경기도 과천시', rate: '120.5 : 1' });
  });
  it('묶음이 없으면 빈 목록 (Review Focus 3)', () => {
    const v = homeView(null, '2026-11-07');
    expect([v.todayRows, v.closingRows, v.weekRows, v.top].every((x) => x.length === 0)).toBe(true);
  });
});
