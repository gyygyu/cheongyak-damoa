import { describe, it, expect } from 'vitest';
import { aptEvents, groupByMonth } from '../src/lib/apt/schedule';
import type { AptSchedule } from '../src/lib/apt/status';

const s: AptSchedule = {
  specialStart: '2026-11-30', specialEnd: '2026-11-30', rank1Start: '2026-12-01', rank1End: '2026-12-01',
  rank2Start: null, rank2End: null, winnerDate: '2026-12-08', contractStart: '2026-12-20', contractEnd: '2026-12-22',
};

describe('aptEvents', () => {
  it('있는 일정만 만들고, 기간은 endDate로', () => {
    const ev = aptEvents('P1', '광교자이', s);
    expect(ev.map((e) => e.kind)).toEqual(['special', 'rank1', 'winner', 'contract']);
    expect(ev[3]).toEqual({ date: '2026-12-20', endDate: '2026-12-22', kind: 'contract', ref: 'P1', title: '광교자이' });
    expect(ev[0].endDate).toBeUndefined(); // 하루짜리는 endDate 없음
  });
  it('지역(시도·시군구)이 있으면 일정마다 붙인다', () => {
    const ev = aptEvents('P1', '광교자이', s, { sido: '경기도', sigungu: '수원시 영통구' });
    expect(ev.every((e) => e.sido === '경기도' && e.sigungu === '수원시 영통구')).toBe(true);
    expect(aptEvents('P1', '광교자이', s, { sido: '세종특별자치시', sigungu: null })[0]).toMatchObject({ sido: '세종특별자치시' });
    expect('sigungu' in aptEvents('P1', '광교자이', s, { sido: '세종특별자치시', sigungu: null })[0]).toBe(false);
  });
});

describe('groupByMonth', () => {
  it('시작일 기준 달로 묶고 날짜순', () => {
    const g = groupByMonth(aptEvents('P1', '광교자이', s));
    expect(Object.keys(g)).toEqual(['2026-11', '2026-12']);
    expect(g['2026-12'].map((e) => e.date)).toEqual(['2026-12-01', '2026-12-08', '2026-12-20']);
  });
});
