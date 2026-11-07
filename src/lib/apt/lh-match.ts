// LH 분양 공고 ↔ 청약홈 공고 (spec §9): 시군구 같고, 모집공고일 3일 이내, 정규화 단지명 같음. 후보가 하나일 때만.
import { daysBetween } from '../date';
import { normalizeComplexName } from '../normalize-name';
import { sameSigungu } from '../region/lawd';

export interface LhNoticeLoc { id: string; kind: 'sale' | 'rent'; lawdCd: string | null; noticeDate: string | null; name: string }
export interface AptNoticeLoc { pblancNo: string; lawdCd: string | null; noticeDate: string | null; name: string }

const MAX_DAYS = 3;

export function matchLh(lh: LhNoticeLoc, notices: AptNoticeLoc[], cityOf: ReadonlyMap<string, string>): string | null {
  if (lh.kind !== 'sale' || !lh.lawdCd || !lh.noticeDate) return null;
  const name = normalizeComplexName(lh.name);
  const hits = notices.filter((n) =>
    sameSigungu(n.lawdCd, lh.lawdCd, cityOf) && n.noticeDate &&
    Math.abs(daysBetween(n.noticeDate, lh.noticeDate!)) <= MAX_DAYS &&
    normalizeComplexName(n.name) === name);
  return hits.length === 1 ? hits[0].pblancNo : null;
}
