// 제43조 생애최초 특별공급 — ① 국민(제27조 ① 1순위 + 저축 600만원, 소득 130%), ③ 민영 85㎡ 이하(제28조 ① 1순위, 소득 160%).
// 단독세대주·세대원이 아닌 동거인은 전용 60㎡ 이하만(같은 조 후단). 제55조의3 ③ 특례 대상이 아니다.
import { chk, homelessCheck, incomeCheck, oneTimeCheck, rank1Check } from './common';
import { incomeTableFor, type IncomeTable } from './income';
import { combine, type ApplicantInput, type Check, type NoticeInput, type TypeResult } from './types';

export function judgeFirstLife(a: ApplicantInput, n: NoticeInput, tables: readonly IncomeTable[]): TypeResult {
  const national = n.supplyKind === 'national';
  const article = national ? '제43조 제1항' : '제43조 제3항';
  const checks: Check[] = [];
  if (!national && n.areaExcl > 85) checks.push(chk('전용 85㎡ 이하', article, 'no', '민영주택 생애최초 특별공급은 전용 85㎡ 이하만'));
  if (n.areaExcl > 60) {
    if (a.singleHousehold === true) checks.push(chk('전용 60㎡ 이하(단독세대)', article, 'no', '단독세대는 전용 60㎡ 이하만 신청 가능'));
    else if (a.singleHousehold == null) checks.push(chk('전용 60㎡ 이하(단독세대)', article, 'check', '단독세대면 전용 60㎡ 이하만 신청 가능'));
  }
  checks.push(a.everOwned === false ? chk('주택 소유 이력 없음', article, 'ok')
    : a.everOwned == null ? chk('주택 소유 이력 없음', article, 'check', '세대 구성원 모두 주택을 소유한 적이 없는지 확인하세요')
    : chk('주택 소유 이력 없음', article, 'no', '세대 구성원 모두 주택을 소유한 적이 없어야 함'));
  checks.push(rank1Check(n));
  checks.push(homelessCheck(a, 'first_life', article));
  checks.push(a.marriageDate != null || a.children.length > 0
    ? chk('혼인 중이거나 자녀 있음', article, 'ok')
    : chk('혼인 중이거나 자녀 있음', `${article} 제2호 나목`, 'check', '혼인 중이 아니고 자녀도 없으면 같은 호 나목 요건을 공고문에서 확인하세요'));
  checks.push(a.incomeTaxYears == null ? chk('소득세 5년 이상 납부', article, 'check', '소득세 납부 연수를 확인하세요')
    : a.incomeTaxYears >= 5 ? chk('소득세 5년 이상 납부', article, 'ok')
    : chk('소득세 5년 이상 납부', article, 'no', '근로자·자영업자로 소득세를 5년 이상 내야 함'));
  if (national) {
    checks.push(a.savingsTotal == null ? chk('저축 600만원 이상', article, 'check', '선납금 포함 납입 총액을 확인하세요')
      : a.savingsTotal >= 600 ? chk('저축 600만원 이상', article, 'ok')
      : chk('저축 600만원 이상', article, 'no', '선납금 포함 600만원 이상이어야 함'));
  }
  checks.push(incomeCheck(a, incomeTableFor(tables, n.noticeDate), { percent: national ? 130 : 160, priority: national ? 100 : 130, altProperty: true, article }));
  checks.push(oneTimeCheck(a, 'first_life'));
  return { type: 'first_life', article, verdict: combine(checks), checks };
}
