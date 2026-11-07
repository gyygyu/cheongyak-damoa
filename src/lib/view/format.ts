// 화면 표시 형식 (spec §7). 면적·금액은 src/lib/units.ts 의 formatArea·formatManwon 을 쓴다
import type { EventKind } from '../apt/schedule';
import type { AptPhase } from '../apt/status';

// 경로 파라미터 → KV 키 조각. Astro 가 풀어 주지 않은 경우까지 처리하고, 못 쓰는 값은 null(→ 404)
export function safeParam(v: string | undefined): string | null {
  if (!v) return null;
  let out = v;
  if (v.includes('%')) {
    try { out = decodeURIComponent(v); } catch { return null; }
  }
  out = out.normalize('NFC').trim();
  if (!out || out.length > 100 || out.includes(':')) return null;
  return out;
}

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function formatDay(d: string | null): string {
  const m = d ? DATE_RE.exec(d) : null;
  if (!m) return '-';
  const w = WEEK[new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay()];
  return `${m[1]}.${m[2]}.${m[3]}(${w})`;
}

export function formatRange(a: string | null, b?: string | null): string {
  if (!a) return b ? formatDay(b) : '-';
  if (!b || b === a) return formatDay(a);
  const end = formatDay(b);
  return `${formatDay(a)} ~ ${a.slice(0, 4) === b.slice(0, 4) ? end.slice(5) : end}`;
}

export function formatRate(rate: number | null, text: string | null): string {
  if (rate !== null && Number.isFinite(rate)) return `${rate.toLocaleString('ko-KR', { maximumFractionDigits: 2 })} : 1`;
  return text && text.trim() ? text.trim() : '-';
}

export const formatCount = (n: number | null | undefined): string =>
  typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString('ko-KR') : '-';

export function formatHouseTy(t: string | null): string {
  if (!t) return '-';
  const m = /^0*(\d+)\.(\d+)([A-Za-z]*)$/.exec(t.trim());
  if (!m) return t;
  return `${Number(`${m[1]}.${m[2]}`)}${m[3]}`;
}

export const KIND_LABEL: Record<EventKind, string> = {
  special: '특별공급', rank1: '1순위', rank2: '2순위', winner: '당첨자 발표', contract: '계약',
  'lh-receipt': 'LH 접수', 'ipo-sub': '공모주 청약', 'ipo-refund': '공모주 환불', 'ipo-listing': '상장', 'ipo-lockup': '보호예수 해제',
};
export const PHASE_LABEL: Record<AptPhase, string> = { upcoming: '접수 예정', open: '접수 중', closed: '접수 마감', cancelled: '취소' };
export const RESIDENCE_LABEL: Record<string, string> = { local: '해당지역', province: '기타경기', other: '기타지역', all: '전체' };
export const SPECIAL_LABEL: Record<string, string> = {
  multichild: '다자녀', newlywed: '신혼부부', first_life: '생애최초', elderly_parent: '노부모 부양',
  newborn: '신생아', youth: '청년', institution: '기관추천', transfer: '이전기관', etc: '기타',
};

export const labelOr = (map: Record<string, string>, key: string | null | undefined): string => (key ? map[key] ?? key : '-');
