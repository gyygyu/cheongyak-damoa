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
