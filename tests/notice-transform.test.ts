import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildLawdIndex } from '../src/lib/region/lawd';
import { str, int, num, yn } from '../src/lib/raw';
import { toNoticeRow, toModelRow, houseTyArea, moveInYm } from '../src/lib/apt/notice-transform';

const idx = buildLawdIndex(JSON.parse(readFileSync('content/lawd/lawd.json', 'utf8')));
const detail: Record<string, unknown>[] = JSON.parse(readFileSync('sync/fixtures/applyhome/notice-detail.json', 'utf8')).data;
const model: Record<string, unknown>[] = JSON.parse(readFileSync('sync/fixtures/applyhome/notice-model.json', 'utf8')).data;
const byNo = (no: string) => detail.find((d) => d.PBLANC_NO === no)!;

describe('raw', () => {
  it('str: 빈칸·공백·- 는 null, 숫자는 문자열', () => {
    expect(str(' ')).toBeNull();
    expect(str('-')).toBeNull();
    expect(str(undefined)).toBeNull();
    expect(str(0)).toBe('0');
    expect(str(' a ')).toBe('a');
  });
  it('int·num·yn', () => {
    expect(int('1,234')).toBe(1234);
    expect(int(27)).toBe(27);
    expect(int('12.5')).toBeNull();
    expect(num('84.9961')).toBe(84.9961);
    expect(num('(△3)')).toBeNull();
    expect(yn('Y')).toBe(1);
    expect(yn('n')).toBe(0);
    expect(yn(null)).toBeNull();
  });
});

describe('toNoticeRow', () => {
  it('신혼희망타운(국민) 공고', () => {
    const r = toNoticeRow(byNo('2026820015'), idx)!;
    expect(r).toMatchObject({
      pblanc_no: '2026820015', house_manage_no: '2026820015', house_kind: '신혼희망타운', rent_kind: '분양주택',
      area_code: '410', sido: '경기도', sigungu: '시흥시', supply_kind: 'national',
      public_land: 1, price_cap: 1, speculative: 0, adjusted: 0,
      notice_date: '2026-11-06', special_start: null, special_end: null,
      rank1_start: '2026-11-16', rank1_end: '2026-11-26', rank2_start: '2026-11-27', rank2_end: '2026-11-27',
      winner_date: '2026-12-08', contract_start: '2027-03-11', contract_end: '2027-03-14',
      move_in_ym: '2029-09', total_households: 480, state: 'normal',
    });
  });
  it('민영 공고: 특공 일정, 기타경기 없는 순위 일정, 법정동', () => {
    const r = toNoticeRow(byNo('2026000557'), idx)!;
    expect(r).toMatchObject({ supply_kind: 'private', lawd_cd: '41610', dong: '탄벌동', special_start: '2026-11-16', rank1_start: '2026-11-17', rank2_end: '2026-11-18' });
    const dates = JSON.parse(r.rank_dates as string);
    expect(dates.rank1).toEqual({ local: ['2026-11-17', '2026-11-17'], other: ['2026-11-17', '2026-11-17'] });
  });
  it('이름에 정정이 있으면 corrected', () => {
    const d = byNo('2026000553');
    expect(toNoticeRow({ ...d, HOUSE_NM: `${d.HOUSE_NM}(정정공고)` }, idx)!.state).toBe('corrected');
  });
  it('공고번호·이름이 없으면 null', () => {
    expect(toNoticeRow({ ...byNo('2026000553'), HOUSE_NM: ' ' }, idx)).toBeNull();
    expect(toNoticeRow({ ...byNo('2026000553'), PBLANC_NO: null }, idx)).toBeNull();
  });
  it('주소를 해석하지 못하면 지역은 null, 주소는 남긴다', () => {
    const r = toNoticeRow({ ...byNo('2026000553'), HSSPLY_ADRES: '어딘가 모르는 곳' }, idx)!;
    expect(r).toMatchObject({ address: '어딘가 모르는 곳', lawd_cd: null, sido: null, dong: null });
  });
});

describe('toModelRow', () => {
  it('주택형 행', () => {
    const m = toModelRow(model.find((x) => x.PBLANC_NO === '2026820015' && x.MODEL_NO === '01')!)!;
    expect(m).toMatchObject({ pblanc_no: '2026820015', model_no: '01', house_ty: '055.0000A', area_excl: 55, area_supply: 79.047, general_count: 0, top_price: 43390 });
    expect(JSON.parse(m.special_counts as string)).toMatchObject({ total: 277, newlywed: 0 });
  });
  it('주택형이 없으면 null', () => {
    expect(toModelRow({ ...model[0], HOUSE_TY: '' })).toBeNull();
  });
  it('houseTyArea·moveInYm', () => {
    expect(houseTyArea('084.3473A')).toBe(84.3473);
    expect(houseTyArea('A형')).toBeNull();
    expect(moveInYm('202909')).toBe('2029-09');
    expect(moveInYm('2029')).toBeNull();
  });
});
