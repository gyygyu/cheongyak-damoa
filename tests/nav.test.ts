import { describe, it, expect } from 'vitest';
import { NAV_ITEMS, navActive } from '../src/lib/nav';

describe('navActive', () => {
  it('탭은 다섯 개, 순서는 아파트 청약·공모주·실거래·캘린더·자격 판정', () => {
    expect(NAV_ITEMS.map((i) => i.label)).toEqual(['아파트 청약', '공모주', '실거래', '캘린더', '자격 판정']);
  });
  it('단지·LH 상세와 경쟁률 모음은 아파트 청약 탭', () => {
    for (const p of ['/', '/apt/2026000557', '/lh/0000061174', '/competition']) expect(navActive(p, '/')).toBe(true);
    expect(navActive('/ipo', '/')).toBe(false);
  });
  it('지역·실거래 화면은 실거래 탭, 끝 / 는 무시', () => {
    expect(navActive('/region/경기도/', '/region')).toBe(true);
    expect(navActive('/trade/41390/거모동', '/region')).toBe(true);
    expect(navActive('/regional', '/region')).toBe(false);
  });
  it('캘린더·판정 하위 주소', () => {
    expect(navActive('/calendar/2026-11', '/calendar')).toBe(true);
    expect(navActive('/eligibility/2026000557/01', '/eligibility')).toBe(true);
  });
});
