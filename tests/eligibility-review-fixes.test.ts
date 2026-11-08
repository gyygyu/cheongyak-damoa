// Plan B 최종 리뷰 지적(빈 날짜·면적 NaN·소득표 적용 시작일·노부모 공공 여부 모름) 회귀 테스트
import { describe, it, expect } from 'vitest';
import { judgeAll } from '../src/lib/eligibility';
import { incomeTableFor, type IncomeTable } from '../src/lib/eligibility/income';
import { applicant, notice, find } from './eligibility-fixtures';
import { parseForm, CHILD_COUNT_OPTIONS, YES_NO_OPTIONS, MARRIED_OPTIONS, PARENT_CARE_OPTIONS, HOME_OWNER_OPTIONS } from '../src/lib/view/eligibility-form';

const byType = (rs: ReturnType<typeof judgeAll>, t: string) => rs.find((r) => r.type === t)!;
const twoKids = [{ kind: 'born' as const, birth: '2020-01-01' }, { kind: 'born' as const, birth: '2022-01-01' }];

describe('잘못된 날짜는 모름으로 본다', () => {
  it("공고일 ''이면 어떤 유형도 가능이 아니고 다자녀는 확인 필요", () => {
    const rs = judgeAll(applicant({ children: twoKids }), notice({ noticeDate: '' }));
    expect(rs.some((r) => r.verdict === 'ok')).toBe(false);
    expect(byType(rs, 'multichild').verdict).toBe('check');
  });
  it("자녀 출생일 ''이면 신생아 2세 미만 요건은 확인 필요", () => {
    const r = byType(judgeAll(applicant({ children: [{ kind: 'born', birth: '' }] }), notice()), 'newborn');
    expect(find(r, '2세 미만 자녀')?.verdict).toBe('check');
  });
  it("부모 생년월일이 형식에 맞지 않으면 65세 요건은 확인 필요", () => {
    const parent = { birth: '1950-13-40', since: '2020-01-01', spouseHomeless: true };
    const r = byType(judgeAll(applicant({ parent }), notice()), 'elderly_parent');
    expect(find(r, '65세 이상 직계존속')?.verdict).toBe('check');
  });
});

describe('전용면적을 모르면 면적·소득 요건은 확인 필요', () => {
  for (const area of [Number.NaN, null]) {
    it(`민영 ${String(area)}: 신혼·신생아·생애최초의 85㎡ 요건이 확인 필요`, () => {
      const rs = judgeAll(applicant(), notice({ supplyKind: 'private', areaExcl: area }));
      for (const t of ['newlywed', 'newborn', 'first_life']) expect(find(byType(rs, t), '전용 85㎡ 이하')?.verdict).toBe('check');
    });
    it(`공공 사업주체 ${String(area)}: 다자녀 소득 120% 초과는 가능이 아니다`, () => {
      const r = byType(judgeAll(applicant({ children: twoKids, householdSize: 4, monthlyIncome: 20_000_000 }),
        notice({ publicBuilder: true, areaExcl: area })), 'multichild');
      expect(r.verdict).toBe('check');
    });
  }
  it('단독세대 + 면적 모름: 생애최초 60㎡ 요건은 확인 필요', () => {
    const r = byType(judgeAll(applicant({ singleHousehold: true }), notice({ areaExcl: null })), 'first_life');
    expect(find(r, '전용 60㎡ 이하(단독세대)')?.verdict).toBe('check');
  });
});

describe('소득 기준표 적용 시작일', () => {
  const t: IncomeTable = { year: 2026, effectiveFrom: '2026-07-01', source: 't', upTo3: 100, bySize: {}, perExtra: 0 };
  it('적용 시작일 전 공고는 표를 쓰지 않는다', () => {
    expect(incomeTableFor([t], '2026-06-30')).toBeNull();
    expect(incomeTableFor([t], '2026-07-01')).toBe(t);
  });
  it('2026년 표 적용 전(2026-03-02) 공고는 소득 기준이 확인 필요', () => {
    const r = byType(judgeAll(applicant(), notice({ noticeDate: '2026-03-02' })), 'newlywed');
    expect(find(r, '소득 기준')?.verdict).toBe('check');
  });
});

describe('노부모: 공공 사업주체 여부를 모르면', () => {
  it('85㎡ 이하·세대주 아님은 불가가 아니라 확인 필요', () => {
    const parent = { birth: '1950-01-01', since: '2020-01-01', spouseHomeless: true };
    const r = byType(judgeAll(applicant({ parent, householdHead: false }), notice({ publicBuilder: null })), 'elderly_parent');
    expect(find(r, '세대주')?.verdict).toBe('check');
  });
});

// UI 리뷰(2026-11-08): 답하지 않은 칸이 0·미혼·해당 없음으로 읽혀 '불가'가 나오던 문제 — 비우면 '확인 필요'
describe('답하지 않은 칸은 모름(확인 필요)이다', () => {
  // 자녀·혼인·부양 칸을 빼고 모든 요건을 채운 폼 값
  const form = {
    supplyKind: 'national', areaExcl: '59.98', noticeDate: '2026-11-07', publicBuilder: 'false',
    homeOwner: 'none', everOwned: 'false', householdHead: 'true', singleHousehold: 'false',
    householdSize: '4', monthlyIncome: '600', dualIncome: 'false', incomeTaxYears: '6',
    savingsMonths: '24', savingsPayments: '24', savingsTotal: '700', priorSpecial: 'false',
  };
  const judgeForm = (v: Record<string, string>) => {
    const p = parseForm(v);
    expect(p.errors).toEqual([]);
    return judgeAll(p.applicant, p.notice);
  };

  it('자녀 수를 고르지 않으면 다자녀는 불가가 아니라 확인 필요', () => {
    const rs = judgeForm({ ...form, childCount: '' });
    expect(find(byType(rs, 'multichild'), '미성년 자녀 2명 이상')?.verdict).toBe('check');
    expect(byType(rs, 'multichild').verdict).toBe('check');
    expect(find(byType(rs, 'newborn'), '2세 미만 자녀')?.verdict).toBe('check');
    expect(byType(rs, 'newlywed').rank).toBe('확인 필요');
  });
  it('자녀 수 "없음"(0)을 고르면 다자녀 불가', () => {
    expect(byType(judgeForm({ ...form, childCount: '0' }), 'multichild').verdict).toBe('no');
  });
  it('혼인 여부를 고르지 않으면 신혼부부 혼인 요건은 확인 필요', () => {
    const r = byType(judgeForm({ ...form, married: '' }), 'newlywed');
    expect(find(r, '혼인 7년 이내')?.verdict).toBe('check');
  });
  it('혼인 중인데 혼인신고일을 비우면 확인 필요, 미혼을 고르면 불가', () => {
    expect(find(byType(judgeForm({ ...form, married: 'true' }), 'newlywed'), '혼인 7년 이내')?.verdict).toBe('check');
    expect(byType(judgeForm({ ...form, married: 'false' }), 'newlywed').verdict).toBe('no');
  });
  it('미혼을 고르면 숨겨진 혼인신고일 칸 값은 쓰지 않는다', () => {
    const p = parseForm({ ...form, married: 'false', marriageDate: '2024-01-01' });
    expect(p.applicant.married).toBe(false);
    expect(p.applicant.marriageDate).toBeNull();
  });
  it('노부모 부양 여부를 고르지 않으면 노부모 부양은 불가가 아니라 확인 필요', () => {
    expect(byType(judgeForm({ ...form, parentCare: '' }), 'elderly_parent').verdict).toBe('check');
    expect(byType(judgeForm({ ...form, parentCare: 'false' }), 'elderly_parent').verdict).toBe('no');
  });
  it('폼의 모든 선택 칸은 첫 값이 비어 있다(모름)', () => {
    for (const opts of [CHILD_COUNT_OPTIONS, YES_NO_OPTIONS, MARRIED_OPTIONS, PARENT_CARE_OPTIONS, HOME_OWNER_OPTIONS]) {
      expect(opts[0][0]).toBe('');
    }
  });
});
