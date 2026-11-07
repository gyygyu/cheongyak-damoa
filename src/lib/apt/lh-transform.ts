// LH 분양·임대 공고(목록·상세·공급) → lh_notice / lh_supply 행 (spec §5)
import { type Raw, type DbRow, str, num } from '../raw';
import { normalizeDate } from '../date';
import { type LawdIndex, resolveAddress } from '../region/lawd';

export function mergeLh(resp: unknown): Raw {
  return Array.isArray(resp) ? Object.assign({}, ...resp.filter((x) => x && typeof x === 'object')) : {};
}

const rowsOf = (v: unknown): Raw[] => (Array.isArray(v) ? (v as Raw[]) : []);

export const lhListItems = (resp: unknown): Raw[] => rowsOf(mergeLh(resp).dsList);

const KIND: Record<string, 'sale' | 'rent'> = { '05': 'sale', '06': 'rent' };
const cleanTitle = (t: string) => t.replace(/^(\s*\[[^\]]*\]\s*)+/, '').trim();
const dates = (vals: (string | null)[]) => vals.map((v) => normalizeDate(v)).filter((d): d is string => !!d).sort();
const first = (a: string[]) => a[0] ?? null;
const last = (a: string[]) => a[a.length - 1] ?? null;

export function toLhNoticeRow(item: Raw, detail: Raw | null, idx: LawdIndex): DbRow | null {
  const id = str(item.PAN_ID), title = str(item.PAN_NM);
  const kind = KIND[str(item.UPP_AIS_TP_CD) ?? ''];
  if (!id || !title || !kind) return null;
  const row: DbRow = {
    lh_id: id, title: cleanTitle(title), kind, sub_kind: str(item.AIS_TP_CD_NM),
    upp_ais_tp_cd: str(item.UPP_AIS_TP_CD), spl_inf_tp_cd: str(item.SPL_INF_TP_CD), ccr_cnnt_sys_ds_cd: str(item.CCR_CNNT_SYS_DS_CD),
    sido: str(item.CNP_CD_NM), sigungu: null, lawd_cd: null, address: null,
    posted_date: normalizeDate(str(item.PAN_NT_ST_DT)), receipt_start: null, receipt_end: normalizeDate(str(item.CLSG_DT)),
    winner_date: null, contract_start: null, contract_end: null,
    url: str(item.DTL_URL), state: str(item.PAN_SS), pblanc_no: null,
  };
  if (!detail) return row;
  const address = str(rowsOf(detail.dsSbd)[0]?.LCT_ARA_ADR);
  row.address = address;
  const loc = address ? resolveAddress(idx, address) : null;
  if (loc) Object.assign(row, { sido: loc.sido, sigungu: loc.sigungu, lawd_cd: loc.lawdCd });
  const sch = rowsOf(detail.dsSplScdl);
  const acp = sch.map((s) => (str(s.ACP_DTTM) ?? '').split('~').map((x) => x.trim()));
  const starts = dates(acp.map((p) => p[0] || null)), ends = dates(acp.map((p) => p[1] || p[0] || null));
  if (starts.length) row.receipt_start = first(starts);
  if (ends.length) row.receipt_end = last(ends);
  row.winner_date = first(dates(sch.map((s) => str(s.PZWR_ANC_DT))));
  row.contract_start = first(dates(sch.map((s) => str(s.CTRT_ST_DT))));
  row.contract_end = last(dates(sch.map((s) => str(s.CTRT_ED_DT))));
  return row;
}

// 원 → 만원 (반올림)
const man = (v: unknown): number | null => { const n = num(v); return n === null ? null : Math.round(n / 10_000); };

export function toLhSupplyRows(lhId: string, supply: Raw): DbRow[] {
  return ['01', '02', '03', '04', '05'].flatMap((t) =>
    rowsOf(supply[`dsList${t}`]).flatMap((r) => {
      const ty = str(r.HTY_NM);
      if (!ty) return [];
      const h = num(r.SIL_HSH_CNT);
      return [{
        lh_id: lhId, supply_type: t, house_ty: ty, area_excl: num(r.RSDN_DDO_AR), households: h === null ? null : Math.round(h),
        price: man(r.SIL_AMT), deposit: man(r.LS_GMY), monthly_rent: man(r.MM_RFE),
      }];
    }),
  );
}
