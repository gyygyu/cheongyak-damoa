import { describe, it, expect } from 'vitest';
import { pathOfKey, staticPaths, sitemapXml } from '../src/lib/view/sitemap';

describe('pathOfKey', () => {
  it('묶음 키 → 화면 주소', () => {
    expect(pathOfKey('apt:2026000557')).toBe('/apt/2026000557');
    expect(pathOfKey('lh:0000061174')).toBe('/lh/0000061174');
    expect(pathOfKey('region:경기도')).toBe('/region/%EA%B2%BD%EA%B8%B0%EB%8F%84');
    expect(pathOfKey('region:경기도:시흥시')).toBe('/region/%EA%B2%BD%EA%B8%B0%EB%8F%84/%EC%8B%9C%ED%9D%A5%EC%8B%9C');
    expect(pathOfKey('trade:11680:대치동')).toBe('/trade/11680/%EB%8C%80%EC%B9%98%EB%8F%99');
  });
  it('화면이 없는 키는 null', () => {
    for (const k of ['home', 'meta:sources', 'calendar:2026-11', 'backfill:trade', 'trade:11680', 'apt:']) expect(pathOfKey(k)).toBeNull();
  });
});

describe('sitemapXml', () => {
  it('고정 주소에 이번 달 캘린더', () => {
    expect(staticPaths('2026-11-07')).toEqual(['/', '/competition', '/region', '/ipo', '/eligibility', '/calendar/2026-11']);
  });
  it('XML 과 이스케이프, 끝 / 정리', () => {
    const xml = sitemapXml('https://a.com/', ['/', '/apt/1&2']);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<loc>https://a.com/</loc>');
    expect(xml).toContain('<loc>https://a.com/apt/1&amp;2</loc>');
  });
});
