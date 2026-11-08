// LH 공고 상세 (spec §7): 청약홈 공고와 맞추지 못한 분양·임대. 판정·주변 시세 없음
import type { LhBundle } from './bundle-types';
import type { Banner, InfoRow } from './apt';
import { formatArea, formatManwon } from '../units';
import { formatDay, formatRange, formatCount, formatHouseTy } from './format';

export interface LhView {
  title: string; place: string; state: string; isRent: boolean; banner: Banner | null;
  schedule: InfoRow[]; supply: { houseTy: string; area: string; households: string; price: string }[]; url: string | null;
}

const money = (n: number | null) => (n === null ? null : formatManwon(n));

export function lhView(b: LhBundle, today: string): LhView {
  const nt = b.notice;
  const isRent = nt.kind !== 'sale';
  const closed = (nt.state ?? '').includes('마감') || (nt.receipt_end !== null && nt.receipt_end < today);
  const rows: [string, string][] = [
    ['공고일', formatDay(nt.posted_date)],
    ['접수', formatRange(nt.receipt_start, nt.receipt_end)],
    ['당첨자 발표', formatDay(nt.winner_date)],
    ['계약', formatRange(nt.contract_start, nt.contract_end)],
  ];
  return {
    title: nt.title,
    place: nt.address ?? [nt.sido, nt.sigungu].filter(Boolean).join(' '),
    state: nt.state ?? '-',
    isRent,
    banner: closed ? { kind: 'closed', text: '접수가 끝난 공고입니다.' } : null,
    schedule: rows.filter(([, v]) => v !== '-').map(([label, value]) => ({ label, value })),
    supply: b.supply.map((s) => ({
      houseTy: formatHouseTy(s.house_ty),
      area: s.area_excl !== null ? formatArea(s.area_excl) : '-',
      households: formatCount(s.households),
      price: isRent
        ? [money(s.deposit) && `보증금 ${money(s.deposit)}`, money(s.monthly_rent) && `월 ${money(s.monthly_rent)}`].filter(Boolean).join(' · ') || '-'
        : money(s.price) ?? '-',
    })),
    url: nt.url,
  };
}
