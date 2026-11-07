import { describe, it, expect } from 'vitest';
import { serviceKeyParam, redactKeys } from '../sync/http';

describe('serviceKeyParam', () => {
  it('이미 인코딩된 키(% 포함)는 그대로 둔다', () => {
    expect(serviceKeyParam('abc%2Bdef%3D%3D')).toBe('abc%2Bdef%3D%3D');
  });
  it('디코딩 키는 인코딩한다', () => {
    expect(serviceKeyParam('abc+def==')).toBe('abc%2Bdef%3D%3D');
  });
});

describe('redactKeys', () => {
  it('원문 키와 인코딩된 키를 모두 지운다', () => {
    const t = 'serviceKey=abc%2Bdef%3D%3D&x=1 abc+def==';
    expect(redactKeys(t, ['abc+def=='])).toBe('serviceKey=<KEY>&x=1 <KEY>');
  });
  it('빈 키는 무시한다', () => {
    expect(redactKeys('abc', [''])).toBe('abc');
  });
});
