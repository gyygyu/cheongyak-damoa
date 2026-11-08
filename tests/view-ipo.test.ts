import { describe, it, expect } from 'vitest';
import { ipoView, ipoEvents, formatWon, IPO_DISCLAIMER } from '../src/lib/view/ipo';
import { BANNED_WORDS } from '../src/lib/view/apt';
import type { IpoBundle } from '../src/lib/view/bundle-types';

const b = (over: Partial<IpoBundle['ipo']> = {}, lockup?: IpoBundle['lockup']): IpoBundle => ({
  ipo: {
    corp_code: '00123456', name: '가나다전자', stock_code: '123450', market: '코스닥', sub_start: '2026-11-20', sub_end: '2026-11-21',
    price_low: 12000, price_high: 15000, price_final: null, listing_date: null, underwriters: '한국투자증권, 미래에셋증권',
    offer_shares: 1000000, revisions: '[{"date":"2026-11-10","note":"공모가 범위 정정"}]', state: 'normal', ...over,
  },
  ...(lockup ? { lockup } : {}),
});

describe('ipoView', () => {
  it('일정·희망가·주관사·정정 이력', () => {
    const v = ipoView(b());
    expect(v.schedule).toEqual([{ label: '청약', value: '2026.11.20(금) ~ 11.21(토)' }, { label: '공모 주식 수', value: '1,000,000주' }]);
    expect(v.price).toEqual([{ label: '희망 공모가', value: '12,000원 ~ 15,000원' }]);
    expect(v.underwriters).toBe('한국투자증권, 미래에셋증권');
    expect(v.revisions).toEqual([{ date: '2026.11.10(화)', note: '공모가 범위 정정' }]);
  });
  it('확정가·상장일이 있으면 줄이 생긴다', () => {
    const v = ipoView(b({ price_final: 14000, listing_date: '2026-12-01' }));
    expect(v.price.map((r) => r.label)).toEqual(['희망 공모가', '확정 공모가']);
    expect(v.schedule.map((r) => r.label)).toContain('상장');
  });
  it('보호예수가 없으면 빈 배열 (수집 꺼짐, Review Focus 3)', () => {
    expect(ipoView(b()).lockup).toEqual([]);
    expect(ipoView(b({}, [{ release_date: '2027-05-20', share_kind: '최대주주', shares: 500000 }])).lockup).toEqual([{ date: '2027.05.20(목)', kind: '최대주주', shares: '500,000주' }]);
  });
  it('정정 이력이 깨진 JSON 이면 빈 배열', () => expect(ipoView(b({ revisions: '[x' })).revisions).toEqual([]));
  it('철회는 배지', () => expect(ipoView(b({ state: 'cancelled' })).stateBadge).toBe('철회'));
  it('어떤 값이 와도 평가어를 쓰지 않는다 (spec §13)', () => {
    const all = JSON.stringify([ipoView(b()), ipoView(b({ price_final: 14000, listing_date: '2026-12-01', state: 'corrected' })), IPO_DISCLAIMER]);
    expect(all).not.toMatch(BANNED_WORDS);
    expect(all).not.toMatch(/수익|매수|매도|전망/);
  });
  it('안내 문구', () => expect(IPO_DISCLAIMER).toBe('투자 권유가 아닙니다.'));
});

describe('ipoEvents', () => {
  it('ipo-* 일정만, 묶음이 없어도 된다', () => {
    const rows = ipoEvents([
      { month: '2026-11', events: [
        { date: '2026-11-20', endDate: '2026-11-21', kind: 'ipo-sub', ref: 'ipo:00123456', title: '가나다전자' },
        { date: '2026-11-16', kind: 'rank1', ref: 'apt:P1', title: '시흥' },
      ] },
      null,
    ]);
    expect(rows.map((r) => r.title)).toEqual(['가나다전자']);
    expect(rows[0].href).toBe('/ipo/00123456');
    expect(ipoEvents([null, null])).toEqual([]);
  });
});

describe('formatWon', () => {
  it('원 단위', () => {
    expect(formatWon(12000)).toBe('12,000원');
    expect(formatWon(null)).toBe('-');
  });
});
