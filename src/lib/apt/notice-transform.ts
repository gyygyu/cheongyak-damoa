// 청약홈 분양정보(getAPTLttotPblancDetail·getAPTLttotPblancMdl) → apt_notice·apt_model 행 (spec §5)
import { normalizeDate } from '../date';
import { resolveAddress, type LawdIndex } from '../region/lawd';
import { str, int, num, yn, type Raw, type DbRow } from '../raw';

// 순위 접수일: 해당지역(CRSPAREA)·기타경기(ETC_GG)·기타지역(ETC_AREA)
const AREAS = [['local', 'CRSPAREA'], ['province', 'ETC_GG'], ['other', 'ETC_AREA']] as const;

function rankRange(raw: Raw, rank: 1 | 2) {
  const byArea: Record<string, [string, string]> = {};
  const starts: string[] = [];
  const ends: string[] = [];
  for (const [name, code] of AREAS) {
    const s = normalizeDate(str(raw[`GNRL_RNK${rank}_${code}_RCPTDE`]));
    const e = normalizeDate(str(raw[`GNRL_RNK${rank}_${code}_ENDDE`])) ?? s;
    if (!s || !e) continue;
    byArea[name] = [s, e];
    starts.push(s);
    ends.push(e);
  }
  starts.sort();
  ends.sort();
  return { start: starts[0] ?? null, end: ends[ends.length - 1] ?? null, byArea };
}

const date = (v: unknown) => normalizeDate(str(v));

export function moveInYm(v: unknown): string | null {
  const t = str(v);
  return t && /^\d{6}$/.test(t) ? `${t.slice(0, 4)}-${t.slice(4)}` : null;
}

export function toNoticeRow(raw: Raw, idx: LawdIndex): DbRow | null {
  const pblancNo = str(raw.PBLANC_NO);
  const name = str(raw.HOUSE_NM);
  if (!pblancNo || !name) return null;
  const address = str(raw.HSSPLY_ADRES);
  const loc = address ? resolveAddress(idx, address) : null;
  const r1 = rankRange(raw, 1);
  const r2 = rankRange(raw, 2);
  return {
    pblanc_no: pblancNo,
    house_manage_no: str(raw.HOUSE_MANAGE_NO) ?? pblancNo,
    name,
    house_kind: str(raw.HOUSE_SECD_NM),
    rent_kind: str(raw.RENT_SECD_NM),
    area_code: str(raw.SUBSCRPT_AREA_CODE),
    sido: loc?.sido ?? null,
    sigungu: loc?.sigungu ?? null,
    address,
    lawd_cd: loc?.lawdCd ?? null,
    dong: loc?.dong ?? null,
    supply_kind: str(raw.HOUSE_DTL_SECD) === '03' ? 'national' : 'private',
    public_land: yn(raw.PUBLIC_HOUSE_EARTH_AT),
    price_cap: yn(raw.PARCPRC_ULS_AT),
    speculative: yn(raw.SPECLT_RDN_EARTH_AT),
    adjusted: yn(raw.MDAT_TRGET_AREA_SECD),
    notice_date: date(raw.RCRIT_PBLANC_DE),
    special_start: date(raw.SPSPLY_RCEPT_BGNDE),
    special_end: date(raw.SPSPLY_RCEPT_ENDDE),
    rank1_start: r1.start,
    rank1_end: r1.end,
    rank2_start: r2.start,
    rank2_end: r2.end,
    rank_dates: JSON.stringify({ rank1: r1.byArea, rank2: r2.byArea }),
    winner_date: date(raw.PRZWNER_PRESNATN_DE),
    contract_start: date(raw.CNTRCT_CNCLS_BGNDE),
    contract_end: date(raw.CNTRCT_CNCLS_ENDDE),
    move_in_ym: moveInYm(raw.MVN_PREARNGE_YM),
    total_households: int(raw.TOT_SUPLY_HSHLDCO),
    url: str(raw.PBLANC_URL),
    state: name.includes('정정') ? 'corrected' : 'normal',
  };
}

// 주택형 "084.3473A" → 전용면적 84.3473
export function houseTyArea(houseTy: string): number | null {
  const m = houseTy.trim().match(/^(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

const SPECIAL_COUNTS = {
  multichild: 'MNYCH_HSHLDCO', newlywed: 'NWWDS_HSHLDCO', first_life: 'LFE_FRST_HSHLDCO',
  elderly_parent: 'OLD_PARNTS_SUPORT_HSHLDCO', newborn: 'NWBB_HSHLDCO', youth: 'YGMN_HSHLDCO',
  institution: 'INSTT_RECOMEND_HSHLDCO', transfer: 'TRANSR_INSTT_ENFSN_HSHLDCO', etc: 'ETC_HSHLDCO',
  total: 'SPSPLY_HSHLDCO',
} as const;

export function toModelRow(raw: Raw): DbRow | null {
  const pblancNo = str(raw.PBLANC_NO);
  const modelNo = str(raw.MODEL_NO);
  const houseTy = str(raw.HOUSE_TY);
  if (!pblancNo || !modelNo || !houseTy) return null;
  const special: Record<string, number | null> = {};
  for (const [k, f] of Object.entries(SPECIAL_COUNTS)) special[k] = int(raw[f]);
  return {
    pblanc_no: pblancNo,
    model_no: modelNo,
    house_ty: houseTy,
    area_excl: houseTyArea(houseTy),
    area_supply: num(raw.SUPLY_AR),
    general_count: int(raw.SUPLY_HSHLDCO),
    special_counts: JSON.stringify(special),
    top_price: int(raw.LTTOT_TOP_AMOUNT),
  };
}
