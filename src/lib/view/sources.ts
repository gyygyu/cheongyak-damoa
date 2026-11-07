// 화면마다 적는 출처 이름과 갱신 시각 (spec §13). 갱신 시각은 meta:sources(동기화가 씀)에서
export type SourceKey = 'applyhome' | 'competition' | 'lh' | 'trade' | 'account' | 'dart' | 'fsc';

export const SOURCE_LABEL: Record<SourceKey, string> = {
  applyhome: '청약홈',
  competition: '청약홈 경쟁률',
  lh: '한국토지주택공사',
  trade: '국토교통부 실거래가',
  account: '청약홈 청약통장 통계',
  dart: '금융감독원 DART',
  fsc: '금융위원회',
};

export interface SourceMeta { lastSuccess: string | null; failures: number; lastCount: number | null; lastError?: string }

export const PAGE_NOTICE = '참고용이며 최종 자격과 가격은 청약홈 공고·실거래 공개 시스템에서 확인하세요.';

const pad = (n: number) => String(n).padStart(2, '0');
export function formatStamp(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const d = new Date(t + 9 * 3600_000);
  return `${d.getUTCFullYear()}.${pad(d.getUTCMonth() + 1)}.${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function sourceLines(meta: Record<string, SourceMeta> | null, keys: readonly SourceKey[]): string[] {
  return keys.map((k) => {
    const at = meta?.[k]?.lastSuccess ? formatStamp(meta[k].lastSuccess as string) : '';
    return at ? `${SOURCE_LABEL[k]} ${at} 갱신` : `${SOURCE_LABEL[k]} (갱신 기록 없음)`;
  });
}
