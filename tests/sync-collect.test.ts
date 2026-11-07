import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { odcloudAll, collectApplyhome, collectCompetition, collectLh, collectTrades, collectAccount, type Fetch } from '../sync/collect';
import { fixtureFetch } from '../sync/fixture-fetch';
import { sigunguCodes, nextBackfill, recentMonths } from '../sync/backfill';
import { buildLawdIndex, type LawdTable } from '../src/lib/region/lawd';

const table: LawdTable = JSON.parse(readFileSync('content/lawd/lawd.json', 'utf8'));
const idx = buildLawdIndex(table);
const fx = fixtureFetch('sync/fixtures');
const KEY = 'FIXTURE';

describe('odcloudAll', () => {
  it('matchCount 에 닿거나 빈 페이지면 멈추고, 조건을 cond[필드::연산] 로 붙인다', async () => {
    const urls: string[] = [];
    const fetch: Fetch = async (url) => {
      urls.push(url);
      const page = Number(new URL(url).searchParams.get('page'));
      return { status: 200, body: JSON.stringify({ data: page === 1 ? [{ a: 1 }, { a: 2 }] : [{ a: 3 }], matchCount: 3 }) };
    };
    const rows = await odcloudAll(fetch, 'k', 'Svc/v1/op', { 'RCRIT_PBLANC_DE::GTE': '2026-09-07' });
    expect(rows).toHaveLength(3);
    expect(urls).toHaveLength(2);
    expect(urls[0]).toContain(`&${encodeURIComponent('cond[RCRIT_PBLANC_DE::GTE]')}=2026-09-07`);
    expect(urls[0]).toContain('perPage=500');
  });

  it('HTTP 오류와 페이지 상한 초과는 던진다', async () => {
    await expect(odcloudAll(async () => ({ status: 500, body: 'x' }), 'k', 'p', {})).rejects.toThrow('HTTP 500');
    const endless: Fetch = async () => ({ status: 200, body: JSON.stringify({ data: [{ a: 1 }], matchCount: 999 }) });
    await expect(odcloudAll(endless, 'k', 'p', {}, 2)).rejects.toThrow('페이지 상한');
  });
});

describe('픽스처로 출처별 수집', () => {
  it('청약홈 공고 3건과 주택형', async () => {
    const r = await collectApplyhome(fx, KEY, '2026-11-07', idx);
    expect(r.notices.map((n) => n.pblanc_no).sort()).toEqual(['2026000553', '2026000557', '2026820015']);
    expect(r.models.length).toBeGreaterThan(0);
  });

  it('경쟁률·특공', async () => {
    const r = await collectCompetition(fx, KEY, '2026000553', () => '01');
    expect(r.competition.length).toBeGreaterThan(0);
    expect(r.special.length).toBeGreaterThan(0);
  });

  it('LH 공고: 분양·임대 목록과 상세·공급, 상세가 실패해도 목록 항목은 남는다', async () => {
    const r = await collectLh(fx, KEY, idx);
    expect(r.notices.length).toBeGreaterThan(0);
    const noDetail: Fetch = async (url) => (url.includes('getLeaseNoticeDtlInfo1') ? { status: 500, body: 'x' } : fx(url));
    const r2 = await collectLh(noDetail, KEY, idx);
    expect(r2.notices.length).toBe(r.notices.length);
  });

  it('국토부 실거래·분양권: 픽스처가 있는 작업만 행이 나온다', async () => {
    const r = await collectTrades(fx, KEY, [{ lawd: '11680', ym: '202610' }, { lawd: '41117', ym: '202610' }, { lawd: '11110', ym: '202610' }]);
    expect(r.trades.length).toBeGreaterThan(0);
    expect(r.trades.every((t) => t.lawd_cd === '11680')).toBe(true);
    expect(r.presale.length).toBeGreaterThan(0);
  });

  it('국토부 resultCode 오류는 던진다', async () => {
    const bad: Fetch = async () => ({ status: 200, body: '<response><header><resultCode>30</resultCode><resultMsg>KEY ERROR</resultMsg></header></response>' });
    await expect(collectTrades(bad, KEY, [{ lawd: '11680', ym: '202610' }])).rejects.toThrow('resultCode 30');
  });

  it('통장 통계', async () => {
    expect((await collectAccount(fx, KEY, '2026-11-07')).length).toBeGreaterThan(0);
  });
});

describe('백필', () => {
  it('시군구 코드는 5자리, 시도·읍면동은 빠진다', () => {
    const codes = sigunguCodes(table);
    expect(codes).toContain('11680');
    expect(codes).toContain('41117');
    expect(codes).not.toContain('11000');
    expect(codes.every((c) => c.length === 5)).toBe(true);
  });

  it('최근 달의 전국부터, 실행당 max 개씩 이어 간다', () => {
    const lawds = ['11110', '11140', '11680'];
    const a = nextBackfill(null, lawds, '2026-11-07', 4);
    expect(a.jobs).toEqual([
      { lawd: '11110', ym: '202610' }, { lawd: '11140', ym: '202610' }, { lawd: '11680', ym: '202610' }, { lawd: '11110', ym: '202609' },
    ]);
    expect(a.state).toEqual({ base: '202610', index: 4 });
    const b = nextBackfill(a.state, lawds, '2026-12-20', 100);
    expect(b.jobs).toHaveLength(32);
    expect(b.jobs.at(-1)).toEqual({ lawd: '11680', ym: '202511' });
    expect(b.done).toBe(true);
    // 같은 기준월이면 끝난 채로 (기준월이 지나면 새로 돈다 — sync-review-fixes 시험)
    expect(nextBackfill(b.state, lawds, '2026-11-30', 100).jobs).toEqual([]);
  });

  it('최근 두 달', () => {
    expect(recentMonths('2026-01-15')).toEqual(['202601', '202512']);
  });
});
