// 판정 테스트용 기본 입력 — 모든 요건을 채운 신혼 3인 세대(2026-11-07 국민 59.98㎡ 공고)
import type { ApplicantInput, NoticeInput, TypeResult, Check } from '../src/lib/eligibility/types';

export const applicant = (o: Partial<ApplicantInput> = {}): ApplicantInput => ({
  homeOwner: 'none', everOwned: false, householdHead: true, singleHousehold: false, married: true,
  marriageDate: '2022-03-01', children: [{ kind: 'born', birth: '2025-05-01' }],
  householdSize: 3, monthlyIncome: 6_000_000, dualIncome: false, incomeTaxYears: 6,
  savingsMonths: 24, savingsPayments: 24, savingsTotal: 700, priorSpecial: false,
  parent: null, ...o,
});

export const notice = (o: Partial<NoticeInput> = {}): NoticeInput => ({
  supplyKind: 'national', areaExcl: 59.98, noticeDate: '2026-11-07', publicBuilder: false, ...o,
});

export const find = (r: TypeResult, label: string): Check | undefined => r.checks.find((c) => c.label === label);
