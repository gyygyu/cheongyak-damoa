import { describe, it, expect } from 'vitest';
import { NAV_ITEMS, navActive } from '../src/lib/nav';

describe('navActive', () => {
  it('탭은 다섯 개, 순서는 아파트 청약·경쟁률·실거래·캘린더·자격 판정 (공모주는 자료가 생길 때까지 꼬리말에만)', () => {
    expect(NAV_ITEMS.map((i) => i.label)).toEqual(['아파트 청약', '경쟁률', '실거래', '캘린더', '자격 판정']);
    expect(NAV_ITEMS.some((i) => i.href === '/ipo')).toBe(false);
  });
  it('탭마다 아이콘 이름이 있고 겹치지 않는다', () => {
    const icons = NAV_ITEMS.map((i) => i.icon);
    expect(new Set(icons).size).toBe(NAV_ITEMS.length);
  });
  it('단지·LH 상세는 아파트 청약 탭, 경쟁률 모음은 경쟁률 탭', () => {
    for (const p of ['/', '/apt/2026000557', '/lh/0000061174']) expect(navActive(p, '/')).toBe(true);
    expect(navActive('/competition', '/')).toBe(false);
    expect(navActive('/competition', '/competition')).toBe(true);
    expect(navActive('/ipo', '/')).toBe(false);
  });
  it('공모주 화면은 어느 탭도 현재 위치가 아니다', () => {
    for (const item of NAV_ITEMS) expect(navActive('/ipo/00123456', item.href)).toBe(false);
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
