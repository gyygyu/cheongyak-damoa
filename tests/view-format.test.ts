import { describe, it, expect } from 'vitest';
import { safeParam, formatDay, formatRange, formatRate, formatCount, formatHouseTy, labelOr, RESIDENCE_LABEL, KIND_LABEL } from '../src/lib/view/format';

describe('safeParam (Review Focus 1)', () => {
  it('인코딩된 한글을 푼다', () => expect(safeParam('%EA%B2%BD%EA%B8%B0%EB%8F%84')).toBe('경기도'));
  it('이미 풀린 값은 그대로', () => expect(safeParam('경기도')).toBe('경기도'));
  it('깨진 % 는 null (500 대신 404)', () => expect(safeParam('%E0%A4%A')).toBeNull());
  it('빈 값·undefined·길이 100 초과는 null', () => {
    expect(safeParam(undefined)).toBeNull();
    expect(safeParam('')).toBeNull();
    expect(safeParam('가'.repeat(101))).toBeNull();
  });
  it('KV 키 구분자 : 가 든 값은 null', () => expect(safeParam('경기도:시흥시')).toBeNull());
});

describe('날짜', () => {
  it('요일을 붙인다', () => expect(formatDay('2026-11-16')).toBe('2026.11.16(월)'));
  it('없으면 -', () => expect(formatDay(null)).toBe('-'));
  it('기간: 같은 해는 뒤 연도 생략, 같은 날은 한 번', () => {
    expect(formatRange('2026-11-16', '2026-11-26')).toBe('2026.11.16(월) ~ 11.26(목)');
    expect(formatRange('2026-12-30', '2027-01-02')).toBe('2026.12.30(수) ~ 2027.01.02(토)');
    expect(formatRange('2026-11-16', '2026-11-16')).toBe('2026.11.16(월)');
    expect(formatRange(null, null)).toBe('-');
  });
});

describe('숫자·라벨', () => {
  it('경쟁률', () => {
    expect(formatRate(12.5, '12.5')).toBe('12.5 : 1');
    expect(formatRate(null, '(△36)')).toBe('(△36)');
    expect(formatRate(null, null)).toBe('-');
  });
  it('건수', () => {
    expect(formatCount(12345)).toBe('12,345');
    expect(formatCount(null)).toBe('-');
  });
  it('주택형', () => {
    expect(formatHouseTy('084.9900A')).toBe('84.99A');
    expect(formatHouseTy('055.0000A')).toBe('55A');
    expect(formatHouseTy('74.9400A')).toBe('74.94A');
    expect(formatHouseTy(null)).toBe('-');
    expect(formatHouseTy('기타')).toBe('기타');
  });
  it('모르는 코드는 원문', () => {
    expect(labelOr(RESIDENCE_LABEL, 'local')).toBe('해당지역');
    expect(labelOr(RESIDENCE_LABEL, '기타경기')).toBe('기타경기');
    expect(KIND_LABEL['lh-receipt']).toBe('LH 접수');
  });
});
