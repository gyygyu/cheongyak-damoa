import { describe, it, expect } from 'vitest';
import { KV_KEYS } from '../src/lib/kv-keys';
import { buildBundles, type Dataset } from '../sync/bundles';

const notice = {
  pblanc_no: 'P1', house_manage_no: 'P1', name: '수원 영통 해모로', house_kind: '민영', rent_kind: null,
  area_code: '410', sido: '경기도', sigungu: '수원시 영통구', address: '경기도 수원시 영통구 망포동 100', lawd_cd: '41117', dong: '망포동',
  supply_kind: 'private', public_land: 0, price_cap: 0, speculative: 0, adjusted: 0, notice_date: '2026-11-01',
  special_start: '2026-11-09', special_end: '2026-11-09', rank1_start: '2026-11-10', rank1_end: '2026-11-10',
  rank2_start: '2026-11-11', rank2_end: '2026-11-11', rank_dates: null, winner_date: '2026-11-17',
  contract_start: '2026-11-28', contract_end: '2026-11-30', move_in_ym: '2029-03', total_households: 300,
  url: 'https://www.applyhome.co.kr/x', state: 'normal', hash: 'h', updated_at: 'u',
};
const lh = {
  lh_id: 'L1', title: '화성 임대', kind: 'rent', sub_kind: '국민임대', sido: '경기도', sigungu: '화성시', lawd_cd: '41590',
  address: '경기도 화성시', posted_date: '2026-11-01', receipt_start: '2026-11-12', receipt_end: '2026-11-14',
  winner_date: null, contract_start: null, contract_end: null, url: 'https://apply.lh.or.kr/x', state: '공고중', pblanc_no: null,
};
const ds: Dataset = {
  notices: [notice],
  models: [{ pblanc_no: 'P1', model_no: '01', house_ty: '084.9900A', area_excl: 84.99, area_supply: 112, general_count: 100, special_counts: null, top_price: 80000 }],
  competition: [{ pblanc_no: 'P1', model_no: '01', rank: 1, residence: 'local', supply_count: 50, applicants: 600, rate: 12, rate_text: '12' }],
  special: [],
  trades: [{ trade_key: 'T1', lawd_cd: '41117', umd_cd: '10500', dong: '망포동', jibun: '1', apt_seq: 'S1', name: '망포자이', area: 84, floor: 5, contract_date: '2026-10-10', amount: 70000, build_year: 2020, cancelled: 0, cancel_date: null }],
  presale: [], presaleLinks: [], lhNotices: [lh], lhSupply: [],
  account: [{ base_month: '2026-09', region: '경기', account_kind: '주택청약종합저축', area_kind: '', subscribers: 100, rank1: 50, rank2: 50 }],
};

describe('KV_KEYS', () => {
  it('buildBundles 가 만든 키는 KV_KEYS 로 만들 수 있다', () => {
    const keys = buildBundles(ds, { today: '2026-11-07', cityOf: new Map([['41117', '41110']]) }).map((w) => w.key);
    const expected = [
      KV_KEYS.apt('P1'), KV_KEYS.lh('L1'), KV_KEYS.calendar('2026-11'), KV_KEYS.home, KV_KEYS.competition,
      KV_KEYS.account, KV_KEYS.region('경기도'), KV_KEYS.region('경기도', '수원시 영통구'), KV_KEYS.trade('41117', '망포동'),
    ];
    for (const k of expected) expect(keys).toContain(k);
    // 화면이 모르는 키가 생기면 이 시험을 고치고 화면도 만든다
    const known = /^(apt|lh|calendar|region|trade):|^(home|competition|stats:account)$/;
    expect(keys.filter((k) => !known.test(k))).toEqual([]);
  });
  it('공모주 키는 ipo:{고유번호}', () => {
    expect(KV_KEYS.ipo('00123456')).toBe('ipo:00123456');
    expect(KV_KEYS.sources).toBe('meta:sources');
  });
});
