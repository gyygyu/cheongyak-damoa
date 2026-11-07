import { describe, it, expect } from 'vitest';
import { parseJibun, jibunKey, extractJibun } from '../src/lib/region/jibun';

describe('parseJibun', () => {
  it('본번-부번', () => expect(parseJibun('123-4')).toEqual({ san: false, main: 123, sub: 4 }));
  it('부번 없음은 0', () => expect(parseJibun('123')).toEqual({ san: false, main: 123, sub: 0 }));
  it('산 지번 (붙여 쓰기·띄어 쓰기)', () => {
    expect(parseJibun('산12-3')).toEqual({ san: true, main: 12, sub: 3 });
    expect(parseJibun('산 12')).toEqual({ san: true, main: 12, sub: 0 });
  });
  it('"번지"·앞자리 0을 정리한다', () => expect(parseJibun('0123-0004번지')).toEqual({ san: false, main: 123, sub: 4 }));
  it('지번이 아니면 null', () => {
    expect(parseJibun('테헤란로')).toBeNull();
    expect(parseJibun('')).toBeNull();
  });
});

describe('jibunKey', () => {
  it('같은 지번은 같은 키', () => {
    expect(jibunKey(parseJibun('123')!)).toBe('123-0');
    expect(jibunKey(parseJibun('123-0')!)).toBe('123-0');
    expect(jibunKey(parseJibun('산 12-3')!)).toBe('산12-3');
  });
});

describe('extractJibun', () => {
  it('남은 주소 첫 낱말이 지번이면 꺼낸다', () => {
    expect(extractJibun('123-4번지 일원')).toEqual({ san: false, main: 123, sub: 4 });
    expect(extractJibun('산 5 외 3필지')).toEqual({ san: true, main: 5, sub: 0 });
  });
  it('도로명·블록은 null', () => {
    expect(extractJibun('테헤란로 123')).toBeNull();
    expect(extractJibun('A-3블록')).toBeNull();
  });
});
