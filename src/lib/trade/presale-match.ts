// 분양권 거래 ↔ 청약홈 공고 (spec §9): 1차 시군구+법정동+지번, 2차 같은 시군구 안 정규화 단지명(후보 하나일 때만)
import { normalizeComplexName } from '../normalize-name';
import { parseJibun, jibunKey, type Jibun } from '../region/jibun';

export interface PresaleTradeLoc { sggCd: string; dong: string; jibun: string; name: string }
export interface NoticeLoc { pblancNo: string; lawdCd: string | null; dong: string | null; jibun: Jibun | null; name: string }
export type PresaleMatch = { pblancNo: string | null; method: 'jibun' | 'name' | 'none' };

export function matchPresale(trade: PresaleTradeLoc, notices: NoticeLoc[]): PresaleMatch {
  const sameSgg = notices.filter((n) => n.lawdCd === trade.sggCd);
  const j = parseJibun(trade.jibun);
  if (j) {
    const key = jibunKey(j);
    const hits = sameSgg.filter((n) => n.dong === trade.dong && n.jibun && jibunKey(n.jibun) === key);
    if (hits.length === 1) return { pblancNo: hits[0].pblancNo, method: 'jibun' };
  }
  // 시 단위로만 해석된 공고(구가 있는 시, 끝자리 0 — 예 화성 41590)는 그 시의 구(41593·41597) 거래와도 이름으로 맞춘다
  const cityCd = `${trade.sggCd.slice(0, 4)}0`;
  const nameScope = cityCd === trade.sggCd ? sameSgg : [...sameSgg, ...notices.filter((n) => n.lawdCd === cityCd)];
  const name = normalizeComplexName(trade.name);
  const byName = nameScope.filter((n) => normalizeComplexName(n.name) === name);
  if (byName.length === 1) return { pblancNo: byName[0].pblancNo, method: 'name' };
  return { pblancNo: null, method: 'none' };
}
