// 분양권 거래 ↔ 청약홈 공고 (spec §9): 1차 시군구+법정동+지번, 2차 같은 시군구 안 정규화 단지명(후보 하나일 때만)
import { normalizeComplexName } from '../normalize-name';
import { parseJibun, jibunKey, type Jibun } from '../region/jibun';
import { sameSigungu } from '../region/lawd';

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
  // 이름은 시 단위로만 해석된 공고(화성 41590)도 그 시의 구 거래와 맞춘다 (sameSigungu)
  const name = normalizeComplexName(trade.name);
  const byName = notices.filter((n) => sameSigungu(n.lawdCd, trade.sggCd)).filter((n) => normalizeComplexName(n.name) === name);
  if (byName.length === 1) return { pblancNo: byName[0].pblancNo, method: 'name' };
  return { pblancNo: null, method: 'none' };
}
