import { describe, it, expect } from 'vitest';
import { sqmToPyeong, formatArea, perSqmToPerPyeong, formatManwon } from '../src/lib/units';

describe('units', () => {
  it('㎡를 평으로 바꾼다 (1평 = 3.3058㎡, 소수 1자리)', () => {
    expect(sqmToPyeong(84)).toBe(25.4);
    expect(sqmToPyeong(59.99)).toBe(18.1);
  });
  it('면적을 "84㎡(25평)"처럼 적는다 (㎡는 소수 버림 없이 그대로 최대 2자리, 평은 반올림 정수)', () => {
    expect(formatArea(84)).toBe('84㎡(25평)');
    expect(formatArea(84.9512)).toBe('84.95㎡(26평)');
  });
  it('㎡당 가격을 평당 가격으로 바꾼다 (정수 만원)', () => {
    expect(perSqmToPerPyeong(1000)).toBe(3306);
  });
  it('만원 금액을 억·만원으로 적는다', () => {
    expect(formatManwon(123456)).toBe('12억 3,456만원');
    expect(formatManwon(50000)).toBe('5억원');
    expect(formatManwon(9800)).toBe('9,800만원');
    expect(formatManwon(0)).toBe('0원');
  });
});
