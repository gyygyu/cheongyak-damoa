import { describe, it, expect } from 'vitest';
import { normalizeComplexName } from '../src/lib/normalize-name';

describe('normalizeComplexName', () => {
  it('공백·괄호·"아파트"를 정리한다', () => {
    expect(normalizeComplexName('힐스테이트 영통 (아파트)')).toBe('힐스테이트영통');
    expect(normalizeComplexName('래미안 원베일리아파트')).toBe('래미안원베일리');
  });
  it('차수 표기를 숫자로 맞춘다', () => {
    expect(normalizeComplexName('e편한세상 수원 2차')).toBe(normalizeComplexName('e편한세상수원(제2차)'));
    expect(normalizeComplexName('자이 Ⅱ')).toBe(normalizeComplexName('자이2차'));
  });
  it('영문 대소문자를 맞춘다', () => expect(normalizeComplexName('DMC SK VIEW')).toBe('dmcskview'));
  it('차수·단지 번호가 다르면 다른 이름으로 남는다', () => {
    expect(normalizeComplexName('푸르지오 1차')).not.toBe(normalizeComplexName('푸르지오 2차'));
    expect(normalizeComplexName('LH 1단지')).not.toBe(normalizeComplexName('LH 2단지'));
  });
});
