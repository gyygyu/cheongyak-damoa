import { describe, it, expect } from 'vitest';
import { aptPhase, type AptSchedule } from '../src/lib/apt/status';

const s: AptSchedule = {
  specialStart: '2026-11-10', specialEnd: '2026-11-10', rank1Start: '2026-11-11', rank1End: '2026-11-11',
  rank2Start: '2026-11-12', rank2End: '2026-11-12', winnerDate: '2026-11-19', contractStart: '2026-12-01', contractEnd: '2026-12-03',
};

describe('aptPhase', () => {
  it('첫 접수일 전은 upcoming', () => expect(aptPhase(s, 'normal', '2026-11-09')).toEqual({ phase: 'upcoming', corrected: false }));
  it('첫 접수일부터 마지막 접수일까지는 open (양 끝 포함)', () => {
    expect(aptPhase(s, 'normal', '2026-11-10').phase).toBe('open');
    expect(aptPhase(s, 'normal', '2026-11-12').phase).toBe('open');
  });
  it('마지막 접수일 다음 날부터 closed', () => expect(aptPhase(s, 'normal', '2026-11-13').phase).toBe('closed'));
  it('2순위가 없으면 1순위 마감이 마지막 접수일', () => {
    expect(aptPhase({ ...s, rank2Start: null, rank2End: null }, 'normal', '2026-11-12').phase).toBe('closed');
  });
  it('정정은 표시만 하고 단계는 그대로', () => expect(aptPhase(s, 'corrected', '2026-11-11')).toEqual({ phase: 'open', corrected: true }));
  it('취소가 가장 앞선다', () => expect(aptPhase(s, 'cancelled', '2026-11-11').phase).toBe('cancelled'));
  it('접수일을 하나도 모르면 upcoming', () => {
    const none = Object.fromEntries(Object.keys(s).map((k) => [k, null])) as unknown as AptSchedule;
    expect(aptPhase(none, 'normal', '2026-11-11').phase).toBe('upcoming');
  });
});
