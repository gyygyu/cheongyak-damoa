import { describe, it, expect } from 'vitest';
import { parseForm, prefillFromApt, resultView } from '../src/lib/view/eligibility-form';
import type { AptBundle } from '../src/lib/view/bundle-types';

const base = {
  supplyKind: 'national', areaExcl: '59.9', noticeDate: '2026-11-06', publicBuilder: '',
  homeOwner: 'none', everOwned: 'false', householdHead: 'true', singleHousehold: 'false',
  marriageDate: '2024-05-01', childCount: '1', 'children.0.kind': 'born', 'children.0.birth': '2025-03-01',
  householdSize: '3', monthlyIncome: '600', dualIncome: 'true', incomeTaxYears: '5',
  savingsMonths: '30', savingsPayments: '30', savingsTotal: '600', priorSpecial: 'false',
  parentBirth: '', parentSince: '', parentSpouseHomeless: '',
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
  it('부모 칸에 하나라도 값이 있으면 parent 를 만든다', () => {
    expect(parseForm({ ...base, parentBirth: '1955-01-01', parentSince: '2020-01-01', parentSpouseHomeless: 'true' }).applicant.parent)
      .toEqual({ birth: '1955-01-01', since: '2020-01-01', spouseHomeless: true });
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
  it('라벨·판정·순위', () => {
    const v = resultView([{ type: 'newlywed', article: '제41조', verdict: 'check', rank: '1순위', checks: [{ label: '무주택', article: '제41조', verdict: 'ok' }] }]);
    expect(v[0]).toEqual({ label: '신혼부부', verdict: '확인 필요', verdictClass: 'check', rank: '1순위', checks: [{ label: '무주택', article: '제41조', verdict: '가능', note: null }] });
  });
});
