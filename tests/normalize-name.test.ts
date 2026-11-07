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
  it('숫자 사이 하이픈은 남겨 다른 단지를 합치지 않는다', () => {
    expect(normalizeComplexName('행복마을 1-2단지')).not.toBe(normalizeComplexName('행복마을 12단지'));
    expect(normalizeComplexName('A-62블록')).not.toBe(normalizeComplexName('A6-2블록'));
    expect(normalizeComplexName('화성동탄2 A-62블록')).toBe(normalizeComplexName('화성동탄2 A62블록'));
  });
});
