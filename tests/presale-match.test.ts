import { describe, it, expect } from 'vitest';
import { matchPresale, type NoticeLoc } from '../src/lib/trade/presale-match';
import { parseJibun } from '../src/lib/region/jibun';
const cityOf = new Map([['41593', '41590'], ['41595', '41590'], ['41597', '41590'], ['41117', '41110']]);

const notices: NoticeLoc[] = [
  { pblancNo: 'P1', lawdCd: '41117', dong: '이의동', jibun: parseJibun('1234'), name: '힐스테이트 광교중앙역' },
  { pblancNo: 'P2', lawdCd: '41117', dong: '이의동', jibun: parseJibun('산 5-1'), name: '광교 자이 2차' },
  { pblancNo: 'P3', lawdCd: '41117', dong: '원천동', jibun: null, name: '원천 푸르지오' },
  { pblancNo: 'P4', lawdCd: '11680', dong: '역삼동', jibun: null, name: '원천 푸르지오' },
];

describe('matchPresale', () => {
  it('1차: 시군구+법정동+지번 (부번 없음 = -0)', () => {
    expect(matchPresale({ sggCd: '41117', dong: '이의동', jibun: '1234-0', name: '다른이름' }, notices, cityOf)).toEqual({ pblancNo: 'P1', method: 'jibun' });
  });
  it('"산" 지번도 맞춘다', () => {
    expect(matchPresale({ sggCd: '41117', dong: '이의동', jibun: '산5-1', name: 'x' }, notices, cityOf)).toEqual({ pblancNo: 'P2', method: 'jibun' });
  });
  it('2차: 지번이 안 맞으면 같은 시군구 안에서 정규화한 단지명', () => {
    expect(matchPresale({ sggCd: '41117', dong: '원천동', jibun: '99', name: '원천푸르지오아파트' }, notices, cityOf)).toEqual({ pblancNo: 'P3', method: 'name' });
  });
  it('다른 시군구의 같은 이름은 맞추지 않는다', () => {
    expect(matchPresale({ sggCd: '41590', dong: '봉담읍', jibun: '1', name: '원천 푸르지오' }, notices, cityOf)).toEqual({ pblancNo: null, method: 'none' });
  });
  it('이름 후보가 둘 이상이면 맞추지 않는다', () => {
    const dup = [...notices, { pblancNo: 'P5', lawdCd: '41117', dong: '원천동', jibun: null, name: '원천푸르지오' }];
    expect(matchPresale({ sggCd: '41117', dong: '원천동', jibun: '', name: '원천 푸르지오' }, dup, cityOf)).toEqual({ pblancNo: null, method: 'none' });
  });
  it('차수가 다르면 이름으로 맞추지 않는다', () => {
    expect(matchPresale({ sggCd: '41117', dong: '이의동', jibun: '', name: '광교자이 1차' }, notices, cityOf)).toEqual({ pblancNo: null, method: 'none' });
  });
  it('구가 있는 시 단위 공고(화성 41590 — 두 구에 걸친 주소)는 그 시의 구 거래와 이름으로 맞춘다', () => {
    const city = [...notices, { pblancNo: 'P6', lawdCd: '41590', dong: null, jibun: null, name: '동탄 레이크자이' }];
    expect(matchPresale({ sggCd: '41597', dong: '오산동', jibun: '1', name: '동탄레이크자이' }, city, cityOf)).toEqual({ pblancNo: 'P6', method: 'name' });
    expect(matchPresale({ sggCd: '41610', dong: '오포읍', jibun: '1', name: '동탄레이크자이' }, city, cityOf)).toEqual({ pblancNo: null, method: 'none' });
  });
});
