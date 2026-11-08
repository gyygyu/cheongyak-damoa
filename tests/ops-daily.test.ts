import { describe, it, expect } from 'vitest';
import { summarizeRum, logRow, appendLogRow, tabOf, refererLabel, yesterdayKst, previousDays, limitLine, actionsLatest, repoFromRemote, dayUsage, LOG_HEADER, type RumRow } from '../sync/ops/daily-summary';

const r = (path: string, count: number, visits: number, referer = '', device = 'mobile'): RumRow =>
  ({ count, sum: { visits }, dimensions: { requestPath: path, refererHost: referer, deviceType: device, countryName: 'KR' } });

describe('summarizeRum', () => {
  it('조회·방문·유입·탭·많이 본 페이지', () => {
    const s = summarizeRum([r('/', 10, 5, 'm.search.naver.com'), r('/apt/2026000557', 6, 3, 'www.google.com'), r('/eligibility', 2, 1)]);
    expect(s.views).toBe(18);
    expect(s.visits).toBe(9);
    expect(s.referers).toEqual({ 네이버: 5, 구글: 3, 직접: 1 });
    expect(s.tabs).toEqual({ 홈: 10, '단지 상세': 6, '자격 판정': 2 });
    expect(s.topPages[0]).toEqual({ path: '/', views: 10 });
  });
  it('인코딩된 한글 경로를 풀고 깨진 값은 그대로', () => {
    expect(summarizeRum([r('/region/%EA%B2%BD%EA%B8%B0%EB%8F%84', 1, 1)]).topPages[0].path).toBe('/region/경기도');
    expect(summarizeRum([r('/region/%E0%A4%A', 1, 1)]).topPages[0].path).toBe('/region/%E0%A4%A');
  });
  it('탭 이름', () => {
    expect(tabOf('/trade/11680/대치동')).toBe('실거래·지역');
    expect(tabOf('/calendar/2026-11')).toBe('캘린더');
    expect(tabOf('/lh/1')).toBe('LH 공고');
    expect(tabOf('/x')).toBe('기타');
    expect(refererLabel('cheongyakdamoa.com')).toBe('사이트 안');
  });
});

describe('기록 줄', () => {
  it('단지 이름으로 바꾸고 상세 비중을 계산한다', () => {
    const s = summarizeRum([r('/apt/P1', 5, 2), r('/', 5, 3)]);
    expect(logRow('2026-11-20', s, { P1: '시흥 거모' })).toBe('| 2026-11-20 | 5 | 10 | 0 | 0 | 5 | 50% | 0 | 시흥 거모 5, / 5 |');
  });
  it('같은 날짜는 다시 붙이지 않는다', () => {
    const first = appendLogRow(null, '2026-11-20', '| 2026-11-20 | x |');
    expect(first).toBe(`${LOG_HEADER}| 2026-11-20 | x |\n`);
    expect(appendLogRow(first, '2026-11-20', '| 2026-11-20 | y |')).toBeNull();
  });
});

describe('날짜·한도·Actions', () => {
  it('어제(한국 날짜)와 앞 날짜', () => {
    expect(yesterdayKst(new Date('2026-11-07T16:00:00Z'))).toBe('2026-11-07');
    expect(previousDays('2026-11-07', 2)).toEqual(['2026-11-06', '2026-11-05']);
  });
  it('한도 줄은 70% 넘으면 경고', () => {
    expect(limitLine('KV 쓰기', 800, 1000)).toBe('KV 쓰기 800 / 1,000 (80%) ⚠ 70% 넘음');
    expect(limitLine('D1 쓴 행', 10, 100000)).toBe('D1 쓴 행 10 / 100,000 (0%)');
  });
  it('그날 기록만 사용량으로 센다', () => {
    expect(dayUsage({ date: '2026-11-07', used: 300 }, '2026-11-07')).toBe(300);
    expect(dayUsage({ date: '2026-11-06', used: 300 }, '2026-11-07')).toBe(0);
    expect(dayUsage(null, '2026-11-07')).toBe(0);
  });
  it('워크플로별 최근 결과와 실패 수', () => {
    const runs = [
      { name: 'sync', conclusion: 'success', status: 'completed', created_at: '2026-11-07T00:00:00Z' },
      { name: 'sync', conclusion: 'failure', status: 'completed', created_at: '2026-11-06T00:00:00Z' },
    ];
    expect(actionsLatest(runs)).toEqual([{ name: 'sync', latest: 'success', at: '2026-11-07 09:00', failures: 1 }]);
  });
  it('저장소 주소에서 owner/repo', () => {
    expect(repoFromRemote('https://github.com/a/cheongyak.git')).toBe('a/cheongyak');
    expect(repoFromRemote('git@github.com:a/cheongyak.git')).toBe('a/cheongyak');
    expect(repoFromRemote('')).toBeNull();
  });
});
