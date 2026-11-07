import { describe, it, expect } from 'vitest';
import { matchLh, type AptNoticeLoc } from '../src/lib/apt/lh-match';

const notices: AptNoticeLoc[] = [
  { pblancNo: 'P1', lawdCd: '41590', noticeDate: '2026-11-05', name: '화성동탄2 A-62블록 신혼희망타운' },
  { pblancNo: 'P2', lawdCd: '41590', noticeDate: '2026-11-05', name: '화성태안3 B-2블록' },
];
const lh = { id: 'L1', kind: 'sale' as const, lawdCd: '41590', noticeDate: '2026-11-08', name: '화성동탄2 A-62블록 신혼희망타운' };

describe('matchLh', () => {
  it('시군구 같고 공고일 3일 이내이고 이름 같으면 맞춘다 (3일 경계 포함)', () => {
    expect(matchLh(lh, notices)).toBe('P1');
  });
  it('공고일이 4일 차이면 맞추지 않는다', () => {
    expect(matchLh({ ...lh, noticeDate: '2026-11-09' }, notices)).toBeNull();
  });
  it('후보가 둘 이상이면 맞추지 않는다', () => {
    const dup = [...notices, { ...notices[0], pblancNo: 'P9', noticeDate: '2026-11-06' }];
    expect(matchLh(lh, dup)).toBeNull();
  });
  it('임대 공고는 맞추지 않는다', () => {
    expect(matchLh({ ...lh, kind: 'rent' }, notices)).toBeNull();
  });
  it('시군구나 공고일을 모르면 맞추지 않는다', () => {
    expect(matchLh({ ...lh, lawdCd: null }, notices)).toBeNull();
    expect(matchLh({ ...lh, noticeDate: null }, notices)).toBeNull();
  });
  it('한쪽이 시 단위(41590)·다른 쪽이 그 시의 구(41597)여도 맞춘다', () => {
    expect(matchLh({ ...lh, lawdCd: '41597' }, notices)).toBe('P1');
    expect(matchLh({ ...lh, lawdCd: '41610' }, notices)).toBeNull();
  });
});
