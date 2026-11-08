import { describe, it, expect } from 'vitest';
import { judgeNewlywed, newlywedRank } from '../src/lib/eligibility/newlywed';
import { judgeNewborn } from '../src/lib/eligibility/newborn';
import { INCOME_TABLES } from '../src/lib/eligibility/tables';
import { applicant, notice, find } from './eligibility-fixtures';

const T = INCOME_TABLES;

describe('제41조 신혼부부', () => {
  it('제41조 ④ 국민: 요건을 모두 채우면 가능, 혼인 중 출생 자녀가 있어 1순위', () => {
    const r = judgeNewlywed(applicant(), notice(), T);
    expect(r).toMatchObject({ type: 'newlywed', article: '제41조 제4항', verdict: 'ok', rank: '1순위' });
  });
  it('제41조 ① 혼인 7년째 마지막 날 공고는 이내, 하루 지나면 불가', () => {
    expect(find(judgeNewlywed(applicant({ marriageDate: '2019-11-07' }), notice(), T), '혼인 7년 이내')?.verdict).toBe('ok');
    expect(judgeNewlywed(applicant({ marriageDate: '2019-11-06' }), notice(), T).verdict).toBe('no');
  });
  it('제41조 ① 미혼은 불가', () => {
    expect(judgeNewlywed(applicant({ married: false, marriageDate: null }), notice(), T).verdict).toBe('no');
  });
  it('제41조 ① 민영은 전용 85㎡ 이하만 — 84.9512·85 통과, 85.0001 불가', () => {
    const p = (areaExcl: number) => judgeNewlywed(applicant(), notice({ supplyKind: 'private', areaExcl }), T);
    expect(p(84.9512).article).toBe('제41조 제1항');
    expect(p(84.9512).verdict).toBe('check'); // 민영 예치금(별표 2)은 확인 필요
    expect(p(85).verdict).toBe('check');
    expect(p(85.0001).verdict).toBe('no');
  });
  it('제41조 국민은 85㎡를 넘어도 면적으로 막지 않는다', () => {
    expect(find(judgeNewlywed(applicant(), notice({ areaExcl: 99 }), T), '전용 85㎡ 이하')).toBeUndefined();
  });
  it('제41조 ① 소득 140% 경계: 3인 10,547,268원 가능, 1원 넘으면 확인 필요(재산 대안)', () => {
    expect(judgeNewlywed(applicant({ monthlyIncome: 10_547_268 }), notice(), T).verdict).toBe('ok');
    expect(judgeNewlywed(applicant({ monthlyIncome: 10_547_269 }), notice(), T).verdict).toBe('check');
  });
  it('제41조 ① 맞벌이 160% 경계: 3인 12,054,020원 가능', () => {
    expect(judgeNewlywed(applicant({ dualIncome: true, monthlyIncome: 12_054_020 }), notice(), T).verdict).toBe('ok');
    expect(judgeNewlywed(applicant({ dualIncome: true, monthlyIncome: 12_054_021 }), notice(), T).verdict).toBe('check');
  });
  it('제41조 공급 순위: 자녀 없음 2순위, 태아·입양 1순위, 혼인 전 출생 자녀만 있으면 확인 필요', () => {
    expect(newlywedRank(applicant({ children: [] }))).toBe('2순위');
    expect(newlywedRank(applicant({ children: [{ kind: 'fetus', birth: null }] }))).toBe('1순위');
    expect(newlywedRank(applicant({ children: [{ kind: 'adopted', birth: '2015-01-01' }] }))).toBe('1순위');
    expect(newlywedRank(applicant({ children: [{ kind: 'born', birth: '2021-01-01' }] }))).toBe('확인 필요');
  });
  it('제41조 다른 세대원이 주택 소유면 불가', () => {
    expect(judgeNewlywed(applicant({ homeOwner: 'other_member' }), notice(), T).verdict).toBe('no');
  });
});

describe('제35조의3 신생아', () => {
  it('제35조의3 ① 국민: 다른 요건을 채워도 1순위는 확인 필요', () => {
    const r = judgeNewborn(applicant(), notice(), T);
    expect(r).toMatchObject({ type: 'newborn', article: '제35조의3 제1항', verdict: 'check' });
    expect(find(r, '2세 미만 자녀')?.verdict).toBe('ok');
    expect(find(r, '청약 1순위')?.verdict).toBe('check');
  });
  it('제35조의3 ① 2세 생일 전날·당일은 2세 미만, 다음 날은 불가', () => {
    const a = applicant({ children: [{ kind: 'born', birth: '2024-11-08' }] });
    expect(find(judgeNewborn(a, notice({ noticeDate: '2026-11-07' }), T), '2세 미만 자녀')?.verdict).toBe('ok');
    expect(find(judgeNewborn(a, notice({ noticeDate: '2026-11-08' }), T), '2세 미만 자녀')?.verdict).toBe('ok');
    expect(judgeNewborn(a, notice({ noticeDate: '2026-11-09' }), T).verdict).toBe('no');
  });
  it('제35조의3 ① 태아도 자녀로 본다', () => {
    expect(find(judgeNewborn(applicant({ children: [{ kind: 'fetus', birth: null }] }), notice(), T), '2세 미만 자녀')?.verdict).toBe('ok');
  });
  it('제35조의3 ① 출생일 모르는 자녀만 있으면 확인 필요', () => {
    expect(find(judgeNewborn(applicant({ children: [{ kind: 'born', birth: null }] }), notice(), T), '2세 미만 자녀')?.verdict).toBe('check');
  });
  it('제35조의3 ③ 민영은 85㎡ 이하만', () => {
    expect(judgeNewborn(applicant(), notice({ supplyKind: 'private', areaExcl: 85.01 }), T).verdict).toBe('no');
    expect(judgeNewborn(applicant(), notice({ supplyKind: 'private', areaExcl: 85 }), T).article).toBe('제35조의3 제3항');
  });
  it('제35조의3 ① 국민 소득 130% 경계(4인 11,442,862원), 넘으면 재산 대안으로 확인 필요', () => {
    const a = (monthlyIncome: number) => applicant({ householdSize: 4, monthlyIncome });
    expect(find(judgeNewborn(a(11_442_862), notice(), T), '소득 기준')?.verdict).toBe('ok');
    expect(find(judgeNewborn(a(11_442_863), notice(), T), '소득 기준')?.verdict).toBe('check');
  });
  it('제35조의3 ③ 민영은 160%까지', () => {
    const r = judgeNewborn(applicant({ monthlyIncome: 12_054_020 }), notice({ supplyKind: 'private', areaExcl: 84 }), T);
    expect(find(r, '소득 기준')?.verdict).toBe('ok');
  });
});
