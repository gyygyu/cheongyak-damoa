// 단지 상세 (spec §7, §9). 시세 문구는 사실만 — 평가어 금지(BANNED_WORDS 시험)
import type { AptBundle, AptNoticeRow, CompetitionRow } from './bundle-types';
import type { NearbyResult } from '../trade/nearby';
import { formatArea, formatManwon, perSqmToPerPyeong } from '../units';
import { formatRange, formatDay, formatRate, formatCount, formatHouseTy, labelOr, RESIDENCE_LABEL, SPECIAL_LABEL, PHASE_LABEL } from './format';

export const BANNED_WORDS = /차익|싸다|싸게|비싸|저렴|이득|유리|추천|저평가|고평가/;

export interface Banner { kind: 'closed' | 'cancelled'; text: string }
export interface InfoRow { label: string; value: string }
export interface ModelView { modelNo: string; houseTy: string; area: string; general: string; special: string; topPrice: string; perSqm: string; perPyeong: string; nearby: string; eligibilityHref: string }
export interface AptView {
  title: string; place: string; phaseLabel: string; corrected: boolean; banner: Banner | null;
  schedule: InfoRow[]; moveIn: string | null; facts: InfoRow[]; models: ModelView[];
  competition: { houseTy: string; rank: string; residence: string; supply: string; applicants: string; rate: string }[];
  special: { houseTy: string; type: string; allotted: string; applicants: string }[];
  presale: { date: string; name: string; area: string; floor: string; amount: string; kind: string; cancelled: boolean }[];
  lhLinks: { title: string; href: string }[]; url: string | null; truncated: boolean;
}

// 단계 표시 (DESIGN.md 패턴: 공고 → 특별공급 → 1순위 → 2순위 → 발표 → 계약). 일정이 없는 단계는 뺀다.
// done 지남 / current 오늘이 기간 안 / next 단계 사이 빈 날의 바로 다음 단계 / upcoming 그 뒤
export type StageState = 'done' | 'current' | 'next' | 'upcoming';
export interface Stage { key: string; label: string; date: string; state: StageState; stateLabel: string; dday: string | null }

const STAGE_STATE_LABEL: Record<StageState, string> = { done: '지남', current: '진행 중', next: '예정', upcoming: '예정' };

const dayDiff = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

// 공고 연도와 같은 해면 연도를 뺀 짧은 날짜(11.16(월)), 다른 해면 연도를 붙인다(2027.03.11(목))
function stageDate(a: string, b: string, baseYear: string | null): string {
  const day = (d: string, withYear: boolean) => { const f = formatDay(d); return withYear ? f : f.slice(5); };
  const first = day(a, a.slice(0, 4) !== baseYear);
  if (b === a) return first;
  return `${first} ~ ${day(b, b.slice(0, 4) !== a.slice(0, 4))}`;
}

export function aptStages(nt: AptNoticeRow, today: string): Stage[] {
  const raw: [string, string, string | null, string | null][] = [
    ['notice', '공고', nt.notice_date, nt.notice_date],
    ['special', '특별공급', nt.special_start, nt.special_end],
    ['rank1', '1순위', nt.rank1_start, nt.rank1_end],
    ['rank2', '2순위', nt.rank2_start, nt.rank2_end],
    ['winner', '당첨자 발표', nt.winner_date, nt.winner_date],
    ['contract', '계약', nt.contract_start, nt.contract_end],
  ];
  const baseYear = nt.notice_date ? nt.notice_date.slice(0, 4) : null;
  const items = raw.flatMap(([key, label, s, e]) => {
    const start = s ?? e;
    const end = e ?? s;
    if (!start || !end) return [];
    return [{ key, label, start, end: end < start ? start : end }];
  });
  const hasCurrent = items.some((i) => i.start <= today && today <= i.end);
  let nextMarked = false;
  return items.map((i) => {
    let state: StageState = i.end < today ? 'done' : i.start <= today ? 'current' : 'upcoming';
    if (state === 'upcoming' && !hasCurrent && !nextMarked) { state = 'next'; nextMarked = true; }
    return {
      key: i.key, label: i.label, date: stageDate(i.start, i.end, baseYear), state, stateLabel: STAGE_STATE_LABEL[state],
      dday: state === 'next' ? `D-${dayDiff(today, i.start)}` : null,
    };
  });
}

export function perSqmPrice(topPrice: number | null, areaExcl: number | null): number | null {
  if (topPrice === null || areaExcl === null || !(areaExcl > 0)) return null;
  return Math.round(topPrice / areaExcl);
}

export function nearbyText(n: NearbyResult | null): string {
  if (!n || n.scope === 'none') return '비교할 주변 거래가 없습니다.';
  if (n.scope === 'insufficient') return `비교할 거래가 ${n.count}건이라 주변 시세를 계산하지 않았습니다.`;
  const where = n.scope === 'dong' ? '같은 법정동' : '같은 시군구';
  return `최근 12개월 ${where}, 준공 10년 이내, 전용 ±10㎡ 아파트 거래 ${n.count}건의 ㎡당 중위가는 ${formatManwon(n.medianPerSqm)}(평당 ${formatManwon(perSqmToPerPyeong(n.medianPerSqm))})입니다.`;
}

function specialTotal(json: string | null): string {
  if (!json) return '-';
  try {
    const v = JSON.parse(json) as Record<string, unknown>;
    return typeof v.total === 'number' ? formatCount(v.total) : '-';
  } catch {
    return '-';
  }
}

const RES_ORDER = ['local', 'province', 'other', 'all'];
const resRank = (r: string) => { const i = RES_ORDER.indexOf(r); return i < 0 ? RES_ORDER.length : i; };
const byModelRankRes = (a: CompetitionRow, b: CompetitionRow) =>
  a.model_no.localeCompare(b.model_no) || a.rank - b.rank || resRank(a.residence) - resRank(b.residence);

const row = (label: string, value: string): InfoRow[] => (value === '-' ? [] : [{ label, value }]);

export function aptView(b: AptBundle): AptView {
  const nt = b.notice;
  const tyOf = new Map(b.models.map((m) => [m.model_no, formatHouseTy(m.house_ty)]));
  const ty = (no: string) => tyOf.get(no) ?? no;
  const banner: Banner | null =
    b.phase === 'cancelled' ? { kind: 'cancelled', text: '취소된 공고입니다. 청약홈 공고를 확인하세요.' }
    : b.phase === 'closed' ? { kind: 'closed', text: '접수가 끝난 공고입니다. 아래에서 경쟁률을 볼 수 있습니다.' }
    : null;
  return {
    title: nt.name,
    place: nt.address ?? [nt.sido, nt.sigungu].filter(Boolean).join(' '),
    phaseLabel: PHASE_LABEL[b.phase] ?? b.phase,
    corrected: b.corrected,
    banner,
    schedule: [
      ...row('모집공고', formatDay(nt.notice_date)),
      ...row('특별공급', formatRange(nt.special_start, nt.special_end)),
      ...row('1순위', formatRange(nt.rank1_start, nt.rank1_end)),
      ...row('2순위', formatRange(nt.rank2_start, nt.rank2_end)),
      ...row('당첨자 발표', formatDay(nt.winner_date)),
      ...row('계약', formatRange(nt.contract_start, nt.contract_end)),
      ...row('입주 예정', nt.move_in_ym ? nt.move_in_ym.replace('-', '.') : '-'),
    ],
    moveIn: nt.move_in_ym ? nt.move_in_ym.replace('-', '.') : null,
    facts: [
      ...row('주택 구분', nt.house_kind ?? '-'),
      ...row('공급 구분', nt.supply_kind === 'national' ? '국민주택' : nt.supply_kind === 'private' ? '민영주택' : '-'),
      ...row('총 세대수', formatCount(nt.total_households)),
      ...row('분양가 상한제', nt.price_cap === 1 ? '적용' : nt.price_cap === 0 ? '미적용' : '-'),
      ...row('투기과열지구', nt.speculative === 1 ? '해당' : nt.speculative === 0 ? '해당 없음' : '-'),
      ...row('조정대상지역', nt.adjusted === 1 ? '해당' : nt.adjusted === 0 ? '해당 없음' : '-'),
    ],
    models: b.models.map((m) => {
      const per = perSqmPrice(m.top_price, m.area_excl);
      return {
        modelNo: m.model_no,
        houseTy: formatHouseTy(m.house_ty),
        area: m.area_excl !== null ? formatArea(m.area_excl) : '-',
        general: formatCount(m.general_count),
        special: specialTotal(m.special_counts),
        topPrice: m.top_price !== null ? formatManwon(m.top_price) : '-',
        perSqm: per !== null ? formatManwon(per) : '-',
        perPyeong: per !== null ? formatManwon(perSqmToPerPyeong(per)) : '-',
        nearby: nearbyText(m.nearby),
        eligibilityHref: `/eligibility/${encodeURIComponent(nt.pblanc_no)}/${encodeURIComponent(m.model_no)}`,
      };
    }),
    competition: [...b.competition].sort(byModelRankRes).map((c) => ({
      houseTy: ty(c.model_no), rank: `${c.rank}순위`, residence: labelOr(RESIDENCE_LABEL, c.residence),
      supply: formatCount(c.supply_count), applicants: formatCount(c.applicants), rate: formatRate(c.rate, c.rate_text),
    })),
    special: b.special.filter((s) => s.residence === 'all').map((s) => ({
      houseTy: ty(s.model_no), type: labelOr(SPECIAL_LABEL, s.special_type), allotted: formatCount(s.allotted), applicants: formatCount(s.applicants),
    })),
    presale: b.presale.map((p) => ({
      date: formatDay(p.contract_date), name: p.name, area: formatArea(p.area), floor: p.floor !== null ? `${p.floor}층` : '-',
      amount: formatManwon(p.amount), kind: p.kind ?? '-', cancelled: p.cancelled === 1,
    })),
    lhLinks: b.lhLinks.filter((l) => l.url).map((l) => ({ title: l.title ?? 'LH 공고', href: l.url as string })),
    url: nt.url,
    truncated: b.truncated === true,
  };
}
