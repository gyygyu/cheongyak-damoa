import { describe, it, expect } from 'vitest';
import { aptView, aptStages, perSqmPrice, nearbyText, BANNED_WORDS } from '../src/lib/view/apt';
import type { AptBundle } from '../src/lib/view/bundle-types';

const bundle = (over: Partial<AptBundle> = {}): AptBundle => ({
  notice: {
    pblanc_no: 'P1', house_manage_no: 'P1', name: '시흥 거모 아테라', house_kind: '신혼희망타운', rent_kind: null, area_code: '410',
    sido: '경기도', sigungu: '시흥시', address: '경기도 시흥시 거모지구 A-6', lawd_cd: '41390', dong: null,
    supply_kind: 'national', public_land: 1, price_cap: 1, speculative: 0, adjusted: 0,
    notice_date: '2026-11-06', special_start: null, special_end: null, rank1_start: '2026-11-16', rank1_end: '2026-11-26',
    rank2_start: '2026-11-27', rank2_end: '2026-11-27', rank_dates: null, winner_date: '2026-12-08',
    contract_start: '2027-03-11', contract_end: '2027-03-14', move_in_ym: '2029-09', total_households: 480,
    url: 'https://www.applyhome.co.kr/x', state: 'normal',
  },
  phase: 'upcoming', corrected: false,
  models: [{
    pblanc_no: 'P1', model_no: '01', house_ty: '055.0000A', area_excl: 55, area_supply: 79.047, general_count: 0,
    special_counts: '{"newlywed":10,"newborn":5,"total":15}', top_price: 43390,
    nearby: { scope: 'dong', count: 7, medianPerSqm: 700 },
  }],
  competition: [
    { pblanc_no: 'P1', model_no: '01', rank: 1, residence: 'other', supply_count: 10, applicants: 30, rate: 3, rate_text: '3' },
    { pblanc_no: 'P1', model_no: '01', rank: 1, residence: 'local', supply_count: 10, applicants: 120, rate: 12, rate_text: '12' },
  ],
  special: [
    { pblanc_no: 'P1', model_no: '01', special_type: 'newlywed', residence: 'local', allotted: null, applicants: 40 },
    { pblanc_no: 'P1', model_no: '01', special_type: 'newlywed', residence: 'all', allotted: 10, applicants: 55 },
  ],
  lhLinks: [{ lhId: 'L1', title: 'LH 공고', url: 'https://apply.lh.or.kr/x' }],
  presale: [],
  ...over,
});

describe('perSqmPrice', () => {
  it('전용면적 기준 ㎡당 만원', () => expect(perSqmPrice(43390, 55)).toBe(789));
  it('값이 없거나 면적 0 이면 null', () => {
    expect(perSqmPrice(null, 55)).toBeNull();
    expect(perSqmPrice(43390, 0)).toBeNull();
  });
});

describe('nearbyText (spec §9 사실만)', () => {
  it('같은 법정동 중위가', () => {
    expect(nearbyText({ scope: 'dong', count: 7, medianPerSqm: 700 })).toBe(
      '최근 12개월 같은 법정동, 준공 10년 이내, 전용 ±10㎡ 아파트 거래 7건의 ㎡당 중위가는 700만원(평당 2,314만원)입니다.');
  });
  it('자료 부족·없음', () => {
    expect(nearbyText({ scope: 'insufficient', count: 3 })).toBe('비교할 거래가 3건이라 주변 시세를 계산하지 않았습니다.');
    expect(nearbyText({ scope: 'none', count: 0 })).toBe('비교할 주변 거래가 없습니다.');
    expect(nearbyText(null)).toBe('비교할 주변 거래가 없습니다.');
  });
  it('평가어를 쓰지 않는다', () => {
    for (const n of [{ scope: 'sigungu', count: 9, medianPerSqm: 1200 } as const, { scope: 'insufficient', count: 1 } as const, null]) {
      expect(nearbyText(n)).not.toMatch(BANNED_WORDS);
    }
  });
});

describe('aptView', () => {
  it('주택형별 면적·분양가·㎡당·평당·판정 링크', () => {
    const m = aptView(bundle()).models[0];
    expect(m).toMatchObject({
      houseTy: '55A', area: '55㎡(17평)', topPrice: '4억 3,390만원', perSqm: '789만원', perPyeong: '2,608만원',
      special: '15', general: '0', eligibilityHref: '/eligibility/P1/01',
    });
  });
  it('경쟁률은 주택형·순위·해당지역 먼저', () => {
    expect(aptView(bundle()).competition.map((c) => c.residence)).toEqual(['해당지역', '기타지역']);
    expect(aptView(bundle()).competition[0]).toMatchObject({ rank: '1순위', rate: '12 : 1', applicants: '120' });
  });
  it('특공 현황은 전체(all) 줄만', () => {
    expect(aptView(bundle()).special).toEqual([{ houseTy: '55A', type: '신혼부부', allotted: '10', applicants: '55' }]);
  });
  it('일정 줄은 값 있는 것만', () => {
    const labels = aptView(bundle()).schedule.map((r) => r.label);
    expect(labels).toEqual(['모집공고', '1순위', '2순위', '당첨자 발표', '계약', '입주 예정']);
  });
  it('종료·취소·정정 배너', () => {
    expect(aptView(bundle({ phase: 'closed' })).banner).toEqual({ kind: 'closed', text: '접수가 끝난 공고입니다. 아래에서 경쟁률을 볼 수 있습니다.' });
    expect(aptView(bundle({ phase: 'cancelled' })).banner?.kind).toBe('cancelled');
    expect(aptView(bundle({ corrected: true })).corrected).toBe(true);
    expect(aptView(bundle()).banner).toBeNull();
  });
  it('주택형·경쟁률·특공이 비어도 깨지지 않는다 (Review Focus 3)', () => {
    const v = aptView(bundle({ models: [], competition: [], special: [], presale: [], lhLinks: [], truncated: true }));
    expect(v.models).toEqual([]);
    expect(v.truncated).toBe(true);
  });
  it('special_counts 가 깨진 JSON 이면 -', () => {
    const b = bundle();
    b.models[0].special_counts = '{x';
    expect(aptView(b).models[0].special).toBe('-');
  });
});

describe('aptStages (단계 표시: 공고 → 특별공급 → 1순위 → 2순위 → 발표 → 계약)', () => {
  const nt = bundle().notice; // 특별공급 일정 없음, 1순위 11.16~11.26, 2순위 11.27, 발표 12.08, 계약 2027.03.11~14
  const states = (today: string, n = nt) => aptStages(n, today).map((s) => s.state);
  it('일정이 없는 단계는 빼고, 날짜는 공고 연도와 다를 때만 연도를 붙인다', () => {
    const st = aptStages(nt, '2026-11-20');
    expect(st.map((s) => s.label)).toEqual(['공고', '1순위', '2순위', '당첨자 발표', '계약']);
    expect(st.map((s) => s.date)).toEqual(['11.06(금)', '11.16(월) ~ 11.26(목)', '11.27(금)', '12.08(화)', '2027.03.11(목) ~ 03.14(일)']);
  });
  it('오늘이 기간 안이면 그 단계가 진행 중, 앞은 지남, 뒤는 예정', () => {
    const st = aptStages(nt, '2026-11-20');
    expect(st.map((s) => s.state)).toEqual(['done', 'current', 'upcoming', 'upcoming', 'upcoming']);
    expect(st.map((s) => s.stateLabel)).toEqual(['지남', '진행 중', '예정', '예정', '예정']);
    expect(states('2026-11-16')[1]).toBe('current');
    expect(states('2026-11-26')[1]).toBe('current');
  });
  it('단계 사이 빈 날에는 다음 단계를 next 로, 남은 날을 붙인다', () => {
    const st = aptStages(nt, '2026-11-30');
    expect(st.map((s) => s.state)).toEqual(['done', 'done', 'done', 'next', 'upcoming']);
    expect(st[3]).toMatchObject({ stateLabel: '예정', dday: 'D-8' });
    expect(st[4].dday).toBeNull();
  });
  it('공고 전이면 공고가 next, 계약이 끝나면 모두 지남', () => {
    expect(states('2026-11-01')).toEqual(['next', 'upcoming', 'upcoming', 'upcoming', 'upcoming']);
    expect(aptStages(nt, '2026-11-01')[0].dday).toBe('D-5');
    expect(states('2027-03-15')).toEqual(['done', 'done', 'done', 'done', 'done']);
  });
  it('특별공급 일정이 있으면 공고 다음에 넣는다', () => {
    const n = { ...nt, special_start: '2026-11-13', special_end: '2026-11-13' };
    expect(aptStages(n, '2026-11-13').map((s) => [s.label, s.state])).toEqual([
      ['공고', 'done'], ['특별공급', 'current'], ['1순위', 'upcoming'], ['2순위', 'upcoming'], ['당첨자 발표', 'upcoming'], ['계약', 'upcoming'],
    ]);
  });
  it('종료일만 있거나 시작일만 있어도 하루짜리로 본다', () => {
    const n = { ...nt, rank2_start: null, rank2_end: '2026-11-27', contract_end: null };
    const st = aptStages(n, '2027-03-11');
    expect(st.map((s) => s.date)).toEqual(['11.06(금)', '11.16(월) ~ 11.26(목)', '11.27(금)', '12.08(화)', '2027.03.11(목)']);
    expect(st.at(-1)?.state).toBe('current');
  });
});

describe('aptView 입주 예정·공식 공고', () => {
  it('입주 예정 연월을 따로 준다', () => {
    expect(aptView(bundle()).moveIn).toBe('2029.09');
    const b = bundle();
    b.notice.move_in_ym = null;
    expect(aptView(b).moveIn).toBeNull();
  });
});
