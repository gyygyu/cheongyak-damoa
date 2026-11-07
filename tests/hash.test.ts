import { describe, it, expect } from 'vitest';
import { fnv64 } from '../src/lib/hash';

describe('fnv64', () => {
  it('16자리 hex, 같은 입력은 같은 값', () => {
    expect(fnv64('abc')).toMatch(/^[0-9a-f]{16}$/);
    expect(fnv64('abc')).toBe(fnv64('abc'));
  });
  it('입력이 다르면 값이 다르다 (한글 포함)', () => {
    expect(fnv64('역삼동|1')).not.toBe(fnv64('역삼동|2'));
  });
});
