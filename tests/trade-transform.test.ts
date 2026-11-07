import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseMolitXml, toTradeRows, toPresaleRows } from '../src/lib/trade/trade-transform';

const tradeXml = readFileSync('sync/fixtures/molit-apt/trade-11680-202610.xml', 'utf8');
const presaleXml = readFileSync('sync/fixtures/molit-presale/presale-41117-202610.xml', 'utf8');

describe('parseMolitXml', () => {
  it('결과 코드·전체 건수·항목을 읽는다', () => {
    const r = parseMolitXml(tradeXml);
    expect(r.resultCode).toBe('000');
    expect(r.totalCount).toBe(110);
    expect(r.items.length).toBe(5);
    expect(r.items[0].aptNm).toBe('은마');
  });
  it('엔티티를 풀고 빈 문서는 빈 목록', () => {
    const r = parseMolitXml('<response><header><resultCode>000</resultCode></header><body><items><item><aptNm>A&amp;B</aptNm></item></items><totalCount>1</totalCount></body></response>');
    expect(r.items[0].aptNm).toBe('A&B');
    expect(parseMolitXml('').items).toEqual([]);
    expect(parseMolitXml('').totalCount).toBe(0);
  });
});

describe('toTradeRows', () => {
  const rows = toTradeRows(parseMolitXml(tradeXml).items);
  it('매매 첫 항목 (은마)', () => {
    expect(rows[0]).toMatchObject({
      lawd_cd: '11680', umd_cd: '10600', dong: '대치동', jibun: '316', apt_seq: '11680-218', name: '은마',
      area: 76.79, floor: 7, contract_date: '2026-10-16', amount: 319000, build_year: 1979, cancelled: 0, cancel_date: null,
    });
    expect(String(rows[0].trade_key)).toMatch(/^[0-9a-f]{16}$/);
  });
  it('해제 거래: cdealType 이 있으면 cancelled 1, 해제일 YY.MM.DD 를 풀어 쓴다', () => {
    const [r] = toTradeRows([{ sggCd: '11680', umdNm: '대치동', aptNm: '은마', excluUseAr: '76.79', dealAmount: '1,000', dealYear: '2026', dealMonth: '10', dealDay: '1', cdealType: 'O', cdealDay: '26.10.20' }]);
    expect(r.cancelled).toBe(1);
    expect(r.cancel_date).toBe('2026-10-20');
  });
  it('금액·면적·날짜·필수 이름이 없으면 건너뛴다', () => {
    const base = { sggCd: '11680', umdNm: '대치동', aptNm: '은마', excluUseAr: '76.79', dealAmount: '1,000', dealYear: '2026', dealMonth: '10', dealDay: '1' };
    expect(toTradeRows([{ ...base, dealAmount: ' ' }])).toEqual([]);
    expect(toTradeRows([{ ...base, excluUseAr: '0' }])).toEqual([]);
    expect(toTradeRows([{ ...base, dealDay: '32' }])).toEqual([]);
    expect(toTradeRows([{ ...base, aptNm: '' }])).toEqual([]);
  });
  it('같은 필드의 거래 두 건은 키가 겹치지 않는다', () => {
    const it1 = { sggCd: '11680', umdNm: '대치동', aptNm: '은마', excluUseAr: '76.79', dealAmount: '1,000', dealYear: '2026', dealMonth: '10', dealDay: '1' };
    const keys = toTradeRows([it1, { ...it1 }]).map((r) => r.trade_key);
    expect(new Set(keys).size).toBe(2);
  });
});

describe('toPresaleRows', () => {
  it('분양권 첫 항목', () => {
    const rows = toPresaleRows(parseMolitXml(presaleXml).items);
    expect(rows.length).toBe(2);
    expect(rows[0]).toMatchObject({
      sgg_cd: '41117', dong: '영통동', jibun: '961-11', name: '영통자이 센트럴파크',
      area: 84.9961, floor: 12, contract_date: '2026-10-31', amount: 162920, kind: null, cancelled: 0,
    });
    expect(rows[1].amount).toBe(125510);
  });
});
