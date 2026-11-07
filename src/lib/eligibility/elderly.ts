// 제46조 노부모부양 특별공급 — ① 65세 이상 직계존속을 3년 이상 같은 세대별 주민등록표에 올려 부양하는 무주택 세대주(1순위).
// ③ 제18조 사업주체 85㎡ 이하는 세대주 요건 대신 무주택세대구성원 + 소득 120% 이하.
import { atLeastYears, chk, homelessCheck, incomeCheck, oneTimeCheck, rank1Check } from './common';
import { incomeTableFor, type IncomeTable } from './income';
import { combine, type ApplicantInput, type Check, type NoticeInput, type TypeResult } from './types';

function dateCheck(label: string, article: string, date: string | null, years: number, on: string | null, fail: string): Check {
  if (date == null) return chk(label, article, 'check', '날짜를 확인하세요');
  if (on == null) return chk(label, article, 'check', '공고일을 확인하세요');
  return atLeastYears(date, years, on) ? chk(label, article, 'ok') : chk(label, article, 'no', fail);
}

export function judgeElderly(a: ApplicantInput, n: NoticeInput, tables: readonly IncomeTable[]): TypeResult {
  const public85 = n.publicBuilder === true && n.areaExcl != null && n.areaExcl <= 85;
  // 공공 사업주체 여부나 면적을 몰라 제3항(세대주 요건 없음)일 수도 있는 경우
  const maybe85 = !public85 && n.publicBuilder !== false && (n.areaExcl == null || n.areaExcl <= 85);
  const article = public85 ? '제46조 제3항' : '제46조 제1항';
  const checks: Check[] = [];
  const p = a.parent;
  if (p == null) checks.push(chk('65세 이상 직계존속', article, 'no', '65세 이상 직계존속(배우자의 직계존속 포함)을 부양해야 함'));
  else {
    checks.push(dateCheck('65세 이상 직계존속', article, p.birth, 65, n.noticeDate, '공고일 현재 65세 이상이어야 함'));
    checks.push(dateCheck('3년 이상 부양', article, p.since, 3, n.noticeDate, '같은 세대별 주민등록표에 3년 이상 계속 올라 있어야 함'));
    checks.push(p.spouseHomeless === true ? chk('피부양자 배우자 무주택', article, 'ok')
      : p.spouseHomeless == null ? chk('피부양자 배우자 무주택', article, 'check', '피부양자의 배우자 주택 소유를 확인하세요')
      : chk('피부양자 배우자 무주택', article, 'no', '피부양자의 배우자도 무주택이어야 함'));
  }
  checks.push(rank1Check(n));
  checks.push(homelessCheck(a, 'elderly_parent', article));
  if (public85) {
    checks.push(incomeCheck(a, incomeTableFor(tables, n.noticeDate), { percent: 120, altProperty: false, article }));
  } else {
    checks.push(a.householdHead === true ? chk('세대주', article, 'ok')
      : a.householdHead == null ? chk('세대주', article, 'check', '세대주인지 확인하세요')
      : maybe85 ? chk('세대주', article, 'check', '제18조 사업주체(공공)가 공급하는 전용 85㎡ 이하면 세대주가 아니어도 됨(같은 조 제3항, 소득 120% 이하) — 공고문을 확인하세요')
      : chk('세대주', article, 'no', '무주택 세대주여야 함'));
  }
  checks.push(oneTimeCheck(a, 'elderly_parent'));
  return { type: 'elderly_parent', article, verdict: combine(checks), checks };
}
