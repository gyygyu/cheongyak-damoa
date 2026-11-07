// Plan C 최종 리뷰 지적 사항 (Critical 1·2, Important 3~6) 회귀 시험
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildBundles, fitValue, selectKvWrites, MAX_VALUE_BYTES, type Dataset } from '../sync/bundles';
import { nextBackfill } from '../sync/backfill';
import { runSync } from '../sync/main';
import { sqliteStore } from '../sync/store';
import { fixtureFetch } from '../sync/fixture-fetch';
import type { LawdTable } from '../src/lib/region/lawd';

const bytes = (s: string) => new TextEncoder().encode(s).length;
const ctx = { today: '2026-11-07', cityOf: new Map<string, string>() };
const notice = { pblanc_no: 'P1', name: '큰 단지', sido: '경기도', sigungu: '화성시', lawd_cd: '41590', dong: '송동', notice_date: '2026-11-01', state: 'normal' };
const empty = (): Dataset => ({
  notices: [notice], models: [], competition: [], special: [], trades: [], presale: [], presaleLinks: [], lhNotices: [], lhSupply: [], account: [],
});

describe('Critical 1: 큰 공고 하나가 묶음 전체를 멈추지 않는다', () => {
  it('주택형 20개 × 특공 25행이어도 apt 묶음이 50KB 안으로 만들어진다', () => {
    const ds = empty();
    for (let m = 1; m <= 20; m++) {
      const no = String(m).padStart(2, '0');
      ds.models.push({ pblanc_no: 'P1', model_no: no, house_ty: `0${59 + m}.0000A`, area_excl: 59 + m });
      for (let k = 0; k < 25; k++) ds.special.push({ pblanc_no: 'P1', model_no: no, kind: `특별공급유형${k}`, residence: '해당지역 거주자', supply_count: 10, applicants: 100 + k, note: '접수 현황 비고 문구 '.repeat(5) });
      for (let k = 0; k < 6; k++) ds.competition.push({ pblanc_no: 'P1', model_no: no, rank: 1 + (k % 2), residence: `지역${k}`, supply_count: 50, applicants: 600, rate: 12, rate_text: '12' });
    }
    const out = buildBundles(ds, ctx);
    const apt = out.find((w) => w.key === 'apt:P1');
    expect(apt).toBeDefined();
    expect(bytes(apt!.value)).toBeLessThan(MAX_VALUE_BYTES);
    expect(JSON.parse(apt!.value).truncated).toBe(true);
  });

  it('fitValue 는 목록 여러 개를 차례로 덜어 낸다', () => {
    const big = Array.from({ length: 800 }, (_, i) => ({ i, t: 'x'.repeat(100) }));
    const v = fitValue({ a: big, b: big }, ['a', 'b']);
    expect(bytes(v)).toBeLessThan(MAX_VALUE_BYTES);
  });

  it('덜어도 안 되는 묶음은 건너뛰고 나머지는 만든다', () => {
    const ds = empty();
    ds.notices = [{ ...notice, name: '가'.repeat(30_000) }, { ...notice, pblanc_no: 'P2' }];
    const skipped: string[] = [];
    const out = buildBundles(ds, ctx, skipped);
    expect(skipped).toEqual(['apt:P1']);
    expect(out.some((w) => w.key === 'apt:P2')).toBe(true);
    expect(out.some((w) => w.key === 'home')).toBe(true);
  });
});

describe('Critical 2·Important 5: KV 미룬 키와 하루 상한', () => {
  const w = (key: string, v = 'v') => ({ key, value: `${key}:${v}` });
  it('미룬 키를 매니페스트 pending 에 남긴다', () => {
    const r = selectKvWrites([w('home'), w('trade:1:a'), w('trade:2:b')], null, { today: '2026-11-07', budget: 4, reserve: 3 });
    expect(r.deferred).toEqual(['trade:1:a', 'trade:2:b']);
    expect(r.manifest.pending).toEqual(['trade:1:a', 'trade:2:b']);
  });
  it('비거래 묶음도 하루 상한을 넘지 않는다', () => {
    const prev = { date: '2026-11-07', used: 795, hashes: {} };
    const r = selectKvWrites([w('home'), w('apt:1'), w('apt:2')], prev, { today: '2026-11-07' });
    expect(r.put.length).toBeLessThanOrEqual(1);
  });
});

describe('Important 6: 백필이 끝나면 새 기준월로 다시 돈다', () => {
  it('끝난 상태에서 기준월이 지났으면 처음부터', () => {
    const r = nextBackfill({ base: '202509', index: 24 }, ['11110', '11140'], '2026-11-07', 5);
    expect(r.state.base).toBe('202610');
    expect(r.jobs[0]).toEqual({ lawd: '11110', ym: '202610' });
  });
  it('같은 기준월이면 끝난 채로 둔다', () => {
    const r = nextBackfill({ base: '202610', index: 24 }, ['11110', '11140'], '2026-11-07', 5);
    expect(r.jobs).toEqual([]);
  });
});

describe('runSync: 미룬 trade 묶음 재생성, D1 하루 상한', () => {
  const lawdTable: LawdTable = JSON.parse(readFileSync('content/lawd/lawd.json', 'utf8'));
  const opts = (store: ReturnType<typeof sqliteStore>) => ({
    store, fetch: fixtureFetch('sync/fixtures'), keys: ['FIXTURE'], today: '2026-11-07', now: '2026-11-07T19:00:00Z', lawdTable, backfillMax: 100_000,
  });

  it('pending 에 남은 trade 묶음은 행이 안 바뀌어도 다음 실행에 다시 쓴다', async () => {
    const store = sqliteStore();
    await runSync(opts(store));
    const tradeKeys = [...store.kv.keys()].filter((k) => k.startsWith('trade:'));
    expect(tradeKeys.length).toBeGreaterThan(0);
    const m = JSON.parse(store.kv.get('meta:kvhash')!);
    for (const k of tradeKeys) { store.kv.delete(k); delete m.hashes[k]; }
    m.pending = tradeKeys;
    store.kv.set('meta:kvhash', JSON.stringify(m));
    await runSync(opts(store));
    for (const k of tradeKeys) expect(store.kv.has(k), k).toBe(true);
  });

  it('D1 하루 쓰기는 UTC 날짜로 누적하고, 잘리면 백필 위치를 옮기지 않는다', async () => {
    const store = sqliteStore();
    store.kv.set('meta:d1rows', JSON.stringify({ date: '2026-11-07', used: 69_990 }));
    const r = await runSync(opts(store));
    expect(r.rowsWritten).toBeLessThanOrEqual(10);
    expect(JSON.parse(store.kv.get('meta:d1rows')!).used).toBeLessThanOrEqual(70_000);
    expect(JSON.parse(store.kv.get('backfill:trade')!).index).toBe(0);
  });

  it('날짜가 바뀌면 D1 누적을 새로 센다', async () => {
    const store = sqliteStore();
    store.kv.set('meta:d1rows', JSON.stringify({ date: '2026-11-06', used: 69_990 }));
    const r = await runSync(opts(store));
    expect(r.rowsWritten).toBeGreaterThan(10);
    expect(JSON.parse(store.kv.get('meta:d1rows')!).date).toBe('2026-11-07');
  });
});
