// 경쟁률 모음·지역·실거래 화면 (spec §7)
import type { CompetitionBundle, AccountRow, NoticeSummary, SidoBundle, SigunguBundle, TradeBundle, TradeItem } from './bundle-types';
import { SIDO_ALIAS } from '../region/lawd';
import { formatArea, formatManwon } from '../units';
import { formatDay, formatRate, formatCount, PHASE_LABEL } from './format';
import { hrefOf } from './calendar';

export const SIDO_LIST: string[] = [...new Set(Object.values(SIDO_ALIAS))];

export const regionHref = (sido: string, sigungu?: string): string =>
  `/region/${encodeURIComponent(sido)}${sigungu ? `/${encodeURIComponent(sigungu)}` : ''}`;
export const tradeHref = (lawdCd: string, dong: string): string => `/trade/${encodeURIComponent(lawdCd)}/${encodeURIComponent(dong)}`;

const place = (a: string | null, b: string | null) => [a, b].filter(Boolean).join(' ');

export function competitionRows(b: CompetitionBundle | null) {
  return (b?.items ?? []).map((c) => ({
    name: c.name ?? c.pblancNo, href: hrefOf(`apt:${c.pblancNo}`) ?? '/competition', place: place(c.sido, c.sigungu),
    noticeDate: formatDay(c.noticeDate), rate: formatRate(c.maxRate, null), applicants: formatCount(c.applicants), supply: formatCount(c.supply),
  }));
}

// BLNC_SECD — 실응답(sync/fixtures/account-stats)으로 확인한 값만 적는다. 나머지는 코드 그대로
export const AREA_KIND_LABEL: Record<string, string> = { '01': '85㎡ 이하', '02': '102㎡ 이하', '03': '135㎡ 이하', '04': '모든 면적' };

export function accountRows(rows: AccountRow[]) {
  return rows.map((r) => ({
    region: r.region, kind: r.account_kind,
    area: r.area_kind ? AREA_KIND_LABEL[r.area_kind] ?? `면적 구분 ${r.area_kind}` : '-',
    subscribers: formatCount(r.subscribers), rank1: formatCount(r.rank1), rank2: formatCount(r.rank2),
  }));
}

// 공고가 없어 region:{시도} 묶음이 없는 시도 — stats:account 에서 고른다 (sync/bundles.ts sidoOfRegion 과 같은 규칙)
export const sidoAccountRows = (rows: AccountRow[], sido: string): AccountRow[] =>
  rows.filter((r) => { const w = r.region.split(' ')[0]; return (SIDO_ALIAS[w] ?? w) === sido; });

// 청약통장 통계(all) 실응답의 묶음 지역(SUBSCRPT_AREA_CODE_NM, sync/fixtures/account-stats/all.json 철자) → 시도(SIDO_LIST 값).
// 5대광역시는 부산·대구·광주·대전·울산. 광주+전남이 합친 전남광주통합특별시는 옛 광주(5대광역시)·옛 전남(기타지역) 둘 다,
// 세종은 광역시가 아니라 기타지역에 둔다
export const ACCOUNT_GROUP_SIDO: Record<string, readonly string[]> = {
  '인천·경기': ['인천광역시', '경기도'],
  '5대광역시': ['부산광역시', '대구광역시', '전남광주통합특별시', '대전광역시', '울산광역시'],
  '기타지역': ['세종특별자치시', '강원특별자치도', '충청북도', '충청남도', '전북특별자치도', '전남광주통합특별시', '경상북도', '경상남도', '제주특별자치도'],
};

// 시도 화면의 청약통장 줄: region:{시도} 묶음 줄 → stats:account 의 그 시도 줄 → 없으면 그 시도가 든 묶음 지역 줄(어느 묶음인지 밝힘)
export function sidoAccount(statsRows: AccountRow[], sido: string, bundleRows?: AccountRow[] | null): { rows: AccountRow[]; note: string | null } {
  const own = bundleRows?.length ? bundleRows : sidoAccountRows(statsRows, sido);
  if (own.length) return { rows: own, note: null };
  const groups = Object.keys(ACCOUNT_GROUP_SIDO).filter((g) => ACCOUNT_GROUP_SIDO[g].includes(sido));
  const rows = statsRows.filter((r) => groups.includes(r.region));
  const shown = groups.filter((g) => rows.some((r) => r.region === g));
  return { rows, note: shown.length ? `이 시도 단독 통계가 없어 ${shown.map((g) => `'${g}'`).join('·')} 묶음 통계를 보여 줍니다.` : null };
}

export function noticeRows(list: NoticeSummary[]) {
  return list.map((n) => ({
    name: n.name ?? n.pblancNo ?? '-', href: n.pblancNo ? hrefOf(`apt:${n.pblancNo}`) : null,
    sigungu: n.sigungu ?? '-', noticeDate: formatDay(n.noticeDate), phase: n.phase ? PHASE_LABEL[n.phase] : '-',
  }));
}

export function sigunguLinks(b: SidoBundle) {
  const names = [...new Set(b.notices.map((n) => n.sigungu).filter((v): v is string => !!v))].sort((x, y) => x.localeCompare(y, 'ko'));
  return names.map((name) => ({ name, href: regionHref(b.sido, name) }));
}

export function dongRows(b: SigunguBundle) {
  return b.dongs.map((d) => ({ dong: d.dong, href: tradeHref(d.lawdCd, d.dong), count: formatCount(d.count), last: formatDay(d.last || null) }));
}

export interface TradeView {
  title: string;
  complexes: { name: string; buildYear: string; areas: { area: string; rows: { date: string; floor: string; amount: string; cancelled: boolean }[] }[] }[];
}

const byDateDesc = (a: TradeItem, b: TradeItem) => (b.date ?? '').localeCompare(a.date ?? '');

export function tradeView(b: TradeBundle): TradeView {
  return {
    title: `${b.dong} 아파트 실거래`,
    complexes: b.complexes.map((c) => {
      const groups = new Map<number | null, TradeItem[]>();
      for (const t of c.trades) {
        const k = t.area === null ? null : Math.round(t.area * 100) / 100;
        groups.set(k, [...(groups.get(k) ?? []), t]);
      }
      const keys = [...groups.keys()].sort((x, y) => (x ?? Infinity) - (y ?? Infinity));
      return {
        name: c.name,
        buildYear: c.buildYear !== null ? `${c.buildYear}년 준공` : '-',
        areas: keys.map((k) => ({
          area: k === null ? '-' : formatArea(k),
          rows: [...(groups.get(k) ?? [])].sort(byDateDesc).map((t) => ({
            date: formatDay(t.date), floor: t.floor !== null ? `${t.floor}층` : '-',
            amount: t.amount !== null ? formatManwon(t.amount) : '-', cancelled: t.cancelled,
          })),
        })),
      };
    }),
  };
}
