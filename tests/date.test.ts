import { describe, it, expect } from 'vitest';
import { normalizeDate, ymd, addMonths, daysBetween, todayKst } from '../src/lib/date';

describe('normalizeDate', () => {
  it('출처마다 다른 날짜 형식을 YYYY-MM-DD로', () => {
    expect(normalizeDate('20261107')).toBe('2026-11-07');
    expect(normalizeDate('2026-11-07')).toBe('2026-11-07');
    expect(normalizeDate('2026.11.07')).toBe('2026-11-07');
    expect(normalizeDate('2026. 11. 7.')).toBe('2026-11-07');
    expect(normalizeDate('2026-11-07 10:00:00')).toBe('2026-11-07');
  });
  it('빈 값·틀린 날짜는 null', () => {
    expect(normalizeDate('')).toBeNull();
    expect(normalizeDate(null)).toBeNull();
    expect(normalizeDate('-')).toBeNull();
    expect(normalizeDate('20260230')).toBeNull();
  });
});

describe('날짜 계산', () => {
  it('ymd는 0을 채운다', () => expect(ymd(2026, '3', 5)).toBe('2026-03-05'));
  it('addMonths는 말일을 보정한다', () => {
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
    expect(addMonths('2026-11-07', -12)).toBe('2025-11-07');
  });
  it('daysBetween', () => {
    expect(daysBetween('2026-11-07', '2026-11-10')).toBe(3);
    expect(daysBetween('2026-11-10', '2026-11-07')).toBe(-3);
  });
  it('todayKst는 한국 날짜', () => expect(todayKst(new Date('2026-11-06T15:30:00Z'))).toBe('2026-11-07'));
});
