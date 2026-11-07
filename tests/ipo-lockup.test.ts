import { describe, it, expect } from 'vitest';
import { matchLockups, normalizeStockCode, normalizeCrno, type LockupRow, type IpoIds } from '../src/lib/ipo/lockup';

const ipos: IpoIds[] = [
  { corpCode: '00100001', stockCode: '012345', crno: '1101111234567' },
  { corpCode: '00100002', stockCode: null, crno: '1101119876543' },
];
const row = (o: Partial<LockupRow>): LockupRow => ({ stockCode: null, crno: null, releaseDate: '2027-05-01', shareKind: '보통주', shares: 1000, ...o });

describe('정규화', () => {
  it('종목코드: 앞 A 제거, 6자리', () => {
    expect(normalizeStockCode('A012345')).toBe('012345');
    expect(normalizeStockCode('12345')).toBe('012345');
    expect(normalizeStockCode('')).toBeNull();
  });
  it('법인등록번호: 하이픈 제거, 13자리만', () => {
    expect(normalizeCrno('110111-1234567')).toBe('1101111234567');
    expect(normalizeCrno('123')).toBeNull();
    expect(normalizeCrno('0000000000000')).toBeNull(); // 외국법인 자리표시
  });
});

describe('matchLockups', () => {
  it('1차 종목코드로 맞춘다', () => {
    expect(matchLockups([row({ stockCode: 'A012345' })], ipos)[0].corpCode).toBe('00100001');
  });
  it('종목코드가 없으면 법인등록번호로 맞춘다', () => {
    expect(matchLockups([row({ crno: '110111-9876543' })], ipos)[0].corpCode).toBe('00100002');
  });
  it('종목코드가 있어도 맞는 공모주가 없으면 법인등록번호로 다시 본다', () => {
    expect(matchLockups([row({ stockCode: '999999', crno: '1101119876543' })], ipos)[0].corpCode).toBe('00100002');
  });
  it('둘 다 없거나 맞지 않으면 버린다', () => {
    expect(matchLockups([row({}), row({ stockCode: '999999' })], ipos)).toEqual([]);
  });
});
