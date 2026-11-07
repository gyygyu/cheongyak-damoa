// 화면이 읽는 KV 키 — sync/bundles.ts 가 쓰는 키와 같아야 한다 (tests/kv-keys.test.ts)
export const KV_KEYS = {
  home: 'home',
  competition: 'competition',
  account: 'stats:account',
  sources: 'meta:sources',
  apt: (no: string) => `apt:${no}`,
  lh: (id: string) => `lh:${id}`,
  calendar: (ym: string) => `calendar:${ym}`,
  region: (sido: string, sigungu?: string) => (sigungu ? `region:${sido}:${sigungu}` : `region:${sido}`),
  trade: (lawdCd: string, dong: string) => `trade:${lawdCd}:${dong}`,
  // 생산자 없음(DART 키 없음) — 묶음이 생기면 이 키로 쓴다
  ipo: (corp: string) => `ipo:${corp}`,
} as const;
