import { describe, it, expect } from 'vitest';
import { parseLawdPage } from '../sync/lawd-parse';

const page = {
  StanReginCd: [
    { head: [{ totalCount: 3 }, { numOfRows: '1000', pageNo: '1', type: 'json' }, { RESULT: { resultCode: 'INFO-0', resultMsg: 'NOMAL SERVICE' } }] },
    { row: [
      { region_cd: '1100000000', locatadd_nm: '서울특별시' },
      { region_cd: '1168000000', locatadd_nm: '서울특별시 강남구' },
      { region_cd: '1168010100', locatadd_nm: '서울특별시 강남구 역삼동 ' },
    ] },
  ],
};

describe('parseLawdPage', () => {
  it('전체 건수와 코드·이름을 꺼낸다 (이름 끝 공백 제거)', () => {
    expect(parseLawdPage(page)).toEqual({
      total: 3,
      rows: [
        { code: '1100000000', name: '서울특별시' },
        { code: '1168000000', name: '서울특별시 강남구' },
        { code: '1168010100', name: '서울특별시 강남구 역삼동' },
      ],
    });
  });
  it('형식이 다르면 오류를 낸다 (빈 표로 덮어쓰지 않게)', () => {
    expect(() => parseLawdPage({ RESULT: { resultCode: 'INFO-200' } })).toThrow('법정동');
  });
});
