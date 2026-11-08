// 제35조의3 신생아 특별공급 — ① 국민(제27조 ① 1순위, 소득 130%), ③ 민영 85㎡ 이하(제28조 ① 1순위, 소득 160%).
import { chk, homelessCheck, incomeCheck, oneTimeCheck, privateAreaCheck, rank1Check, under2 } from './common';
import { incomeTableFor, type IncomeTable } from './income';
import { combine, type ApplicantInput, type Check, type NoticeInput, type TypeResult } from './types';

function under2Check(a: ApplicantInput, n: NoticeInput, article: string): Check {
  const label = '2세 미만 자녀';
  const kids = a.children;
  if (kids == null) return chk(label, article, 'check', '자녀 수와 출생일을 넣으면 판정합니다');
  if (kids.some((c) => c.kind === 'fetus')) return chk(label, article, 'ok', '태아 포함');
  if (n.noticeDate == null) return chk(label, article, 'check', '공고일을 확인하세요');
  const on = n.noticeDate;
  if (kids.some((c) => c.birth != null && under2(c.birth, on))) return chk(label, article, 'ok');
  if (kids.some((c) => c.birth == null)) return chk(label, article, 'check', '자녀 출생일을 확인하세요');
  return chk(label, article, 'no', '공고일 현재 2세 미만(2세가 되는 날 포함) 자녀가 있어야 함');
}

export function judgeNewborn(a: ApplicantInput, n: NoticeInput, tables: readonly IncomeTable[]): TypeResult {
  const national = n.supplyKind === 'national';
  const article = national ? '제35조의3 제1항' : '제35조의3 제3항';
  const checks: Check[] = [];
  const area = privateAreaCheck(n, article, '신생아');
  if (area) checks.push(area);
  checks.push(under2Check(a, n, article));
  checks.push(rank1Check(n));
  checks.push(homelessCheck(a, 'newborn', article));
  checks.push(incomeCheck(a, incomeTableFor(tables, n.noticeDate), { percent: national ? 130 : 160, priority: national ? 100 : 130, altProperty: true, article }));
  checks.push(oneTimeCheck(a, 'newborn'));
  return { type: 'newborn', article, verdict: combine(checks), checks };
}
