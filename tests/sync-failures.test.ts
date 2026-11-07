import { describe, it, expect } from 'vitest';
import { nextMeta, ALERT_AFTER } from '../sync/failures';

describe('nextMeta', () => {
  it('성공은 실패 수를 0 으로, 건수·시각을 기록', () => {
    expect(nextMeta({ lastSuccess: null, failures: 2, lastCount: 5, lastError: 'x' }, { ok: true, count: 7 }, '2026-11-07T19:00:00Z'))
      .toEqual({ lastSuccess: '2026-11-07T19:00:00Z', failures: 0, lastCount: 7 });
  });
  it('실패는 실패 수를 늘리고 직전 성공 기록은 둔다', () => {
    const m = nextMeta(undefined, { ok: false, error: 'HTTP 500' }, 'now');
    expect(m).toEqual({ lastSuccess: null, failures: 1, lastCount: null, lastError: 'HTTP 500' });
    const m3 = nextMeta(nextMeta(m, { ok: false, error: 'e' }, 'now'), { ok: false, error: 'e3' }, 'now');
    expect(m3.failures).toBe(ALERT_AFTER);
  });
});
