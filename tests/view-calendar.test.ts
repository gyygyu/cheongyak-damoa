import { describe, it, expect } from 'vitest';
import { parseMonth, monthGrid, monthRows, dayCounts, dayList, dday, complexKey, dedupeEvents, mergeEvents, hrefOf, kindGroup, prevMonth, nextMonth, eventRow, placeLabel, weekGroups } from '../src/lib/view/calendar';
import type { CalendarEvent } from '../src/lib/apt/schedule';

const ev = (date: string, endDate?: string, kind: CalendarEvent['kind'] = 'rank1', ref = 'apt:P1'): CalendarEvent =>
  ({ date, ...(endDate ? { endDate } : {}), kind, ref, title: '시흥 거모' });

describe('parseMonth', () => {
  it('YYYY-MM 이고 ±12개월 안이면 그대로', () => {
    expect(parseMonth('2026-11', '2026-11-07')).toBe('2026-11');
    expect(parseMonth('2027-11', '2026-11-07')).toBe('2027-11');
    expect(parseMonth('2025-11', '2026-11-07')).toBe('2025-11');
  });
  it('범위 밖·형식 오류는 null', () => {
    for (const v of ['2027-12', '2025-10', '2026-13', '2026-1', 'abc', undefined]) expect(parseMonth(v, '2026-11-07')).toBeNull();
  });
  it('앞뒤 달', () => {
    expect(prevMonth('2026-01')).toBe('2025-12');
    expect(nextMonth('2026-12')).toBe('2027-01');
  });
});

describe('monthGrid', () => {
  it('2026-11 은 일요일(1일)부터, 5주', () => {
    const g = monthGrid('2026-11');
    expect(g[0][0]).toBe('2026-11-01');
    expect(g.length).toBe(5);
    expect(g[4].filter(Boolean).at(-1)).toBe('2026-11-30');
    expect(g.every((w) => w.length === 7)).toBe(true);
  });
  it('2026-12 는 화요일 시작이라 앞 두 칸이 비어 있다', () => {
    const g = monthGrid('2026-12');
    expect(g[0].slice(0, 3)).toEqual([null, null, '2026-12-01']);
  });
});

describe('monthRows — 날짜별 목록 줄 (Review Focus 5)', () => {
  const T = '2026-11-08';
  it('하루 일정은 그날 한 줄, 여러 날 접수는 시작일과 마감일에 한 줄씩', () => {
    const days = monthRows([ev('2026-11-16', '2026-11-18'), ev('2026-11-20', undefined, 'winner')], '2026-11', T);
    expect(Object.keys(days).sort()).toEqual(['2026-11-16', '2026-11-18', '2026-11-20']);
    expect(days['2026-11-16'][0]).toMatchObject({ end: false, meta: '2026.11.16(월) ~ 11.18(수)', note: null });
    expect(days['2026-11-18'][0]).toMatchObject({ end: true, note: '마감 D-10', noteTone: 'later' });
  });
  it('지난달에 시작한 접수는 이번 달 마감일에만 보인다', () => {
    const days = monthRows([ev('2026-10-30', '2026-11-02')], '2026-11', T);
    expect(Object.keys(days)).toEqual(['2026-11-02']);
    expect(days['2026-11-02'][0]).toMatchObject({ end: true, note: '마감', noteTone: 'past' });
  });
  it('지난달에 시작한 접수 아닌 일정(계약)은 이번 달 1일에 보인다', () => {
    expect(Object.keys(monthRows([ev('2026-10-30', '2026-11-02', 'contract')], '2026-11', T))).toEqual(['2026-11-01']);
  });
  it('다음 달에 마감하는 접수는 이번 달 시작일에만', () => {
    expect(Object.keys(monthRows([ev('2026-11-30', '2026-12-02')], '2026-11', T))).toEqual(['2026-11-30']);
  });
  it('진행 중인 접수의 시작 줄에는 마감까지 남은 날을 붙인다', () => {
    const days = monthRows([ev('2026-11-02', '2026-11-10', 'lh-receipt', 'lh:L1')], '2026-11', T);
    expect(days['2026-11-02'][0]).toMatchObject({ end: false, note: '마감 D-2', noteTone: 'soon' });
    expect(days['2026-11-10'][0]).toMatchObject({ end: true, note: '마감 D-2', noteTone: 'soon' });
  });
  it('끝날이 시작보다 앞서는 잘못된 값은 시작일 하루만', () => {
    expect(Object.keys(monthRows([ev('2026-11-05', '2026-11-01')], '2026-11', T))).toEqual(['2026-11-05']);
  });
  it('같은 날은 특별공급 → 1순위 → 2순위 → 발표 순', () => {
    const days = monthRows([ev('2026-11-09', undefined, 'winner'), ev('2026-11-09', undefined, 'rank1'), ev('2026-11-09', undefined, 'special')], '2026-11', T);
    expect(days['2026-11-09'].map((r) => r.kindLabel)).toEqual(['특별공급', '1순위', '당첨자 발표']);
  });
  it('mergeEvents 는 이번 달·지난달 묶음의 같은 일정을 하나로', () => {
    expect(mergeEvents([ev('2026-11-01')], [ev('2026-11-01'), ev('2026-11-02')]).length).toBe(2);
  });
});

describe('dayCounts — 달력 칸 건수', () => {
  it('종류별 건수, 여러 날 접수의 마감은 그룹별 "마감"으로 센다', () => {
    const rows = monthRows([
      ev('2026-11-09', undefined, 'rank1', 'apt:A'), ev('2026-11-09', undefined, 'rank1', 'apt:B'), ev('2026-11-09', undefined, 'winner', 'apt:C'),
      ev('2026-11-02', '2026-11-09', 'lh-receipt', 'lh:L1'),
    ], '2026-11', '2026-11-08');
    expect(dayCounts(rows)['2026-11-09']).toEqual([
      { key: 'rank1', label: '1순위', count: 2, group: 'apt' },
      { key: 'winner', label: '발표', count: 1, group: 'apt' },
      { key: 'end-lh', label: 'LH 마감', count: 1, group: 'lh' },
    ]);
    expect(dayCounts(rows)['2026-11-02']).toEqual([{ key: 'lh-receipt', label: 'LH 접수', count: 1, group: 'lh' }]);
  });
});

describe('dayList — 아래 목록 (휴대폰은 오늘부터)', () => {
  const evs = [ev('2026-11-02'), ev('2026-11-05', undefined, 'winner'), ev('2026-11-08', undefined, 'rank2'), ev('2026-11-10', undefined, 'winner')];
  it('이번 달이면 오늘 전 날짜는 지난 일정으로 접는다', () => {
    const v = dayList(monthRows(evs, '2026-11', '2026-11-08'), '2026-11', '2026-11-08');
    expect(v.past.map((d) => d.date)).toEqual(['2026-11-02', '2026-11-05']);
    expect(v.pastCount).toBe(2);
    expect(v.days.map((d) => [d.date, d.dday, d.tone])).toEqual([['2026-11-08', '오늘', 'today'], ['2026-11-10', 'D-2', 'soon']]);
    expect(v.days[0]).toMatchObject({ id: 'd-2026-11-08', label: '11.08(일)' });
  });
  it('다른 달은 접지 않는다', () => {
    const v = dayList(monthRows(evs, '2026-11', '2026-12-20'), '2026-11', '2026-12-20');
    expect(v.past).toEqual([]);
    expect(v.days.length).toBe(4);
  });
});

describe('weekGroups — 날짜 목록을 달력 줄(주) 단위로 묶어 첫 주만 펼친다', () => {
  const evs = [ev('2026-11-02'), ev('2026-11-05', undefined, 'winner'), ev('2026-11-08', undefined, 'rank2'), ev('2026-11-10', undefined, 'winner'), ev('2026-11-30', undefined, 'winner')];
  it('주마다 기간 글자·건수, 첫 주만 open', () => {
    const v = dayList(monthRows(evs, '2026-11', '2026-12-20'), '2026-11', '2026-12-20');
    const w = weekGroups(v.days, '2026-11');
    expect(w.map((g) => [g.label, g.count, g.open, g.days.map((d) => d.date.slice(8))])).toEqual([
      ['11.01(일) ~ 11.07(토)', 2, true, ['02', '05']],
      ['11.08(일) ~ 11.14(토)', 2, false, ['08', '10']],
      ['11.29(일) ~ 11.30(월)', 1, false, ['30']],
    ]);
    expect(w[1].id).toBe('w-2026-11-08');
  });
  it('이번 달이면 오늘이 든 주부터 (지난 날은 dayList 가 이미 뺐다)', () => {
    const v = dayList(monthRows(evs, '2026-11', '2026-11-09'), '2026-11', '2026-11-09');
    const w = weekGroups(v.days, '2026-11');
    expect(w.map((g) => [g.label, g.count, g.open])).toEqual([['11.08(일) ~ 11.14(토)', 1, true], ['11.29(일) ~ 11.30(월)', 1, false]]);
  });
  it('일정이 없으면 빈 배열', () => {
    expect(weekGroups([], '2026-11')).toEqual([]);
  });
});

describe('placeLabel — 일정 줄의 짧은 지역 글자', () => {
  it('시도는 짧은 이름, 시군구는 그대로', () => {
    expect(placeLabel('서울특별시', '강남구')).toBe('서울 강남구');
    expect(placeLabel('경기도', '수원시 영통구')).toBe('경기 수원시 영통구');
    expect(placeLabel('전남광주통합특별시', '여수시')).toBe('전남광주 여수시');
    expect(placeLabel('세종특별자치시', null)).toBe('세종');
    expect(placeLabel('강원특별자치도', '춘천시')).toBe('강원 춘천시');
  });
  it('시도가 없으면 null, 모르는 시도 이름은 그대로', () => {
    expect(placeLabel(null, '강남구')).toBeNull();
    expect(placeLabel(undefined, undefined)).toBeNull();
    expect(placeLabel('어딘가', null)).toBe('어딘가');
  });
});

describe('dday', () => {
  it('오늘 = today, D-3 이내 = soon, 그 뒤 = later, 지난 날 = past (7일 넘으면 글자 없음)', () => {
    expect(dday('2026-11-08', '2026-11-08')).toEqual({ label: '오늘', tone: 'today' });
    expect(dday('2026-11-08', '2026-11-11')).toEqual({ label: 'D-3', tone: 'soon' });
    expect(dday('2026-11-08', '2026-11-12')).toEqual({ label: 'D-4', tone: 'later' });
    expect(dday('2026-11-08', '2026-11-06')).toEqual({ label: 'D+2', tone: 'past' });
    expect(dday('2026-11-08', '2026-10-20')).toEqual({ label: null, tone: 'past' });
  });
});

describe('dedupeEvents — 같은 단지가 청약홈·LH 에 두 번 실린 경우', () => {
  const e = (title: string, ref: string, kind: CalendarEvent['kind'], date: string, endDate?: string): CalendarEvent =>
    ({ date, ...(endDate ? { endDate } : {}), kind, ref, title });
  it('단지 이름 열쇠는 지구·공공분양주택·본청약·입주자 모집공고 같은 꾸밈말을 뺀다', () => {
    expect(complexKey('시흥거모지구 S-1블록 공공분양(본청약)')).toBe(complexKey('시흥거모 S-1블록 공공분양주택 입주자모집공고'));
    expect(complexKey('안산신길2지구 B-1블록 공공분양주택(본청약)')).toBe(complexKey('안산신길2 B-1블록 공공분양주택 입주자 모집공고'));
    expect(complexKey('영종 A17BL')).toBe(complexKey('영종 A17블록'));
  });
  it('블록·차수·잔여세대가 다르면 다른 단지', () => {
    expect(complexKey('고양지축 B-1블록 공공분양주택')).not.toBe(complexKey('고양지축 B-2블록 공공분양주택'));
    expect(complexKey('고양지축 B-1블록 공공분양주택 잔여세대 추가입주자모집공고')).not.toBe(complexKey('고양지축 B-1블록 공공분양주택 입주자모집공고'));
  });
  it('청약홈 접수와 기간이 겹치는 같은 단지 LH 접수는 뺀다 (청약홈 쪽을 남긴다)', () => {
    const out = dedupeEvents([
      e('시흥거모지구 S-1블록 공공분양(본청약)', 'apt:2026000531', 'rank1', '2026-11-02', '2026-11-16'),
      e('시흥거모 S-1블록 공공분양주택 입주자모집공고', 'lh:0000061186', 'lh-receipt', '2026-11-02', '2026-11-17'),
    ]);
    expect(out.map((x) => x.ref)).toEqual(['apt:2026000531']);
  });
  it('제목·기간이 같은 LH 공고 두 건은 하나만', () => {
    const out = dedupeEvents([
      e('안산신길2 B-1블록 공공분양주택 입주자 모집공고', 'lh:0000061196', 'lh-receipt', '2026-11-09', '2026-11-18'),
      e('안산신길2 B-1블록 공공분양주택 입주자 모집공고', 'lh:0000061205', 'lh-receipt', '2026-11-09', '2026-11-18'),
    ]);
    expect(out.map((x) => x.ref)).toEqual(['lh:0000061196']);
  });
  it('기간이 겹치지 않거나 이름이 다르면 둘 다 남긴다', () => {
    const out = dedupeEvents([
      e('시흥거모지구 S-1블록 공공분양(본청약)', 'apt:A', 'rank1', '2026-11-02', '2026-11-03'),
      e('시흥거모 S-1블록 공공분양주택 입주자모집공고', 'lh:L1', 'lh-receipt', '2026-12-02', '2026-12-03'),
      e('인천가정2 B2블록 공공분양 잔여세대', 'lh:L2', 'lh-receipt', '2026-11-02', '2026-11-03'),
    ]);
    expect(out.length).toBe(3);
  });
  it('같은 공고의 특별공급·1순위는 둘 다 남긴다', () => {
    const out = dedupeEvents([e('수원 영통', 'apt:P1', 'special', '2026-11-09'), e('수원 영통', 'apt:P1', 'rank1', '2026-11-10')]);
    expect(out.length).toBe(2);
  });
});

describe('링크·그룹', () => {
  it('ref → 주소', () => {
    expect(hrefOf('apt:2026000557')).toBe('/apt/2026000557');
    expect(hrefOf('lh:0000061174')).toBe('/lh/0000061174');
    expect(hrefOf('ipo:00123456')).toBe('/ipo/00123456');
    expect(hrefOf('apt:null')).toBeNull();
    expect(hrefOf('x')).toBeNull();
  });
  it('그룹', () => {
    expect(kindGroup('rank1')).toBe('apt');
    expect(kindGroup('lh-receipt')).toBe('lh');
    expect(kindGroup('ipo-listing')).toBe('ipo');
  });
  it('eventRow', () => {
    expect(eventRow(ev('2026-11-16', '2026-11-26'))).toMatchObject({ dateText: '2026.11.16(월) ~ 11.26(목)', kindLabel: '1순위', href: '/apt/P1', group: 'apt', place: null, sido: null });
    expect(eventRow({ ...ev('2026-11-16'), sido: '경기도', sigungu: '시흥시' })).toMatchObject({ place: '경기 시흥시', sido: '경기도' });
  });
});
