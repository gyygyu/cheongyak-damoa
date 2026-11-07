import { describe, it, expect } from 'vitest';
import { canonicalRedirect } from '../src/lib/canonical-host';
import { cacheKeyUrl } from '../src/lib/cache-key';

describe('canonicalRedirect', () => {
  const site = 'https://cheongyakdamoa.com';
  it('대표 주소면 넘기지 않는다', () => expect(canonicalRedirect('https://cheongyakdamoa.com/apt/1', site)).toBeNull());
  it('www·workers.dev 는 같은 경로로', () => {
    expect(canonicalRedirect('https://www.cheongyakdamoa.com/apt/1?x=1', site)).toBe('https://cheongyakdamoa.com/apt/1?x=1');
    expect(canonicalRedirect('https://cheongyak-damoa.a.workers.dev/', site)).toBe('https://cheongyakdamoa.com/');
  });
  it('로컬·대표 주소가 workers.dev 면 넘기지 않는다', () => {
    expect(canonicalRedirect('http://localhost:8787/', site)).toBeNull();
    expect(canonicalRedirect('https://x.workers.dev/', 'https://x.workers.dev')).toBeNull();
  });
});

describe('cacheKeyUrl', () => {
  it('배포 판 번호를 붙인다', () => expect(cacheKeyUrl('https://a.com/b?c=1', 'v9')).toBe('https://a.com/b?c=1&__v=v9'));
});
