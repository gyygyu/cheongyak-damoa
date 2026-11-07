import { describe, it, expect } from 'vitest';
import { median } from '../src/lib/trade/median';
import { nearbyPrice, type TradeRecord } from '../src/lib/trade/nearby';
const cityOf = new Map([['41593', '41590'], ['41595', '41590'], ['41597', '41590'], ['41117', '41110']]);

describe('median', () => {
  it('홀수·짝수 건수', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
  it('빈 배열은 null', () => expect(median([])).toBeNull());
});

const ASOF = '2026-11-07';
const t = (o: Partial<TradeRecord> = {}): TradeRecord => ({
  lawdCd: '11680', dong: '역삼동', area: 84, contractDate: '2026-10-01', amount: 84000, buildYear: 2020, cancelled: false, ...o,
});
const five = (o: Partial<TradeRecord> = {}) => [1, 2, 3, 4, 5].map((i) => t({ amount: 84000 + i * 840, ...o }));

describe('nearbyPrice', () => {
  const target = { lawdCd: '11680', dong: '역삼동', area: 84 };

  it('같은 법정동 5건 이상이면 동 기준 ㎡당 중위가(정수 만원)', () => {
    // ㎡당: 1010, 1020, 1030, 1040, 1050 → 1030
    expect(nearbyPrice(target, five(), ASOF, cityOf)).toEqual({ scope: 'dong', count: 5, medianPerSqm: 1030 });
  });
  it('해제 거래는 뺀다', () => {
    const rows = [...five(), t({ amount: 999999, cancelled: true })];
    expect(nearbyPrice(target, rows, ASOF, cityOf)).toMatchObject({ scope: 'dong', count: 5, medianPerSqm: 1030 });
  });
  it('면적 ±10㎡ 경계: 정확히 10㎡ 차이는 넣고, 넘으면 뺀다', () => {
    const rows = [...five().slice(0, 4), t({ area: 94, amount: 94 * 1030 }), t({ area: 94.01, amount: 1 })];
    expect(nearbyPrice(target, rows, ASOF, cityOf)).toMatchObject({ scope: 'dong', count: 5 });
  });
  it('12개월 경계: 정확히 12개월 전 날짜는 넣고, 그 전날은 뺀다', () => {
    const rows = [...five().slice(0, 4), t({ contractDate: '2025-11-07' }), t({ contractDate: '2025-11-06' })];
    expect(nearbyPrice(target, rows, ASOF, cityOf)).toMatchObject({ count: 5 });
  });
  it('준공 10년 이내만: 2016년은 넣고 2015년은 뺀다', () => {
    const rows = [...five().slice(0, 4), t({ buildYear: 2016 }), t({ buildYear: 2015 }), t({ buildYear: null })];
    expect(nearbyPrice(target, rows, ASOF, cityOf)).toMatchObject({ count: 5 });
  });
  it('동에서 5건 미만이면 시군구로 넓힌다', () => {
    const rows = [...five().slice(0, 2), ...five({ dong: '대치동' }).slice(0, 3)];
    expect(nearbyPrice(target, rows, ASOF, cityOf)).toMatchObject({ scope: 'sigungu', count: 5 });
  });
  it('시군구로도 5건 미만이면 비교 자료 부족(n건)', () => {
    expect(nearbyPrice(target, five().slice(0, 3), ASOF, cityOf)).toEqual({ scope: 'insufficient', count: 3 });
  });
  it('법정동을 모르면 시군구부터 본다', () => {
    expect(nearbyPrice({ ...target, dong: null }, five({ dong: '대치동' }), ASOF, cityOf)).toMatchObject({ scope: 'sigungu', count: 5 });
  });
  it('지역 해석이 안 됐으면(lawdCd 빈 값) 비교 자료 없음', () => {
    expect(nearbyPrice({ lawdCd: '', dong: null, area: 84 }, five(), ASOF, cityOf)).toEqual({ scope: 'none', count: 0 });
  });
  it('시 단위로만 해석된 공고(화성 41590)는 그 시의 구 거래로 시군구 범위를 잡는다', () => {
    expect(nearbyPrice({ lawdCd: '41590', dong: null, area: 84 }, five({ lawdCd: '41597', dong: '오산동' }), ASOF, cityOf))
      .toMatchObject({ scope: 'sigungu', count: 5 });
  });
});
