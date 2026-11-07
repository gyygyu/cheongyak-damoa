import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { toAccountRows } from '../src/lib/apt/account-transform';

const load = (f: string) => JSON.parse(readFileSync(`sync/fixtures/account-stats/${f}.json`, 'utf8')).data;
const rows = toAccountRows(load('all'), load('deposit'), load('subscribe'));
const find = (region: string, area: string) => rows.find((r) => r.region === region && r.account_kind === '청약예금' && r.area_kind === area);

describe('toAccountRows', () => {
  it('가입현황: 서울 85㎡ 이하 1순위, 같은 키의 가입기간별 계좌 수를 subscribers 로', () => {
    expect(find('서울', '01')).toMatchObject({ base_month: '2026-09', rank1: 95607, rank2: 0, subscribers: 205 });
  });
  it('가입현황만 있는 키는 subscribers null', () => {
    expect(find('인천·경기', '01')).toMatchObject({ rank1: 30286, subscribers: null });
  });
  it('예치금액별: 시도와 지역이 다르면 "시도 지역", area_kind 빈 문자열', () => {
    expect(find('강원 춘천', '')).toMatchObject({ rank1: 912, rank2: 0, subscribers: null });
    expect(find('서울', '')).toMatchObject({ rank1: 272768 });
  });
  it('키가 겹치지 않는다', () => {
    const keys = rows.map((r) => [r.base_month, r.region, r.account_kind, r.area_kind].join('|'));
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('같은 키는 합치고, 기준월·지역·종류가 없는 행은 버린다', () => {
    const s = { DELNG_OCCRRNC_YM: '202609', DPST_ITEM_NM: '청약예금', SIDO_NM: '서울', SUBSCRPT_AREA_CODE_NM: '서울', BLNC_SECD: '01' };
    const out = toAccountRows([], [], [{ ...s, ACNUT_CO: 2 }, { ...s, ACNUT_CO: 3 }, { ...s, DELNG_OCCRRNC_YM: '', ACNUT_CO: 9 }]);
    expect(out).toEqual([{ base_month: '2026-09', region: '서울', account_kind: '청약예금', area_kind: '01', subscribers: 5, rank1: null, rank2: null }]);
  });
});
