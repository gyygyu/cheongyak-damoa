import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildLawdIndex, resolveAddress, sameSigungu, SIDO_ALIAS, type LawdTable } from '../src/lib/region/lawd';

// 실제 스냅숏(content/lawd/lawd.json)으로 확인 — 시도 개편(전남광주통합특별시 등)을 놓치지 않게
const table: LawdTable = JSON.parse(readFileSync('content/lawd/lawd.json', 'utf8'));
const idx = buildLawdIndex(table);

describe('실제 법정동 표', () => {
  it('시도 별칭이 가리키는 이름은 모두 표에 있다', () => {
    for (const [from, to] of Object.entries(SIDO_ALIAS)) expect(idx.byName.has(to), `${from}→${to}`).toBe(true);
  });
  it('옛 광주·전남 주소도 통합특별시로 해석한다', () => {
    expect(resolveAddress(idx, '광주광역시 광산구 수완동 123')).toMatchObject({ lawdCd: '12330', sigungu: '광산구' });
    expect(resolveAddress(idx, '광주 광산구 수완동')).toMatchObject({ lawdCd: '12330' });
    expect(resolveAddress(idx, '전남 순천시 조례동 1')).toMatchObject({ lawdCd: '12150' });
    expect(resolveAddress(idx, '전라남도 여수시 학동 1')).toMatchObject({ lawdCd: '12130' });
  });
  it('구가 없는 이웃 군(영동군 43740·증평군 43745)은 다른 곳', () => {
    expect(sameSigungu('43740', '43745', idx.cityOf)).toBe(false);
  });
  it('구가 있는 시와 그 구는 같은 곳 (화성시)', () => {
    expect(sameSigungu('41590', '41597', idx.cityOf)).toBe(true);
    expect(sameSigungu('41593', '41597', idx.cityOf)).toBe(false);
  });
});
