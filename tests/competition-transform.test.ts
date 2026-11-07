import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { residenceOf, toCompetitionRow, toSpecialStatusRows } from '../src/lib/apt/competition-transform';

const comp: Record<string, unknown>[] = JSON.parse(readFileSync('sync/fixtures/applyhome-cmpet/competition.json', 'utf8')).data;
const spec: Record<string, unknown>[] = JSON.parse(readFileSync('sync/fixtures/applyhome-cmpet/special-status.json', 'utf8')).data;

describe('residenceOf', () => {
  it('거주 구분 이름을 코드로', () => {
    expect(residenceOf('해당지역')).toBe('local');
    expect(residenceOf('기타경기')).toBe('province');
    expect(residenceOf('기타지역')).toBe('other');
    expect(residenceOf(null)).toBe('all');
  });
});

describe('toCompetitionRow', () => {
  it('1순위 해당지역', () => {
    expect(toCompetitionRow(comp[0])).toEqual({
      pblanc_no: '2026000532', model_no: '01', rank: 1, residence: 'local',
      supply_count: 116, applicants: 119, rate: 2.05, rate_text: '2.05',
    });
  });
  it("경쟁률 '-' 는 rate null, 원문은 남긴다", () => {
    expect(toCompetitionRow(comp[2])).toMatchObject({ rank: 2, residence: 'local', applicants: 27, rate: null, rate_text: '-' });
  });
  it('미달 표기(△) 도 원문만 남긴다', () => {
    expect(toCompetitionRow({ ...comp[0], CMPET_RATE: '(△12)' })).toMatchObject({ rate: null, rate_text: '(△12)' });
  });
  it('공고번호·주택형번호·순위가 없으면 null', () => {
    expect(toCompetitionRow({ ...comp[0], MODEL_NO: '' })).toBeNull();
    expect(toCompetitionRow({ ...comp[0], SUBSCRPT_RANK_CODE: null })).toBeNull();
  });
});

describe('toSpecialStatusRows', () => {
  const rows = toSpecialStatusRows(spec[0], (p, ty) => (p === '2026000532' && ty === '084.3473A' ? '01' : null));
  const find = (t: string, r: string) => rows.find((x) => x.special_type === t && x.residence === r);
  it('유형·거주지역별 신청 수', () => {
    expect(find('first_life', 'local')).toMatchObject({ pblanc_no: '2026000532', model_no: '01', allotted: null, applicants: 10 });
    expect(find('first_life', 'other')).toMatchObject({ applicants: 15 });
    expect(find('first_life', 'province')).toMatchObject({ applicants: 0 });
  });
  it('all 행은 배정 세대수와 신청 합계', () => {
    expect(find('first_life', 'all')).toMatchObject({ allotted: 31, applicants: 25 });
    expect(find('newlywed', 'all')).toMatchObject({ allotted: 28, applicants: 18 });
    expect(find('elderly_parent', 'all')).toMatchObject({ allotted: 6, applicants: 0 });
  });
  it('기관추천은 all 한 행(신청 = 결정 수)', () => {
    expect(rows.filter((x) => x.special_type === 'institution')).toEqual([
      { pblanc_no: '2026000532', model_no: '01', special_type: 'institution', residence: 'all', allotted: 27, applicants: 1 },
    ]);
  });
  it('주택형번호를 못 찾으면 주택형을 그대로 쓴다', () => {
    const r = toSpecialStatusRows(spec[0], () => null);
    expect(r[0].model_no).toBe('084.3473A');
  });
  it('공고번호가 없으면 행이 없다', () => {
    expect(toSpecialStatusRows({ ...spec[0], PBLANC_NO: '' }, () => '01')).toEqual([]);
  });
});
