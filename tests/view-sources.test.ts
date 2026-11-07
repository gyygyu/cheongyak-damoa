import { describe, it, expect } from 'vitest';
import { sourceLines, formatStamp, SOURCE_LABEL } from '../src/lib/view/sources';

describe('sourceLines', () => {
  it('출처 이름과 한국 시각 갱신 시각', () => {
    const meta = { applyhome: { lastSuccess: '2026-11-07T21:05:00.000Z', failures: 0, lastCount: 10 } };
    expect(sourceLines(meta, ['applyhome'])).toEqual(['청약홈 2026.11.08 06:05 갱신']);
  });
  it('기록이 없거나 meta 를 못 읽으면 이름만', () => {
    expect(sourceLines({}, ['lh'])).toEqual(['한국토지주택공사 (갱신 기록 없음)']);
    expect(sourceLines(null, ['dart'])).toEqual(['금융감독원 DART (갱신 기록 없음)']);
  });
  it('spec §13 출처 이름을 모두 가진다', () => {
    const names = Object.values(SOURCE_LABEL).join(' ');
    for (const n of ['청약홈', '한국토지주택공사', '국토교통부', '금융감독원 DART', '금융위원회']) expect(names).toContain(n);
  });
  it('formatStamp 는 깨진 값이면 빈 문자열', () => expect(formatStamp('x')).toBe(''));
});
