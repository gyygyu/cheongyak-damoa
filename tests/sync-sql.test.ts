import { describe, it, expect } from 'vitest';
import { sqlLiteral, upsertSql } from '../sync/sql';

describe('sqlLiteral', () => {
  it('NULL·숫자·문자열', () => {
    expect(sqlLiteral(null)).toBe('NULL');
    expect(sqlLiteral(12.5)).toBe('12.5');
    expect(sqlLiteral("O'Neil")).toBe("'O''Neil'");
  });
  it('NUL 문자를 지우고 2만 자로 자른다', () => {
    expect(sqlLiteral('a\u0000b')).toBe("'ab'");
    expect(sqlLiteral('x'.repeat(30_000)).length).toBe(20_002);
  });
  it('유한하지 않은 숫자는 오류', () => {
    expect(() => sqlLiteral(Number.NaN)).toThrow();
  });
});

describe('upsertSql', () => {
  const rows = [{ id: 'a', n: 1 }, { id: 'b', n: null }];
  it('키 충돌이면 나머지 열을 덮어쓴다', () => {
    expect(upsertSql('t', ['id'], rows)).toEqual([
      "INSERT INTO t (id, n) VALUES ('a', 1), ('b', NULL) ON CONFLICT(id) DO UPDATE SET n=excluded.n;",
    ]);
  });
  it('키 열만 있으면 DO NOTHING', () => {
    expect(upsertSql('t', ['id'], [{ id: 'a' }])).toEqual(["INSERT INTO t (id) VALUES ('a') ON CONFLICT(id) DO NOTHING;"]);
  });
  it('maxRows 로 나눈다', () => {
    expect(upsertSql('t', ['id'], rows, 1)).toHaveLength(2);
  });
  it('빈 배열이면 문이 없다', () => {
    expect(upsertSql('t', ['id'], [])).toEqual([]);
  });
  it('문 하나가 10만 자를 넘지 않게 나눈다', () => {
    const big = Array.from({ length: 10 }, (_, i) => ({ id: String(i), t: 'x'.repeat(20_000) }));
    const out = upsertSql('t', ['id'], big);
    expect(out.length).toBeGreaterThan(1);
    for (const s of out) expect(s.length).toBeLessThan(100_000);
  });
  it('잘못된 식별자·키 열 없음·열이 다른 행은 오류', () => {
    expect(() => upsertSql('t; DROP', ['id'], rows)).toThrow();
    expect(() => upsertSql('t', ['nope'], rows)).toThrow();
    expect(() => upsertSql('t', ['id'], [{ id: 'a', n: 1 }, { id: 'b', m: 2 }])).toThrow();
  });
});
