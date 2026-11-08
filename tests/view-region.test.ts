import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { SIDO_LIST, resolveSido, tradePeriod, regionHref, tradeHref, competitionRows, accountRows, sidoAccountRows, sidoAccount, ACCOUNT_GROUP_SIDO, noticeRows, sigunguLinks, dongRows, tradeView } from '../src/lib/view/region';

describe('시도 목록', () => {
  it('16개, 통합 시도 이름 포함', () => {
    expect(SIDO_LIST.length).toBe(16);
    expect(SIDO_LIST).toContain('전남광주통합특별시');
    expect(SIDO_LIST).toContain('세종특별자치시');
    expect(new Set(SIDO_LIST).size).toBe(16);
  });
  it('주소는 한글을 인코딩한다', () => {
    expect(regionHref('경기도')).toBe('/region/%EA%B2%BD%EA%B8%B0%EB%8F%84');
    expect(regionHref('경기도', '수원시 영통구')).toBe('/region/%EA%B2%BD%EA%B8%B0%EB%8F%84/%EC%88%98%EC%9B%90%EC%8B%9C%20%EC%98%81%ED%86%B5%EA%B5%AC');
    expect(tradeHref('11680', '대치동')).toBe('/trade/11680/%EB%8C%80%EC%B9%98%EB%8F%99');
  });
});

describe('경쟁률 모음', () => {
  it('최고 경쟁률·접수·공급', () => {
    const rows = competitionRows({ items: [{ pblancNo: 'P1', name: '과천 A', sido: '경기도', sigungu: '과천시', noticeDate: '2026-10-01', maxRate: 120.5, applicants: 12050, supply: 100 }] });
    expect(rows[0]).toEqual({ name: '과천 A', href: '/apt/P1', place: '경기도 과천시', noticeDate: '2026.10.01(목)', rate: '120.5 : 1', applicants: '12,050', supply: '100', short: null });
  });
  it('모든 주택형이 접수 < 공급이면 미달, 일부면 일부 미달 (경쟁률 숫자가 없으면 - 대신 배지만)', () => {
    const item = { pblancNo: 'P1', name: 'a', sido: null, sigungu: null, noticeDate: null, applicants: 2, supply: 57 };
    expect(competitionRows({ items: [{ ...item, maxRate: null, models: 2, shortModels: 2 }] })[0]).toMatchObject({ rate: '', short: '미달' });
    expect(competitionRows({ items: [{ ...item, maxRate: 3.2, models: 4, shortModels: 1 }] })[0]).toMatchObject({ rate: '3.2 : 1', short: '일부 미달' });
    expect(competitionRows({ items: [{ ...item, maxRate: 3.2, models: 4, shortModels: 0 }] })[0].short).toBeNull();
  });
  it('옛 묶음(주택형 수 없음)은 배지 없이 예전처럼', () => {
    const item = { pblancNo: 'P1', name: 'a', sido: null, sigungu: null, noticeDate: null, applicants: 2, supply: 57, maxRate: null };
    expect(competitionRows({ items: [item] })[0]).toMatchObject({ rate: '-', short: null });
  });
  it('묶음이 없거나 비면 빈 배열 (Review Focus 3)', () => {
    expect(competitionRows(null)).toEqual([]);
    expect(competitionRows({ items: [] })).toEqual([]);
  });
});

describe('청약통장', () => {
  it('면적 코드는 라벨, 빈 코드는 -', () => {
    const rows = accountRows([
      { base_month: '2026-09', region: '서울', account_kind: '주택청약종합저축', area_kind: '01', subscribers: null, rank1: 1000, rank2: 200 },
      { base_month: '2026-09', region: '서울', account_kind: '청약예금', area_kind: '', subscribers: null, rank1: 5, rank2: null },
    ]);
    expect(rows[0]).toEqual({ region: '서울', kind: '주택청약종합저축', area: '85㎡ 이하', subscribers: '-', rank1: '1,000', rank2: '200' });
    expect(rows[1].area).toBe('-');
  });
  it('fixture(실응답)의 BLNC_SECD 01~04 는 모두 라벨이 있다', () => {
    const area = (k: string) => accountRows([{ base_month: '2026-09', region: '서울', account_kind: 'x', area_kind: k, subscribers: 1, rank1: 1, rank2: 1 }])[0].area;
    expect(['01', '02', '03', '04'].map(area)).toEqual(['85㎡ 이하', '102㎡ 이하', '135㎡ 이하', '모든 면적']);
  });
  it('시도 묶음이 없을 때 stats:account 에서 그 시도 줄만 고른다 (sync sidoOfRegion 과 같은 규칙)', () => {
    const r = (region: string) => ({ base_month: '2026-09', region, account_kind: 'x', area_kind: '01', subscribers: 1, rank1: 1, rank2: 1 });
    const rows = [r('서울'), r('강원 원주'), r('서울특별시'), r('인천·경기')];
    expect(sidoAccountRows(rows, '서울특별시').map((x) => x.region)).toEqual(['서울', '서울특별시']);
    expect(sidoAccountRows(rows, '강원특별자치도').map((x) => x.region)).toEqual(['강원 원주']);
    expect(sidoAccountRows(rows, '경기도')).toEqual([]);
  });
  it('모르는 코드는 코드 그대로 보인다', () => {
    expect(accountRows([{ base_month: '2026-09', region: '서울', account_kind: 'x', area_kind: '07', subscribers: 1, rank1: 1, rank2: 1 }])[0].area).toBe('면적 구분 07');
  });
});

describe('묶음 지역 청약통장 통계 (인천·경기·5대광역시·기타지역)', () => {
  const r = (region: string) => ({ base_month: '2026-09', region, account_kind: 'x', area_kind: '01', subscribers: 1, rank1: 1, rank2: 1 });
  // fixture(sync/fixtures/account-stats/all.json) 실응답의 SUBSCRPT_AREA_CODE_NM 철자 그대로
  const fixtureGroups = JSON.parse(readFileSync('sync/fixtures/account-stats/all.json', 'utf8')).data
    .map((x: { SUBSCRPT_AREA_CODE_NM: string }) => x.SUBSCRPT_AREA_CODE_NM).filter((v: string) => v !== '서울');
  const stats = [r('서울'), r('인천·경기'), r('5대광역시'), r('기타지역'), r('대전'), r('강원 원주')];

  it('대응표의 묶음 이름은 실응답 철자와 같다', () => {
    expect(Object.keys(ACCOUNT_GROUP_SIDO).sort()).toEqual([...new Set<string>(fixtureGroups)].sort());
  });
  it('대응표의 시도 이름은 모두 SIDO_LIST 값이고, 서울을 뺀 모든 시도가 어느 묶음엔가 든다', () => {
    const all = Object.values(ACCOUNT_GROUP_SIDO).flat();
    for (const s of all) expect(SIDO_LIST).toContain(s);
    expect(SIDO_LIST.filter((s) => !all.includes(s))).toEqual(['서울특별시']);
  });
  it('단독 통계가 없는 경기도·인천은 인천·경기 묶음을 밝히고 보여 준다', () => {
    for (const sido of ['경기도', '인천광역시']) {
      const a = sidoAccount(stats, sido);
      expect(a.rows.map((x) => x.region)).toEqual(['인천·경기']);
      expect(a.note).toBe("이 시도 단독 통계가 없어 '인천·경기' 묶음 통계를 보여 줍니다.");
    }
  });
  it('부산은 5대광역시, 세종·충북은 기타지역 묶음', () => {
    expect(sidoAccount(stats, '부산광역시').rows.map((x) => x.region)).toEqual(['5대광역시']);
    expect(sidoAccount(stats, '세종특별자치시').rows.map((x) => x.region)).toEqual(['기타지역']);
    expect(sidoAccount(stats, '충청북도').note).toBe("이 시도 단독 통계가 없어 '기타지역' 묶음 통계를 보여 줍니다.");
  });
  it('광주+전남 통합 시도는 5대광역시(옛 광주)·기타지역(옛 전남) 둘 다', () => {
    const a = sidoAccount(stats, '전남광주통합특별시');
    expect(a.rows.map((x) => x.region)).toEqual(['5대광역시', '기타지역']);
    expect(a.note).toBe("이 시도 단독 통계가 없어 '5대광역시'·'기타지역' 묶음 통계를 보여 줍니다.");
  });
  it('단독 줄이 있으면 묶음을 섞지 않는다 (서울·대전·강원)', () => {
    expect(sidoAccount(stats, '대전광역시')).toEqual({ rows: [r('대전')], note: null });
    expect(sidoAccount(stats, '서울특별시')).toEqual({ rows: [r('서울')], note: null });
    expect(sidoAccount(stats, '강원특별자치도').rows.map((x) => x.region)).toEqual(['강원 원주']);
  });
  it('region:{시도} 묶음의 account 가 있으면 그것을 쓴다', () => {
    expect(sidoAccount(stats, '경기도', [r('경기 수원')])).toEqual({ rows: [r('경기 수원')], note: null });
    expect(sidoAccount(stats, '경기도', []).rows.map((x) => x.region)).toEqual(['인천·경기']);
  });
  it('통계가 아예 없으면 빈 목록, 안내 없음', () => {
    expect(sidoAccount([], '경기도')).toEqual({ rows: [], note: null });
  });
});

describe('지역 화면', () => {
  const sido = {
    sido: '경기도',
    notices: [
      { pblancNo: 'P1', name: '시흥 거모', sigungu: '시흥시', noticeDate: '2026-11-06', phase: 'upcoming' as const },
      { pblancNo: 'P2', name: '시흥 은계', sigungu: '시흥시', noticeDate: '2026-10-01', phase: 'closed' as const },
      { pblancNo: null, name: '이름만', sigungu: null, noticeDate: null, phase: null },
    ],
    account: [],
  };
  it('공고 줄', () => {
    expect(noticeRows(sido.notices)[0]).toEqual({ name: '시흥 거모', href: '/apt/P1', sigungu: '시흥시', noticeDate: '2026.11.06(금)', phase: '접수 예정' });
    expect(noticeRows(sido.notices)[2]).toMatchObject({ href: null, phase: '-' });
  });
  it('시군구 링크는 공고의 시군구에서 중복 없이', () => {
    expect(sigunguLinks(sido)).toEqual([{ name: '시흥시', href: regionHref('경기도', '시흥시') }]);
  });
  it('동 줄은 실거래 화면으로', () => {
    expect(dongRows({ notices: [], dongs: [{ lawdCd: '41390', dong: '거모동', count: 12, last: '2026-10-30' }] })).toEqual([
      { dong: '거모동', href: tradeHref('41390', '거모동'), count: '12', last: '2026.10.30(금)' },
    ]);
  });
});

describe('tradeView', () => {
  it('단지별·면적대별로 묶고 최근 거래 먼저, 해제 표시', () => {
    const v = tradeView({
      lawdCd: '11680', dong: '대치동',
      complexes: [{ name: '래미안대치', buildYear: 2015, trades: [
        { date: '2026-10-01', area: 84.97, floor: 10, amount: 280000, cancelled: false },
        { date: '2026-10-05', area: 59.9, floor: 3, amount: 200000, cancelled: true },
        { date: '2026-10-09', area: 84.97, floor: 12, amount: 285000, cancelled: false },
      ] }],
    });
    expect(v.title).toBe('대치동 아파트 실거래');
    const c = v.complexes[0];
    expect(c.buildYear).toBe('2015년 준공');
    expect(c.rows.map((r) => r.area)).toEqual(['59.9㎡(18평)', '84.97㎡(26평)', '84.97㎡(26평)']);
    expect(c.rows.slice(1).map((r) => r.date)).toEqual(['2026.10.09(금)', '2026.10.01(목)']);
    expect(c.rows[0]).toMatchObject({ amount: '20억원', cancelled: true });
  });
  it('면적·금액 없는 거래도 깨지지 않는다', () => {
    const v = tradeView({ lawdCd: '1', dong: 'x', complexes: [{ name: 'a', buildYear: null, trades: [{ date: null, area: null, floor: null, amount: null, cancelled: false }] }] });
    expect(v.complexes[0].rows).toEqual([{ area: '-', date: '-', floor: '-', amount: '-', cancelled: false }]);
    expect(v.period).toBeNull();
  });
});

describe('resolveSido (짧은 이름 → 대표 시도 이름, /region 301 용)', () => {
  it('대표 이름은 그대로', () => {
    for (const s of SIDO_LIST) expect(resolveSido(s)).toBe(s);
  });
  it('흔히 쓰는 짧은 이름·옛 이름', () => {
    expect(resolveSido('서울')).toBe('서울특별시');
    expect(resolveSido('서울시')).toBe('서울특별시');
    expect(resolveSido('부산')).toBe('부산광역시');
    expect(resolveSido('경기')).toBe('경기도');
    expect(resolveSido('세종')).toBe('세종특별자치시');
    expect(resolveSido('강원도')).toBe('강원특별자치도');
    expect(resolveSido('전라북도')).toBe('전북특별자치도');
    expect(resolveSido('제주')).toBe('제주특별자치도');
  });
  it('광주·전남은 통합 시도로', () => {
    for (const n of ['광주', '광주광역시', '전남', '전라남도']) expect(resolveSido(n)).toBe('전남광주통합특별시');
  });
  it('앞뒤 공백은 무시, 모르는 이름·경기 광주시처럼 겹치는 이름은 null', () => {
    expect(resolveSido(' 서울 ')).toBe('서울특별시');
    expect(resolveSido('광주시')).toBeNull();
    expect(resolveSido('강남구')).toBeNull();
    expect(resolveSido('')).toBeNull();
  });
});

describe('tradePeriod (실거래 화면 기간 글)', () => {
  const b = (dates: (string | null)[]) => ({ lawdCd: '1', dong: 'x', complexes: [{ name: 'a', buildYear: null, trades: dates.map((date) => ({ date, area: 84, floor: 1, amount: 1, cancelled: false })) }] });
  it('한 달뿐이면 그 달', () => expect(tradePeriod(b(['2026-10-01', '2026-10-30']))).toBe('2026년 10월'));
  it('여러 달이면 첫 달–끝 달 (같은 해는 끝 달 연도 생략)', () => {
    expect(tradePeriod(b(['2026-10-01', '2026-08-03', '2026-09-30']))).toBe('2026.08–10');
    expect(tradePeriod(b(['2025-12-01', '2026-02-03']))).toBe('2025.12–2026.02');
  });
  it('날짜가 하나도 없으면 null', () => expect(tradePeriod(b([null]))).toBeNull());
});

describe('tradeView 한 단지 한 표', () => {
  it('단지마다 면적 칸이 있는 줄 목록 — 면적 작은 것부터, 같은 면적은 최근 거래 먼저', () => {
    const v = tradeView({
      lawdCd: '11740', dong: '성내동',
      complexes: [{ name: '성내 A', buildYear: 2004, trades: [
        { date: '2026-10-01', area: 84.97, floor: 10, amount: 120000, cancelled: false },
        { date: '2026-10-05', area: 59.9, floor: 3, amount: 90000, cancelled: true },
        { date: '2026-10-09', area: 84.97, floor: 12, amount: 125000, cancelled: false },
      ] }],
    });
    expect(v.complexes[0].rows.map((r) => [r.area, r.date])).toEqual([
      ['59.9㎡(18평)', '2026.10.05(월)'], ['84.97㎡(26평)', '2026.10.09(금)'], ['84.97㎡(26평)', '2026.10.01(목)'],
    ]);
    expect(v.complexes[0].rows[0]).toMatchObject({ cancelled: true, amount: '9억원' });
    expect(v.period).toBe('2026년 10월');
  });
});
