import { describe, it, expect } from 'vitest';
import { buildBundles, fitValue, selectKvWrites, MAX_VALUE_BYTES, type Dataset, type KvWrite } from '../sync/bundles';

const cityOf = new Map<string, string>([['41117', '41110']]);
const ctx = { today: '2026-11-07', cityOf };

const notice = {
  pblanc_no: 'P1', house_manage_no: 'H1', name: '수원 영통 해모로', house_kind: '민영', rent_kind: null,
  area_code: '410', sido: '경기도', sigungu: '수원시 영통구', address: '경기도 수원시 영통구 망포동 100', lawd_cd: '41117', dong: '망포동',
  supply_kind: null, public_land: 0, price_cap: 0, speculative: 0, adjusted: 0, notice_date: '2026-11-01',
  special_start: '2026-11-09', special_end: '2026-11-09', rank1_start: '2026-11-10', rank1_end: '2026-11-10',
  rank2_start: '2026-11-11', rank2_end: '2026-11-11', rank_dates: null, winner_date: '2026-11-17',
  contract_start: '2026-11-28', contract_end: '2026-11-30', move_in_ym: '2029-03', total_households: 300,
  url: 'https://www.applyhome.co.kr/x', state: 'normal', hash: 'h', updated_at: 'u',
};
const model = { pblanc_no: 'P1', model_no: '01', house_ty: '084.9900A', area_excl: 84.99, area_supply: 112, general_count: 100, special_counts: null, top_price: 80000 };
const trade = (i: number, extra: Record<string, unknown> = {}) => ({
  trade_key: `T${i}`, lawd_cd: '41117', umd_cd: '10500', dong: '망포동', jibun: '1', apt_seq: 'S1', name: '망포자이',
  area: 84 + (i % 3) * 0.5, floor: 5, contract_date: `2026-10-${String(10 + i).padStart(2, '0')}`, amount: 70000 + i * 100,
  build_year: 2020, cancelled: 0, cancel_date: null, ...extra,
});
const base = (): Dataset => ({
  notices: [notice], models: [model],
  competition: [
    { pblanc_no: 'P1', model_no: '01', rank: 1, residence: 'local', supply_count: 50, applicants: 600, rate: 12, rate_text: '12' },
    { pblanc_no: 'P1', model_no: '01', rank: 1, residence: 'other', supply_count: 50, applicants: 100, rate: 2, rate_text: '2' },
  ],
  special: [], trades: [1, 2, 3, 4, 5, 6].map((i) => trade(i)), presale: [], presaleLinks: [],
  lhNotices: [], lhSupply: [], account: [],
});
const get = (ws: KvWrite[], key: string) => {
  const w = ws.find((x) => x.key === key);
  if (!w) throw new Error(`키 없음: ${key} (있는 키: ${ws.map((x) => x.key).join(', ')})`);
  return JSON.parse(w.value);
};

describe('buildBundles', () => {
  it('apt 묶음에 공고·단계·주택형별 주변 시세·경쟁률이 들어간다', () => {
    const apt = get(buildBundles(base(), ctx), 'apt:P1');
    expect(apt.notice.name).toBe('수원 영통 해모로');
    expect(apt.notice.hash).toBeUndefined();
    expect(apt.phase).toBe('upcoming');
    expect(apt.models[0].nearby.scope).toBe('dong');
    expect(apt.models[0].nearby.count).toBe(6);
    expect(apt.competition).toHaveLength(2);
  });

  it('LH 공고는 맞춘 것은 apt 묶음의 링크로, 못 맞춘 것만 lh 묶음으로', () => {
    const ds = base();
    ds.lhNotices = [
      { lh_id: 'L1', title: '영통 공공분양', kind: 'sale', pblanc_no: 'P1', url: 'https://apply.lh.or.kr/1', receipt_start: '2026-11-10', receipt_end: '2026-11-12', sido: '경기도', sigungu: '수원시 영통구' },
      { lh_id: 'L2', title: '화성 행복주택', kind: 'rent', pblanc_no: null, url: 'https://apply.lh.or.kr/2', receipt_start: '2026-11-20', receipt_end: '2026-11-21', sido: '경기도', sigungu: '화성시' },
    ];
    ds.lhSupply = [{ lh_id: 'L2', supply_type: '01', house_ty: '26A', area_excl: 26, households: 40, price: null, deposit: 1500, monthly_rent: 13 }];
    const ws = buildBundles(ds, ctx);
    expect(get(ws, 'apt:P1').lhLinks).toEqual([{ lhId: 'L1', title: '영통 공공분양', url: 'https://apply.lh.or.kr/1' }]);
    expect(ws.some((w) => w.key === 'lh:L1')).toBe(false);
    expect(get(ws, 'lh:L2').supply).toHaveLength(1);
    const cal = get(ws, 'calendar:2026-11');
    expect(cal.events.some((e: { kind: string; ref: string }) => e.kind === 'lh-receipt' && e.ref === 'lh:L2')).toBe(true);
    expect(cal.events.some((e: { kind: string; ref: string }) => e.kind === 'rank1' && e.ref === 'apt:P1')).toBe(true);
  });

  it('home 은 오늘부터 7일 안 일정과 경쟁률 상위를 담는다', () => {
    const home = get(buildBundles(base(), ctx), 'home');
    const kinds = home.events.map((e: { kind: string }) => e.kind);
    expect(kinds).toEqual(['special', 'rank1', 'rank2']); // 11-17 발표는 7일 밖
    expect(home.topCompetition[0]).toMatchObject({ pblancNo: 'P1', maxRate: 12, applicants: 700 });
  });

  it('trade 묶음은 최근 12개월만, 단지별·최신순, 해제 거래도 표시한다', () => {
    const ds = base();
    ds.trades.push(trade(7, { contract_date: '2025-10-01' }), trade(8, { name: '망포아이파크', cancelled: 1, contract_date: '2026-10-30' }));
    const t = get(buildBundles(ds, ctx), 'trade:41117:망포동');
    expect(t.complexes.map((c: { name: string }) => c.name)).toEqual(['망포아이파크', '망포자이']);
    expect(t.complexes[0].trades[0]).toMatchObject({ date: '2026-10-30', cancelled: true });
    expect(t.complexes[1].trades).toHaveLength(6); // 2025-10-01 은 12개월 밖
    expect(t.complexes[1].trades[0].date).toBe('2026-10-16');
  });

  it('region 묶음: 시도는 공고와 최신 기준월 통장 현황, 시군구는 동별 거래 요약', () => {
    const ds = base();
    ds.account = [
      { base_month: '202609', region: '경기', account_kind: '종합', area_kind: '', subscribers: 1, rank1: 1, rank2: 0 },
      { base_month: '202610', region: '경기', account_kind: '종합', area_kind: '', subscribers: 2, rank1: 2, rank2: 0 },
      { base_month: '202610', region: '서울', account_kind: '종합', area_kind: '', subscribers: 3, rank1: 3, rank2: 0 },
    ];
    const ws = buildBundles(ds, ctx);
    const sido = get(ws, 'region:경기도');
    expect(sido.notices.map((n: { pblancNo: string }) => n.pblancNo)).toEqual(['P1']);
    expect(sido.account).toEqual([expect.objectContaining({ base_month: '202610', subscribers: 2 })]);
    expect(get(ws, 'region:경기도:수원시 영통구').dongs).toEqual([{ lawdCd: '41117', dong: '망포동', count: 6, last: '2026-10-16' }]);
    expect(get(ws, 'stats:account').rows).toHaveLength(2);
  });

  it('competition 묶음은 공고별 요약을 공고일 최신순으로', () => {
    const ds = base();
    ds.notices.push({ ...notice, pblanc_no: 'P0', name: '옛 공고', notice_date: '2026-09-01' });
    ds.competition.push({ pblanc_no: 'P0', model_no: '01', rank: 1, residence: 'local', supply_count: 10, applicants: 5, rate: null, rate_text: '미달' });
    const c = get(buildBundles(ds, ctx), 'competition');
    expect(c.items.map((i: { pblancNo: string }) => i.pblancNo)).toEqual(['P1', 'P0']);
    expect(c.items[1].maxRate).toBeNull();
  });

  it('공급은 주택형마다 한 번만 센다 — 실응답은 순위·거주 줄마다 같은 주택형 공급 세대수를 되풀이한다', () => {
    // sync/fixtures/applyhome-cmpet/competition.json: 2026000532 주택형 01 의 1순위 해당·기타, 2순위 해당 줄이 모두 SUPLY_HSHLDCO 116
    const ds = base();
    ds.competition = [
      { pblanc_no: 'P1', model_no: '01', rank: 1, residence: 'local', supply_count: 46, applicants: 0, rate: null, rate_text: '(△46)' },
      { pblanc_no: 'P1', model_no: '01', rank: 1, residence: 'other', supply_count: 46, applicants: 0, rate: null, rate_text: '(△46)' },
      { pblanc_no: 'P1', model_no: '01', rank: 2, residence: 'local', supply_count: 46, applicants: 1, rate: null, rate_text: '(△45)' },
      { pblanc_no: 'P1', model_no: '01', rank: 2, residence: 'other', supply_count: 46, applicants: 1, rate: null, rate_text: '(△44)' },
      { pblanc_no: 'P1', model_no: '02', rank: 1, residence: 'local', supply_count: 11, applicants: 30, rate: 2.73, rate_text: '2.73' },
      { pblanc_no: 'P1', model_no: '02', rank: 1, residence: 'other', supply_count: 11, applicants: 5, rate: null, rate_text: '-' },
    ];
    const item = get(buildBundles(ds, ctx), 'competition').items[0];
    expect(item).toMatchObject({ supply: 57, applicants: 37, maxRate: 2.73, models: 2, shortModels: 1 });
  });
});

describe('fitValue', () => {
  it('50KB 를 넘으면 목록 끝에서부터 덜어 내고 truncated 를 단다', () => {
    const big = { name: 'x', rows: Array.from({ length: 5000 }, (_, i) => ({ i, pad: '가나다라마바사'.repeat(3) })) };
    const v = fitValue(big, 'rows');
    expect(new TextEncoder().encode(v).length).toBeLessThan(MAX_VALUE_BYTES);
    const o = JSON.parse(v);
    expect(o.truncated).toBe(true);
    expect(o.rows[0].i).toBe(0);
    expect(fitValue({ rows: [1] }, 'rows')).toBe('{"rows":[1]}');
  });
});

describe('selectKvWrites', () => {
  const w = (key: string, value = 'v') => ({ key, value });
  it('바뀌지 않은 키는 건너뛴다', () => {
    const first = selectKvWrites([w('home'), w('apt:P1')], null, { today: '2026-11-07' });
    expect(first.put.map((x) => x.key)).toEqual(['home', 'apt:P1']);
    const again = selectKvWrites([w('home'), w('apt:P1', 'v2')], first.manifest, { today: '2026-11-07' });
    expect(again.put.map((x) => x.key)).toEqual(['apt:P1']);
  });

  it('예산을 넘으면 trade 키부터 미루고, 미룬 키는 다음 실행에 다시 고른다', () => {
    const writes = [w('trade:1:a'), w('trade:1:b'), w('home'), w('apt:P1')];
    const r1 = selectKvWrites(writes, null, { today: '2026-11-07', budget: 6, reserve: 3 });
    expect(r1.put.map((x) => x.key)).toEqual(['home', 'apt:P1', 'trade:1:a']);
    expect(r1.deferred).toEqual(['trade:1:b']);
    expect(r1.manifest.used).toBe(6);
    const r2 = selectKvWrites(writes, r1.manifest, { today: '2026-11-07', budget: 6, reserve: 3 });
    expect(r2.put.map((x) => x.key)).toEqual(['trade:1:b']);
    expect(r2.deferred).toEqual([]);
  });

  it('하루 누적이 dailyCap 에 닿으면 trade 는 미루고 나머지는 쓴다. 날짜가 바뀌면 누적을 새로 센다', () => {
    const prev = { date: '2026-11-07', used: 795, hashes: {} };
    const r = selectKvWrites([w('trade:1:a'), w('home')], prev, { today: '2026-11-07' });
    expect(r.put.map((x) => x.key)).toEqual(['home']);
    expect(r.deferred).toEqual(['trade:1:a']);
    const next = selectKvWrites([w('trade:1:a'), w('home')], { ...prev, date: '2026-11-06' }, { today: '2026-11-07' });
    expect(next.put.map((x) => x.key)).toEqual(['home', 'trade:1:a']);
    expect(next.manifest).toMatchObject({ date: '2026-11-07', used: 5 });
  });
});
