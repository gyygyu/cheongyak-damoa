import { describe, it, expect } from 'vitest';
import { rowHash, withHash, keyBy, diffRows, hashQuerySql, guardCount } from '../sync/diff';

const now = '2026-11-07T00:00:00.000Z';

describe('rowHash·withHash', () => {
  it('열 순서·hash·updated_at 과 무관하고 값이 바뀌면 달라진다', () => {
    expect(rowHash({ a: 1, b: 'x' })).toBe(rowHash({ b: 'x', a: 1, hash: 'z', updated_at: 't' }));
    expect(rowHash({ a: 1 })).not.toBe(rowHash({ a: 2 }));
    expect(rowHash({ a: null })).not.toBe(rowHash({ a: '' }));
  });
  it('withHash 는 hash·updated_at 을 붙인다', () => {
    const r = withHash({ a: 1 }, now);
    expect(r).toEqual({ a: 1, hash: rowHash({ a: 1 }), updated_at: now });
  });
});

describe('keyBy·diffRows', () => {
  it('null 은 빈 문자열, 열은 | 로 잇는다', () => {
    expect(keyBy(['a', 'b'])({ a: 'x', b: null })).toBe('x|');
    expect(keyBy(['a', 'b'])({ a: 'x', b: 2 })).toBe('x|2');
  });
  it('해시가 바뀐 행만, 같은 키는 마지막 행을 쓴다', () => {
    const k = keyBy(['id']);
    const r1 = withHash({ id: 'a', n: 1 }, now);
    const r2 = withHash({ id: 'b', n: 2 }, now);
    const r2b = withHash({ id: 'b', n: 3 }, now);
    const prev = new Map([['a', r1.hash as string], ['b', r2.hash as string]]);
    expect(diffRows([r1, r2, r2b], k, prev)).toEqual([r2b]);
  });
});

describe('hashQuerySql', () => {
  it('키 열을 문자열로 이어 붙여 hash 와 함께 읽는다', () => {
    expect(hashQuerySql('apt_model', ['pblanc_no', 'model_no'])).toBe(
      "SELECT COALESCE(CAST(pblanc_no AS TEXT),'')||'|'||COALESCE(CAST(model_no AS TEXT),'') AS k, hash FROM apt_model",
    );
  });
});

describe('guardCount', () => {
  it('0건은 막는다', () => {
    expect(guardCount(0, 10)).toEqual({ ok: false, reason: '0건' });
    expect(guardCount(0, null)).toEqual({ ok: false, reason: '0건' });
  });
  it('70% 넘게 줄면 막는다', () => {
    expect(guardCount(29, 100)).toEqual({ ok: false, reason: '직전 100건 → 29건 (71% 감소)' });
  });
  it('정확히 70% 감소는 통과', () => {
    expect(guardCount(30, 100)).toEqual({ ok: true });
  });
  it('직전 기록이 없으면 통과', () => {
    expect(guardCount(5, null)).toEqual({ ok: true });
    expect(guardCount(5, 0)).toEqual({ ok: true });
  });
});
