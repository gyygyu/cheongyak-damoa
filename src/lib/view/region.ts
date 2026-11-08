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
