# 청약다모아 Plan B — 특별공급 자격 판정 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 브라우저에서만 돌아가는 특별공급 자격 판정 순수 로직(신생아·다자녀·신혼부부·생애최초·노부모 부양)을 조문 근거와 경계값 테스트로 만든다.

**Architecture:** `src/lib/eligibility/` 아래 순수 함수만 둔다. 공통 요건(무주택·제48조 통장·제55조 1회 제한·제55조의3 특례·소득·1순위)은 `common.ts`, 유형마다 판정 파일 하나, `index.ts`의 `judgeAll`이 다섯 유형을 한 번에 낸다. 각 요건은 `Check { label, article, verdict, note }`로 나오고 유형 결과는 그 묶음을 `combine`(불가 > 확인 필요 > 가능)으로 합친다. 소득 기준표는 `content/income-table/{연도}.json`을 `tables.ts`가 묶어 낸다. 화면(입력 폼·단지 상세에서 미리 채우기)은 Plan D.

**Tech Stack:** TypeScript 6, vitest 5 (기존 Plan A 골격 그대로)

**Spec:** `docs/superpowers/specs/2026-11-07-cheongyak-site-design.md` §8·§11, 근거 정리 `docs/special-supply-rules.md`

## Global Constraints

- 근거: 「주택공급에 관한 규칙」(시행 2026. 6. 15., 국토교통부령 제1592호), 출처 법제처 국가법령정보센터. 테스트 이름에 조·항을 적는다.
- 결과는 **가능(`ok`) / 불가(`no`) / 확인 필요(`check`)** 세 가지. 결과마다 걸린 요건과 조문을 함께 낸다.
- 1순위 여부와 부동산 가액(재산 대안)은 "확인 필요"로 둔다. 공고일이 속한 해의 소득 기준표가 없으면 소득 요건은 "확인 필요".
- 판정 입력값은 서버·URL로 보내지 않는다 — `src/lib/eligibility/`는 `fetch`·`location`·`localStorage`를 쓰지 않는다.
- 결과 안내 문구: "판정은 입력값 기준 참고 결과이며, 당첨 후 서류 심사로 최종 결정됩니다."
- 소득은 원 단위 정수, 면적은 ㎡, 날짜는 `YYYY-MM-DD`. 소득 비율 비교는 소수 없이 `income * 100 <= base * percent`.
- `src/lib/`는 Cloudflare·Node API를 쓰지 않는다. 코드 주석·커밋은 한국어, 커밋 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `.claude/`는 커밋하지 않는다.

## 판정에 쓰는 해석 (조문 문구 → 코드)

| 요건 | 조문 문구 | 코드 |
|---|---|---|
| 혼인 7년 이내 | 제41조 ① "공고일 현재 혼인기간(혼인신고일 기준)이 7년 이내" | `공고일 <= 혼인신고일 + 7년` (민법 초일 불산입 — 7년째 같은 날까지 포함) |
| 2세 미만 | 제35조의3 ① "2세 미만(2세가 되는 날을 포함)" | `공고일 <= 출생일 + 2년` |
| 미성년 | 제40조 ① "공고일 현재 미성년자인 두 명 이상의 자녀"(태아·입양 포함, ③) | `공고일 < 출생일 + 19년` |
| 65세 이상 | 제46조 ① | `공고일 >= 출생일 + 65년` |
| 3년 이상 부양 | 제46조 ① "3년 이상 계속하여 부양(같은 세대별 주민등록표)" | `공고일 >= 등재일 + 3년` |
| 2024. 6. 19. 이후 출생 | 제55조의3 ③ | `출생일 >= '2024-06-19'` 또는 태아 |
| 소득 기준 | 제40조 ② "(태아를 포함한 가구원 수가 4명 이상인 세대는 가구원수별 … 이하 같다)" | 3명 이하는 한 값, 4명 이상은 가구원수별, 8명 초과는 1명당 더함 — 모든 유형 공통 |
| 면적 | "85제곱미터 이하", "60제곱미터 이하" | `areaExcl <= 85`, `<= 60` |

## Review Focus

1. 공고일을 모를 때(단지 상세에서 못 받아 옴) 날짜·소득 요건이 "가능"으로 새면 안 된다 → 전부 "확인 필요" (Task 5 `judgeAll` 테스트).
2. 2월 29일 혼인신고 → 7년 뒤 2월 28일까지 포함 (Task 2 `withinYears` 테스트).
3. 면적 표기 `84.9512`·`85`·`85.0001` → 85 이하만 통과 (Task 3 민영 신혼부부 테스트).
4. 생년월일을 모르는 자녀(`birth: null`)는 "불가"가 아니라 "확인 필요" (Task 2 `hasPostExceptionChild`, Task 4 다자녀 테스트).
5. 가구원 수 0·소수·소득 모름은 예외 없이 "확인 필요" (Task 1 `withinIncome`, Task 2 `incomeCheck` 테스트).

---

### Task 1: 소득 기준표와 비교

**Files:**
- Create: `content/income-table/2026.json`
- Create: `src/lib/eligibility/income.ts`
- Create: `src/lib/eligibility/tables.ts`
- Test: `tests/eligibility-income.test.ts`

**Interfaces:**
- Produces: `interface IncomeTable { year; source; upTo3; bySize: Record<string, number>; perExtra }`, `baseIncome(t, size): number | null`, `withinIncome(t, size, percent, income): boolean | null`, `incomeTableFor(tables, noticeDate): IncomeTable | null`, `INCOME_TABLES: readonly IncomeTable[]`

- [ ] **Step 1: Write the failing test**

```ts
// file: tests/eligibility-income.test.ts
import { describe, it, expect } from 'vitest';
import { baseIncome, withinIncome, incomeTableFor } from '../src/lib/eligibility/income';
import { INCOME_TABLES } from '../src/lib/eligibility/tables';

const t = INCOME_TABLES.find((x) => x.year === 2026)!;

describe('2026 소득 기준표 (docs/special-supply-rules.md)', () => {
  it('3명 이하는 한 값, 4~8명은 가구원수별', () => {
    expect([1, 2, 3].map((n) => baseIncome(t, n))).toEqual([7_533_763, 7_533_763, 7_533_763]);
    expect([4, 5, 6, 7, 8].map((n) => baseIncome(t, n))).toEqual([8_802_202, 9_326_985, 9_906_263, 10_485_541, 11_064_819]);
  });
  it('8명 초과는 1명당 959,198원을 더한다', () => {
    expect(baseIncome(t, 9)).toBe(12_024_017);
    expect(baseIncome(t, 10)).toBe(12_983_215);
  });
  it('가구원 수가 0·음수·소수면 null', () => {
    expect(baseIncome(t, 0)).toBeNull();
    expect(baseIncome(t, -1)).toBeNull();
    expect(baseIncome(t, 2.5)).toBeNull();
  });
});

describe('withinIncome — 소수 없이 정수 비교', () => {
  it('제41조 140% 경계: 10,547,268원 이하', () => {
    expect(withinIncome(t, 3, 140, 10_547_268)).toBe(true);
    expect(withinIncome(t, 3, 140, 10_547_269)).toBe(false);
  });
  it('제41조 맞벌이 160% 경계: 12,054,020원 이하', () => {
    expect(withinIncome(t, 3, 160, 12_054_020)).toBe(true);
    expect(withinIncome(t, 3, 160, 12_054_021)).toBe(false);
  });
  it('4인 130% 경계: 11,442,862원 이하', () => {
    expect(withinIncome(t, 4, 130, 11_442_862)).toBe(true);
    expect(withinIncome(t, 4, 130, 11_442_863)).toBe(false);
  });
  it('소득 모름·음수·가구원 수 오류는 null', () => {
    expect(withinIncome(t, 3, 140, null)).toBeNull();
    expect(withinIncome(t, 3, 140, -1)).toBeNull();
    expect(withinIncome(t, 0, 140, 1_000_000)).toBeNull();
  });
});

describe('incomeTableFor — 공고일이 속한 해의 표', () => {
  it('2026년 공고는 2026 표, 2025년·날짜 없음은 null', () => {
    expect(incomeTableFor(INCOME_TABLES, '2026-01-01')?.year).toBe(2026);
    expect(incomeTableFor(INCOME_TABLES, '2026-12-31')?.year).toBe(2026);
    expect(incomeTableFor(INCOME_TABLES, '2025-12-31')).toBeNull();
    expect(incomeTableFor(INCOME_TABLES, null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/eligibility-income.test.ts`
Expected: FAIL — `Failed to resolve import "../src/lib/eligibility/income"`

- [ ] **Step 3: Write minimal implementation**

```json
// file: content/income-table/2026.json
{
  "year": 2026,
  "source": "마이홈포털(국토교통부) 신혼희망타운 입주자격 2026년도 적용기준 — 전년도 도시근로자 가구당 월평균 소득 100%(원)",
  "upTo3": 7533763,
  "bySize": { "4": 8802202, "5": 9326985, "6": 9906263, "7": 10485541, "8": 11064819 },
  "perExtra": 959198
}
```

```ts
// file: src/lib/eligibility/income.ts
// 소득 기준표: 전년도 도시근로자 가구당 월평균 소득 100%(원). 근거·출처는 docs/special-supply-rules.md
// 주택공급규칙 제40조 ②: 태아를 포함한 가구원 수가 4명 이상이면 가구원수별 값(이하 같다) — 모든 유형 공통으로 쓴다.
export interface IncomeTable {
  year: number;
  source: string;
  upTo3: number;                  // 3명 이하
  bySize: Record<string, number>; // "4" ~ "8"
  perExtra: number;               // 8명 초과 1명당 더하는 값
}

export function baseIncome(t: IncomeTable, size: number): number | null {
  if (!Number.isInteger(size) || size < 1) return null;
  if (size <= 3) return t.upTo3;
  if (size <= 8) return t.bySize[String(size)] ?? null;
  const eight = t.bySize['8'];
  return eight == null ? null : eight + (size - 8) * t.perExtra;
}

/** 소득이 기준의 percent% 이하인가 — 반올림 없이 정수 곱으로 비교. 판단할 수 없으면 null */
export function withinIncome(t: IncomeTable, size: number, percent: number, income: number | null): boolean | null {
  const base = baseIncome(t, size);
  if (base == null || income == null || !Number.isFinite(income) || income < 0) return null;
  return income * 100 <= base * percent;
}

/** 공고일이 속한 해의 표. 없으면 null(소득 요건은 '확인 필요') */
export function incomeTableFor(tables: readonly IncomeTable[], noticeDate: string | null): IncomeTable | null {
  if (!noticeDate) return null;
  const year = Number(noticeDate.slice(0, 4));
  return tables.find((t) => t.year === year) ?? null;
}
```

```ts
// file: src/lib/eligibility/tables.ts
// 연도별 소득 기준표 묶음. 해마다 content/income-table/{연도}.json 을 더하고 여기에 한 줄 추가한다.
import t2026 from '../../../content/income-table/2026.json';
import type { IncomeTable } from './income';

export const INCOME_TABLES: readonly IncomeTable[] = [t2026];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/eligibility-income.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add content/income-table/2026.json src/lib/eligibility/income.ts src/lib/eligibility/tables.ts tests/eligibility-income.test.ts
git commit -m "특공 판정: 2026 소득 기준표와 정수 비교"
```

---

### Task 2: 입력 타입과 공통 요건

**Files:**
- Create: `src/lib/eligibility/types.ts`
- Create: `src/lib/eligibility/common.ts`
- Create: `tests/eligibility-fixtures.ts`
- Test: `tests/eligibility-common.test.ts`

**Interfaces:**
- Consumes: `IncomeTable`, `withinIncome` (Task 1), `addMonths` (`src/lib/date.ts`)
- Produces:
  - `types.ts`: `SupplyKind`, `SpecialType = 'newborn' | 'multichild' | 'newlywed' | 'first_life' | 'elderly_parent'`, `Verdict = 'ok' | 'no' | 'check'`, `NoticeInput { supplyKind; areaExcl; noticeDate: string | null; publicBuilder: boolean | null }`, `Child { kind: 'born' | 'fetus' | 'adopted'; birth: string | null }`, `HomeOwner`, `ParentInput { birth; since; spouseHomeless }`, `ApplicantInput` (아래 코드), `Check { label; article; verdict; note? }`, `TypeResult { type; article; verdict; checks; rank? }`, `combine(checks): Verdict`, `DISCLAIMER`
  - `common.ts`: `chk(label, article, verdict, note?)`, `addYears`, `withinYears(start, years, on)`, `atLeastYears(start, years, on)`, `under2(birth, on)`, `isMinor(birth, on)`, `BIRTH_EXCEPTION_FROM`, `hasPostExceptionChild(children): boolean | null`, `homelessCheck(a, type, article)`, `oneTimeCheck(a, type)`, `savingsCheck(a, n)`, `rank1Check(n)`, `incomeCheck(a, table, rule: IncomeRule)`, `interface IncomeRule { percent; priority?; altProperty; article }`
  - `tests/eligibility-fixtures.ts`: `applicant(o?)`, `notice(o?)`, `find(result, label)`

- [ ] **Step 1: Write the failing test**

```ts
// file: tests/eligibility-fixtures.ts
// 판정 테스트용 기본 입력 — 모든 요건을 채운 신혼 3인 세대(2026-11-07 국민 59.98㎡ 공고)
import type { ApplicantInput, NoticeInput, TypeResult, Check } from '../src/lib/eligibility/types';

export const applicant = (o: Partial<ApplicantInput> = {}): ApplicantInput => ({
  homeOwner: 'none', everOwned: false, householdHead: true, singleHousehold: false,
  marriageDate: '2022-03-01', children: [{ kind: 'born', birth: '2025-05-01' }],
  householdSize: 3, monthlyIncome: 6_000_000, dualIncome: false, incomeTaxYears: 6,
  savingsMonths: 24, savingsPayments: 24, savingsTotal: 700, priorSpecial: false,
  parent: null, ...o,
});

export const notice = (o: Partial<NoticeInput> = {}): NoticeInput => ({
  supplyKind: 'national', areaExcl: 59.98, noticeDate: '2026-11-07', publicBuilder: false, ...o,
});

export const find = (r: TypeResult, label: string): Check | undefined => r.checks.find((c) => c.label === label);
```

```ts
// file: tests/eligibility-common.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/eligibility-common.test.ts`
Expected: FAIL — `Failed to resolve import "../src/lib/eligibility/common"`

- [ ] **Step 3: Write minimal implementation**

```ts
// file: src/lib/eligibility/types.ts
// 특별공급 판정 입력·결과 타입 (spec §8). 입력값은 브라우저 안에서만 쓰고 서버·URL로 보내지 않는다.
export type SupplyKind = 'national' | 'private';
export type SpecialType = 'newborn' | 'multichild' | 'newlywed' | 'first_life' | 'elderly_parent';
export type Verdict = 'ok' | 'no' | 'check'; // 가능 | 불가 | 확인 필요

/** 공고 쪽 값 — 공개 데이터라 단지 상세에서 미리 채울 수 있다 */
export interface NoticeInput {
  supplyKind: SupplyKind;
  areaExcl: number;              // 전용면적 ㎡
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
```

```ts
// file: src/lib/eligibility/common.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/eligibility-common.test.ts`
Expected: PASS (23 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/eligibility/types.ts src/lib/eligibility/common.ts tests/eligibility-fixtures.ts tests/eligibility-common.test.ts
git commit -m "특공 판정: 입력 타입과 공통 요건(무주택·제48조·제55조·제55조의3·소득)"
```

---

### Task 3: 신혼부부(제41조)·신생아(제35조의3)

**Files:**
- Create: `src/lib/eligibility/newlywed.ts`
- Create: `src/lib/eligibility/newborn.ts`
- Test: `tests/eligibility-newlywed-newborn.test.ts`

**Interfaces:**
- Consumes: Task 2 전부, `incomeTableFor` (Task 1)
- Produces: `judgeNewlywed(a, n, tables): TypeResult`, `newlywedRank(a): '1순위' | '2순위' | '확인 필요'`, `judgeNewborn(a, n, tables): TypeResult`

- [ ] **Step 1: Write the failing test**

```ts
// file: tests/eligibility-newlywed-newborn.test.ts
import { describe, it, expect } from 'vitest';
import { judgeNewlywed, newlywedRank } from '../src/lib/eligibility/newlywed';
import { judgeNewborn } from '../src/lib/eligibility/newborn';
import { INCOME_TABLES } from '../src/lib/eligibility/tables';
import { applicant, notice, find } from './eligibility-fixtures';

const T = INCOME_TABLES;

describe('제41조 신혼부부', () => {
  it('제41조 ④ 국민: 요건을 모두 채우면 가능, 혼인 중 출생 자녀가 있어 1순위', () => {
    const r = judgeNewlywed(applicant(), notice(), T);
    expect(r).toMatchObject({ type: 'newlywed', article: '제41조 제4항', verdict: 'ok', rank: '1순위' });
  });
  it('제41조 ① 혼인 7년째 마지막 날 공고는 이내, 하루 지나면 불가', () => {
    expect(find(judgeNewlywed(applicant({ marriageDate: '2019-11-07' }), notice(), T), '혼인 7년 이내')?.verdict).toBe('ok');
    expect(judgeNewlywed(applicant({ marriageDate: '2019-11-06' }), notice(), T).verdict).toBe('no');
  });
  it('제41조 ① 미혼은 불가', () => {
    expect(judgeNewlywed(applicant({ marriageDate: null }), notice(), T).verdict).toBe('no');
  });
  it('제41조 ① 민영은 전용 85㎡ 이하만 — 84.9512·85 통과, 85.0001 불가', () => {
    const p = (areaExcl: number) => judgeNewlywed(applicant(), notice({ supplyKind: 'private', areaExcl }), T);
    expect(p(84.9512).article).toBe('제41조 제1항');
    expect(p(84.9512).verdict).toBe('check'); // 민영 예치금(별표 2)은 확인 필요
    expect(p(85).verdict).toBe('check');
    expect(p(85.0001).verdict).toBe('no');
  });
  it('제41조 국민은 85㎡를 넘어도 면적으로 막지 않는다', () => {
    expect(find(judgeNewlywed(applicant(), notice({ areaExcl: 99 }), T), '전용 85㎡ 이하')).toBeUndefined();
  });
  it('제41조 ① 소득 140% 경계: 3인 10,547,268원 가능, 1원 넘으면 확인 필요(재산 대안)', () => {
    expect(judgeNewlywed(applicant({ monthlyIncome: 10_547_268 }), notice(), T).verdict).toBe('ok');
    expect(judgeNewlywed(applicant({ monthlyIncome: 10_547_269 }), notice(), T).verdict).toBe('check');
  });
  it('제41조 ① 맞벌이 160% 경계: 3인 12,054,020원 가능', () => {
    expect(judgeNewlywed(applicant({ dualIncome: true, monthlyIncome: 12_054_020 }), notice(), T).verdict).toBe('ok');
    expect(judgeNewlywed(applicant({ dualIncome: true, monthlyIncome: 12_054_021 }), notice(), T).verdict).toBe('check');
  });
  it('제41조 공급 순위: 자녀 없음 2순위, 태아·입양 1순위, 혼인 전 출생 자녀만 있으면 확인 필요', () => {
    expect(newlywedRank(applicant({ children: [] }))).toBe('2순위');
    expect(newlywedRank(applicant({ children: [{ kind: 'fetus', birth: null }] }))).toBe('1순위');
    expect(newlywedRank(applicant({ children: [{ kind: 'adopted', birth: '2015-01-01' }] }))).toBe('1순위');
    expect(newlywedRank(applicant({ children: [{ kind: 'born', birth: '2021-01-01' }] }))).toBe('확인 필요');
  });
  it('제41조 다른 세대원이 주택 소유면 불가', () => {
    expect(judgeNewlywed(applicant({ homeOwner: 'other_member' }), notice(), T).verdict).toBe('no');
  });
});

describe('제35조의3 신생아', () => {
  it('제35조의3 ① 국민: 다른 요건을 채워도 1순위는 확인 필요', () => {
    const r = judgeNewborn(applicant(), notice(), T);
    expect(r).toMatchObject({ type: 'newborn', article: '제35조의3 제1항', verdict: 'check' });
    expect(find(r, '2세 미만 자녀')?.verdict).toBe('ok');
    expect(find(r, '청약 1순위')?.verdict).toBe('check');
  });
  it('제35조의3 ① 2세 생일 전날·당일은 2세 미만, 다음 날은 불가', () => {
    const a = applicant({ children: [{ kind: 'born', birth: '2024-11-08' }] });
    expect(find(judgeNewborn(a, notice({ noticeDate: '2026-11-07' }), T), '2세 미만 자녀')?.verdict).toBe('ok');
    expect(find(judgeNewborn(a, notice({ noticeDate: '2026-11-08' }), T), '2세 미만 자녀')?.verdict).toBe('ok');
    expect(judgeNewborn(a, notice({ noticeDate: '2026-11-09' }), T).verdict).toBe('no');
  });
  it('제35조의3 ① 태아도 자녀로 본다', () => {
    expect(find(judgeNewborn(applicant({ children: [{ kind: 'fetus', birth: null }] }), notice(), T), '2세 미만 자녀')?.verdict).toBe('ok');
  });
  it('제35조의3 ① 출생일 모르는 자녀만 있으면 확인 필요', () => {
    expect(find(judgeNewborn(applicant({ children: [{ kind: 'born', birth: null }] }), notice(), T), '2세 미만 자녀')?.verdict).toBe('check');
  });
  it('제35조의3 ③ 민영은 85㎡ 이하만', () => {
    expect(judgeNewborn(applicant(), notice({ supplyKind: 'private', areaExcl: 85.01 }), T).verdict).toBe('no');
    expect(judgeNewborn(applicant(), notice({ supplyKind: 'private', areaExcl: 85 }), T).article).toBe('제35조의3 제3항');
  });
  it('제35조의3 ① 국민 소득 130% 경계(4인 11,442,862원), 넘으면 재산 대안으로 확인 필요', () => {
    const a = (monthlyIncome: number) => applicant({ householdSize: 4, monthlyIncome });
    expect(find(judgeNewborn(a(11_442_862), notice(), T), '소득 기준')?.verdict).toBe('ok');
    expect(find(judgeNewborn(a(11_442_863), notice(), T), '소득 기준')?.verdict).toBe('check');
  });
  it('제35조의3 ③ 민영은 160%까지', () => {
    const r = judgeNewborn(applicant({ monthlyIncome: 12_054_020 }), notice({ supplyKind: 'private', areaExcl: 84 }), T);
    expect(find(r, '소득 기준')?.verdict).toBe('ok');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/eligibility-newlywed-newborn.test.ts`
Expected: FAIL — `Failed to resolve import "../src/lib/eligibility/newlywed"`

- [ ] **Step 3: Write minimal implementation**

```ts
// file: src/lib/eligibility/newlywed.ts
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
```

```ts
// file: src/lib/eligibility/newborn.ts
// 제35조의3 신생아 특별공급 — ① 국민(제27조 ① 1순위, 소득 130%), ③ 민영 85㎡ 이하(제28조 ① 1순위, 소득 160%).
import { chk, homelessCheck, incomeCheck, oneTimeCheck, rank1Check, under2 } from './common';
import { incomeTableFor, type IncomeTable } from './income';
import { combine, type ApplicantInput, type Check, type NoticeInput, type TypeResult } from './types';

function under2Check(a: ApplicantInput, n: NoticeInput, article: string): Check {
  const label = '2세 미만 자녀';
  if (a.children.some((c) => c.kind === 'fetus')) return chk(label, article, 'ok', '태아 포함');
  if (n.noticeDate == null) return chk(label, article, 'check', '공고일을 확인하세요');
  const on = n.noticeDate;
  if (a.children.some((c) => c.birth != null && under2(c.birth, on))) return chk(label, article, 'ok');
  if (a.children.some((c) => c.birth == null)) return chk(label, article, 'check', '자녀 출생일을 확인하세요');
  return chk(label, article, 'no', '공고일 현재 2세 미만(2세가 되는 날 포함) 자녀가 있어야 함');
}

export function judgeNewborn(a: ApplicantInput, n: NoticeInput, tables: readonly IncomeTable[]): TypeResult {
  const national = n.supplyKind === 'national';
  const article = national ? '제35조의3 제1항' : '제35조의3 제3항';
  const checks: Check[] = [];
  if (!national && n.areaExcl > 85) checks.push(chk('전용 85㎡ 이하', article, 'no', '민영주택 신생아 특별공급은 전용 85㎡ 이하만'));
  checks.push(under2Check(a, n, article));
  checks.push(rank1Check(n));
  checks.push(homelessCheck(a, 'newborn', article));
  checks.push(incomeCheck(a, incomeTableFor(tables, n.noticeDate), { percent: national ? 130 : 160, priority: national ? 100 : 130, altProperty: true, article }));
  checks.push(oneTimeCheck(a, 'newborn'));
  return { type: 'newborn', article, verdict: combine(checks), checks };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/eligibility-newlywed-newborn.test.ts`
Expected: PASS (16 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/eligibility/newlywed.ts src/lib/eligibility/newborn.ts tests/eligibility-newlywed-newborn.test.ts
git commit -m "특공 판정: 신혼부부(제41조)·신생아(제35조의3)"
```

---

### Task 4: 생애최초(제43조)·다자녀(제40조)·노부모 부양(제46조)

**Files:**
- Create: `src/lib/eligibility/first-life.ts`
- Create: `src/lib/eligibility/multichild.ts`
- Create: `src/lib/eligibility/elderly.ts`
- Test: `tests/eligibility-other.test.ts`

**Interfaces:**
- Consumes: Task 2 전부, `incomeTableFor` (Task 1)
- Produces: `judgeFirstLife(a, n, tables)`, `judgeMultichild(a, n, tables)`, `judgeElderly(a, n, tables)` — 모두 `TypeResult`

- [ ] **Step 1: Write the failing test**

```ts
// file: tests/eligibility-other.test.ts
import { describe, it, expect } from 'vitest';
import { judgeFirstLife } from '../src/lib/eligibility/first-life';
import { judgeMultichild } from '../src/lib/eligibility/multichild';
import { judgeElderly } from '../src/lib/eligibility/elderly';
import { INCOME_TABLES } from '../src/lib/eligibility/tables';
import { applicant, notice, find } from './eligibility-fixtures';

const T = INCOME_TABLES;

describe('제43조 생애최초', () => {
  it('제43조 ① 국민: 요건을 채워도 1순위는 확인 필요', () => {
    const r = judgeFirstLife(applicant(), notice(), T);
    expect(r).toMatchObject({ type: 'first_life', article: '제43조 제1항', verdict: 'check' });
    expect(r.checks.filter((c) => c.verdict !== 'ok').map((c) => c.label)).toEqual(['청약 1순위']);
  });
  it('제43조 ① 세대 구성원이 주택을 소유한 적이 있으면 불가', () => {
    expect(judgeFirstLife(applicant({ everOwned: true }), notice(), T).verdict).toBe('no');
  });
  it('제43조 ① 소득세 5년 납부부터 가능', () => {
    expect(find(judgeFirstLife(applicant({ incomeTaxYears: 5 }), notice(), T), '소득세 5년 이상 납부')?.verdict).toBe('ok');
    expect(judgeFirstLife(applicant({ incomeTaxYears: 4 }), notice(), T).verdict).toBe('no');
  });
  it('제43조 ① 국민은 저축 600만원 이상(선납 포함)', () => {
    expect(find(judgeFirstLife(applicant({ savingsTotal: 600 }), notice(), T), '저축 600만원 이상')?.verdict).toBe('ok');
    expect(judgeFirstLife(applicant({ savingsTotal: 599 }), notice(), T).verdict).toBe('no');
  });
  it('제43조 ③ 민영은 저축 요건이 없고 85㎡ 이하만', () => {
    const r = judgeFirstLife(applicant({ savingsTotal: 0 }), notice({ supplyKind: 'private', areaExcl: 84 }), T);
    expect(r.article).toBe('제43조 제3항');
    expect(find(r, '저축 600만원 이상')).toBeUndefined();
    expect(judgeFirstLife(applicant(), notice({ supplyKind: 'private', areaExcl: 85.01 }), T).verdict).toBe('no');
  });
  it('제43조 후단 단독세대는 전용 60㎡ 이하만 — 60 통과, 60.01 불가', () => {
    const a = applicant({ singleHousehold: true });
    expect(find(judgeFirstLife(a, notice({ areaExcl: 60 }), T), '전용 60㎡ 이하(단독세대)')).toBeUndefined();
    expect(judgeFirstLife(a, notice({ areaExcl: 60.01 }), T).verdict).toBe('no');
  });
  it('제43조 ① 혼인 중도 아니고 자녀도 없으면 같은 항 제2호 나목 확인 필요', () => {
    const r = judgeFirstLife(applicant({ marriageDate: null, children: [] }), notice(), T);
    expect(find(r, '혼인 중이거나 자녀 있음')?.verdict).toBe('check');
  });
  it('제43조는 제55조의3 ③ 특례 대상이 아니다', () => {
    const a = applicant({ priorSpecial: true, children: [{ kind: 'born', birth: '2025-01-01' }] });
    expect(judgeFirstLife(a, notice(), T).verdict).toBe('no');
  });
});

describe('제40조 다자녀', () => {
  const two = [{ kind: 'born' as const, birth: '2025-05-01' }, { kind: 'born' as const, birth: '2010-01-01' }];
  it('제40조 ① 미성년 자녀 2명이면 국민 가능', () => {
    expect(judgeMultichild(applicant({ children: two }), notice(), T)).toMatchObject({ type: 'multichild', article: '제40조 제1항', verdict: 'ok' });
  });
  it('제40조 ① 19세 생일이 공고일인 자녀는 미성년이 아니다', () => {
    const kids = [{ kind: 'born' as const, birth: '2025-05-01' }, { kind: 'born' as const, birth: '2007-11-07' }];
    expect(judgeMultichild(applicant({ children: kids }), notice(), T).verdict).toBe('no');
  });
  it('제40조 ③ 태아도 자녀로 센다', () => {
    const kids = [{ kind: 'born' as const, birth: '2025-05-01' }, { kind: 'fetus' as const, birth: null }];
    expect(find(judgeMultichild(applicant({ children: kids }), notice(), T), '미성년 자녀 2명 이상')?.verdict).toBe('ok');
  });
  it('제40조 ① 출생일 모르는 자녀가 있어 2명이 될 수 있으면 확인 필요', () => {
    const kids = [{ kind: 'born' as const, birth: '2025-05-01' }, { kind: 'born' as const, birth: null }];
    expect(find(judgeMultichild(applicant({ children: kids }), notice(), T), '미성년 자녀 2명 이상')?.verdict).toBe('check');
  });
  it('제40조 ② 제18조 사업주체 85㎡ 이하는 소득 120%(4인 10,562,642원)', () => {
    const a = (monthlyIncome: number) => applicant({ children: two, householdSize: 4, monthlyIncome });
    const pub = notice({ publicBuilder: true, areaExcl: 84 });
    expect(judgeMultichild(a(10_562_642), pub, T)).toMatchObject({ article: '제40조 제2항', verdict: 'ok' });
    expect(judgeMultichild(a(10_562_643), pub, T).verdict).toBe('no');
  });
  it('제40조 ② 사업주체를 모르면 소득 초과는 확인 필요, 민간 사업주체면 소득을 보지 않는다', () => {
    const a = applicant({ children: two, householdSize: 4, monthlyIncome: 20_000_000 });
    expect(judgeMultichild(a, notice({ publicBuilder: null, areaExcl: 84 }), T).verdict).toBe('check');
    expect(judgeMultichild(a, notice({ publicBuilder: false, areaExcl: 84 }), T).verdict).toBe('ok');
  });
});

describe('제46조 노부모 부양', () => {
  const parent = { birth: '1961-11-07', since: '2023-11-07', spouseHomeless: true };
  it('제46조 ① 65세·3년 부양 경계일에 요건 충족, 1순위는 확인 필요', () => {
    const r = judgeElderly(applicant({ parent }), notice(), T);
    expect(r).toMatchObject({ type: 'elderly_parent', article: '제46조 제1항', verdict: 'check' });
    expect(r.checks.filter((c) => c.verdict !== 'ok').map((c) => c.label)).toEqual(['청약 1순위']);
  });
  it('제46조 ① 3년에서 하루 모자라면 불가', () => {
    expect(judgeElderly(applicant({ parent: { ...parent, since: '2023-11-08' } }), notice(), T).verdict).toBe('no');
  });
  it('제46조 ① 65세 생일 전이면 불가', () => {
    expect(judgeElderly(applicant({ parent: { ...parent, birth: '1961-11-08' } }), notice(), T).verdict).toBe('no');
  });
  it('제46조 ① 세대주가 아니거나 부양 직계존속이 없으면 불가', () => {
    expect(judgeElderly(applicant({ parent, householdHead: false }), notice(), T).verdict).toBe('no');
    expect(judgeElderly(applicant({ parent: null }), notice(), T).verdict).toBe('no');
  });
  it('제46조 ① 피부양자의 배우자가 주택을 소유하면 불가', () => {
    expect(judgeElderly(applicant({ parent: { ...parent, spouseHomeless: false } }), notice(), T).verdict).toBe('no');
  });
  it('제46조 ③ 제18조 사업주체 85㎡ 이하는 세대주 요건 대신 소득 120%', () => {
    const r = judgeElderly(applicant({ parent, householdHead: false, householdSize: 4, monthlyIncome: 10_562_642 }), notice({ publicBuilder: true, areaExcl: 84 }), T);
    expect(r.article).toBe('제46조 제3항');
    expect(find(r, '세대주')).toBeUndefined();
    expect(find(r, '소득 기준')?.verdict).toBe('ok');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/eligibility-other.test.ts`
Expected: FAIL — `Failed to resolve import "../src/lib/eligibility/first-life"`

- [ ] **Step 3: Write minimal implementation**

```ts
// file: src/lib/eligibility/first-life.ts
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
```

```ts
// file: src/lib/eligibility/multichild.ts
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
  const smallArea = n.areaExcl <= 85;
  const article = n.publicBuilder === true && smallArea ? '제40조 제2항' : '제40조 제1항';
  const checks: Check[] = [minorsCheck(a, n), homelessCheck(a, 'multichild', article), savingsCheck(a, n)];
  if (smallArea && n.publicBuilder !== false) {
    const c = incomeCheck(a, incomeTableFor(tables, n.noticeDate), { percent: 120, altProperty: false, article: '제40조 제2항' });
    checks.push(n.publicBuilder == null && c.verdict === 'no'
      ? chk(c.label, c.article, 'check', '제18조 사업주체(공공) 공급이면 소득 120% 이하여야 함 — 공고문을 확인하세요')
      : c);
  }
  checks.push(oneTimeCheck(a, 'multichild'));
  return { type: 'multichild', article, verdict: combine(checks), checks };
}
```

```ts
// file: src/lib/eligibility/elderly.ts
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
  const public85 = n.publicBuilder === true && n.areaExcl <= 85;
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
      : chk('세대주', article, 'no', '무주택 세대주여야 함'));
  }
  checks.push(oneTimeCheck(a, 'elderly_parent'));
  return { type: 'elderly_parent', article, verdict: combine(checks), checks };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/eligibility-other.test.ts`
Expected: PASS (20 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/eligibility/first-life.ts src/lib/eligibility/multichild.ts src/lib/eligibility/elderly.ts tests/eligibility-other.test.ts
git commit -m "특공 판정: 생애최초(제43조)·다자녀(제40조)·노부모 부양(제46조)"
```

---

### Task 5: 한 번에 판정(judgeAll)과 경계 점검

**Files:**
- Create: `src/lib/eligibility/index.ts`
- Test: `tests/eligibility-judge.test.ts`

**Interfaces:**
- Consumes: Task 1~4 전부
- Produces: `judgeAll(a, n, tables = INCOME_TABLES): TypeResult[]` (순서: newborn, multichild, newlywed, first_life, elderly_parent), `TYPE_LABEL: Record<SpecialType, string>`, `VERDICT_LABEL: Record<Verdict, string>`, 그리고 `types.ts`·`common.ts`의 타입·`DISCLAIMER` 재내보내기 — Plan D 화면이 이 모듈 하나만 가져다 쓴다.

- [ ] **Step 1: Write the failing test**

```ts
// file: tests/eligibility-judge.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { judgeAll, TYPE_LABEL, VERDICT_LABEL, DISCLAIMER } from '../src/lib/eligibility';
import { applicant, notice } from './eligibility-fixtures';

describe('judgeAll', () => {
  it('다섯 유형을 정해진 순서로 낸다', () => {
    expect(judgeAll(applicant(), notice()).map((r) => r.type)).toEqual(['newborn', 'multichild', 'newlywed', 'first_life', 'elderly_parent']);
  });
  it('기본 입력(신혼 3인, 자녀 1명): 신혼부부 가능, 다자녀·노부모 불가, 신생아·생애최초 확인 필요', () => {
    const v = Object.fromEntries(judgeAll(applicant(), notice()).map((r) => [r.type, r.verdict]));
    expect(v).toEqual({ newborn: 'check', multichild: 'no', newlywed: 'ok', first_life: 'check', elderly_parent: 'no' });
  });
  it('공고일을 모르면 어떤 유형도 가능으로 나오지 않는다', () => {
    const rs = judgeAll(applicant(), notice({ noticeDate: null }));
    expect(rs.some((r) => r.verdict === 'ok')).toBe(false);
    expect(rs.find((r) => r.type === 'newlywed')?.verdict).toBe('check');
  });
  it('소득 기준표가 없는 해(2027) 공고는 소득 요건이 확인 필요', () => {
    const r = judgeAll(applicant(), notice({ noticeDate: '2027-01-05' })).find((x) => x.type === 'newlywed')!;
    expect(r.checks.find((c) => c.label === '소득 기준')?.verdict).toBe('check');
  });
  it('모든 요건에 조문이 붙는다', () => {
    for (const r of judgeAll(applicant(), notice())) for (const c of r.checks) expect(c.article).toMatch(/^제\d+조/);
  });
  it('화면 문구', () => {
    expect(TYPE_LABEL.first_life).toBe('생애최초');
    expect(VERDICT_LABEL).toEqual({ ok: '가능', no: '불가', check: '확인 필요' });
    expect(DISCLAIMER).toContain('서류 심사');
  });
});

describe('입력값은 밖으로 나가지 않는다 (spec §8)', () => {
  it('src/lib/eligibility 는 fetch·location·storage 를 쓰지 않는다', () => {
    const dir = 'src/lib/eligibility';
    for (const f of readdirSync(dir)) {
      const src = readFileSync(`${dir}/${f}`, 'utf8');
      expect(src, f).not.toMatch(/\bfetch\s*\(|location\.|localStorage|sessionStorage|XMLHttpRequest|sendBeacon/);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/eligibility-judge.test.ts`
Expected: FAIL — `Failed to resolve import "../src/lib/eligibility"`

- [ ] **Step 3: Write minimal implementation**

```ts
// file: src/lib/eligibility/index.ts
// 특별공급 자격 판정 진입점 (spec §8) — 화면은 이 모듈만 가져다 쓴다. 브라우저 안에서만 계산한다.
import { judgeElderly } from './elderly';
import { judgeFirstLife } from './first-life';
import type { IncomeTable } from './income';
import { judgeMultichild } from './multichild';
import { judgeNewborn } from './newborn';
import { judgeNewlywed } from './newlywed';
import { INCOME_TABLES } from './tables';
import type { ApplicantInput, NoticeInput, SpecialType, TypeResult, Verdict } from './types';

export * from './types';
export { INCOME_TABLES } from './tables';

export const TYPE_LABEL: Record<SpecialType, string> = {
  newborn: '신생아', multichild: '다자녀', newlywed: '신혼부부', first_life: '생애최초', elderly_parent: '노부모 부양',
};
export const VERDICT_LABEL: Record<Verdict, string> = { ok: '가능', no: '불가', check: '확인 필요' };

export function judgeAll(a: ApplicantInput, n: NoticeInput, tables: readonly IncomeTable[] = INCOME_TABLES): TypeResult[] {
  return [judgeNewborn, judgeMultichild, judgeNewlywed, judgeFirstLife, judgeElderly].map((f) => f(a, n, tables));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/eligibility-judge.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: 전체 확인**

Run: `npm test` 그리고 `npm run typecheck`
Expected: 전체 PASS(기존 테스트 + 이번 74), typecheck 오류 0

- [ ] **Step 6: Commit**

```bash
git add src/lib/eligibility/index.ts tests/eligibility-judge.test.ts
git commit -m "특공 판정: judgeAll 진입점·화면 문구·입력값 유출 점검"
```
