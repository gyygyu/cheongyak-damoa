import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { truncatedNotice, TRUNCATED_TEXT } from '../src/lib/view/truncated';

describe('잘린 묶음 안내 (sync/bundles.ts fitValue 의 truncated)', () => {
  it('묶음이 하나라도 truncated 면 안내 문구를 준다', () => {
    expect(truncatedNotice({ truncated: true })).toBe(TRUNCATED_TEXT);
    expect(truncatedNotice(null, { truncated: true })).toBe(TRUNCATED_TEXT);
  });
  it('잘리지 않았거나 묶음이 없으면 null', () => {
    expect(truncatedNotice({})).toBeNull();
    expect(truncatedNotice({ truncated: false }, null, undefined)).toBeNull();
    expect(truncatedNotice()).toBeNull();
  });
  it('문구는 일부만 보인다는 것과 원 출처를 밝힌다', () => {
    expect(TRUNCATED_TEXT).toBe('자료가 많아 일부만 표시합니다. 전체는 청약홈·실거래 공개 시스템에서 확인하세요.');
  });
  it('묶음을 읽는 화면마다 같은 함수로 안내한다', () => {
    const pages = [
      'src/pages/apt/[no].astro', 'src/pages/calendar/[month].astro', 'src/pages/trade/[lawd]/[dong].astro',
      'src/pages/region/[sido]/index.astro', 'src/pages/region/[sido]/[sigungu].astro',
      'src/pages/index.astro', 'src/pages/competition.astro',
    ];
    for (const p of pages) expect(readFileSync(p, 'utf8'), p).toMatch(/truncatedNotice\(/);
  });
});
