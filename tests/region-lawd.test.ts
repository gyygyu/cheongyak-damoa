import { describe, it, expect } from 'vitest';
import { buildLawdIndex, resolveAddress, type LawdTable } from '../src/lib/region/lawd';

// 실제 표(content/lawd/lawd.json, 2026-11-07)와 같은 모양: 화성시는 2026년 구 설치, 세종은 시도 행 없이 3611000000 만
const TABLE: LawdTable = [
  ['1100000000', '서울특별시'], ['1168000000', '서울특별시 강남구'], ['1168010100', '서울특별시 강남구 역삼동'],
  ['4100000000', '경기도'], ['4111000000', '경기도 수원시'], ['4111700000', '경기도 수원시 영통구'],
  ['4111710700', '경기도 수원시 영통구 이의동'],
  ['4159000000', '경기도 화성시'], ['4159300000', '경기도 화성시 효행구'], ['4159325000', '경기도 화성시 효행구 봉담읍'],
  ['4159325024', '경기도 화성시 효행구 봉담읍 동화리'],
  ['4159700000', '경기도 화성시 동탄구'], ['4159711000', '경기도 화성시 동탄구 오산동'],
  ['4159500000', '경기도 화성시 병점구'], ['4159511000', '경기도 화성시 병점구 오산동'],
  ['3611000000', '세종특별자치시'], ['3611010100', '세종특별자치시 반곡동'],
  ['5000000000', '제주특별자치도'], ['5011000000', '제주특별자치도 제주시'], ['5011010100', '제주특별자치도 제주시 일도일동'],
  ['5100000000', '강원특별자치도'], ['5111000000', '강원특별자치도 춘천시'], ['5111010100', '강원특별자치도 춘천시 봉의동'],
  ['5200000000', '전북특별자치도'], ['5211100000', '전북특별자치도 전주시 완산구'], ['5211110100', '전북특별자치도 전주시 완산구 중앙동1가'],
];
const idx = buildLawdIndex(TABLE);

describe('resolveAddress', () => {
  it('지번 주소: 시군구·법정동과 남은 주소를 낸다', () => {
    expect(resolveAddress(idx, '서울특별시 강남구 역삼동 123-4번지 일원')).toEqual({
      lawdCd: '11680', code: '1168010100', sido: '서울특별시', sigungu: '강남구', dong: '역삼동', rest: '123-4번지 일원',
    });
  });
  it('도로명 주소: 법정동 없이 시군구까지만', () => {
    expect(resolveAddress(idx, '서울특별시 강남구 테헤란로 123')).toMatchObject({ lawdCd: '11680', dong: null, rest: '테헤란로 123' });
  });
  it('행정구가 있는 시: 구 코드로 잡는다', () => {
    expect(resolveAddress(idx, '경기도 수원시 영통구 이의동 1234')).toMatchObject({ lawdCd: '41117', sigungu: '수원시 영통구', dong: '이의동' });
  });
  it('읍면 아래 리까지 법정동으로 잡는다', () => {
    expect(resolveAddress(idx, '경기도 화성시 효행구 봉담읍 동화리 100')).toMatchObject({ lawdCd: '41593', dong: '봉담읍 동화리' });
  });
  it('주소에 구가 빠져도 그 시 안에서 하나로 정해지면 구 코드로 잡는다', () => {
    expect(resolveAddress(idx, '경기도 화성시 봉담읍 동화리 100')).toMatchObject({
      lawdCd: '41593', code: '4159325024', sigungu: '화성시 효행구', dong: '봉담읍 동화리', rest: '100',
    });
  });
  it('구가 빠졌는데 같은 동 이름이 두 구에 있으면 시까지만', () => {
    expect(resolveAddress(idx, '경기도 화성시 오산동 1')).toMatchObject({ lawdCd: '41590', dong: null, rest: '오산동 1' });
  });
  it('세종: 시군구가 없다', () => {
    expect(resolveAddress(idx, '세종특별자치시 반곡동 4-1생활권')).toMatchObject({ lawdCd: '36110', sido: '세종특별자치시', sigungu: null, dong: '반곡동' });
  });
  it('제주: 제주시가 시군구', () => {
    expect(resolveAddress(idx, '제주특별자치도 제주시 일도일동 1')).toMatchObject({ lawdCd: '50110', sigungu: '제주시', dong: '일도일동' });
  });
  it('시도 약칭·옛 이름도 해석한다', () => {
    expect(resolveAddress(idx, '경기 수원시 영통구 이의동 1')).toMatchObject({ lawdCd: '41117' });
    expect(resolveAddress(idx, '강원도 춘천시 봉의동 1')).toMatchObject({ lawdCd: '51110', sido: '강원특별자치도' });
    expect(resolveAddress(idx, '전라북도 전주시 완산구 중앙동1가 1')).toMatchObject({ lawdCd: '52111' });
    expect(resolveAddress(idx, '서울 강남구 역삼동')).toMatchObject({ lawdCd: '11680', dong: '역삼동', rest: '' });
    expect(resolveAddress(idx, '세종시 반곡동')).toMatchObject({ lawdCd: '36110' });
  });
  it('시군구까지 못 잡으면 null', () => {
    expect(resolveAddress(idx, '경기도 어딘가')).toBeNull();
    expect(resolveAddress(idx, '')).toBeNull();
  });
});
