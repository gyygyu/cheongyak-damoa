// 청약홈 경쟁률(getAPTLttotPblancCmpet)·특공 신청현황(getAPTSpsplyReqstStus) → 행 (spec §5)
import { str, int, num, type Raw, type DbRow } from '../raw';

export function residenceOf(name: unknown): 'local' | 'province' | 'other' | 'all' {
  const t = str(name) ?? '';
  if (t.startsWith('해당')) return 'local';
  if (t.startsWith('기타경기')) return 'province';
  if (t.startsWith('기타')) return 'other';
  return 'all';
}

export function toCompetitionRow(raw: Raw): DbRow | null {
  const pblancNo = str(raw.PBLANC_NO);
  const modelNo = str(raw.MODEL_NO);
  const rank = int(raw.SUBSCRPT_RANK_CODE);
  if (!pblancNo || !modelNo || rank === null) return null;
  const rateText = raw.CMPET_RATE === null || raw.CMPET_RATE === undefined ? null : String(raw.CMPET_RATE).trim() || null;
  return {
    pblanc_no: pblancNo,
    model_no: modelNo,
    rank,
    residence: residenceOf(raw.RESIDE_SENM),
    supply_count: int(raw.SUPLY_HSHLDCO),
    applicants: int(raw.REQ_CNT),
    rate: num(raw.CMPET_RATE),
    rate_text: rateText,
  };
}

// [유형, 신청 수 필드 꼬리, 배정 세대수 필드]
const TYPES = [
  ['multichild', 'MNYCH_CNT', 'MNYCH_HSHLDCO'],
  ['newlywed', 'NWWDS_NMTW_CNT', 'NWWDS_NMTW_HSHLDCO'],
  ['first_life', 'LFE_FRST_CNT', 'LFE_FRST_HSHLDCO'],
  ['elderly_parent', 'OPS_CNT', 'OLD_PARNTS_SUPORT_HSHLDCO'],
  ['newborn', 'NWBB_NWBBSHR_CNT', 'NWBB_NWBBSHR_HSHLDCO'],
  ['youth', 'YGMN_CNT', 'YGMN_HSHLDCO'],
] as const;
const AREAS = [['local', 'CRSPAREA'], ['province', 'CTPRVN'], ['other', 'ETC_AREA']] as const;

export function toSpecialStatusRows(raw: Raw, modelNoOf: (pblancNo: string, houseTy: string) => string | null): DbRow[] {
  const pblancNo = str(raw.PBLANC_NO);
  const houseTy = str(raw.HOUSE_TY);
  if (!pblancNo || !houseTy) return [];
  const modelNo = modelNoOf(pblancNo, houseTy) ?? houseTy;
  const base = { pblanc_no: pblancNo, model_no: modelNo };
  const out: DbRow[] = [];
  for (const [type, cnt, hh] of TYPES) {
    let sum: number | null = null;
    for (const [residence, prefix] of AREAS) {
      const applicants = int(raw[`${prefix}_${cnt}`]);
      if (applicants !== null) sum = (sum ?? 0) + applicants;
      out.push({ ...base, special_type: type, residence, allotted: null, applicants });
    }
    out.push({ ...base, special_type: type, residence: 'all', allotted: int(raw[hh]), applicants: sum });
  }
  out.push({ ...base, special_type: 'institution', residence: 'all', allotted: int(raw.INSTT_RECOMEND_HSHLDCO), applicants: int(raw.INSTT_RECOMEND_DCSN_CNT) });
  return out;
}
