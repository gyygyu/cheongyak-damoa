// 제41조 신혼부부 특별공급 — ① 민영 85㎡ 이하, ④ 국민. 소득 140%(배우자 소득 있으면 160%), 넘으면 부동산 가액 기준.
import { chk, homelessCheck, incomeCheck, oneTimeCheck, savingsCheck, withinYears } from './common';
import { incomeTableFor, type IncomeTable } from './income';
import { combine, type ApplicantInput, type Check, type NoticeInput, type TypeResult } from './types';

/** 혼인 중 출생 자녀(태아·입양 포함)가 있으면 1순위. 혼인 전 출생 자녀는 민법 제855조 제2항 해당 여부를 확인 */
export function newlywedRank(a: ApplicantInput): '1순위' | '2순위' | '확인 필요' {
  const inMarriage = a.children.some((c) =>
    c.kind === 'fetus' || c.kind === 'adopted' || (c.birth != null && a.marriageDate != null && c.birth >= a.marriageDate));
  if (inMarriage) return '1순위';
  return a.children.length === 0 ? '2순위' : '확인 필요';
}

export function judgeNewlywed(a: ApplicantInput, n: NoticeInput, tables: readonly IncomeTable[]): TypeResult {
  const article = n.supplyKind === 'national' ? '제41조 제4항' : '제41조 제1항';
  const checks: Check[] = [];
  if (n.supplyKind === 'private' && n.areaExcl > 85) {
    checks.push(chk('전용 85㎡ 이하', article, 'no', '민영주택 신혼부부 특별공급은 전용 85㎡ 이하만'));
  }
  if (a.marriageDate == null) checks.push(chk('혼인 7년 이내', article, 'no', '혼인 중이어야 함(혼인신고일 기준)'));
  else if (n.noticeDate == null) checks.push(chk('혼인 7년 이내', article, 'check', '공고일을 확인하세요'));
  else {
    checks.push(withinYears(a.marriageDate, 7, n.noticeDate)
      ? chk('혼인 7년 이내', article, 'ok')
      : chk('혼인 7년 이내', article, 'no', '혼인신고일부터 7년이 지남'));
  }
  checks.push(homelessCheck(a, 'newlywed', article));
  const dual = a.dualIncome === true;
  checks.push(incomeCheck(a, incomeTableFor(tables, n.noticeDate), { percent: dual ? 160 : 140, priority: dual ? 120 : 100, altProperty: true, article }));
  checks.push(savingsCheck(a, n));
  checks.push(oneTimeCheck(a, 'newlywed'));
  return { type: 'newlywed', article, verdict: combine(checks), checks, rank: newlywedRank(a) };
}
