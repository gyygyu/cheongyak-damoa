// KV 묶음 모양 — sync/bundles.ts buildBundles 가 만드는 값 (D1 열 이름 그대로, hash·updated_at 뺌)
import type { CalendarEvent } from '../apt/schedule';
import type { AptPhase } from '../apt/status';
import type { NearbyResult } from '../trade/nearby';

type S = string | null;
type N = number | null;

export interface AptNoticeRow {
  pblanc_no: string; house_manage_no: S; name: string; house_kind: S; rent_kind: S; area_code: S;
  sido: S; sigungu: S; address: S; lawd_cd: S; dong: S;
  supply_kind: 'national' | 'private' | null; public_land: N; price_cap: N; speculative: N; adjusted: N;
  notice_date: S; special_start: S; special_end: S; rank1_start: S; rank1_end: S; rank2_start: S; rank2_end: S;
  rank_dates: S; winner_date: S; contract_start: S; contract_end: S; move_in_ym: S; total_households: N;
  url: S; state: string;
}
export interface AptModelRow {
  pblanc_no: string; model_no: string; house_ty: S; area_excl: N; area_supply: N;
  general_count: N; special_counts: S; top_price: N; // top_price 만원
  nearby: NearbyResult | null;
}
export interface CompetitionRow { pblanc_no: string; model_no: string; rank: number; residence: string; supply_count: N; applicants: N; rate: N; rate_text: S }
export interface SpecialRow { pblanc_no: string; model_no: string; special_type: string; residence: string; allotted: N; applicants: N }
export interface PresaleRow { trade_key: string; sgg_cd: string; dong: string; jibun: S; name: string; area: number; floor: N; contract_date: string; amount: number; kind: S; cancelled: number }
export interface AptBundle {
  notice: AptNoticeRow; phase: AptPhase; corrected: boolean; models: AptModelRow[];
  competition: CompetitionRow[]; special: SpecialRow[];
  lhLinks: { lhId: S; title: S; url: S }[]; presale: PresaleRow[]; truncated?: boolean;
}

export interface LhNoticeRow {
  lh_id: string; title: string; kind: S; sub_kind: S; sido: S; sigungu: S; lawd_cd: S; address: S; posted_date: S;
  receipt_start: S; receipt_end: S; winner_date: S; contract_start: S; contract_end: S; url: S; state: S; pblanc_no: S;
}
export interface LhSupplyRow { lh_id: string; supply_type: S; house_ty: S; area_excl: N; households: N; price: N; deposit: N; monthly_rent: N } // 금액 만원
export interface LhBundle { notice: LhNoticeRow; supply: LhSupplyRow[]; truncated?: boolean }

export interface CalendarBundle { month: string; events: CalendarEvent[]; truncated?: boolean }
// supply 는 주택형별 일반공급 세대수 합, models·shortModels(접수 < 공급인 주택형 수)는 2026-11-08 이후 묶음에만 있다
export interface CompSummary { pblancNo: string; name: S; sido: S; sigungu: S; noticeDate: S; maxRate: N; applicants: number; supply: number; models?: number; shortModels?: number }
export interface HomeBundle { today: string; events: CalendarEvent[]; topCompetition: CompSummary[]; truncated?: boolean }
export interface CompetitionBundle { items: CompSummary[]; truncated?: boolean }

export interface AccountRow { base_month: string; region: string; account_kind: string; area_kind: string; subscribers: N; rank1: N; rank2: N }
export interface AccountBundle { baseMonth: S; rows: AccountRow[]; truncated?: boolean }

export interface NoticeSummary { pblancNo: S; name: S; sigungu: S; noticeDate: S; phase: AptPhase | null }
export interface SidoBundle { sido: string; notices: NoticeSummary[]; account: AccountRow[]; truncated?: boolean }
export interface SigunguBundle { notices: NoticeSummary[]; dongs: { lawdCd: string; dong: string; count: number; last: string }[]; truncated?: boolean }

export interface TradeItem { date: S; area: N; floor: N; amount: N; cancelled: boolean } // amount 만원
export interface TradeComplex { name: string; buildYear: N; trades: TradeItem[] }
export interface TradeBundle { lawdCd: string; dong: string; complexes: TradeComplex[]; truncated?: boolean }

// 공모주 — 아직 생산자 없음(DART 키 없음, 보호예수 수집 꺼짐). migrations/0001 ipo·ipo_lockup 열 이름
export interface IpoRow {
  corp_code: string; name: string; stock_code: S; market: S; sub_start: S; sub_end: S;
  price_low: N; price_high: N; price_final: N; listing_date: S; underwriters: S; offer_shares: N; revisions: S; state: string;
}
export interface IpoLockupRow { release_date: string; share_kind: string; shares: N }
export interface IpoBundle { ipo: IpoRow; lockup?: IpoLockupRow[] }
