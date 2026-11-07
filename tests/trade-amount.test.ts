import { describe, it, expect } from 'vitest';
import { parseDealAmount, parseArea } from '../src/lib/trade/amount';

describe('parseDealAmount', () => {
  it('쉼표·공백을 지우고 만원 정수로', () => {
    expect(parseDealAmount('    82,500')).toBe(82500);
    expect(parseDealAmount('125,000 ')).toBe(125000);
    expect(parseDealAmount(9800)).toBe(9800);
  });
  it('빈 값·"-"·숫자 아님은 null (그 행만 빠진다)', () => {
    expect(parseDealAmount('')).toBeNull();
    expect(parseDealAmount('-')).toBeNull();
    expect(parseDealAmount(undefined)).toBeNull();
    expect(parseDealAmount('12억')).toBeNull();
  });
});

describe('parseArea', () => {
  it('문자열 면적을 실수로', () => {
    expect(parseArea('84.9512')).toBe(84.9512);
    expect(parseArea(' 59.98 ')).toBe(59.98);
  });
  it('빈 값·0 이하는 null', () => {
    expect(parseArea('')).toBeNull();
    expect(parseArea('0')).toBeNull();
    expect(parseArea(null)).toBeNull();
  });
});
