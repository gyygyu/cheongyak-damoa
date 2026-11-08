import { describe, it, expect } from 'vitest';
import { judgeFirstLife } from '../src/lib/eligibility/first-life';
import { judgeMultichild } from '../src/lib/eligibility/multichild';
import { judgeElderly } from '../src/lib/eligibility/elderly';
import { INCOME_TABLES } from '../src/lib/eligibility/tables';
import { applicant, notice, find } from './eligibility-fixtures';

const T = INCOME_TABLES;

describe('제43조 생애최초', () => {
  it('제43조 ① 국민: 요건을 채워도 1순위는 확인 필요', () => {
    const r = judgeFirstLife(applicant(), notice(), T);
    expect(r).toMatchObject({ type: 'first_life', article: '제43조 제1항', verdict: 'check' });
    expect(r.checks.filter((c) => c.verdict !== 'ok').map((c) => c.label)).toEqual(['청약 1순위']);
  });
  it('제43조 ① 세대 구성원이 주택을 소유한 적이 있으면 불가', () => {
    expect(judgeFirstLife(applicant({ everOwned: true }), notice(), T).verdict).toBe('no');
  });
  it('제43조 ① 소득세 5년 납부부터 가능', () => {
    expect(find(judgeFirstLife(applicant({ incomeTaxYears: 5 }), notice(), T), '소득세 5년 이상 납부')?.verdict).toBe('ok');
    expect(judgeFirstLife(applicant({ incomeTaxYears: 4 }), notice(), T).verdict).toBe('no');
  });
  it('제43조 ① 국민은 저축 600만원 이상(선납 포함)', () => {
    expect(find(judgeFirstLife(applicant({ savingsTotal: 600 }), notice(), T), '저축 600만원 이상')?.verdict).toBe('ok');
    expect(judgeFirstLife(applicant({ savingsTotal: 599 }), notice(), T).verdict).toBe('no');
  });
  it('제43조 ③ 민영은 저축 요건이 없고 85㎡ 이하만', () => {
    const r = judgeFirstLife(applicant({ savingsTotal: 0 }), notice({ supplyKind: 'private', areaExcl: 84 }), T);
    expect(r.article).toBe('제43조 제3항');
    expect(find(r, '저축 600만원 이상')).toBeUndefined();
    expect(judgeFirstLife(applicant(), notice({ supplyKind: 'private', areaExcl: 85.01 }), T).verdict).toBe('no');
  });
  it('제43조 후단 단독세대는 전용 60㎡ 이하만 — 60 통과, 60.01 불가', () => {
    const a = applicant({ singleHousehold: true });
    expect(find(judgeFirstLife(a, notice({ areaExcl: 60 }), T), '전용 60㎡ 이하(단독세대)')).toBeUndefined();
    expect(judgeFirstLife(a, notice({ areaExcl: 60.01 }), T).verdict).toBe('no');
  });
  it('제43조 ① 혼인 중도 아니고 자녀도 없으면 같은 항 제2호 나목 확인 필요', () => {
    const r = judgeFirstLife(applicant({ married: false, marriageDate: null, children: [] }), notice(), T);
    expect(find(r, '혼인 중이거나 자녀 있음')?.verdict).toBe('check');
  });
  it('제43조는 제55조의3 ③ 특례 대상이 아니다', () => {
    const a = applicant({ priorSpecial: true, children: [{ kind: 'born', birth: '2025-01-01' }] });
    expect(judgeFirstLife(a, notice(), T).verdict).toBe('no');
  });
});

describe('제40조 다자녀', () => {
  const two = [{ kind: 'born' as const, birth: '2025-05-01' }, { kind: 'born' as const, birth: '2010-01-01' }];
  it('제40조 ① 미성년 자녀 2명이면 국민 가능', () => {
    expect(judgeMultichild(applicant({ children: two }), notice(), T)).toMatchObject({ type: 'multichild', article: '제40조 제1항', verdict: 'ok' });
  });
  it('제40조 ① 19세 생일이 공고일인 자녀는 미성년이 아니다', () => {
    const kids = [{ kind: 'born' as const, birth: '2025-05-01' }, { kind: 'born' as const, birth: '2007-11-07' }];
    expect(judgeMultichild(applicant({ children: kids }), notice(), T).verdict).toBe('no');
  });
  it('제40조 ③ 태아도 자녀로 센다', () => {
    const kids = [{ kind: 'born' as const, birth: '2025-05-01' }, { kind: 'fetus' as const, birth: null }];
    expect(find(judgeMultichild(applicant({ children: kids }), notice(), T), '미성년 자녀 2명 이상')?.verdict).toBe('ok');
  });
  it('제40조 ① 출생일 모르는 자녀가 있어 2명이 될 수 있으면 확인 필요', () => {
    const kids = [{ kind: 'born' as const, birth: '2025-05-01' }, { kind: 'born' as const, birth: null }];
    expect(find(judgeMultichild(applicant({ children: kids }), notice(), T), '미성년 자녀 2명 이상')?.verdict).toBe('check');
  });
  it('제40조 ② 제18조 사업주체 85㎡ 이하는 소득 120%(4인 10,562,642원)', () => {
    const a = (monthlyIncome: number) => applicant({ children: two, householdSize: 4, monthlyIncome });
    const pub = notice({ publicBuilder: true, areaExcl: 84 });
    expect(judgeMultichild(a(10_562_642), pub, T)).toMatchObject({ article: '제40조 제2항', verdict: 'ok' });
    expect(judgeMultichild(a(10_562_643), pub, T).verdict).toBe('no');
  });
  it('제40조 ② 사업주체를 모르면 소득 초과는 확인 필요, 민간 사업주체면 소득을 보지 않는다', () => {
    const a = applicant({ children: two, householdSize: 4, monthlyIncome: 20_000_000 });
    expect(judgeMultichild(a, notice({ publicBuilder: null, areaExcl: 84 }), T).verdict).toBe('check');
    expect(judgeMultichild(a, notice({ publicBuilder: false, areaExcl: 84 }), T).verdict).toBe('ok');
  });
});

describe('제46조 노부모 부양', () => {
  const parent = { birth: '1961-11-07', since: '2023-11-07', spouseHomeless: true };
  it('제46조 ① 65세·3년 부양 경계일에 요건 충족, 1순위는 확인 필요', () => {
    const r = judgeElderly(applicant({ parent }), notice(), T);
    expect(r).toMatchObject({ type: 'elderly_parent', article: '제46조 제1항', verdict: 'check' });
    expect(r.checks.filter((c) => c.verdict !== 'ok').map((c) => c.label)).toEqual(['청약 1순위']);
  });
  it('제46조 ① 3년에서 하루 모자라면 불가', () => {
    expect(judgeElderly(applicant({ parent: { ...parent, since: '2023-11-08' } }), notice(), T).verdict).toBe('no');
  });
  it('제46조 ① 65세 생일 전이면 불가', () => {
    expect(judgeElderly(applicant({ parent: { ...parent, birth: '1961-11-08' } }), notice(), T).verdict).toBe('no');
  });
  it('제46조 ① 세대주가 아니거나 부양 직계존속이 없으면 불가', () => {
    expect(judgeElderly(applicant({ parent, householdHead: false }), notice(), T).verdict).toBe('no');
    expect(judgeElderly(applicant({ parent: null }), notice(), T).verdict).toBe('no');
  });
  it('제46조 ① 피부양자의 배우자가 주택을 소유하면 불가', () => {
    expect(judgeElderly(applicant({ parent: { ...parent, spouseHomeless: false } }), notice(), T).verdict).toBe('no');
  });
  it('제46조 ③ 제18조 사업주체 85㎡ 이하는 세대주 요건 대신 소득 120%', () => {
    const r = judgeElderly(applicant({ parent, householdHead: false, householdSize: 4, monthlyIncome: 10_562_642 }), notice({ publicBuilder: true, areaExcl: 84 }), T);
    expect(r.article).toBe('제46조 제3항');
    expect(find(r, '세대주')).toBeUndefined();
    expect(find(r, '소득 기준')?.verdict).toBe('ok');
  });
});
