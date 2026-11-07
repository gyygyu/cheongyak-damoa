// 특별공급 판정 입력·결과 타입 (spec §8). 입력값은 브라우저 안에서만 쓰고 서버·URL로 보내지 않는다.
export type SupplyKind = 'national' | 'private';
export type SpecialType = 'newborn' | 'multichild' | 'newlywed' | 'first_life' | 'elderly_parent';
export type Verdict = 'ok' | 'no' | 'check'; // 가능 | 불가 | 확인 필요

/** 공고 쪽 값 — 공개 데이터라 단지 상세에서 미리 채울 수 있다 */
export interface NoticeInput {
  supplyKind: SupplyKind;
  areaExcl: number | null;              // 전용면적 ㎡
  noticeDate: string | null;     // 입주자모집공고일
  publicBuilder: boolean | null; // 제18조 사업주체(국가·지자체·LH·지방공사 등) 공급인가, 모르면 null
}

export interface Child { kind: 'born' | 'fetus' | 'adopted'; birth: string | null }
export type HomeOwner = 'none' | 'self_or_spouse' | 'other_member';

/** 부양하는 65세 이상 직계존속(배우자의 직계존속 포함) */
export interface ParentInput {
  birth: string | null;          // 생년월일
  since: string | null;          // 같은 세대별 주민등록표에 등재된 날
  spouseHomeless: boolean | null; // 피부양자의 배우자도 무주택인가(배우자 없으면 true)
}

/** 사용자 입력. null 은 '모름' — 판정은 '확인 필요'가 된다 */
export interface ApplicantInput {
  homeOwner: HomeOwner | null;     // 지금 세대의 주택 소유
  everOwned: boolean | null;       // 세대 전원 과거 소유 이력(배우자의 혼인 전 소유 제외 — 제55조의3 ①2)
  householdHead: boolean | null;   // 세대주인가
  singleHousehold: boolean | null; // 단독세대주이거나 세대원이 아닌 동거인(제43조 후단)
  marriageDate: string | null;     // 혼인신고일 — 값이 있으면 혼인 중으로 본다
  children: Child[];
  householdSize: number | null;    // 태아 포함 세대 구성원 수
  monthlyIncome: number | null;    // 세대 월평균 소득(원)
  dualIncome: boolean | null;      // 배우자도 소득이 있는가
  incomeTaxYears: number | null;   // 근로자·자영업자 소득세 납부 연수
  savingsMonths: number | null;    // 청약통장 가입 개월
  savingsPayments: number | null;  // 납입 회차
  savingsTotal: number | null;     // 납입 총액(만원, 선납 포함)
  priorSpecial: boolean | null;    // 본인·배우자 특별공급 당첨 이력(배우자의 혼인 전 당첨 제외 — 제55조의3 ①)
  parent: ParentInput | null;
}

export interface Check { label: string; article: string; verdict: Verdict; note?: string }

export interface TypeResult {
  type: SpecialType;
  article: string;  // 적용 조·항
  verdict: Verdict;
  checks: Check[];
  rank?: '1순위' | '2순위' | '확인 필요'; // 신혼부부 공급 순위(제41조)
}

export const combine = (checks: readonly Check[]): Verdict =>
  checks.some((c) => c.verdict === 'no') ? 'no' : checks.some((c) => c.verdict === 'check') ? 'check' : 'ok';

export const DISCLAIMER = '판정은 입력값 기준 참고 결과이며, 당첨 후 서류 심사로 최종 결정됩니다.';
