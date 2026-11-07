import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { runSync, TABLES } from '../sync/main';
import { sqliteStore } from '../sync/store';
import { fixtureFetch } from '../sync/fixture-fetch';
import { collectApplyhome, collectCompetition, collectLh, collectTrades, collectAccount, type Fetch } from '../sync/collect';
import { buildLawdIndex, type LawdTable } from '../src/lib/region/lawd';

const lawdTable: LawdTable = JSON.parse(readFileSync('content/lawd/lawd.json', 'utf8'));
const idx = buildLawdIndex(lawdTable);
const fx = fixtureFetch('sync/fixtures');
const opts = (store: ReturnType<typeof sqliteStore>, fetch: Fetch = fx) => ({
  store, fetch, keys: ['FIXTURE'], today: '2026-11-07', now: '2026-11-07T19:00:00Z', lawdTable, backfillMax: 100_000,
});
const count = async (store: ReturnType<typeof sqliteStore>, table: string) =>
  (await store.query<{ c: number }>(`SELECT COUNT(*) AS c FROM ${table}`))[0].c;
const failOn = (part: string): Fetch => async (url) => (url.includes(part) ? { status: 500, body: 'down' } : fx(url));

describe('변환 행의 열이 D1 스키마와 맞음', () => {
  it('모든 표', async () => {
    const db = new DatabaseSync(':memory:');
    db.exec(readFileSync('migrations/0001_init.sql', 'utf8'));
    const cols = (t: string) => new Set((db.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map((c) => c.name));
    const ah = await collectApplyhome(fx, 'K', '2026-11-07', idx);
    const cp = await collectCompetition(fx, 'K', '0', () => '01');
    const lh = await collectLh(fx, 'K', idx);
    const tr = await collectTrades(fx, 'K', [{ lawd: '11680', ym: '202610' }, { lawd: '41117', ym: '202610' }]);
    const samples: Record<string, Record<string, unknown>[]> = {
      apt_notice: ah.notices, apt_model: ah.models, apt_competition: cp.competition, apt_special_status: cp.special,
      lh_notice: lh.notices.map((r) => ({ ...r, pblanc_no: null })), lh_supply: lh.supply,
      trade: tr.trades, presale_trade: tr.presale, account_stats: await collectAccount(fx, 'K', '2026-11-07'),
      presale_link: [{ trade_key: 'x', pblanc_no: null, method: 'none' }],
    };
    for (const [table, rows] of Object.entries(samples)) {
      expect(rows.length, table).toBeGreaterThan(0);
      const have = cols(table);
      const missing = Object.keys(rows[0]).filter((c) => !have.has(c));
      expect(missing, table).toEqual([]);
      for (const k of TABLES[table]) expect(have.has(k), `${table}.${k}`).toBe(true);
    }
  });
});

describe('runSync (픽스처)', () => {
  it('출처 다섯 곳이 모두 반영되고 묶음과 meta 가 써진다', async () => {
    const store = sqliteStore();
    const r = await runSync(opts(store));
    for (const name of ['applyhome', 'competition', 'lh', 'trade', 'account'] as const) expect(r.sources[name].applied, name).toBe(true);
    expect(await count(store, 'apt_notice')).toBe(3);
    expect(await count(store, 'trade')).toBeGreaterThan(0);
    expect(await count(store, 'presale_link')).toBe(await count(store, 'presale_trade'));
    expect(store.kv.has('apt:2026000557')).toBe(true);
    expect(store.kv.has('home')).toBe(true);
    expect([...store.kv.keys()].some((k) => k.startsWith('trade:11680:'))).toBe(true);
    expect(JSON.parse(store.kv.get('meta:sources')!).applyhome.failures).toBe(0);
    expect(JSON.parse(store.kv.get('backfill:trade')!).index).toBeGreaterThan(0);
    expect(r.alerts).toEqual([]);
  });

  it('두 번째 실행은 바뀐 것이 없으면 행·묶음을 다시 쓰지 않는다', async () => {
    const store = sqliteStore();
    await runSync(opts(store));
    const r2 = await runSync(opts(store));
    expect(r2.rowsWritten).toBe(0);
    expect(r2.kvPut).toBe(0);
  });

  it('실패한 출처는 직전 행으로 묶음을 만든다', async () => {
    const store = sqliteStore();
    await runSync(opts(store));
    const lhKeys = [...store.kv.keys()].filter((k) => k.startsWith('lh:'));
    const before = Object.fromEntries(lhKeys.map((k) => [k, store.kv.get(k)]));
    const r = await runSync(opts(store, failOn('B552555')));
    expect(r.sources.lh.applied).toBe(false);
    expect(r.sources.lh.failures).toBe(1);
    expect(r.sources.applyhome.applied).toBe(true);
    expect(await count(store, 'lh_notice')).toBeGreaterThan(0);
    for (const k of lhKeys) expect(store.kv.get(k)).toBe(before[k]);
  });

  it('받은 건수가 0 이면 그 출처를 반영하지 않는다', async () => {
    const store = sqliteStore();
    await runSync(opts(store));
    const empty: Fetch = async (url) => (url.includes('getAPTLttotPblancDetail') ? { status: 200, body: '{"data":[],"matchCount":0}' } : fx(url));
    const r = await runSync(opts(store, empty));
    expect(r.sources.applyhome).toMatchObject({ applied: false, reason: '0건' });
    expect(await count(store, 'apt_notice')).toBe(3);
  });

  it('같은 출처가 3회 연속 실패하면 알림, 오류 문구에 키가 남지 않는다', async () => {
    const store = sqliteStore();
    const leak: Fetch = async (url) => (url.includes('BnkbAcnut') ? { status: 500, body: `bad key SECRET123` } : fx(url));
    const o = { ...opts(store, leak), keys: ['SECRET123'] };
    expect((await runSync(o)).alerts).toEqual([]);
    expect((await runSync(o)).alerts).toEqual([]);
    const r3 = await runSync(o);
    expect(r3.alerts).toHaveLength(1);
    expect(r3.alerts[0]).toContain('account');
    expect(r3.alerts[0]).not.toContain('SECRET123');
    expect(store.kv.get('meta:sources')).not.toContain('SECRET123');
  });
});
