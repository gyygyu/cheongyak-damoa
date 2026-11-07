// 제40조 다자녀가구 특별공급 — ① 미성년 자녀 2명 이상(태아·입양 포함, ③) 무주택세대구성원.
// ② 제18조 사업주체가 공급하는 85㎡ 이하는 소득 120% 이하.
import { chk, homelessCheck, incomeCheck, isMinor, oneTimeCheck, savingsCheck } from './common';
import { incomeTableFor, type IncomeTable } from './income';
import { combine, type ApplicantInput, type Check, type NoticeInput, type TypeResult } from './types';

function minorsCheck(a: ApplicantInput, n: NoticeInput): Check {
  const label = '미성년 자녀 2명 이상', article = '제40조 제1항';
  const on = n.noticeDate;
  let sure = 0, unknown = 0;
  for (const c of a.children) {
    if (c.kind === 'fetus') sure++;
    else if (c.birth == null || on == null) unknown++;
    else if (isMinor(c.birth, on)) sure++;
  }
  if (sure >= 2) return chk(label, article, 'ok');
  if (sure + unknown >= 2) return chk(label, article, 'check', on == null ? '공고일을 확인하세요' : '자녀 출생일을 확인하세요');
  return chk(label, article, 'no', '공고일 현재 미성년 자녀가 2명 이상이어야 함(태아·입양 포함)');
}

export function judgeMultichild(a: ApplicantInput, n: NoticeInput, tables: readonly IncomeTable[]): TypeResult {
  const smallArea = n.areaExcl == null ? null : n.areaExcl <= 85; // null = 면적 모름
  const article = n.publicBuilder === true && smallArea === true ? '제40조 제2항' : '제40조 제1항';
  const checks: Check[] = [minorsCheck(a, n), homelessCheck(a, 'multichild', article), savingsCheck(a, n)];
  if (smallArea !== false && n.publicBuilder !== false) {
    const c = incomeCheck(a, incomeTableFor(tables, n.noticeDate), { percent: 120, altProperty: false, article: '제40조 제2항' });
    checks.push((n.publicBuilder == null || smallArea == null) && c.verdict === 'no'
      ? chk(c.label, c.article, 'check', '제18조 사업주체(공공)가 공급하는 전용 85㎡ 이하면 소득 120% 이하여야 함 — 공고문을 확인하세요')
      : c);
  }
  checks.push(oneTimeCheck(a, 'multichild'));
  return { type: 'multichild', article, verdict: combine(checks), checks };
}
