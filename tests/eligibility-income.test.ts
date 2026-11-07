import { describe, it, expect } from 'vitest';
import { baseIncome, withinIncome, incomeTableFor } from '../src/lib/eligibility/income';
import { INCOME_TABLES } from '../src/lib/eligibility/tables';

const t = INCOME_TABLES.find((x) => x.year === 2026)!;

describe('2026 소득 기준표 (docs/special-supply-rules.md)', () => {
  it('3명 이하는 한 값, 4~8명은 가구원수별', () => {
    expect([1, 2, 3].map((n) => baseIncome(t, n))).toEqual([7_533_763, 7_533_763, 7_533_763]);
    expect([4, 5, 6, 7, 8].map((n) => baseIncome(t, n))).toEqual([8_802_202, 9_326_985, 9_906_263, 10_485_541, 11_064_819]);
  });
  it('8명 초과는 1명당 959,198원을 더한다', () => {
    expect(baseIncome(t, 9)).toBe(12_024_017);
    expect(baseIncome(t, 10)).toBe(12_983_215);
  });
  it('가구원 수가 0·음수·소수면 null', () => {
    expect(baseIncome(t, 0)).toBeNull();
    expect(baseIncome(t, -1)).toBeNull();
    expect(baseIncome(t, 2.5)).toBeNull();
  });
});

describe('withinIncome — 소수 없이 정수 비교', () => {
  it('제41조 140% 경계: 10,547,268원 이하', () => {
    expect(withinIncome(t, 3, 140, 10_547_268)).toBe(true);
    expect(withinIncome(t, 3, 140, 10_547_269)).toBe(false);
  });
  it('제41조 맞벌이 160% 경계: 12,054,020원 이하', () => {
    expect(withinIncome(t, 3, 160, 12_054_020)).toBe(true);
    expect(withinIncome(t, 3, 160, 12_054_021)).toBe(false);
  });
  it('4인 130% 경계: 11,442,862원 이하', () => {
    expect(withinIncome(t, 4, 130, 11_442_862)).toBe(true);
    expect(withinIncome(t, 4, 130, 11_442_863)).toBe(false);
  });
  it('소득 모름·음수·가구원 수 오류는 null', () => {
    expect(withinIncome(t, 3, 140, null)).toBeNull();
    expect(withinIncome(t, 3, 140, -1)).toBeNull();
    expect(withinIncome(t, 0, 140, 1_000_000)).toBeNull();
  });
});

describe('incomeTableFor — 공고일이 속한 해의 표', () => {
  it('2026년 표는 적용 시작일(2026-07-01)부터, 그 전·2025년·날짜 없음은 null', () => {
    expect(incomeTableFor(INCOME_TABLES, '2026-07-01')?.year).toBe(2026);
    expect(incomeTableFor(INCOME_TABLES, '2026-06-30')).toBeNull();
    expect(incomeTableFor(INCOME_TABLES, '2026-12-31')?.year).toBe(2026);
    expect(incomeTableFor(INCOME_TABLES, '2025-12-31')).toBeNull();
    expect(incomeTableFor(INCOME_TABLES, null)).toBeNull();
  });
});
