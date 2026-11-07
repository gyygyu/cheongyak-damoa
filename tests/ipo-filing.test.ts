import { describe, it, expect } from 'vitest';
import { pickFiling, isEquityFiling, type Filing } from '../src/lib/ipo/filing';

const f = (rceptNo: string, reportNm: string): Filing => ({ rceptNo, reportNm, rceptDt: rceptNo.slice(0, 8) });

describe('isEquityFiling', () => {
  it('증권신고서(지분증권)와 그 정정만', () => {
    expect(isEquityFiling('증권신고서(지분증권)')).toBe(true);
    expect(isEquityFiling('[기재정정]증권신고서(지분증권)')).toBe(true);
    expect(isEquityFiling('증권신고서(채무증권)')).toBe(false);
    expect(isEquityFiling('투자설명서')).toBe(false);
  });
});

describe('pickFiling', () => {
  it('접수번호가 가장 늦은 판을 쓴다 (입력 순서와 무관)', () => {
    const r = pickFiling([f('20261020000200', '[기재정정]증권신고서(지분증권)'), f('20261001000100', '증권신고서(지분증권)')]);
    expect(r!.latest.rceptNo).toBe('20261020000200');
  });
  it('정정 이력: 접수번호 순, [기재정정] 표시', () => {
    const r = pickFiling([
      f('20261001000100', '증권신고서(지분증권)'),
      f('20261020000200', '[기재정정]증권신고서(지분증권)'),
      f('20261025000300', '[기재정정]증권신고서(지분증권)'),
    ]);
    expect(r!.revisions).toEqual([
      { rceptNo: '20261001000100', rceptDt: '20261001', corrected: false },
      { rceptNo: '20261020000200', rceptDt: '20261020', corrected: true },
      { rceptNo: '20261025000300', rceptDt: '20261025', corrected: true },
    ]);
  });
  it('[발행조건확정] 판도 정정 이력으로 표시한다', () => {
    const r = pickFiling([f('20261001000100', '증권신고서(지분증권)'), f('20261028000400', '[발행조건확정]증권신고서(지분증권)')]);
    expect(r!.revisions.map((x) => x.corrected)).toEqual([false, true]);
  });
  it('지분증권 신고서가 없으면 null', () => {
    expect(pickFiling([f('20261001000100', '투자설명서')])).toBeNull();
    expect(pickFiling([])).toBeNull();
  });
});
