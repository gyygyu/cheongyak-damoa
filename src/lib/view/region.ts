// 경쟁률 모음·지역·실거래 화면 (spec §7)
import type { CompSummary, CompetitionBundle, AccountRow, NoticeSummary, SidoBundle, SigunguBundle, TradeBundle, TradeItem } from './bundle-types';
import { SIDO_ALIAS } from '../region/lawd';
import { formatArea, formatManwon } from '../units';
import { formatDay, formatRate, formatCount, PHASE_LABEL } from './format';
import { hrefOf } from './calendar';

export const SIDO_LIST: string[] = [...new Set(Object.values(SIDO_ALIAS))];

// /region/{이름} 의 이름 → 대표 시도 이름(SIDO_LIST 값). 짧은 이름·옛 이름은 lawd.ts SIDO_ALIAS 와 아래 '…시' 꼴.
// '광주시'는 경기도 광주시와 겹쳐 받지 않는다. 모르는 이름은 null(→ 404)
const SIDO_EXTRA: Record<string, string> = {
  서울시: '서울특별시', 부산시: '부산광역시', 대구시: '대구광역시', 인천시: '인천광역시', 대전시: '대전광역시', 울산시: '울산광역시',
  광주전남: '전남광주통합특별시', 전남광주: '전남광주통합특별시',
};
export function resolveSido(name: string): string | null {
  const t = name.normalize('NFC').trim();
  if (!t) return null;
  if (SIDO_LIST.includes(t)) return t;
  return SIDO_ALIAS[t] ?? SIDO_EXTRA[t] ?? null;
}

export const regionHref = (sido: string, sigungu?: string): string =>
  `/region/${encodeURIComponent(sido)}${sigungu ? `/${encodeURIComponent(sigungu)}` : ''}`;
export const tradeHref = (lawdCd: string, dong: string): string => `/trade/${encodeURIComponent(lawdCd)}/${encodeURIComponent(dong)}`;

const place = (a: string | null, b: string | null) => [a, b].filter(Boolean).join(' ');

// 미달 배지: 모든 주택형이 접수 < 공급이면 '미달', 일부면 '일부 미달'. 경쟁률 숫자가 없으면 '-' 대신 배지만 보인다
function shortLabel(c: CompSummary): '미달' | '일부 미달' | null {
  if (!c.models || !c.shortModels) return null;
  return c.shortModels >= c.models ? '미달' : '일부 미달';
}

export function competitionRows(b: CompetitionBundle | null) {
  return (b?.items ?? []).map((c) => {
    const short = shortLabel(c);
    return {
      name: c.name ?? c.pblancNo, href: hrefOf(`apt:${c.pblancNo}`) ?? '/competition', place: place(c.sido, c.sigungu),
      noticeDate: formatDay(c.noticeDate), rate: c.maxRate === null && short ? '' : formatRate(c.maxRate, null),
      applicants: formatCount(c.applicants), supply: formatCount(c.supply), short,
    };
  });
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

export interface TradeRow { area: string; date: string; floor: string; amount: string; cancelled: boolean }
export interface TradeView {
  title: string;
  period: string | null; // 묶음에 실제로 든 계약 달 (예: '2026년 10월', '2026.08–10')
  complexes: { name: string; buildYear: string; rows: TradeRow[] }[];
}

const byDateDesc = (a: TradeItem, b: TradeItem) => (b.date ?? '').localeCompare(a.date ?? '');

// 실거래 묶음은 최근 12개월 창으로 만들지만, 과거 자료를 채우는 중이라 실제로 든 달만 적는다
export function tradePeriod(b: TradeBundle): string | null {
  const months = b.complexes.flatMap((c) => c.trades.map((t) => t.date?.slice(0, 7) ?? '')).filter((m) => /^\d{4}-\d{2}$/.test(m)).sort();
  if (!months.length) return null;
  const [first, last] = [months[0], months.at(-1)!];
  if (first === last) return `${first.slice(0, 4)}년 ${Number(first.slice(5))}월`;
  const dot = (m: string) => m.replace('-', '.');
  return `${dot(first)}–${first.slice(0, 4) === last.slice(0, 4) ? last.slice(5) : dot(last)}`;
}

// 단지마다 표 하나: 면적 작은 것부터, 같은 면적은 최근 거래 먼저
export function tradeView(b: TradeBundle): TradeView {
  const areaKey = (t: TradeItem) => (t.area === null ? Infinity : Math.round(t.area * 100) / 100);
  return {
    title: `${b.dong} 아파트 실거래`,
    period: tradePeriod(b),
    complexes: b.complexes.map((c) => ({
      name: c.name,
      buildYear: c.buildYear !== null ? `${c.buildYear}년 준공` : '-',
      rows: [...c.trades].sort((x, y) => areaKey(x) - areaKey(y) || byDateDesc(x, y)).map((t) => ({
        area: t.area === null ? '-' : formatArea(Math.round(t.area * 100) / 100),
        date: formatDay(t.date), floor: t.floor !== null ? `${t.floor}층` : '-',
        amount: t.amount !== null ? formatManwon(t.amount) : '-', cancelled: t.cancelled,
      })),
    })),
  };
}
