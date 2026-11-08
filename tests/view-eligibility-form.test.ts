import { describe, it, expect } from 'vitest';
import { parseForm, prefillFromApt, resultView, resultSummary } from '../src/lib/view/eligibility-form';
import type { AptBundle } from '../src/lib/view/bundle-types';

const base = {
  supplyKind: 'national', areaExcl: '59.9', noticeDate: '2026-11-06', publicBuilder: '',
  homeOwner: 'none', everOwned: 'false', householdHead: 'true', singleHousehold: 'false',
  married: 'true', marriageDate: '2024-05-01', childCount: '1', 'children.0.kind': 'born', 'children.0.birth': '2025-03-01',
  householdSize: '3', monthlyIncome: '600', dualIncome: 'true', incomeTaxYears: '5',
  savingsMonths: '30', savingsPayments: '30', savingsTotal: '600', priorSpecial: 'false',
  parentCare: 'false', parentBirth: '', parentSince: '', parentSpouseHomeless: '',
};

describe('parseForm', () => {
  it('값을 입력 타입으로 바꾼다 (월소득 만원 → 원)', () => {
    const p = parseForm(base);
    expect(p.errors).toEqual([]);
    expect(p.notice).toEqual({ supplyKind: 'national', areaExcl: 59.9, noticeDate: '2026-11-06', publicBuilder: null });
    expect(p.applicant).toMatchObject({
      homeOwner: 'none', everOwned: false, householdHead: true, marriageDate: '2024-05-01',
      children: [{ kind: 'born', birth: '2025-03-01' }], householdSize: 3, monthlyIncome: 6_000_000,
      savingsTotal: 600, priorSpecial: false, parent: null,
    });
  });
  it('빈 칸은 모름(null)', () => {
    const p = parseForm({ ...base, everOwned: '', householdSize: '', monthlyIncome: '' });
    expect(p.applicant.everOwned).toBeNull();
    expect(p.applicant.householdSize).toBeNull();
    expect(p.applicant.monthlyIncome).toBeNull();
  });
  it('가구원 수가 자녀 수보다 적으면 오류 (Plan B 결정)', () => {
    const p = parseForm({ ...base, childCount: '2', 'children.1.kind': 'fetus', 'children.1.birth': '', householdSize: '1' });
    expect(p.errors).toContainEqual({ field: 'householdSize', message: '세대 구성원 수(태아 포함)가 자녀 수보다 적습니다.' });
  });
  it('공고일보다 뒤인 날짜는 오류, 태아 출산 예정일은 예외', () => {
    const p = parseForm({ ...base, marriageDate: '2026-12-01', childCount: '1', 'children.0.kind': 'fetus', 'children.0.birth': '2027-02-01' });
    expect(p.errors).toEqual([{ field: 'marriageDate', message: '공고일(2026-11-06)보다 뒤 날짜입니다.' }]);
  });
  it('형식이 틀린 날짜·음수·숫자 아님은 오류', () => {
    const p = parseForm({ ...base, marriageDate: '2024-13-01', savingsMonths: '-1', monthlyIncome: '육백' });
    expect(p.errors.map((e) => e.field).sort()).toEqual(['marriageDate', 'monthlyIncome', 'savingsMonths']);
  });
  it('공급 구분을 안 고르면 오류', () => {
    expect(parseForm({ ...base, supplyKind: '' }).errors).toContainEqual({ field: 'supplyKind', message: '국민주택·민영주택 중 하나를 고르세요.' });
  });
  it('자녀 수는 0~6, 보이지 않는 자녀 칸은 무시', () => {
    expect(parseForm({ ...base, childCount: '0' }).applicant.children).toEqual([]);
    expect(parseForm({ ...base, childCount: '9' }).errors.map((e) => e.field)).toContain('childCount');
  });
  it('노부모 부양 예면 parent 를 만들고, 아니오면 숨겨진 칸 값이 있어도 만들지 않는다', () => {
    const v = { ...base, parentBirth: '1955-01-01', parentSince: '2020-01-01', parentSpouseHomeless: 'true' };
    expect(parseForm({ ...v, parentCare: 'true' }).applicant.parent).toEqual({ birth: '1955-01-01', since: '2020-01-01', spouseHomeless: true });
    expect(parseForm(v).applicant.parent).toBeNull();
  });
  it('노부모 부양 모름이면 날짜를 모르는 parent(판정은 확인 필요)', () => {
    expect(parseForm({ ...base, parentCare: '' }).applicant.parent).toEqual({ birth: null, since: null, spouseHomeless: null });
  });
  it('자녀 수를 고르지 않으면 children 은 null(모름), 없음은 []', () => {
    expect(parseForm({ ...base, childCount: '' }).applicant.children).toBeNull();
    expect(parseForm({ ...base, childCount: '0' }).applicant.children).toEqual([]);
  });
  it('혼인 여부를 고르지 않아도 혼인신고일이 있으면 혼인 중', () => {
    expect(parseForm({ ...base, married: '' }).applicant).toMatchObject({ married: true, marriageDate: '2024-05-01' });
    expect(parseForm({ ...base, married: '', marriageDate: '' }).applicant.married).toBeNull();
  });
});

describe('prefillFromApt', () => {
  const b = {
    notice: { pblanc_no: 'P1', supply_kind: 'private', notice_date: '2026-11-01' },
    models: [{ model_no: '01', area_excl: 84.99 }],
  } as unknown as AptBundle;
  it('공개값 세 개만 채운다', () => expect(prefillFromApt(b, '01')).toEqual({ supplyKind: 'private', areaExcl: '84.99', noticeDate: '2026-11-01' }));
  it('주택형이 없으면 null', () => expect(prefillFromApt(b, '99')).toBeNull());
});

describe('resultView', () => {
  it('라벨·판정·순위, 유형 조문과 같은 조문은 줄마다 되풀이하지 않는다', () => {
    const v = resultView([{ type: 'newlywed', article: '제41조', verdict: 'check', rank: '1순위', checks: [{ label: '무주택', article: '제41조', verdict: 'ok' }] }]);
    expect(v[0]).toEqual({
      label: '신혼부부', article: '제41조', verdict: '확인 필요', verdictClass: 'check', rank: '1순위',
      checks: [{ label: '무주택', article: null, verdict: '가능', verdictClass: 'ok', note: null }], next: null,
    });
  });
  it('다른 조문만 남기고, 라벨에 이미 있는 조문도 다시 붙이지 않는다', () => {
    const v = resultView([{ type: 'multichild', article: '제40조 제1항', verdict: 'ok', checks: [
      { label: '청약통장', article: '제48조 제1호', verdict: 'ok' },
      { label: '청약통장(제48조)', article: '제48조', verdict: 'ok' },
    ] }]);
    expect(v[0].checks.map((c) => c.article)).toEqual(['제48조 제1호', null]);
    expect(v[0].next).toBeNull();
  });
  it('요건은 불가 → 확인 필요 → 가능 순', () => {
    const v = resultView([{ type: 'newborn', article: 'A', verdict: 'no', checks: [
      { label: 'a', article: 'A', verdict: 'ok' }, { label: 'b', article: 'A', verdict: 'check' }, { label: 'c', article: 'A', verdict: 'no' },
    ] }]);
    expect(v[0].checks.map((c) => c.label)).toEqual(['c', 'b', 'a']);
  });
  it('다음에 할 일: 확인 필요 사유 글에서 할 곳·넣을 값을 뽑는다', () => {
    const v = resultView([{ type: 'newborn', article: 'A', verdict: 'check', checks: [
      { label: '청약 1순위', article: 'A', verdict: 'check', note: '1순위 여부(가입 기간·납입·거주 지역)는 청약홈에서 확인하세요' },
      { label: '소득 기준', article: 'A', verdict: 'check', note: '공고 연도의 소득 기준표가 없음 — 공고문의 소득 기준을 확인하세요' },
      { label: '2세 미만 자녀', article: 'A', verdict: 'check', note: '자녀 수와 출생일을 넣으면 판정합니다' },
      { label: '무주택세대구성원', article: 'A', verdict: 'check', note: '세대 구성원 모두의 주택 소유 여부를 확인하세요' },
    ] }]);
    expect(v[0].next).toBe('청약홈에서 청약 1순위 확인 · 공고문에서 소득 기준 확인 · 자녀 수와 출생일 입력 · 무주택세대구성원 확인');
  });
  it('다음에 할 일: 불가는 불가 요건을 짚는다', () => {
    const v = resultView([{ type: 'multichild', article: 'A', verdict: 'no', checks: [{ label: '미성년 자녀 2명 이상', article: 'A', verdict: 'no' }] }]);
    expect(v[0].next).toBe('입력값이 맞다면 신청할 수 없습니다 — 미성년 자녀 2명 이상 입력을 다시 확인하세요.');
  });
});

describe('resultSummary', () => {
  it('가능·불가·확인 필요 개수', () => {
    const r = (verdict: 'ok' | 'no' | 'check') => ({ type: 'newborn' as const, article: 'A', verdict, checks: [] });
    expect(resultSummary([r('ok'), r('no'), r('no'), r('check')])).toEqual({ ok: 1, no: 2, check: 1, text: '가능 1 · 불가 2 · 확인 필요 1' });
  });
});
