import { describe, it, expect } from 'vitest';
import {
  withinYears, atLeastYears, under2, isMinor, hasPostExceptionChild,
  homelessCheck, oneTimeCheck, savingsCheck, rank1Check, incomeCheck,
} from '../src/lib/eligibility/common';
import { combine, DISCLAIMER } from '../src/lib/eligibility/types';
import { INCOME_TABLES } from '../src/lib/eligibility/tables';
import { applicant, notice } from './eligibility-fixtures';

const t2026 = INCOME_TABLES[0]!;

describe('기간 계산 (민법 초일 불산입 — 같은 날까지 포함)', () => {
  it('제41조 ① 혼인 7년째 마지막 날까지 이내', () => {
    expect(withinYears('2019-11-07', 7, '2026-11-07')).toBe(true);
    expect(withinYears('2019-11-07', 7, '2026-11-08')).toBe(false);
  });
  it('2월 29일 혼인신고는 7년 뒤 2월 28일까지', () => {
    expect(withinYears('2020-02-29', 7, '2027-02-28')).toBe(true);
    expect(withinYears('2020-02-29', 7, '2027-03-01')).toBe(false);
  });
  it('제35조의3 ① 2세가 되는 날까지 2세 미만', () => {
    expect(under2('2024-11-08', '2026-11-07')).toBe(true); // 생일 전날
    expect(under2('2024-11-08', '2026-11-08')).toBe(true); // 2세가 되는 날
    expect(under2('2024-11-08', '2026-11-09')).toBe(false);
  });
  it('제40조 ① 19세 생일부터 미성년 아님', () => {
    expect(isMinor('2007-11-08', '2026-11-07')).toBe(true);
    expect(isMinor('2007-11-07', '2026-11-07')).toBe(false);
  });
  it('제46조 ① 3년 이상 부양·65세 이상', () => {
    expect(atLeastYears('2023-11-07', 3, '2026-11-07')).toBe(true);
    expect(atLeastYears('2023-11-07', 3, '2026-11-06')).toBe(false);
    expect(atLeastYears('1961-11-07', 65, '2026-11-07')).toBe(true);
    expect(atLeastYears('1961-11-08', 65, '2026-11-07')).toBe(false);
  });
});

describe('제55조의3 ③ 2024. 6. 19. 이후 출생 자녀', () => {
  it('6월 19일 출생부터 해당, 18일은 아님', () => {
    expect(hasPostExceptionChild([{ kind: 'born', birth: '2024-06-19' }])).toBe(true);
    expect(hasPostExceptionChild([{ kind: 'born', birth: '2024-06-18' }])).toBe(false);
  });
  it('태아는 해당, 출생일 모르는 자녀만 있으면 null, 자녀 없으면 false', () => {
    expect(hasPostExceptionChild([{ kind: 'fetus', birth: null }])).toBe(true);
    expect(hasPostExceptionChild([{ kind: 'born', birth: null }])).toBeNull();
    expect(hasPostExceptionChild([])).toBe(false);
  });
});

describe('무주택세대구성원', () => {
  it('무주택 가능, 다른 세대원 소유 불가, 모름 확인 필요', () => {
    expect(homelessCheck(applicant(), 'newlywed', '제41조 제4항').verdict).toBe('ok');
    expect(homelessCheck(applicant({ homeOwner: 'other_member' }), 'newlywed', '제41조 제4항').verdict).toBe('no');
    expect(homelessCheck(applicant({ homeOwner: null }), 'newlywed', '제41조 제4항').verdict).toBe('check');
  });
  it('제55조의3 ③2호: 당첨 이력 + 2024. 6. 19. 이후 출생 자녀면 본인 소유여도 확인 필요', () => {
    const a = applicant({ homeOwner: 'self_or_spouse', priorSpecial: true, children: [{ kind: 'born', birth: '2024-06-19' }] });
    const c = homelessCheck(a, 'newlywed', '제41조 제4항');
    expect(c.verdict).toBe('check');
    expect(c.article).toBe('제55조의3 제3항 제2호');
  });
  it('생애최초(제43조)는 특례 대상이 아니라 불가', () => {
    const a = applicant({ homeOwner: 'self_or_spouse', priorSpecial: true, children: [{ kind: 'born', birth: '2024-06-19' }] });
    expect(homelessCheck(a, 'first_life', '제43조 제1항').verdict).toBe('no');
  });
  it('당첨 이력 없이 본인 소유면 불가', () => {
    const a = applicant({ homeOwner: 'self_or_spouse', children: [{ kind: 'born', birth: '2025-01-01' }] });
    expect(homelessCheck(a, 'newlywed', '제41조 제4항').verdict).toBe('no');
  });
});

describe('제55조 특별공급 1회 제한', () => {
  it('이력 없음 가능, 모름 확인 필요', () => {
    expect(oneTimeCheck(applicant(), 'newlywed').verdict).toBe('ok');
    expect(oneTimeCheck(applicant({ priorSpecial: null }), 'newlywed').verdict).toBe('check');
  });
  it('이력 있고 2024. 6. 18. 출생 자녀뿐이면 불가', () => {
    expect(oneTimeCheck(applicant({ priorSpecial: true, children: [{ kind: 'born', birth: '2024-06-18' }] }), 'newborn').verdict).toBe('no');
  });
  it('이력 있고 2024. 6. 19. 출생 자녀가 있으면 제55조의3 ③ 확인 필요', () => {
    const c = oneTimeCheck(applicant({ priorSpecial: true, children: [{ kind: 'born', birth: '2024-06-19' }] }), 'newborn');
    expect(c.verdict).toBe('check');
    expect(c.article).toBe('제55조의3 제3항');
  });
  it('생애최초는 특례가 없어 불가', () => {
    expect(oneTimeCheck(applicant({ priorSpecial: true, children: [{ kind: 'born', birth: '2025-01-01' }] }), 'first_life').verdict).toBe('no');
  });
});

describe('제48조 통장 요건', () => {
  it('국민: 가입 6개월 + 6회 납입', () => {
    expect(savingsCheck(applicant({ savingsMonths: 6, savingsPayments: 6 }), notice()).verdict).toBe('ok');
    expect(savingsCheck(applicant({ savingsMonths: 5, savingsPayments: 6 }), notice()).verdict).toBe('no');
    expect(savingsCheck(applicant({ savingsMonths: 6, savingsPayments: 5 }), notice()).verdict).toBe('no');
    expect(savingsCheck(applicant({ savingsMonths: null }), notice()).verdict).toBe('check');
  });
  it('민영: 6개월 지나도 예치금(별표 2)은 확인 필요', () => {
    expect(savingsCheck(applicant(), notice({ supplyKind: 'private' })).verdict).toBe('check');
    expect(savingsCheck(applicant({ savingsMonths: 3 }), notice({ supplyKind: 'private' })).verdict).toBe('no');
  });
});

describe('1순위·소득', () => {
  it('1순위는 언제나 확인 필요, 국민은 제27조 ①·민영은 제28조 ①', () => {
    expect(rank1Check(notice())).toMatchObject({ verdict: 'check', article: '제27조 제1항' });
    expect(rank1Check(notice({ supplyKind: 'private' }))).toMatchObject({ verdict: 'check', article: '제28조 제1항' });
  });
  it('소득 기준 이내 가능 + 우선공급 구간 안내', () => {
    const c = incomeCheck(applicant({ monthlyIncome: 7_000_000 }), t2026, { percent: 140, priority: 100, altProperty: true, article: '제41조 제4항' });
    expect(c.verdict).toBe('ok');
    expect(c.note).toContain('우선공급');
  });
  it('기준 초과: 재산 대안 있으면 확인 필요, 없으면 불가', () => {
    const a = applicant({ monthlyIncome: 20_000_000 });
    expect(incomeCheck(a, t2026, { percent: 140, altProperty: true, article: '제41조 제4항' }).verdict).toBe('check');
    expect(incomeCheck(a, t2026, { percent: 120, altProperty: false, article: '제40조 제2항' }).verdict).toBe('no');
  });
  it('표 없음·소득 모름·가구원 수 오류는 확인 필요', () => {
    const rule = { percent: 140, altProperty: false, article: '제41조 제4항' };
    expect(incomeCheck(applicant(), null, rule).verdict).toBe('check');
    expect(incomeCheck(applicant({ monthlyIncome: null }), t2026, rule).verdict).toBe('check');
    expect(incomeCheck(applicant({ householdSize: 0 }), t2026, rule).verdict).toBe('check');
  });
});

describe('combine·안내 문구', () => {
  it('불가 > 확인 필요 > 가능', () => {
    const c = (verdict: 'ok' | 'no' | 'check') => ({ label: 'x', article: 'y', verdict });
    expect(combine([c('ok'), c('check'), c('no')])).toBe('no');
    expect(combine([c('ok'), c('check')])).toBe('check');
    expect(combine([c('ok')])).toBe('ok');
  });
  it('spec §8 결과 안내 문구', () => {
    expect(DISCLAIMER).toBe('판정은 입력값 기준 참고 결과이며, 당첨 후 서류 심사로 최종 결정됩니다.');
  });
});
