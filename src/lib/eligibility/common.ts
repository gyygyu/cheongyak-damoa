// 특별공급 공통 요건 (주택공급에 관한 규칙, 시행 2026. 6. 15.). 기간은 민법 초일 불산입 — 같은 날까지 포함한다.
import { addMonths } from '../date';
import { withinIncome, type IncomeTable } from './income';
import type { ApplicantInput, Check, Child, NoticeInput, SpecialType, Verdict } from './types';

export const chk = (label: string, article: string, verdict: Verdict, note?: string): Check =>
  note === undefined ? { label, article, verdict } : { label, article, verdict, note };

export const addYears = (date: string, years: number): string => addMonths(date, years * 12);
/** start 로부터 years 년 이내(기념일 당일 포함) */
export const withinYears = (start: string, years: number, on: string): boolean => on <= addYears(start, years);
/** start 로부터 years 년 이상(기념일 당일부터) */
export const atLeastYears = (start: string, years: number, on: string): boolean => on >= addYears(start, years);
/** 제35조의3 ①: 2세 미만(2세가 되는 날 포함) */
export const under2 = (birth: string, on: string): boolean => on <= addYears(birth, 2);
/** 미성년: 19세 생일 전날까지 */
export const isMinor = (birth: string, on: string): boolean => on < addYears(birth, 19);

export const BIRTH_EXCEPTION_FROM = '2024-06-19';
/** 제55조의3 ③ 특례가 붙는 유형(제35조의3·제40조·제41조·제46조) */
const EXCEPTION_TYPES: readonly SpecialType[] = ['newborn', 'multichild', 'newlywed', 'elderly_parent'];

/** 제55조의3 ③: 2024. 6. 19. 이후 출생 자녀(태아, 그 이후 출생자 입양 포함). 출생일 모르는 자녀만 있으면 null */
export function hasPostExceptionChild(children: readonly Child[]): boolean | null {
  let unknown = false;
  for (const c of children) {
    if (c.kind === 'fetus') return true;
    if (c.birth == null) unknown = true;
    else if (c.birth >= BIRTH_EXCEPTION_FROM) return true;
  }
  return unknown ? null : false;
}

const exceptionApplies = (a: ApplicantInput, type: SpecialType): boolean | null => {
  if (!EXCEPTION_TYPES.includes(type) || a.priorSpecial !== true) return false;
  return hasPostExceptionChild(a.children);
};

export function homelessCheck(a: ApplicantInput, type: SpecialType, article: string): Check {
  const label = '무주택세대구성원';
  switch (a.homeOwner) {
    case 'none': return chk(label, article, 'ok');
    case null: return chk(label, article, 'check', '세대 구성원 모두의 주택 소유 여부를 확인하세요');
    case 'other_member': return chk(label, article, 'no', '세대원이 주택을 소유하고 있음');
    case 'self_or_spouse':
      if (exceptionApplies(a, type) !== false) {
        return chk(label, '제55조의3 제3항 제2호', 'check',
          '특별공급 당첨 이력이 있고 2024. 6. 19. 이후 출생 자녀가 있으면 주택을 소유해도 한 차례 신청 가능 — 기존 주택 처분 조건(같은 조 제5항)을 확인하세요');
      }
      return chk(label, article, 'no', '본인 또는 배우자가 주택을 소유하고 있음');
  }
}

export function oneTimeCheck(a: ApplicantInput, type: SpecialType): Check {
  const label = '특별공급 1회 제한';
  if (a.priorSpecial === false) return chk(label, '제55조', 'ok');
  if (a.priorSpecial == null) return chk(label, '제55조', 'check', '본인·배우자의 특별공급 당첨 이력을 확인하세요');
  const ex = exceptionApplies(a, type);
  if (ex === true) return chk(label, '제55조의3 제3항', 'check', '2024. 6. 19. 이후 출생 자녀 특례로 한 차례 더 신청 가능 — 이미 특례를 썼는지 확인하세요');
  if (ex == null) return chk(label, '제55조의3 제3항', 'check', '자녀 출생일을 확인하세요(2024. 6. 19. 이후 출생이면 특례)');
  return chk(label, '제55조', 'no', '특별공급은 한 차례만 받을 수 있음');
}

export function savingsCheck(a: ApplicantInput, n: NoticeInput): Check {
  const label = '청약통장(제48조)';
  if (a.savingsMonths == null) return chk(label, '제48조', 'check', '청약통장 가입 기간을 확인하세요');
  if (a.savingsMonths < 6) return chk(label, '제48조', 'no', '가입 6개월이 지나야 함');
  if (n.supplyKind === 'national') {
    if (a.savingsPayments == null) return chk(label, '제48조 제1호', 'check', '납입 회차를 확인하세요');
    return a.savingsPayments >= 6 ? chk(label, '제48조 제1호', 'ok') : chk(label, '제48조 제1호', 'no', '월납입금을 6회 이상 내야 함');
  }
  return chk(label, '제48조 제2호', 'check', '지역·면적별 예치기준금액(별표 2) 이상 냈는지 확인하세요');
}

/** 민영주택 특별공급의 전용 85㎡ 이하 요건. 국민주택이거나 85㎡ 이하로 확인되면 줄을 내지 않는다(null) */
export function privateAreaCheck(n: NoticeInput, article: string, kindLabel: string): Check | null {
  if (n.supplyKind === 'national') return null;
  if (n.areaExcl == null) return chk('전용 85㎡ 이하', article, 'check', `전용면적을 확인하세요 — 민영주택 ${kindLabel} 특별공급은 85㎡ 이하만`);
  return n.areaExcl > 85 ? chk('전용 85㎡ 이하', article, 'no', `민영주택 ${kindLabel} 특별공급은 전용 85㎡ 이하만`) : null;
}

export function rank1Check(n: NoticeInput): Check {
  return chk('청약 1순위', n.supplyKind === 'national' ? '제27조 제1항' : '제28조 제1항', 'check',
    '1순위 여부(가입 기간·납입·거주 지역)는 청약홈에서 확인하세요');
}

export interface IncomeRule {
  percent: number;      // 기준 비율
  priority?: number;    // 우선공급 구간 비율(있으면 안내)
  altProperty: boolean; // 넘으면 부동산 가액 기준(추첨)으로 갈 수 있는가
  article: string;
}

export function incomeCheck(a: ApplicantInput, table: IncomeTable | null, rule: IncomeRule): Check {
  const label = '소득 기준';
  if (!table) return chk(label, rule.article, 'check', '공고 연도의 소득 기준표가 없음 — 공고문의 소득 기준을 확인하세요');
  if (a.householdSize == null || a.monthlyIncome == null) {
    return chk(label, rule.article, 'check', '세대 구성원 수와 월평균 소득을 넣으면 판정합니다');
  }
  const within = withinIncome(table, a.householdSize, rule.percent, a.monthlyIncome);
  if (within == null) return chk(label, rule.article, 'check', '세대 구성원 수(태아 포함)와 소득을 확인하세요');
  if (within) {
    const pri = rule.priority != null && withinIncome(table, a.householdSize, rule.priority, a.monthlyIncome) === true;
    const tier = rule.priority == null ? '' : pri ? ` — 우선공급 구간(${rule.priority}% 이하)` : ` — 일반공급 구간(${rule.priority}% 초과)`;
    return chk(label, rule.article, 'ok', `월평균 소득 ${rule.percent}% 이하${tier}`);
  }
  return rule.altProperty
    ? chk(label, rule.article, 'check', `월평균 소득 ${rule.percent}% 초과 — 부동산 가액 기준(추첨)으로 신청할 수 있는지 공고문을 확인하세요`)
    : chk(label, rule.article, 'no', `월평균 소득 ${rule.percent}% 초과`);
}
