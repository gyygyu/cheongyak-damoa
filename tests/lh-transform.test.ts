import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildLawdIndex } from '../src/lib/region/lawd';
import { mergeLh, lhListItems, toLhNoticeRow, toLhSupplyRows } from '../src/lib/apt/lh-transform';

const idx = buildLawdIndex(JSON.parse(readFileSync('content/lawd/lawd.json', 'utf8')));
const load = (f: string) => JSON.parse(readFileSync(`sync/fixtures/lh/${f}`, 'utf8'));
const list = lhListItems(load('notice-list.json'));
const item = list.find((x) => x.PAN_ID === '0000061205')!;
const detail = mergeLh(load('notice-detail.json'));
const supply = mergeLh(load('notice-supply.json'));

describe('lhListItems·mergeLh', () => {
  it('목록 24건', () => expect(list.length).toBe(24));
  it('배열이 아니면 빈 값', () => {
    expect(mergeLh(null)).toEqual({});
    expect(lhListItems({})).toEqual([]);
  });
});

describe('toLhNoticeRow', () => {
  it('상세 없이: 목록 값만', () => {
    const r = toLhNoticeRow(item, null, idx)!;
    expect(r).toMatchObject({
      lh_id: '0000061205', title: '안산신길2 B-1블록 공공분양주택 입주자 모집공고', kind: 'sale', sub_kind: '분양주택',
      upp_ais_tp_cd: '05', spl_inf_tp_cd: '050', ccr_cnnt_sys_ds_cd: '02', sido: '경기도', sigungu: null, lawd_cd: null,
      posted_date: '2026-11-04', receipt_start: null, receipt_end: '2026-11-18', state: '공고중', pblanc_no: null,
    });
    expect(String(r.url)).toMatch(/^https:\/\/apply\.lh\.or\.kr\//);
  });
  it('상세가 있으면 주소·일정을 채운다', () => {
    const r = toLhNoticeRow(item, detail, idx)!;
    expect(r).toMatchObject({
      address: '경기도 안산시 단원구 신길동', lawd_cd: '41273',
      receipt_start: '2026-11-09', receipt_end: '2026-11-18', winner_date: '2026-11-30',
      contract_start: '2027-03-15', contract_end: '2027-03-18',
    });
    expect(String(r.sido)).toMatch(/경기/);
    expect(String(r.sigungu)).toContain('단원구');
  });
  it('임대(06)는 rent, 분양·임대가 아니면 null', () => {
    expect(toLhNoticeRow({ ...item, UPP_AIS_TP_CD: '06' }, null, idx)!.kind).toBe('rent');
    expect(toLhNoticeRow({ ...item, UPP_AIS_TP_CD: '13' }, null, idx)).toBeNull();
    expect(toLhNoticeRow({ ...item, PAN_ID: '' }, null, idx)).toBeNull();
  });
  it('주소를 풀지 못하면 목록의 시도만 남긴다', () => {
    const r = toLhNoticeRow(item, { dsSbd: [{ LCT_ARA_ADR: '어딘가' }], dsSplScdl: [] }, idx)!;
    expect(r).toMatchObject({ sido: '경기도', lawd_cd: null, address: '어딘가', receipt_end: '2026-11-18' });
  });
});

describe('toLhSupplyRows', () => {
  const rows = toLhSupplyRows('0000061205', supply);
  it('dsList01 8행, 원 → 만원', () => {
    expect(rows.length).toBe(8);
    expect(rows[0]).toMatchObject({ lh_id: '0000061205', supply_type: '01', house_ty: '74.9400A', area_excl: 74.94, households: 80, price: 50430, deposit: null, monthly_rent: null });
  });
  it('임대 표는 보증금·월세', () => {
    const [r] = toLhSupplyRows('X', { dsList02: [{ HTY_NM: '26A', RSDN_DDO_AR: '26.5', SIL_HSH_CNT: '10', LS_GMY: '15,000,000', MM_RFE: '125000' }] });
    expect(r).toMatchObject({ supply_type: '02', price: null, deposit: 1500, monthly_rent: 13 });
  });
  it('주택형이 없는 행은 건너뛴다', () => {
    expect(toLhSupplyRows('X', { dsList01: [{ HTY_NM: '' }] })).toEqual([]);
  });
});
