// Plan B 최종 리뷰 지적(빈 날짜·면적 NaN·소득표 적용 시작일·노부모 공공 여부 모름) 회귀 테스트
import { describe, it, expect } from 'vitest';
import { judgeAll } from '../src/lib/eligibility';
import { incomeTableFor, type IncomeTable } from '../src/lib/eligibility/income';
import { applicant, notice, find } from './eligibility-fixtures';

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
