import { describe, it, expect } from 'vitest';
import { lhView } from '../src/lib/view/lh';
import type { LhBundle } from '../src/lib/view/bundle-types';

const b = (kind: string, state: string, receiptEnd: string): LhBundle => ({
  notice: {
    lh_id: 'L1', title: '인천계양 A6 공공분양', kind, sub_kind: kind === 'sale' ? '분양주택' : '국민임대', sido: '인천광역시', sigungu: '계양구', lawd_cd: '28245',
    address: '인천 계양구', posted_date: '2026-09-14', receipt_start: '2026-11-09', receipt_end: receiptEnd, winner_date: '2026-11-30',
    contract_start: null, contract_end: null, url: 'https://apply.lh.or.kr/x', state, pblanc_no: null,
  },
  supply: [{ lh_id: 'L1', supply_type: '01', house_ty: '74.9400A', area_excl: 74.94, households: 80, price: 50430, deposit: 3000, monthly_rent: 25 }],
});

describe('lhView', () => {
  it('분양은 공급 금액, 판정 대상 아님', () => {
    const v = lhView(b('sale', '공고중', '2026-11-18'), '2026-11-07');
    expect(v.isRent).toBe(false);
    expect(v.supply[0]).toEqual({ houseTy: '74.94A', area: '74.94㎡(23평)', households: '80', price: '5억 430만원' });
    expect(v.banner).toBeNull();
  });
  it('임대는 보증금·월 임대료', () => {
    expect(lhView(b('rent', '공고중', '2026-11-18'), '2026-11-07').supply[0].price).toBe('보증금 3,000만원 · 월 25만원');
  });
  it('접수 마감 상태이거나 접수 끝날이 지났으면 종료 배너', () => {
    expect(lhView(b('sale', '접수마감', '2026-11-18'), '2026-11-07').banner?.kind).toBe('closed');
    expect(lhView(b('sale', '공고중', '2026-11-01'), '2026-11-07').banner?.kind).toBe('closed');
  });
  it('공급 정보가 없어도 된다', () => {
    const x = b('sale', '공고중', '2026-11-18');
    x.supply = [];
    expect(lhView(x, '2026-11-07').supply).toEqual([]);
  });
});
