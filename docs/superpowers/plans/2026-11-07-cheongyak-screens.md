# 청약다모아 Plan D — 화면·배포 문서·운영 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plan C 가 KV 에 쓴 묶음(`home`·`apt:`·`lh:`·`calendar:`·`competition`·`region:`·`trade:`·`stats:account`)을 읽어 탭 다섯 개(아파트 청약·공모주·실거래·캘린더·자격 판정) 화면을 Astro SSR(Cloudflare Workers)로 만들고, 사이트맵·매일 점검(`npm run ops:daily`)·배포 절차서(`docs/deploy.md`)를 갖춘다.

**Architecture:** 화면 계산은 모두 `src/lib/view/*.ts` 순수 함수(묶음 → 표시용 모델)로 두고 vitest 로 시험한다. `.astro` 페이지는 KV 묶음 하나(50KB 이하)를 `src/server/kv.ts` 로 읽어 view 함수에 넘기고 그리기만 한다. 페이지 응답은 미들웨어가 Cache API 로 1시간 저장한다(지원금다모아 방식). 자격 판정은 브라우저 스크립트가 `src/lib/eligibility` 의 `judgeAll` 로 하고 입력값은 어디에도 보내지 않는다.

**Tech Stack:** Astro 7 SSR + @astrojs/cloudflare 14, Cloudflare Workers·KV(D1 은 동기화만), TypeScript 6, vitest 5, wrangler 4, Node 24(tsx)

**Spec:** `docs/superpowers/specs/2026-11-07-cheongyak-site-design.md` (§6 KV, §7 주소와 화면, §8 판정 화면, §9 시세 문구, §12 운영, §13 문구 규칙)

## Global Constraints

- 자격 판정 입력값은 서버로 보내지 않는다 (URL 쿼리 포함). 판정은 브라우저에서 `src/lib/eligibility` 로 한다. 단지 상세에서 넘기는 공개값(공급 구분·전용면적·공고일)은 URL **경로**로만 넘긴다 (spec §8).
- Workers 무료 CPU 10ms: Worker 에서 큰 JSON 파싱 금지. KV 묶음은 50KB 이하라 `type:'json'` 으로 읽어도 되고(spec §6), 그 밖의 값(`meta:sources` 등)은 `type:'stream'` 으로 그대로 넘긴다. 페이지마다 KV 묶음은 하나(캘린더만 이번 달·지난달 둘).
- 무료 한도: D1 쓰기 하루 10만 행, KV 쓰기 하루 1,000건 — 화면은 KV·D1 에 쓰지 않는다. KV list(하루 1,000회)는 사이트맵에서만 쓰고 하루 캐시한다.
- 비밀값은 `.env`(로컬)·GitHub Secrets 에만. 계획·코드·문서에 키 값을 쓰지 않는다.
- 공모주 페이지: "투자 권유가 아닙니다."를 넣는다. 의견, 예상 수익, "차익 예상", 추천 문구는 쓰지 않는다. 시세 비교에 "싸다·비싸다" 금지 (spec §9, §13).
- 모든 페이지 아래: "참고용이며 최종 자격과 가격은 청약홈 공고·실거래 공개 시스템에서 확인하세요."
- 자격 판정 결과: "판정은 입력값 기준 참고 결과이며, 당첨 후 서류 심사로 최종 결정됩니다." (`DISCLAIMER`)
- 출처 이름(청약홈·한국토지주택공사·국토교통부·금융감독원 DART·금융위원회)과 갱신 시각을 각 화면에 적는다.
- 면적은 "84㎡(25평)"(`formatArea`), 숫자는 `tabular-nums`. 휴대폰 우선. 지원금다모아 CSS 에서 강조색만 바꾼다.
- 종료 공고는 404 대신 "접수가 끝난 공고입니다"와 경쟁률. 정정·취소는 배지. 광고는 자리만 두고 비운다.
- 도메인·사이트 이름은 `src/lib/site-meta.ts` 에서만 바꾼다.
- 보호예수 수집은 꺼져 있고 DART 키가 없다 — `ipo:` 묶음과 `ipo-*` 일정이 없어도 화면이 깨지지 않아야 한다.
- `src/lib/` 는 순수 로직(Cloudflare·Node API 금지). Cloudflare 바인딩은 `src/server/`·`src/pages/`·`src/middleware.ts` 에서만.
- 배포·merge·push·도메인 구입·Cloudflare 가입은 사용자가 한다. 이 계획은 `docs/deploy.md` 작성과 로컬 빌드·미리보기까지. 실제 배포 단계는 **사용자 확인 필요**.
- 지원금다모아 저장소는 읽기만 한다. 옮겨 오는 코드는 이 저장소에 새로 쓴다.
- 테스트는 `tests/**/*.test.ts`, `npm test` 는 키 없이 통과해야 한다.

## Review Focus

1. **한글 경로 파라미터(`/region/경기도/시흥시`, `/trade/41390/거모동`)가 인코딩된 채로 오거나 잘못된 `%` 로 옴** — 그대로 KV 키로 쓰면 묶음을 못 찾거나 `decodeURIComponent` 가 던져 500 이 난다. 사람은 404 화면을 기대한다. Task 2 의 `safeParam` 시험(인코딩·이미 풀린 값·깨진 `%`).
2. **화면이 읽는 KV 키가 `sync/bundles.ts` 가 쓰는 키와 어긋남** — 로컬에선 몰라도 화면이 전부 404 가 된다. Task 1 의 `buildBundles 가 만든 키는 KV_KEYS 로 만들 수 있다` 시험.
3. **묶음이 없거나 비었거나 `truncated` 인 경우(경쟁률·청약통장 통계 0건, 공모주·보호예수 없음)** — 빈 표 대신 "자료가 아직 없습니다" 안내가 떠야 한다. Task 4·5·6 의 빈 묶음 시험.
4. **자격 판정 입력이 폼 제출(GET)·`fetch`·주소 변경으로 새어 나감** — 사용자는 아무것도 보내지 않는다고 믿는다. Task 7 의 소스 검사 시험(`<form`·`fetch(`·`location`·`history.`·`sendBeacon`·`XMLHttpRequest` 금지).
5. **캘린더 월 경계·여러 날 일정** — 10-30~11-02 접수는 `calendar:2026-10` 에만 들어 있어 11월 화면에서 사라진다. 사람은 11월 1·2일 칸에도 보이길 기대한다. Task 3 의 `지난달에 시작한 일정이 이번 달 칸에도 보인다` 시험.

---

## 파일 구조

| 파일 | 역할 |
|---|---|
| `src/lib/kv-keys.ts` | KV 키 이름 (화면 ↔ 동기화 계약) |
| `src/lib/nav.ts` | 탭 다섯 개, 지금 탭 판정 |
| `src/lib/cache-key.ts`, `src/lib/canonical-host.ts` | 페이지 캐시 이름, 대표 주소 넘기기 |
| `src/lib/view/bundle-types.ts` | KV 묶음 타입 (`sync/bundles.ts` 결과 모양) |
| `src/lib/view/format.ts` | 날짜·경쟁률·주택형·라벨, `safeParam` |
| `src/lib/view/sources.ts` | 출처 이름·갱신 시각 줄 |
| `src/lib/view/calendar.ts`, `home.ts` | 캘린더 칸·홈 타임라인 |
| `src/lib/view/apt.ts`, `lh.ts` | 단지·LH 상세 |
| `src/lib/view/region.ts` | 지역·실거래·경쟁률 모음·청약통장 |
| `src/lib/view/ipo.ts` | 공모주 목록·상세 |
| `src/lib/view/eligibility-form.ts` | 판정 폼 값 → 입력 타입, 검증, 결과 표시 |
| `src/lib/view/sitemap.ts` | 사이트맵 XML |
| `src/server/kv.ts`, `src/server/cache.ts` | KV 읽기, 공개 캐시 머리글 |
| `src/middleware.ts` | 대표 주소 301, Cache API |
| `src/layouts/Base.astro`, `src/components/*.astro` | 공용 틀 |
| `src/scripts/sources-client.ts`, `calendar-client.ts`, `eligibility-client.ts` | 브라우저 스크립트 |
| `src/pages/**` | 페이지·API |
| `sync/ops/daily-summary.ts`, `sync/ops-daily.ts` | 매일 점검 |
| `docs/deploy.md` | 배포 절차 (사용자 몫 포함) |

---

### Task 1: 공용 틀 — KV 키·탭·캐시·레이아웃

**Files:**
- Create: `src/lib/kv-keys.ts`, `src/lib/nav.ts`, `src/lib/cache-key.ts`, `src/lib/canonical-host.ts`, `src/lib/view/sources.ts`
- Create: `src/server/kv.ts`, `src/server/cache.ts`, `src/middleware.ts`
- Create: `src/layouts/Base.astro`, `src/components/Header.astro`, `src/components/TabBar.astro`, `src/components/Footer.astro`, `src/components/NotFound.astro`, `src/components/AdSlot.astro`
- Create: `src/scripts/sources-client.ts`, `src/styles/global.css`
- Create: `src/pages/api/meta.json.ts`, `src/pages/robots.txt.ts`, `src/pages/404.astro`
- Modify: `src/pages/index.astro` (Task 3 에서 다시 씀 — 여기서는 Base 를 쓰는 자리값)
- Test: `tests/kv-keys.test.ts`, `tests/nav.test.ts`, `tests/canonical-host.test.ts`, `tests/view-sources.test.ts`

**Interfaces:**
- Consumes: `buildBundles(ds: Dataset, ctx: BundleCtx): KvWrite[]` (`sync/bundles.ts`, 시험에서만), `SITE` (`src/lib/site-meta.ts`)
- Produces:
  - `KV_KEYS: { home; competition; account; sources; apt(no); lh(id); calendar(ym); region(sido, sigungu?); trade(lawdCd, dong); ipo(corp) }` — 모두 `string` 반환
  - `NAV_ITEMS: readonly { href: string; label: string }[]`, `navActive(pathname: string, href: string): boolean`
  - `cacheKeyUrl(url: string, build: string): string`, `canonicalRedirect(requestUrl: string, siteUrl: string): string | null`
  - `type SourceKey = 'applyhome' | 'competition' | 'lh' | 'trade' | 'account' | 'dart' | 'fsc'`, `SOURCE_LABEL: Record<SourceKey, string>`, `interface SourceMeta`, `sourceLines(meta: Record<string, SourceMeta> | null, keys: readonly SourceKey[]): string[]`, `formatStamp(iso: string): string`
  - `getJson<T>(key: string): Promise<T | null>`, `getStream(key: string): Promise<ReadableStream | null>` (`src/server/kv.ts`)
  - `PUBLIC_CACHE`, `setPublicCache(headers: Headers, sMaxAge = 3600): void` (`src/server/cache.ts`)
  - `Base.astro` Props: `{ title: string; description: string; sources: SourceKey[]; noindex?: boolean; canonicalPath?: string }`
  - `NotFound.astro` Props: `{ message?: string }`
  - 상수 `PAGE_NOTICE = '참고용이며 최종 자격과 가격은 청약홈 공고·실거래 공개 시스템에서 확인하세요.'` (`src/lib/view/sources.ts`)

- [ ] **Step 1: 실패하는 시험을 쓴다**

```ts
// file: tests/kv-keys.test.ts
import { describe, it, expect } from 'vitest';
import { KV_KEYS } from '../src/lib/kv-keys';
import { buildBundles, type Dataset } from '../sync/bundles';

const notice = {
  pblanc_no: 'P1', house_manage_no: 'P1', name: '수원 영통 해모로', house_kind: '민영', rent_kind: null,
  area_code: '410', sido: '경기도', sigungu: '수원시 영통구', address: '경기도 수원시 영통구 망포동 100', lawd_cd: '41117', dong: '망포동',
  supply_kind: 'private', public_land: 0, price_cap: 0, speculative: 0, adjusted: 0, notice_date: '2026-11-01',
  special_start: '2026-11-09', special_end: '2026-11-09', rank1_start: '2026-11-10', rank1_end: '2026-11-10',
  rank2_start: '2026-11-11', rank2_end: '2026-11-11', rank_dates: null, winner_date: '2026-11-17',
  contract_start: '2026-11-28', contract_end: '2026-11-30', move_in_ym: '2029-03', total_households: 300,
  url: 'https://www.applyhome.co.kr/x', state: 'normal', hash: 'h', updated_at: 'u',
};
const lh = {
  lh_id: 'L1', title: '화성 임대', kind: 'rent', sub_kind: '국민임대', sido: '경기도', sigungu: '화성시', lawd_cd: '41590',
  address: '경기도 화성시', posted_date: '2026-11-01', receipt_start: '2026-11-12', receipt_end: '2026-11-14',
  winner_date: null, contract_start: null, contract_end: null, url: 'https://apply.lh.or.kr/x', state: '공고중', pblanc_no: null,
};
const ds: Dataset = {
  notices: [notice],
  models: [{ pblanc_no: 'P1', model_no: '01', house_ty: '084.9900A', area_excl: 84.99, area_supply: 112, general_count: 100, special_counts: null, top_price: 80000 }],
  competition: [{ pblanc_no: 'P1', model_no: '01', rank: 1, residence: 'local', supply_count: 50, applicants: 600, rate: 12, rate_text: '12' }],
  special: [],
  trades: [{ trade_key: 'T1', lawd_cd: '41117', umd_cd: '10500', dong: '망포동', jibun: '1', apt_seq: 'S1', name: '망포자이', area: 84, floor: 5, contract_date: '2026-10-10', amount: 70000, build_year: 2020, cancelled: 0, cancel_date: null }],
  presale: [], presaleLinks: [], lhNotices: [lh], lhSupply: [],
  account: [{ base_month: '2026-09', region: '경기', account_kind: '주택청약종합저축', area_kind: '', subscribers: 100, rank1: 50, rank2: 50 }],
};

describe('KV_KEYS', () => {
  it('buildBundles 가 만든 키는 KV_KEYS 로 만들 수 있다', () => {
    const keys = buildBundles(ds, { today: '2026-11-07', cityOf: new Map([['41117', '41110']]) }).map((w) => w.key);
    const expected = [
      KV_KEYS.apt('P1'), KV_KEYS.lh('L1'), KV_KEYS.calendar('2026-11'), KV_KEYS.home, KV_KEYS.competition,
      KV_KEYS.account, KV_KEYS.region('경기도'), KV_KEYS.region('경기도', '수원시 영통구'), KV_KEYS.trade('41117', '망포동'),
    ];
    for (const k of expected) expect(keys).toContain(k);
    // 화면이 모르는 키가 생기면 이 시험을 고치고 화면도 만든다
    const known = /^(apt|lh|calendar|region|trade):|^(home|competition|stats:account)$/;
    expect(keys.filter((k) => !known.test(k))).toEqual([]);
  });
  it('공모주 키는 ipo:{고유번호}', () => {
    expect(KV_KEYS.ipo('00123456')).toBe('ipo:00123456');
    expect(KV_KEYS.sources).toBe('meta:sources');
  });
});
```

```ts
// file: tests/nav.test.ts
import { describe, it, expect } from 'vitest';
import { NAV_ITEMS, navActive } from '../src/lib/nav';

describe('navActive', () => {
  it('탭은 다섯 개, 순서는 아파트 청약·공모주·실거래·캘린더·자격 판정', () => {
    expect(NAV_ITEMS.map((i) => i.label)).toEqual(['아파트 청약', '공모주', '실거래', '캘린더', '자격 판정']);
  });
  it('단지·LH 상세와 경쟁률 모음은 아파트 청약 탭', () => {
    for (const p of ['/', '/apt/2026000557', '/lh/0000061174', '/competition']) expect(navActive(p, '/')).toBe(true);
    expect(navActive('/ipo', '/')).toBe(false);
  });
  it('지역·실거래 화면은 실거래 탭, 끝 / 는 무시', () => {
    expect(navActive('/region/경기도/', '/region')).toBe(true);
    expect(navActive('/trade/41390/거모동', '/region')).toBe(true);
    expect(navActive('/regional', '/region')).toBe(false);
  });
  it('캘린더·판정 하위 주소', () => {
    expect(navActive('/calendar/2026-11', '/calendar')).toBe(true);
    expect(navActive('/eligibility/2026000557/01', '/eligibility')).toBe(true);
  });
});
```

```ts
// file: tests/canonical-host.test.ts
import { describe, it, expect } from 'vitest';
import { canonicalRedirect } from '../src/lib/canonical-host';
import { cacheKeyUrl } from '../src/lib/cache-key';

describe('canonicalRedirect', () => {
  const site = 'https://cheongyakdamoa.com';
  it('대표 주소면 넘기지 않는다', () => expect(canonicalRedirect('https://cheongyakdamoa.com/apt/1', site)).toBeNull());
  it('www·workers.dev 는 같은 경로로', () => {
    expect(canonicalRedirect('https://www.cheongyakdamoa.com/apt/1?x=1', site)).toBe('https://cheongyakdamoa.com/apt/1?x=1');
    expect(canonicalRedirect('https://cheongyak-damoa.a.workers.dev/', site)).toBe('https://cheongyakdamoa.com/');
  });
  it('로컬·대표 주소가 workers.dev 면 넘기지 않는다', () => {
    expect(canonicalRedirect('http://localhost:8787/', site)).toBeNull();
    expect(canonicalRedirect('https://x.workers.dev/', 'https://x.workers.dev')).toBeNull();
  });
});

describe('cacheKeyUrl', () => {
  it('배포 판 번호를 붙인다', () => expect(cacheKeyUrl('https://a.com/b?c=1', 'v9')).toBe('https://a.com/b?c=1&__v=v9'));
});
```

```ts
// file: tests/view-sources.test.ts
import { describe, it, expect } from 'vitest';
import { sourceLines, formatStamp, SOURCE_LABEL } from '../src/lib/view/sources';

describe('sourceLines', () => {
  it('출처 이름과 한국 시각 갱신 시각', () => {
    const meta = { applyhome: { lastSuccess: '2026-11-07T21:05:00.000Z', failures: 0, lastCount: 10 } };
    expect(sourceLines(meta, ['applyhome'])).toEqual(['청약홈 2026.11.08 06:05 갱신']);
  });
  it('기록이 없거나 meta 를 못 읽으면 이름만', () => {
    expect(sourceLines({}, ['lh'])).toEqual(['한국토지주택공사 (갱신 기록 없음)']);
    expect(sourceLines(null, ['dart'])).toEqual(['금융감독원 DART (갱신 기록 없음)']);
  });
  it('spec §13 출처 이름을 모두 가진다', () => {
    const names = Object.values(SOURCE_LABEL).join(' ');
    for (const n of ['청약홈', '한국토지주택공사', '국토교통부', '금융감독원 DART', '금융위원회']) expect(names).toContain(n);
  });
  it('formatStamp 는 깨진 값이면 빈 문자열', () => expect(formatStamp('x')).toBe(''));
});
```

- [ ] **Step 2: 시험이 실패하는지 본다**

Run: `npm test -- tests/kv-keys.test.ts tests/nav.test.ts tests/canonical-host.test.ts tests/view-sources.test.ts`
Expected: FAIL — `Failed to resolve import "../src/lib/kv-keys"` 등

- [ ] **Step 3: 순수 로직을 쓴다**

```ts
// file: src/lib/kv-keys.ts
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
```

```ts
// file: src/lib/nav.ts
// 머리말 메뉴(PC)와 하단 탭(휴대폰). spec §7 탭 다섯 개
export const NAV_ITEMS = [
  { href: '/', label: '아파트 청약' },
  { href: '/ipo', label: '공모주' },
  { href: '/region', label: '실거래' },
  { href: '/calendar', label: '캘린더' },
  { href: '/eligibility', label: '자격 판정' },
] as const;

const SECTION: Record<string, string[]> = {
  '/': ['/apt', '/lh', '/competition'],
  '/ipo': ['/ipo'],
  '/region': ['/region', '/trade'],
  '/calendar': ['/calendar'],
  '/eligibility': ['/eligibility'],
};

export function navActive(pathname: string, href: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (href === '/' && path === '/') return true;
  return (SECTION[href] ?? [href]).some((p) => path === p || path.startsWith(`${p}/`));
}
```

```ts
// file: src/lib/cache-key.ts
// 페이지 캐시(Cache API)의 이름. 배포 판 번호를 붙여 새로 배포하면 예전 저장본을 쓰지 않는다
export function cacheKeyUrl(url: string, build: string): string {
  const u = new URL(url);
  u.searchParams.set('__v', build);
  return u.toString();
}
```

```ts
// file: src/lib/canonical-host.ts
// 대표 주소(SITE_URL)가 아닌 주소(workers.dev, www, http)로 들어오면 같은 경로로 넘길 곳. 넘길 필요가 없으면 null
const LOCAL = new Set(['localhost', '127.0.0.1', '[::1]']);

export function canonicalRedirect(requestUrl: string, siteUrl: string): string | null {
  if (!siteUrl) return null;
  const req = new URL(requestUrl);
  const site = new URL(siteUrl);
  if (LOCAL.has(req.hostname) || site.hostname.endsWith('.workers.dev') || LOCAL.has(site.hostname)) return null;
  if (req.hostname === site.hostname && req.protocol === site.protocol) return null;
  return new URL(req.pathname + req.search, site.origin).toString();
}
```

```ts
// file: src/lib/view/sources.ts
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
```

- [ ] **Step 4: 시험이 통과하는지 본다**

Run: `npm test -- tests/kv-keys.test.ts tests/nav.test.ts tests/canonical-host.test.ts tests/view-sources.test.ts`
Expected: PASS (4 files)

- [ ] **Step 5: Worker 타입을 만든다**

Run: `npm run cf-typegen`
Expected: 저장소 루트에 `worker-configuration.d.ts` 생성(`.gitignore` 대상), `Env` 에 `DB`, `KV`, `SITE_URL` 이 있다. `tsconfig.json` 의 `include` 에 이미 `worker-configuration.d.ts` 가 있으니 고치지 않는다.

- [ ] **Step 6: 서버 코드·미들웨어를 쓴다**

```ts
// file: src/server/kv.ts
import { env } from 'cloudflare:workers';

// KV 묶음은 50KB 이하(spec §6, sync/bundles.ts MAX_VALUE_BYTES) — 파싱해도 CPU 한도 안
export function getJson<T>(key: string): Promise<T | null> {
  return env.KV.get<T>(key, { type: 'json', cacheTtl: 300 });
}

// 파싱 없이 스트림으로 넘긴다 (Workers CPU 10ms)
export function getStream(key: string): Promise<ReadableStream | null> {
  return env.KV.get(key, { type: 'stream', cacheTtl: 300 });
}
```

```ts
// file: src/server/cache.ts
export const PUBLIC_CACHE = 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400';

// 미들웨어는 s-maxage 가 붙은 200 응답만 Cache API 에 저장한다
export function setPublicCache(headers: Headers, sMaxAge = 3600): void {
  headers.set('Cache-Control', sMaxAge === 3600 ? PUBLIC_CACHE : `public, max-age=0, s-maxage=${sMaxAge}, stale-while-revalidate=86400`);
}
```

```ts
// file: src/middleware.ts
import { defineMiddleware } from 'astro:middleware';
import { env } from 'cloudflare:workers';
import { cacheKeyUrl } from './lib/cache-key';
import { canonicalRedirect } from './lib/canonical-host';

// Workers 응답은 자동으로 CDN 캐시되지 않으므로 Cache API 로 직접 저장한다 (지원금다모아 방식)
export const onRequest = defineMiddleware(async (context, next) => {
  const { request } = context;
  const target = import.meta.env.DEV ? null : canonicalRedirect(request.url, env.SITE_URL);
  if (target) return Response.redirect(target, 301);

  const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  if (import.meta.env.DEV || request.method !== 'GET' || !cache) return next();

  const key = new Request(cacheKeyUrl(request.url, __BUILD_ID__));
  const hit = await cache.match(key);
  if (hit) return hit;

  const response = await next();
  if (response.status === 200 && (response.headers.get('Cache-Control') ?? '').includes('s-maxage')) {
    context.locals.cfContext.waitUntil(cache.put(key, response.clone()));
  }
  return response;
});
```

```ts
// file: src/pages/api/meta.json.ts
import type { APIRoute } from 'astro';
import { getStream } from '../../server/kv';
import { KV_KEYS } from '../../lib/kv-keys';

// 출처별 갱신 시각 — 바닥글 스크립트가 읽는다. 파싱하지 않고 그대로 넘긴다
export const GET: APIRoute = async () => {
  const body = await getStream(KV_KEYS.sources);
  if (!body) return new Response('{}', { status: 503, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  return new Response(body, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300, s-maxage=300' } });
};
```

```ts
// file: src/pages/robots.txt.ts
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const GET: APIRoute = () => {
  const base = env.SITE_URL.replace(/\/$/, '');
  const body = `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${base}/sitemap.xml\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
```

- [ ] **Step 7: CSS 를 옮기고 강조색만 바꾼다**

Run:
```bash
cp "../지원금다모아/src/styles/global.css" src/styles/global.css
```
그다음 `src/styles/global.css` 맨 위 `:root` 의 세 줄만 바꾼다.

```css
  --brand: #2557a7;
  --brand-strong: #1b4080;
  --brand-soft: #e8eef8;
```

파일 끝에 이 계획이 쓰는 클래스를 붙인다.

```css
/* 청약다모아 추가 — 숫자 정렬, 표, 배너, 캘린더 */
.num, td.num, .tabular { font-variant-numeric: tabular-nums; }
.table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.data-table { width: 100%; border-collapse: collapse; font-size: 0.92rem; }
.data-table th, .data-table td { padding: 8px 10px; border-bottom: 1px solid var(--line); text-align: left; white-space: nowrap; }
.data-table td.num, .data-table th.num { text-align: right; font-variant-numeric: tabular-nums; }
.banner { border-radius: 10px; padding: 12px 14px; margin: 12px 0; font-weight: 600; }
.banner--closed { background: #f1f3f5; color: #495057; }
.banner--cancelled { background: #fdecec; color: #b42318; }
.badge--corrected { background: #fff4e5; color: #b54708; }
.badge--cancelled { background: #fdecec; color: #b42318; }
.empty { color: var(--ink-soft); padding: 16px 0; }
.page-notice { font-size: 0.85rem; color: var(--ink-soft); }
.ad-slot { min-height: 0; }
.cal { width: 100%; border-collapse: collapse; table-layout: fixed; }
.cal th, .cal td { border: 1px solid var(--line); vertical-align: top; padding: 4px; font-size: 0.8rem; }
.cal td.out { background: #fafafa; }
.cal .day { font-variant-numeric: tabular-nums; font-weight: 700; }
.cal-list { display: none; }
.cal-filter { display: flex; gap: 6px; margin: 8px 0; }
.cal-filter button[aria-pressed='true'] { background: var(--brand); color: #fff; }
[data-show='apt'] [data-group]:not([data-group='apt']),
[data-show='lh'] [data-group]:not([data-group='lh']),
[data-show='ipo'] [data-group]:not([data-group='ipo']) { display: none; }
@media (max-width: 760px) {
  .cal { display: none; }
  .cal-list { display: block; }
}
.verdict--ok { color: var(--brand-strong); font-weight: 700; }
.verdict--no { color: #b42318; font-weight: 700; }
.verdict--check { color: #b54708; font-weight: 700; }
.field-error { color: #b42318; font-size: 0.85rem; }
```

`--line`·`--ink-soft` 는 지원금다모아 CSS 에 이미 있는 변수다. 없으면 `grep -n "^\s*--" src/styles/global.css` 로 이름을 확인해 같은 뜻의 변수로 바꾼다.

- [ ] **Step 8: 레이아웃·컴포넌트를 쓴다**

```astro
---
// file: src/components/Header.astro
import { NAV_ITEMS, navActive } from '../lib/nav';
import { SITE } from '../lib/site-meta';
const path = Astro.url.pathname;
---
<header class="site-header">
  <div class="inner">
    <a class="logo" href="/">{SITE.name}</a>
    <nav class="nav" aria-label="주 메뉴">
      {NAV_ITEMS.map((item) => (
        <a href={item.href} aria-current={navActive(path, item.href) ? 'page' : undefined}>{item.label}</a>
      ))}
    </nav>
  </div>
</header>
```

```astro
---
// file: src/components/TabBar.astro
import { NAV_ITEMS, navActive } from '../lib/nav';
const path = Astro.url.pathname;
---
<nav class="tabbar" aria-label="하단 탭">
  {NAV_ITEMS.map((item) => (
    <a href={item.href} aria-current={navActive(path, item.href) ? 'page' : undefined}><span>{item.label}</span></a>
  ))}
</nav>
```

```astro
---
// file: src/components/Footer.astro
import { SOURCE_LABEL, PAGE_NOTICE, type SourceKey } from '../lib/view/sources';
import { SITE } from '../lib/site-meta';
interface Props { sources: SourceKey[] }
const { sources } = Astro.props;
---
<footer class="site-footer">
  <div class="inner">
    <p class="page-notice">{PAGE_NOTICE}</p>
    {sources.length > 0 && (
      <p class="page-notice">출처: <span data-sources={sources.join(',')}>{sources.map((k) => SOURCE_LABEL[k]).join(' · ')}</span></p>
    )}
    <p class="page-notice">{SITE.name}는 청약홈·한국토지주택공사·국토교통부가 운영하는 사이트가 아닙니다.</p>
  </div>
</footer>
```

```astro
---
// file: src/components/NotFound.astro
interface Props { message?: string }
const { message = '찾는 화면이 없습니다.' } = Astro.props;
---
<section>
  <h1>찾는 화면이 없습니다</h1>
  <p>{message}</p>
  <p><a class="btn btn--ghost" href="/">홈으로</a> <a class="btn btn--ghost" href="/calendar">캘린더</a></p>
</section>
```

```astro
---
// file: src/components/AdSlot.astro
// 애드센스 승인 전에는 자리만 둔다 (spec §7). 승인 뒤 이 파일만 고친다
---
<div class="ad-slot" aria-hidden="true"></div>
```

```astro
---
// file: src/layouts/Base.astro
import '../styles/global.css';
import Header from '../components/Header.astro';
import Footer from '../components/Footer.astro';
import TabBar from '../components/TabBar.astro';
import { env } from 'cloudflare:workers';
import { SITE } from '../lib/site-meta';
import type { SourceKey } from '../lib/view/sources';

interface Props { title: string; description: string; sources: SourceKey[]; noindex?: boolean; canonicalPath?: string }
const { title, description, sources, noindex = false, canonicalPath } = Astro.props;
const fullTitle = title === SITE.name ? title : `${title} | ${SITE.name}`;
const canonical = new URL(canonicalPath ?? Astro.url.pathname, env.SITE_URL).toString();
---
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>{fullTitle}</title>
    <meta name="description" content={description} />
    <link rel="canonical" href={canonical} />
    {noindex && <meta name="robots" content="noindex" />}
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content={SITE.name} />
    <meta property="og:title" content={fullTitle} />
    <meta property="og:description" content={description} />
    <meta property="og:url" content={canonical} />
    <meta property="og:locale" content="ko_KR" />
    <meta name="theme-color" content="#2557a7" />
  </head>
  <body>
    <Header />
    <main class="container"><slot /></main>
    <Footer sources={sources} />
    <TabBar />
    <script>import '../scripts/sources-client';</script>
  </body>
</html>
```

```ts
// file: src/scripts/sources-client.ts
// 바닥글 출처 이름 뒤에 갱신 시각을 붙인다. 사용자 입력은 다루지 않는다
import { sourceLines, type SourceKey, type SourceMeta } from '../lib/view/sources';

const el = document.querySelector<HTMLElement>('[data-sources]');
if (el) {
  const keys = (el.dataset.sources ?? '').split(',').filter(Boolean) as SourceKey[];
  fetch('/api/meta.json')
    .then((r) => (r.ok ? (r.json() as Promise<Record<string, SourceMeta>>) : null))
    .then((meta) => { el.textContent = sourceLines(meta, keys).join(' · '); })
    .catch(() => {});
}
```

```astro
---
// file: src/pages/404.astro
import Base from '../layouts/Base.astro';
import NotFound from '../components/NotFound.astro';
---
<Base title="찾는 화면이 없습니다" description="주소를 다시 확인해 주세요." sources={[]} noindex>
  <NotFound />
</Base>
```

```astro
---
// file: src/pages/index.astro  (Task 3 에서 홈으로 다시 쓴다)
import Base from '../layouts/Base.astro';
import { SITE } from '../lib/site-meta';
---
<Base title={SITE.name} description={SITE.tagline} sources={['applyhome']}>
  <h1>{SITE.name}</h1>
  <p>{SITE.tagline}</p>
</Base>
```

- [ ] **Step 9: 빌드·미리보기로 틀을 확인한다**

Run: `npm run typecheck && npm run build`
Expected: 오류 0. 그다음 `npx wrangler dev` (포트 8787) 를 띄워 `curl -s http://localhost:8787/ | grep -c "참고용이며 최종 자격과 가격은"` → `1`, `curl -s http://localhost:8787/robots.txt` → `Disallow: /api/` 포함, `curl -s -o /dev/null -w "%{http_code}" http://localhost:8787/없는주소` → `404`. 확인 뒤 wrangler dev 를 끈다.

- [ ] **Step 10: 커밋**

```bash
git add src/lib/kv-keys.ts src/lib/nav.ts src/lib/cache-key.ts src/lib/canonical-host.ts src/lib/view/sources.ts src/server src/middleware.ts src/layouts src/components src/scripts/sources-client.ts src/styles src/pages tests/kv-keys.test.ts tests/nav.test.ts tests/canonical-host.test.ts tests/view-sources.test.ts
git commit -m "화면 공용 틀: KV 키 계약·탭·캐시 미들웨어·레이아웃·출처 표시"
```

---

### Task 2: 묶음 타입과 표시 형식

**Files:**
- Create: `src/lib/view/bundle-types.ts`, `src/lib/view/format.ts`
- Test: `tests/view-format.test.ts`

**Interfaces:**
- Consumes: `CalendarEvent`, `EventKind` (`src/lib/apt/schedule.ts`), `AptPhase` (`src/lib/apt/status.ts`), `NearbyResult` (`src/lib/trade/nearby.ts`)
- Produces:
  - 타입: `AptNoticeRow`, `AptModelRow`, `CompetitionRow`, `SpecialRow`, `PresaleRow`, `AptBundle`, `LhNoticeRow`, `LhSupplyRow`, `LhBundle`, `CalendarBundle`, `CompSummary`, `HomeBundle`, `CompetitionBundle`, `AccountRow`, `AccountBundle`, `NoticeSummary`, `SidoBundle`, `SigunguBundle`, `TradeItem`, `TradeComplex`, `TradeBundle`, `IpoRow`, `IpoLockupRow`, `IpoBundle`
  - `safeParam(v: string | undefined): string | null`
  - `formatDay(d: string | null): string` — `'2026.11.16(월)'`, 없으면 `'-'`
  - `formatRange(a: string | null, b?: string | null): string` — 같은 해면 뒤쪽 연도 생략 `'2026.11.16(월) ~ 11.26(목)'`
  - `formatRate(rate: number | null, text: string | null): string` — `'12.5 : 1'`, 수치 없으면 원문, 둘 다 없으면 `'-'`
  - `formatCount(n: number | null | undefined): string`
  - `formatHouseTy(t: string | null): string` — `'084.9900A'` → `'84.99A'`
  - `KIND_LABEL: Record<EventKind, string>`, `PHASE_LABEL: Record<AptPhase, string>`, `RESIDENCE_LABEL: Record<string, string>`, `SPECIAL_LABEL: Record<string, string>`, `labelOr(map, key): string`

- [ ] **Step 1: 실패하는 시험을 쓴다**

```ts
// file: tests/view-format.test.ts
import { describe, it, expect } from 'vitest';
import { safeParam, formatDay, formatRange, formatRate, formatCount, formatHouseTy, labelOr, RESIDENCE_LABEL, KIND_LABEL } from '../src/lib/view/format';

describe('safeParam (Review Focus 1)', () => {
  it('인코딩된 한글을 푼다', () => expect(safeParam('%EA%B2%BD%EA%B8%B0%EB%8F%84')).toBe('경기도'));
  it('이미 풀린 값은 그대로', () => expect(safeParam('경기도')).toBe('경기도'));
  it('깨진 % 는 null (500 대신 404)', () => expect(safeParam('%E0%A4%A')).toBeNull());
  it('빈 값·undefined·길이 100 초과는 null', () => {
    expect(safeParam(undefined)).toBeNull();
    expect(safeParam('')).toBeNull();
    expect(safeParam('가'.repeat(101))).toBeNull();
  });
  it('KV 키 구분자 : 가 든 값은 null', () => expect(safeParam('경기도:시흥시')).toBeNull());
});

describe('날짜', () => {
  it('요일을 붙인다', () => expect(formatDay('2026-11-16')).toBe('2026.11.16(월)'));
  it('없으면 -', () => expect(formatDay(null)).toBe('-'));
  it('기간: 같은 해는 뒤 연도 생략, 같은 날은 한 번', () => {
    expect(formatRange('2026-11-16', '2026-11-26')).toBe('2026.11.16(월) ~ 11.26(목)');
    expect(formatRange('2026-12-30', '2027-01-02')).toBe('2026.12.30(수) ~ 2027.01.02(토)');
    expect(formatRange('2026-11-16', '2026-11-16')).toBe('2026.11.16(월)');
    expect(formatRange(null, null)).toBe('-');
  });
});

describe('숫자·라벨', () => {
  it('경쟁률', () => {
    expect(formatRate(12.5, '12.5')).toBe('12.5 : 1');
    expect(formatRate(null, '(△36)')).toBe('(△36)');
    expect(formatRate(null, null)).toBe('-');
  });
  it('건수', () => {
    expect(formatCount(12345)).toBe('12,345');
    expect(formatCount(null)).toBe('-');
  });
  it('주택형', () => {
    expect(formatHouseTy('084.9900A')).toBe('84.99A');
    expect(formatHouseTy('055.0000A')).toBe('55A');
    expect(formatHouseTy('74.9400A')).toBe('74.94A');
    expect(formatHouseTy(null)).toBe('-');
    expect(formatHouseTy('기타')).toBe('기타');
  });
  it('모르는 코드는 원문', () => {
    expect(labelOr(RESIDENCE_LABEL, 'local')).toBe('해당지역');
    expect(labelOr(RESIDENCE_LABEL, '기타경기')).toBe('기타경기');
    expect(KIND_LABEL['lh-receipt']).toBe('LH 접수');
  });
});
```

- [ ] **Step 2: 시험이 실패하는지 본다**

Run: `npm test -- tests/view-format.test.ts`
Expected: FAIL — `Failed to resolve import "../src/lib/view/format"`

- [ ] **Step 3: 타입과 형식 함수를 쓴다**

```ts
// file: src/lib/view/bundle-types.ts
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
export interface CompSummary { pblancNo: string; name: S; sido: S; sigungu: S; noticeDate: S; maxRate: N; applicants: number; supply: number }
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
```

```ts
// file: src/lib/view/format.ts
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
```

- [ ] **Step 4: 시험이 통과하는지 본다**

Run: `npm test -- tests/view-format.test.ts && npm run typecheck`
Expected: PASS, typecheck 오류 0

- [ ] **Step 5: 커밋**

```bash
git add src/lib/view/bundle-types.ts src/lib/view/format.ts tests/view-format.test.ts
git commit -m "화면: KV 묶음 타입과 날짜·경쟁률·주택형 표시 형식, 경로 파라미터 풀기"
```

---

### Task 3: 홈과 캘린더

**Files:**
- Create: `src/lib/view/calendar.ts`, `src/lib/view/home.ts`
- Create: `src/pages/calendar/index.ts`, `src/pages/calendar/[month].astro`, `src/components/EventList.astro`, `src/scripts/calendar-client.ts`
- Modify: `src/pages/index.astro` (홈으로 다시 씀)
- Test: `tests/view-calendar.test.ts`, `tests/view-home.test.ts`

**Interfaces:**
- Consumes: `CalendarEvent`, `EventKind`, `CalendarBundle`, `HomeBundle`, `CompSummary`, `formatRange`, `formatRate`, `KIND_LABEL`, `addMonths(date, n)`, `todayKst()`, `getJson`, `setPublicCache`, `KV_KEYS`
- Produces:
  - `type EventGroup = 'apt' | 'lh' | 'ipo'`, `kindGroup(kind: EventKind): EventGroup`
  - `hrefOf(ref: string): string | null` — `'apt:NO'`→`'/apt/NO'`, `'lh:ID'`→`'/lh/ID'`, `'ipo:X'`→`'/ipo/X'`
  - `interface EventRow { date: string; endDate: string | null; dateText: string; kindLabel: string; title: string; href: string | null; group: EventGroup }`, `eventRow(e: CalendarEvent): EventRow`
  - `parseMonth(raw: string | undefined, today: string): string | null` — `YYYY-MM`, 이번 달 ±12개월 밖이면 null
  - `prevMonth(ym: string): string`, `nextMonth(ym: string): string`
  - `monthGrid(ym: string): (string | null)[][]` — 일요일 시작 주 단위, 칸은 `YYYY-MM-DD` 또는 null
  - `eventsByDay(events: CalendarEvent[], ym: string): Record<string, EventRow[]>` — 여러 날 일정은 그 달 안의 모든 날에
  - `mergeEvents(...lists: CalendarEvent[][]): CalendarEvent[]` — 같은 `ref·kind·date` 하나로
  - `interface HomeView { today: string; todayRows: EventRow[]; closingRows: EventRow[]; weekRows: EventRow[]; top: { name: string; href: string; place: string; rate: string }[] }`, `homeView(b: HomeBundle | null, today: string): HomeView`
  - `EventList.astro` Props: `{ rows: EventRow[]; empty: string }`

- [ ] **Step 1: 실패하는 시험을 쓴다**

```ts
// file: tests/view-calendar.test.ts
import { describe, it, expect } from 'vitest';
import { parseMonth, monthGrid, eventsByDay, mergeEvents, hrefOf, kindGroup, prevMonth, nextMonth, eventRow } from '../src/lib/view/calendar';
import type { CalendarEvent } from '../src/lib/apt/schedule';

const ev = (date: string, endDate?: string, kind: CalendarEvent['kind'] = 'rank1', ref = 'apt:P1'): CalendarEvent =>
  ({ date, ...(endDate ? { endDate } : {}), kind, ref, title: '시흥 거모' });

describe('parseMonth', () => {
  it('YYYY-MM 이고 ±12개월 안이면 그대로', () => {
    expect(parseMonth('2026-11', '2026-11-07')).toBe('2026-11');
    expect(parseMonth('2027-11', '2026-11-07')).toBe('2027-11');
    expect(parseMonth('2025-11', '2026-11-07')).toBe('2025-11');
  });
  it('범위 밖·형식 오류는 null', () => {
    for (const v of ['2027-12', '2025-10', '2026-13', '2026-1', 'abc', undefined]) expect(parseMonth(v, '2026-11-07')).toBeNull();
  });
  it('앞뒤 달', () => {
    expect(prevMonth('2026-01')).toBe('2025-12');
    expect(nextMonth('2026-12')).toBe('2027-01');
  });
});

describe('monthGrid', () => {
  it('2026-11 은 일요일(1일)부터, 5주', () => {
    const g = monthGrid('2026-11');
    expect(g[0][0]).toBe('2026-11-01');
    expect(g.length).toBe(5);
    expect(g[4].filter(Boolean).at(-1)).toBe('2026-11-30');
    expect(g.every((w) => w.length === 7)).toBe(true);
  });
  it('2026-12 는 화요일 시작이라 앞 두 칸이 비어 있다', () => {
    const g = monthGrid('2026-12');
    expect(g[0].slice(0, 3)).toEqual([null, null, '2026-12-01']);
  });
});

describe('eventsByDay (Review Focus 5)', () => {
  it('여러 날 일정은 매일 칸에', () => {
    const days = eventsByDay([ev('2026-11-16', '2026-11-18')], '2026-11');
    expect(Object.keys(days).sort()).toEqual(['2026-11-16', '2026-11-17', '2026-11-18']);
  });
  it('지난달에 시작한 일정이 이번 달 칸에도 보인다', () => {
    const days = eventsByDay([ev('2026-10-30', '2026-11-02')], '2026-11');
    expect(Object.keys(days).sort()).toEqual(['2026-11-01', '2026-11-02']);
  });
  it('다음 달로 넘어가는 일정은 이번 달 끝까지만', () => {
    const days = eventsByDay([ev('2026-11-30', '2026-12-02')], '2026-11');
    expect(Object.keys(days)).toEqual(['2026-11-30']);
  });
  it('끝날이 시작보다 앞서는 잘못된 값은 시작일 하루만', () => {
    expect(Object.keys(eventsByDay([ev('2026-11-05', '2026-11-01')], '2026-11'))).toEqual(['2026-11-05']);
  });
  it('mergeEvents 는 이번 달·지난달 묶음의 같은 일정을 하나로', () => {
    expect(mergeEvents([ev('2026-11-01')], [ev('2026-11-01'), ev('2026-11-02')]).length).toBe(2);
  });
});

describe('링크·그룹', () => {
  it('ref → 주소', () => {
    expect(hrefOf('apt:2026000557')).toBe('/apt/2026000557');
    expect(hrefOf('lh:0000061174')).toBe('/lh/0000061174');
    expect(hrefOf('ipo:00123456')).toBe('/ipo/00123456');
    expect(hrefOf('apt:null')).toBeNull();
    expect(hrefOf('x')).toBeNull();
  });
  it('그룹', () => {
    expect(kindGroup('rank1')).toBe('apt');
    expect(kindGroup('lh-receipt')).toBe('lh');
    expect(kindGroup('ipo-listing')).toBe('ipo');
  });
  it('eventRow', () => {
    expect(eventRow(ev('2026-11-16', '2026-11-26'))).toMatchObject({ dateText: '2026.11.16(월) ~ 11.26(목)', kindLabel: '1순위', href: '/apt/P1', group: 'apt' });
  });
});
```

```ts
// file: tests/view-home.test.ts
import { describe, it, expect } from 'vitest';
import { homeView } from '../src/lib/view/home';
import type { HomeBundle } from '../src/lib/view/bundle-types';

const b: HomeBundle = {
  today: '2026-11-07',
  events: [
    { date: '2026-11-05', endDate: '2026-11-08', kind: 'lh-receipt', ref: 'lh:L1', title: '화성 임대' },
    { date: '2026-11-07', kind: 'special', ref: 'apt:P1', title: '수원 영통' },
    { date: '2026-11-12', kind: 'rank1', ref: 'apt:P2', title: '시흥 거모' },
  ],
  topCompetition: [{ pblancNo: 'P9', name: '과천 A', sido: '경기도', sigungu: '과천시', noticeDate: '2026-10-01', maxRate: 120.5, applicants: 1000, supply: 8 }],
};

describe('homeView', () => {
  it('오늘 진행 중인 일정, 마감 임박(2일 안에 끝남), 이번 주 예정으로 나눈다', () => {
    const v = homeView(b, '2026-11-07');
    expect(v.todayRows.map((r) => r.title)).toEqual(['화성 임대', '수원 영통']);
    expect(v.closingRows.map((r) => r.title)).toEqual(['화성 임대', '수원 영통']);
    expect(v.weekRows.map((r) => r.title)).toEqual(['시흥 거모']);
  });
  it('최근 경쟁률', () => {
    expect(homeView(b, '2026-11-07').top[0]).toEqual({ name: '과천 A', href: '/apt/P9', place: '경기도 과천시', rate: '120.5 : 1' });
  });
  it('묶음이 없으면 빈 목록 (Review Focus 3)', () => {
    const v = homeView(null, '2026-11-07');
    expect([v.todayRows, v.closingRows, v.weekRows, v.top].every((x) => x.length === 0)).toBe(true);
  });
});
```

- [ ] **Step 2: 시험이 실패하는지 본다**

Run: `npm test -- tests/view-calendar.test.ts tests/view-home.test.ts`
Expected: FAIL — `Failed to resolve import "../src/lib/view/calendar"`

- [ ] **Step 3: view 함수를 쓴다**

```ts
// file: src/lib/view/calendar.ts
// 월 캘린더 칸과 일정 줄 (spec §7). 묶음은 시작일 달에만 들어 있으므로(groupByMonth) 화면은 지난달 묶음도 함께 읽는다
import type { CalendarEvent, EventKind } from '../apt/schedule';
import { addMonths, daysBetween } from '../date';
import { formatRange, KIND_LABEL } from './format';

export type EventGroup = 'apt' | 'lh' | 'ipo';
export const kindGroup = (kind: EventKind): EventGroup => (kind === 'lh-receipt' ? 'lh' : kind.startsWith('ipo-') ? 'ipo' : 'apt');

export function hrefOf(ref: string): string | null {
  const m = /^(apt|lh|ipo):(.+)$/.exec(ref);
  if (!m || m[2] === 'null') return null;
  return `/${m[1]}/${encodeURIComponent(m[2])}`;
}

export interface EventRow { date: string; endDate: string | null; dateText: string; kindLabel: string; title: string; href: string | null; group: EventGroup }
export function eventRow(e: CalendarEvent): EventRow {
  const endDate = e.endDate && e.endDate > e.date ? e.endDate : null;
  return { date: e.date, endDate, dateText: formatRange(e.date, endDate), kindLabel: KIND_LABEL[e.kind] ?? e.kind, title: e.title, href: hrefOf(e.ref), group: kindGroup(e.kind) };
}

const YM = /^(\d{4})-(0[1-9]|1[0-2])$/;
export function parseMonth(raw: string | undefined, today: string): string | null {
  if (!raw || !YM.test(raw)) return null;
  const now = today.slice(0, 7);
  const min = addMonths(`${now}-01`, -12).slice(0, 7);
  const max = addMonths(`${now}-01`, 12).slice(0, 7);
  return raw >= min && raw <= max ? raw : null;
}
export const prevMonth = (ym: string): string => addMonths(`${ym}-01`, -1).slice(0, 7);
export const nextMonth = (ym: string): string => addMonths(`${ym}-01`, 1).slice(0, 7);

const pad = (n: number) => String(n).padStart(2, '0');
const lastDay = (ym: string): number => new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).getUTCDate();

export function monthGrid(ym: string): (string | null)[][] {
  const first = new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7) - 1, 1)).getUTCDay();
  const cells: (string | null)[] = [...Array(first).fill(null)];
  for (let d = 1; d <= lastDay(ym); d++) cells.push(`${ym}-${pad(d)}`);
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
}

export function mergeEvents(...lists: CalendarEvent[][]): CalendarEvent[] {
  const seen = new Map<string, CalendarEvent>();
  for (const e of lists.flat()) seen.set(`${e.ref}|${e.kind}|${e.date}`, e);
  return [...seen.values()].sort((a, b) => a.date.localeCompare(b.date) || a.ref.localeCompare(b.ref));
}

export function eventsByDay(events: CalendarEvent[], ym: string): Record<string, EventRow[]> {
  const out: Record<string, EventRow[]> = {};
  const monthStart = `${ym}-01`;
  const monthEnd = `${ym}-${pad(lastDay(ym))}`;
  for (const e of events) {
    const row = eventRow(e);
    const end = row.endDate ?? row.date;
    const from = row.date > monthStart ? row.date : monthStart;
    const to = end < monthEnd ? end : monthEnd;
    if (from > to) continue;
    const n = daysBetween(from, to);
    for (let i = 0; i <= n; i++) {
      const d = `${ym}-${pad(Number(from.slice(8, 10)) + i)}`;
      (out[d] ??= []).push(row);
    }
  }
  return out;
}
```

```ts
// file: src/lib/view/home.ts
// 홈 타임라인 (spec §7): 오늘·이번 주 일정, 마감 임박, 최근 경쟁률
import type { HomeBundle } from './bundle-types';
import { eventRow, hrefOf, type EventRow } from './calendar';
import { formatRate } from './format';
import { daysBetween } from '../date';

export interface HomeView {
  today: string; todayRows: EventRow[]; closingRows: EventRow[]; weekRows: EventRow[];
  top: { name: string; href: string; place: string; rate: string }[];
}

const CLOSING_DAYS = 2;
const RECEIPT = new Set(['special', 'rank1', 'rank2', 'lh-receipt', 'ipo-sub']);

export function homeView(b: HomeBundle | null, today: string): HomeView {
  const events = b?.events ?? [];
  const rows = events.map((e) => ({ e, r: eventRow(e) }));
  const running = rows.filter(({ r }) => r.date <= today && (r.endDate ?? r.date) >= today);
  return {
    today,
    todayRows: running.map(({ r }) => r),
    closingRows: rows
      .filter(({ e, r }) => RECEIPT.has(e.kind) && (r.endDate ?? r.date) >= today && daysBetween(today, r.endDate ?? r.date) <= CLOSING_DAYS && r.date <= today)
      .map(({ r }) => r),
    weekRows: rows.filter(({ r }) => r.date > today).map(({ r }) => r),
    top: (b?.topCompetition ?? []).map((c) => ({
      name: c.name ?? c.pblancNo,
      href: hrefOf(`apt:${c.pblancNo}`) ?? '/competition',
      place: [c.sido, c.sigungu].filter(Boolean).join(' '),
      rate: formatRate(c.maxRate, null),
    })),
  };
}
```

- [ ] **Step 4: 시험이 통과하는지 본다**

Run: `npm test -- tests/view-calendar.test.ts tests/view-home.test.ts`
Expected: PASS

- [ ] **Step 5: 페이지를 쓴다**

```astro
---
// file: src/components/EventList.astro
import type { EventRow } from '../lib/view/calendar';
interface Props { rows: EventRow[]; empty: string }
const { rows, empty } = Astro.props;
---
{rows.length === 0 ? <p class="empty">{empty}</p> : (
  <ul class="rows">
    {rows.map((r) => (
      <li data-group={r.group}>
        <span class="badge">{r.kindLabel}</span>
        {r.href ? <a href={r.href}><strong>{r.title}</strong></a> : <strong>{r.title}</strong>}
        <span class="tabular"> {r.dateText}</span>
      </li>
    ))}
  </ul>
)}
```

```astro
---
// file: src/pages/index.astro
import Base from '../layouts/Base.astro';
import EventList from '../components/EventList.astro';
import AdSlot from '../components/AdSlot.astro';
import { SITE } from '../lib/site-meta';
import { KV_KEYS } from '../lib/kv-keys';
import { getJson } from '../server/kv';
import { setPublicCache } from '../server/cache';
import { homeView } from '../lib/view/home';
import { todayKst } from '../lib/date';
import type { HomeBundle } from '../lib/view/bundle-types';

const bundle = await getJson<HomeBundle>(KV_KEYS.home);
const v = homeView(bundle, bundle?.today ?? todayKst());
setPublicCache(Astro.response.headers);
---
<Base title={SITE.name} description={SITE.tagline} sources={['applyhome', 'competition', 'lh']}>
  <h1>오늘의 청약 일정</h1>
  <p class="tabular">{v.today} 기준 · <a href={`/calendar/${v.today.slice(0, 7)}`}>이번 달 캘린더</a></p>
  <h2>오늘 진행 중</h2>
  <EventList rows={v.todayRows} empty="오늘 진행 중인 일정이 없습니다." />
  <h2>마감 임박</h2>
  <EventList rows={v.closingRows} empty="이틀 안에 끝나는 접수가 없습니다." />
  <AdSlot />
  <h2>이번 주 예정</h2>
  <EventList rows={v.weekRows} empty="이번 주 예정된 일정이 없습니다." />
  <h2>최근 경쟁률</h2>
  {v.top.length === 0 ? <p class="empty">경쟁률 자료가 아직 없습니다.</p> : (
    <div class="table-wrap"><table class="data-table">
      <thead><tr><th>단지</th><th>지역</th><th class="num">최고 경쟁률</th></tr></thead>
      <tbody>{v.top.map((t) => <tr><td><a href={t.href}>{t.name}</a></td><td>{t.place}</td><td class="num">{t.rate}</td></tr>)}</tbody>
    </table></div>
  )}
  <p><a href="/competition">경쟁률 모음 보기</a></p>
</Base>
```

```ts
// file: src/pages/calendar/index.ts
import type { APIRoute } from 'astro';
import { todayKst } from '../../lib/date';

// /calendar → 이번 달 (한국 날짜)
export const GET: APIRoute = () =>
  new Response(null, { status: 302, headers: { Location: `/calendar/${todayKst().slice(0, 7)}`, 'Cache-Control': 'no-store' } });
```

```astro
---
// file: src/pages/calendar/[month].astro
import Base from '../../layouts/Base.astro';
import NotFound from '../../components/NotFound.astro';
import EventList from '../../components/EventList.astro';
import { KV_KEYS } from '../../lib/kv-keys';
import { getJson } from '../../server/kv';
import { setPublicCache } from '../../server/cache';
import { todayKst } from '../../lib/date';
import { parseMonth, prevMonth, nextMonth, monthGrid, eventsByDay, mergeEvents, eventRow } from '../../lib/view/calendar';
import type { CalendarBundle } from '../../lib/view/bundle-types';

const today = todayKst();
const ym = parseMonth(Astro.params.month, today);
let grid: (string | null)[][] = [];
let byDay: Record<string, ReturnType<typeof eventRow>[]> = {};
let list: ReturnType<typeof eventRow>[] = [];
if (ym) {
  // 지난달에 시작해 이번 달까지 이어지는 일정 때문에 두 묶음을 읽는다 (각 50KB 이하)
  const [cur, prev] = await Promise.all([getJson<CalendarBundle>(KV_KEYS.calendar(ym)), getJson<CalendarBundle>(KV_KEYS.calendar(prevMonth(ym)))]);
  const events = mergeEvents(prev?.events ?? [], cur?.events ?? []);
  grid = monthGrid(ym);
  byDay = eventsByDay(events, ym);
  list = events.map(eventRow).filter((r) => (r.endDate ?? r.date) >= `${ym}-01` && r.date <= `${ym}-31`);
  setPublicCache(Astro.response.headers);
} else {
  Astro.response.status = 404;
}
const title = ym ? `${Number(ym.slice(0, 4))}년 ${Number(ym.slice(5, 7))}월 청약 캘린더` : '찾는 달이 없습니다';
---
<Base title={title} description="아파트 청약·LH·공모주 접수와 발표 일정을 달력으로 봅니다." sources={['applyhome', 'lh']} noindex={!ym}>
  {!ym ? <NotFound message="캘린더는 이번 달 앞뒤 12개월까지 볼 수 있습니다." /> : (
    <section class="cal-wrap" data-show="all">
      <h1>{title}</h1>
      <p><a href={`/calendar/${prevMonth(ym)}`} rel="prev">← 지난달</a> · <a href={`/calendar/${nextMonth(ym)}`} rel="next">다음 달 →</a></p>
      <div class="cal-filter" role="group" aria-label="일정 거르기">
        <button type="button" data-filter="all" aria-pressed="true">전체</button>
        <button type="button" data-filter="apt" aria-pressed="false">아파트</button>
        <button type="button" data-filter="lh" aria-pressed="false">LH</button>
        <button type="button" data-filter="ipo" aria-pressed="false">공모주</button>
      </div>
      <table class="cal">
        <thead><tr>{['일', '월', '화', '수', '목', '금', '토'].map((d) => <th>{d}</th>)}</tr></thead>
        <tbody>
          {grid.map((week) => (
            <tr>{week.map((d) => d === null ? <td class="out"></td> : (
              <td>
                <div class="day">{Number(d.slice(8, 10))}</div>
                {(byDay[d] ?? []).map((r) => (
                  <div data-group={r.group}>{r.href ? <a href={r.href}>{r.kindLabel} {r.title}</a> : `${r.kindLabel} ${r.title}`}</div>
                ))}
              </td>
            ))}</tr>
          ))}
        </tbody>
      </table>
      <div class="cal-list"><EventList rows={list} empty="이 달에는 일정이 없습니다." /></div>
    </section>
  )}
  <script>import '../../scripts/calendar-client';</script>
</Base>
```

```ts
// file: src/scripts/calendar-client.ts
// 캘린더 거르기 버튼 — 화면 표시만 바꾼다 (주소·저장소 안 씀)
const wrap = document.querySelector<HTMLElement>('.cal-wrap');
wrap?.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((btn) => {
  btn.addEventListener('click', () => {
    wrap.dataset.show = btn.dataset.filter ?? 'all';
    wrap.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
  });
});
```

- [ ] **Step 6: 로컬 데이터로 확인한다**

Run:
```bash
npm run db:migrate:local
npm run sync -- --target local --fixtures sync/fixtures
npm run build && npx wrangler dev
```
다른 창에서:
```bash
curl -s http://localhost:8787/ | grep -c "오늘의 청약 일정"
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:8787/calendar
curl -s http://localhost:8787/calendar/2026-11 | grep -c "시흥 거모"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8787/calendar/2030-01
```
Expected: `1`, `302 …/calendar/2026-11`(오늘 달), 1 이상, `404`. 브라우저에서 `http://localhost:8787/calendar/2026-11` 을 폭 375px 로 열어 목록 보기로 바뀌는지, "LH" 버튼으로 LH 일정만 남는지 본다. 확인 뒤 wrangler dev 를 끈다.

- [ ] **Step 7: 커밋**

```bash
git add src/lib/view/calendar.ts src/lib/view/home.ts src/pages/index.astro src/pages/calendar src/components/EventList.astro src/scripts/calendar-client.ts tests/view-calendar.test.ts tests/view-home.test.ts
git commit -m "화면: 홈 타임라인과 월 캘린더(여러 날 일정, 지난달 일정, 거르기)"
```

---

### Task 4: 단지 상세와 LH 공고 상세

**Files:**
- Create: `src/lib/view/apt.ts`, `src/lib/view/lh.ts`
- Create: `src/pages/apt/[no].astro`, `src/pages/lh/[id].astro`
- Test: `tests/view-apt.test.ts`, `tests/view-lh.test.ts`

**Interfaces:**
- Consumes: `AptBundle`, `LhBundle`, `NearbyResult`, `formatArea`, `formatManwon`, `perSqmToPerPyeong` (`src/lib/units.ts`), `formatRange`, `formatDay`, `formatRate`, `formatCount`, `formatHouseTy`, `labelOr`, `RESIDENCE_LABEL`, `SPECIAL_LABEL`, `PHASE_LABEL`, `safeParam`
- Produces:
  - `perSqmPrice(topPrice: number | null, areaExcl: number | null): number | null` — 만원/㎡(전용 기준), 반올림
  - `nearbyText(n: NearbyResult | null): string`
  - `interface Banner { kind: 'closed' | 'cancelled'; text: string }`
  - `interface InfoRow { label: string; value: string }`
  - `interface ModelView { modelNo: string; houseTy: string; area: string; general: string; special: string; topPrice: string; perSqm: string; perPyeong: string; nearby: string; eligibilityHref: string }`
  - `interface AptView { title: string; place: string; phaseLabel: string; corrected: boolean; banner: Banner | null; schedule: InfoRow[]; facts: InfoRow[]; models: ModelView[]; competition: { houseTy: string; rank: string; residence: string; supply: string; applicants: string; rate: string }[]; special: { houseTy: string; type: string; allotted: string; applicants: string }[]; presale: { date: string; name: string; area: string; floor: string; amount: string; kind: string; cancelled: boolean }[]; lhLinks: { title: string; href: string }[]; url: string | null; truncated: boolean }`
  - `aptView(b: AptBundle): AptView`
  - `BANNED_WORDS: RegExp` — 평가어 검사용 `/차익|싸다|싸게|비싸|저렴|이득|유리|추천|저평가|고평가/`
  - `interface LhView { title: string; place: string; state: string; isRent: boolean; banner: Banner | null; schedule: InfoRow[]; supply: { houseTy: string; area: string; households: string; price: string }[]; url: string | null }`, `lhView(b: LhBundle, today: string): LhView`

- [ ] **Step 1: 실패하는 시험을 쓴다**

```ts
// file: tests/view-apt.test.ts
import { describe, it, expect } from 'vitest';
import { aptView, perSqmPrice, nearbyText, BANNED_WORDS } from '../src/lib/view/apt';
import type { AptBundle } from '../src/lib/view/bundle-types';

const bundle = (over: Partial<AptBundle> = {}): AptBundle => ({
  notice: {
    pblanc_no: 'P1', house_manage_no: 'P1', name: '시흥 거모 아테라', house_kind: '신혼희망타운', rent_kind: null, area_code: '410',
    sido: '경기도', sigungu: '시흥시', address: '경기도 시흥시 거모지구 A-6', lawd_cd: '41390', dong: null,
    supply_kind: 'national', public_land: 1, price_cap: 1, speculative: 0, adjusted: 0,
    notice_date: '2026-11-06', special_start: null, special_end: null, rank1_start: '2026-11-16', rank1_end: '2026-11-26',
    rank2_start: '2026-11-27', rank2_end: '2026-11-27', rank_dates: null, winner_date: '2026-12-08',
    contract_start: '2027-03-11', contract_end: '2027-03-14', move_in_ym: '2029-09', total_households: 480,
    url: 'https://www.applyhome.co.kr/x', state: 'normal',
  },
  phase: 'upcoming', corrected: false,
  models: [{
    pblanc_no: 'P1', model_no: '01', house_ty: '055.0000A', area_excl: 55, area_supply: 79.047, general_count: 0,
    special_counts: '{"newlywed":10,"newborn":5,"total":15}', top_price: 43390,
    nearby: { scope: 'dong', count: 7, medianPerSqm: 700 },
  }],
  competition: [
    { pblanc_no: 'P1', model_no: '01', rank: 1, residence: 'other', supply_count: 10, applicants: 30, rate: 3, rate_text: '3' },
    { pblanc_no: 'P1', model_no: '01', rank: 1, residence: 'local', supply_count: 10, applicants: 120, rate: 12, rate_text: '12' },
  ],
  special: [
    { pblanc_no: 'P1', model_no: '01', special_type: 'newlywed', residence: 'local', allotted: null, applicants: 40 },
    { pblanc_no: 'P1', model_no: '01', special_type: 'newlywed', residence: 'all', allotted: 10, applicants: 55 },
  ],
  lhLinks: [{ lhId: 'L1', title: 'LH 공고', url: 'https://apply.lh.or.kr/x' }],
  presale: [],
  ...over,
});

describe('perSqmPrice', () => {
  it('전용면적 기준 ㎡당 만원', () => expect(perSqmPrice(43390, 55)).toBe(789));
  it('값이 없거나 면적 0 이면 null', () => {
    expect(perSqmPrice(null, 55)).toBeNull();
    expect(perSqmPrice(43390, 0)).toBeNull();
  });
});

describe('nearbyText (spec §9 사실만)', () => {
  it('같은 법정동 중위가', () => {
    expect(nearbyText({ scope: 'dong', count: 7, medianPerSqm: 700 })).toBe(
      '최근 12개월 같은 법정동, 준공 10년 이내, 전용 ±10㎡ 아파트 거래 7건의 ㎡당 중위가는 700만원(평당 2,314만원)입니다.');
  });
  it('자료 부족·없음', () => {
    expect(nearbyText({ scope: 'insufficient', count: 3 })).toBe('비교할 거래가 3건이라 주변 시세를 계산하지 않았습니다.');
    expect(nearbyText({ scope: 'none', count: 0 })).toBe('비교할 주변 거래가 없습니다.');
    expect(nearbyText(null)).toBe('비교할 주변 거래가 없습니다.');
  });
  it('평가어를 쓰지 않는다', () => {
    for (const n of [{ scope: 'sigungu', count: 9, medianPerSqm: 1200 } as const, { scope: 'insufficient', count: 1 } as const, null]) {
      expect(nearbyText(n)).not.toMatch(BANNED_WORDS);
    }
  });
});

describe('aptView', () => {
  it('주택형별 면적·분양가·㎡당·평당·판정 링크', () => {
    const m = aptView(bundle()).models[0];
    expect(m).toMatchObject({
      houseTy: '55A', area: '55㎡(17평)', topPrice: '4억 3,390만원', perSqm: '789만원', perPyeong: '2,608만원',
      special: '15', general: '0', eligibilityHref: '/eligibility/P1/01',
    });
  });
  it('경쟁률은 주택형·순위·해당지역 먼저', () => {
    expect(aptView(bundle()).competition.map((c) => c.residence)).toEqual(['해당지역', '기타지역']);
    expect(aptView(bundle()).competition[0]).toMatchObject({ rank: '1순위', rate: '12 : 1', applicants: '120' });
  });
  it('특공 현황은 전체(all) 줄만', () => {
    expect(aptView(bundle()).special).toEqual([{ houseTy: '55A', type: '신혼부부', allotted: '10', applicants: '55' }]);
  });
  it('일정 줄은 값 있는 것만', () => {
    const labels = aptView(bundle()).schedule.map((r) => r.label);
    expect(labels).toEqual(['모집공고', '1순위', '2순위', '당첨자 발표', '계약', '입주 예정']);
  });
  it('종료·취소·정정 배너', () => {
    expect(aptView(bundle({ phase: 'closed' })).banner).toEqual({ kind: 'closed', text: '접수가 끝난 공고입니다. 아래에서 경쟁률을 볼 수 있습니다.' });
    expect(aptView(bundle({ phase: 'cancelled' })).banner?.kind).toBe('cancelled');
    expect(aptView(bundle({ corrected: true })).corrected).toBe(true);
    expect(aptView(bundle()).banner).toBeNull();
  });
  it('주택형·경쟁률·특공이 비어도 깨지지 않는다 (Review Focus 3)', () => {
    const v = aptView(bundle({ models: [], competition: [], special: [], presale: [], lhLinks: [], truncated: true }));
    expect(v.models).toEqual([]);
    expect(v.truncated).toBe(true);
  });
  it('special_counts 가 깨진 JSON 이면 -', () => {
    const b = bundle();
    b.models[0].special_counts = '{x';
    expect(aptView(b).models[0].special).toBe('-');
  });
});
```

```ts
// file: tests/view-lh.test.ts
import { describe, it, expect } from 'vitest';
import { lhView } from '../src/lib/view/lh';
import type { LhBundle } from '../src/lib/view/bundle-types';

const b = (kind: string, state: string, receiptEnd: string): LhBundle => ({
  notice: {
    lh_id: 'L1', title: '인천계양 A6 공공분양', kind, sub_kind: kind === 'sale' ? '분양주택' : '국민임대', sido: '인천광역시', sigungu: '계양구', lawd_cd: '28245',
    address: '인천 계양구', posted_date: '2026-09-14', receipt_start: '2026-11-09', receipt_end: receiptEnd, winner_date: '2026-11-30',
    contract_start: null, contract_end: null, url: 'https://apply.lh.or.kr/x', state, pblanc_no: null,
  },
  supply: [{ lh_id: 'L1', supply_type: '01', house_ty: '74.9400A', area_excl: 74.94, households: 80, price: 50430, deposit: 3000, monthly_rent: 25 }],
});

describe('lhView', () => {
  it('분양은 공급 금액, 판정 대상 아님', () => {
    const v = lhView(b('sale', '공고중', '2026-11-18'), '2026-11-07');
    expect(v.isRent).toBe(false);
    expect(v.supply[0]).toEqual({ houseTy: '74.94A', area: '74.94㎡(23평)', households: '80', price: '5억 430만원' });
    expect(v.banner).toBeNull();
  });
  it('임대는 보증금·월 임대료', () => {
    expect(lhView(b('rent', '공고중', '2026-11-18'), '2026-11-07').supply[0].price).toBe('보증금 3,000만원 · 월 25만원');
  });
  it('접수 마감 상태이거나 접수 끝날이 지났으면 종료 배너', () => {
    expect(lhView(b('sale', '접수마감', '2026-11-18'), '2026-11-07').banner?.kind).toBe('closed');
    expect(lhView(b('sale', '공고중', '2026-11-01'), '2026-11-07').banner?.kind).toBe('closed');
  });
  it('공급 정보가 없어도 된다', () => {
    const x = b('sale', '공고중', '2026-11-18');
    x.supply = [];
    expect(lhView(x, '2026-11-07').supply).toEqual([]);
  });
});
```

- [ ] **Step 2: 시험이 실패하는지 본다**

Run: `npm test -- tests/view-apt.test.ts tests/view-lh.test.ts`
Expected: FAIL — `Failed to resolve import "../src/lib/view/apt"`

- [ ] **Step 3: view 함수를 쓴다**

```ts
// file: src/lib/view/apt.ts
// 단지 상세 (spec §7, §9). 시세 문구는 사실만 — 평가어 금지(BANNED_WORDS 시험)
import type { AptBundle, CompetitionRow } from './bundle-types';
import type { NearbyResult } from '../trade/nearby';
import { formatArea, formatManwon, perSqmToPerPyeong } from '../units';
import { formatRange, formatDay, formatRate, formatCount, formatHouseTy, labelOr, RESIDENCE_LABEL, SPECIAL_LABEL, PHASE_LABEL } from './format';

export const BANNED_WORDS = /차익|싸다|싸게|비싸|저렴|이득|유리|추천|저평가|고평가/;

export interface Banner { kind: 'closed' | 'cancelled'; text: string }
export interface InfoRow { label: string; value: string }
export interface ModelView { modelNo: string; houseTy: string; area: string; general: string; special: string; topPrice: string; perSqm: string; perPyeong: string; nearby: string; eligibilityHref: string }
export interface AptView {
  title: string; place: string; phaseLabel: string; corrected: boolean; banner: Banner | null;
  schedule: InfoRow[]; facts: InfoRow[]; models: ModelView[];
  competition: { houseTy: string; rank: string; residence: string; supply: string; applicants: string; rate: string }[];
  special: { houseTy: string; type: string; allotted: string; applicants: string }[];
  presale: { date: string; name: string; area: string; floor: string; amount: string; kind: string; cancelled: boolean }[];
  lhLinks: { title: string; href: string }[]; url: string | null; truncated: boolean;
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
```

```ts
// file: src/lib/view/lh.ts
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
```

`formatManwon(25)` 는 `'25만원'` 이다(`src/lib/units.ts`). 시험의 `'월 25만원'` 은 이 값에 `월 ` 을 붙인 것이다.

- [ ] **Step 4: 시험이 통과하는지 본다**

Run: `npm test -- tests/view-apt.test.ts tests/view-lh.test.ts`
Expected: PASS

- [ ] **Step 5: 페이지를 쓴다**

```astro
---
// file: src/pages/apt/[no].astro
import Base from '../../layouts/Base.astro';
import NotFound from '../../components/NotFound.astro';
import AdSlot from '../../components/AdSlot.astro';
import { KV_KEYS } from '../../lib/kv-keys';
import { getJson } from '../../server/kv';
import { setPublicCache } from '../../server/cache';
import { safeParam } from '../../lib/view/format';
import { aptView } from '../../lib/view/apt';
import type { AptBundle } from '../../lib/view/bundle-types';

const no = safeParam(Astro.params.no);
const bundle = no && /^[0-9A-Za-z_-]{1,30}$/.test(no) ? await getJson<AptBundle>(KV_KEYS.apt(no)) : null;
const v = bundle ? aptView(bundle) : null;
if (v) setPublicCache(Astro.response.headers);
else Astro.response.status = 404;
---
<Base title={v ? v.title : '공고를 찾을 수 없습니다'} description={v ? `${v.title} 청약 일정, 주택형별 분양가, 경쟁률, 주변 실거래 비교` : '공고를 찾을 수 없습니다.'} sources={['applyhome', 'competition', 'trade']} noindex={!v}>
  {!v ? <NotFound message="공고번호를 다시 확인해 주세요. 오래된 공고는 목록에서 빠질 수 있습니다." /> : (
    <article>
      <h1>{v.title}</h1>
      <p>
        <span class:list={['badge', { 'badge--open': v.phaseLabel === '접수 중' }]}>{v.phaseLabel}</span>
        {v.corrected && <span class="badge badge--corrected">정정 공고</span>}
        {v.banner?.kind === 'cancelled' && <span class="badge badge--cancelled">취소</span>}
        {' '}{v.place}
      </p>
      {v.banner && <p class:list={['banner', `banner--${v.banner.kind}`]}>{v.banner.text}</p>}
      {v.truncated && <p class="hint">내용이 많아 일부 표만 보여 줍니다. 전체는 청약홈 공고에서 확인하세요.</p>}

      <h2>일정</h2>
      <dl class="info">{v.schedule.map((r) => <><dt>{r.label}</dt><dd class="tabular">{r.value}</dd></>)}</dl>
      <dl class="info">{v.facts.map((r) => <><dt>{r.label}</dt><dd>{r.value}</dd></>)}</dl>

      <h2>주택형별 분양가</h2>
      {v.models.length === 0 ? <p class="empty">주택형 자료가 아직 없습니다.</p> : (
        <div class="table-wrap"><table class="data-table">
          <thead><tr><th>주택형</th><th>전용면적</th><th class="num">일반</th><th class="num">특공</th><th class="num">최고 분양가</th><th class="num">㎡당(전용)</th><th class="num">평당</th><th></th></tr></thead>
          <tbody>{v.models.map((m) => (
            <tr><td>{m.houseTy}</td><td class="num">{m.area}</td><td class="num">{m.general}</td><td class="num">{m.special}</td><td class="num">{m.topPrice}</td><td class="num">{m.perSqm}</td><td class="num">{m.perPyeong}</td>
              <td><a class="btn btn--ghost" href={m.eligibilityHref}>이 단지로 자격 판정</a></td></tr>
          ))}</tbody>
        </table></div>
      )}

      <h2>주변 시세 비교</h2>
      {v.models.length === 0 ? <p class="empty">비교할 주택형이 없습니다.</p> : (
        <ul class="bullets">{v.models.map((m) => <li><strong>{m.houseTy}</strong> {m.nearby}</li>)}</ul>
      )}
      <AdSlot />

      <h2>경쟁률</h2>
      {v.competition.length === 0 ? <p class="empty">경쟁률은 접수가 끝난 뒤 청약홈에 공개됩니다.</p> : (
        <div class="table-wrap"><table class="data-table">
          <thead><tr><th>주택형</th><th>순위</th><th>거주</th><th class="num">공급</th><th class="num">접수</th><th class="num">경쟁률</th></tr></thead>
          <tbody>{v.competition.map((c) => <tr><td>{c.houseTy}</td><td>{c.rank}</td><td>{c.residence}</td><td class="num">{c.supply}</td><td class="num">{c.applicants}</td><td class="num">{c.rate}</td></tr>)}</tbody>
        </table></div>
      )}

      <h2>특별공급 신청 현황</h2>
      {v.special.length === 0 ? <p class="empty">특별공급 신청 현황이 아직 없습니다.</p> : (
        <div class="table-wrap"><table class="data-table">
          <thead><tr><th>주택형</th><th>유형</th><th class="num">배정</th><th class="num">접수</th></tr></thead>
          <tbody>{v.special.map((s) => <tr><td>{s.houseTy}</td><td>{s.type}</td><td class="num">{s.allotted}</td><td class="num">{s.applicants}</td></tr>)}</tbody>
        </table></div>
      )}

      {v.presale.length > 0 && (
        <>
          <h2>분양권·입주권 거래</h2>
          <div class="table-wrap"><table class="data-table">
            <thead><tr><th>계약일</th><th>구분</th><th>전용면적</th><th class="num">층</th><th class="num">거래 금액</th></tr></thead>
            <tbody>{v.presale.map((p) => <tr><td class="num">{p.date}</td><td>{p.kind}{p.cancelled && ' (해제)'}</td><td class="num">{p.area}</td><td class="num">{p.floor}</td><td class="num">{p.amount}</td></tr>)}</tbody>
          </table></div>
        </>
      )}

      {v.lhLinks.length > 0 && <p>LH 공고: {v.lhLinks.map((l) => <a href={l.href} rel="noopener" target="_blank">{l.title}</a>)}</p>}
      {v.url && <p><a class="btn" href={v.url} rel="noopener" target="_blank">청약홈 공고 보기</a></p>}
    </article>
  )}
</Base>
```

`dl.info` 는 지원금다모아 CSS 에 없으면 `src/styles/global.css` 끝에 `.info { display: grid; grid-template-columns: max-content 1fr; gap: 4px 12px; } .info dt { color: var(--ink-soft); }` 를 붙인다.

```astro
---
// file: src/pages/lh/[id].astro
import Base from '../../layouts/Base.astro';
import NotFound from '../../components/NotFound.astro';
import { KV_KEYS } from '../../lib/kv-keys';
import { getJson } from '../../server/kv';
import { setPublicCache } from '../../server/cache';
import { safeParam } from '../../lib/view/format';
import { lhView } from '../../lib/view/lh';
import { todayKst } from '../../lib/date';
import type { LhBundle } from '../../lib/view/bundle-types';

const id = safeParam(Astro.params.id);
const bundle = id && /^[0-9A-Za-z_-]{1,30}$/.test(id) ? await getJson<LhBundle>(KV_KEYS.lh(id)) : null;
const v = bundle ? lhView(bundle, todayKst()) : null;
if (v) setPublicCache(Astro.response.headers);
else Astro.response.status = 404;
---
<Base title={v ? v.title : 'LH 공고를 찾을 수 없습니다'} description={v ? `${v.title} 접수 일정과 주택형별 공급·금액` : 'LH 공고를 찾을 수 없습니다.'} sources={['lh']} noindex={!v}>
  {!v ? <NotFound message="청약홈 공고와 맞춘 LH 공고는 단지 상세에서 볼 수 있습니다." /> : (
    <article>
      <h1>{v.title}</h1>
      <p><span class="badge">{v.isRent ? '임대' : '분양'}</span> <span class="badge">{v.state}</span> {v.place}</p>
      {v.banner && <p class:list={['banner', `banner--${v.banner.kind}`]}>{v.banner.text}</p>}
      <h2>일정</h2>
      <dl class="info">{v.schedule.map((r) => <><dt>{r.label}</dt><dd class="tabular">{r.value}</dd></>)}</dl>
      <h2>주택형별 공급</h2>
      {v.supply.length === 0 ? <p class="empty">공급 정보가 아직 없습니다. 공고문을 확인하세요.</p> : (
        <div class="table-wrap"><table class="data-table">
          <thead><tr><th>주택형</th><th>전용면적</th><th class="num">세대수</th><th class="num">{v.isRent ? '보증금·임대료' : '공급 금액'}</th></tr></thead>
          <tbody>{v.supply.map((s) => <tr><td>{s.houseTy}</td><td class="num">{s.area}</td><td class="num">{s.households}</td><td class="num">{s.price}</td></tr>)}</tbody>
        </table></div>
      )}
      {v.url && <p><a class="btn" href={v.url} rel="noopener" target="_blank">LH 청약플러스 공고문</a></p>}
    </article>
  )}
</Base>
```

- [ ] **Step 6: 로컬 데이터로 확인한다**

Task 3 Step 6 처럼 fixture 동기화 뒤 `npm run build && npx wrangler dev`, 다른 창에서:
```bash
curl -s http://localhost:8787/apt/2026820015 | grep -o "이 단지로 자격 판정" | head -1
curl -s http://localhost:8787/apt/2026820015 | grep -c "55㎡(17평)"
curl -s http://localhost:8787/lh/0000061174 | grep -c "접수가 끝난 공고입니다"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8787/apt/0000000000
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:8787/apt/%E0%A4%A"
```
Expected: `이 단지로 자격 판정`, 1 이상, `1`(fixture 의 LH 상태가 접수마감), `404`, `404`. 끈다.

- [ ] **Step 7: 커밋**

```bash
git add src/lib/view/apt.ts src/lib/view/lh.ts src/pages/apt src/pages/lh src/styles/global.css tests/view-apt.test.ts tests/view-lh.test.ts
git commit -m "화면: 단지 상세(분양가 ㎡당·평당, 주변 시세 사실 문구, 경쟁률·특공)와 LH 공고 상세"
```

---

### Task 5: 경쟁률 모음·지역·실거래

**Files:**
- Create: `src/lib/view/region.ts`
- Create: `src/pages/competition.astro`, `src/pages/region/index.astro`, `src/pages/region/[sido]/index.astro`, `src/pages/region/[sido]/[sigungu].astro`, `src/pages/trade/[lawd]/[dong].astro`
- Test: `tests/view-region.test.ts`

**Interfaces:**
- Consumes: `SIDO_ALIAS` (`src/lib/region/lawd.ts`), `CompetitionBundle`, `AccountBundle`, `AccountRow`, `SidoBundle`, `SigunguBundle`, `TradeBundle`, `NoticeSummary`, `formatArea`, `formatManwon`, `formatDay`, `formatRate`, `formatCount`, `PHASE_LABEL`, `safeParam`, `KV_KEYS`
- Produces:
  - `SIDO_LIST: string[]` — 시도 16개(정식 이름, 중복 없음)
  - `regionHref(sido: string, sigungu?: string): string`, `tradeHref(lawdCd: string, dong: string): string`
  - `competitionRows(b: CompetitionBundle | null): { name: string; href: string; place: string; noticeDate: string; rate: string; applicants: string; supply: string }[]`
  - `AREA_KIND_LABEL: Record<string, string>`, `accountRows(rows: AccountRow[]): { region: string; kind: string; area: string; subscribers: string; rank1: string; rank2: string }[]`
  - `noticeRows(list: NoticeSummary[]): { name: string; href: string | null; sigungu: string; noticeDate: string; phase: string }[]`
  - `sigunguLinks(b: SidoBundle): { name: string; href: string }[]`
  - `dongRows(b: SigunguBundle): { dong: string; href: string; count: string; last: string }[]`
  - `interface TradeView { title: string; complexes: { name: string; buildYear: string; areas: { area: string; rows: { date: string; floor: string; amount: string; cancelled: boolean }[] }[] }[] }`, `tradeView(b: TradeBundle): TradeView`

- [ ] **Step 1: 실패하는 시험을 쓴다**

```ts
// file: tests/view-region.test.ts
import { describe, it, expect } from 'vitest';
import { SIDO_LIST, regionHref, tradeHref, competitionRows, accountRows, noticeRows, sigunguLinks, dongRows, tradeView } from '../src/lib/view/region';

describe('시도 목록', () => {
  it('16개, 통합 시도 이름 포함', () => {
    expect(SIDO_LIST.length).toBe(16);
    expect(SIDO_LIST).toContain('전남광주통합특별시');
    expect(SIDO_LIST).toContain('세종특별자치시');
    expect(new Set(SIDO_LIST).size).toBe(16);
  });
  it('주소는 한글을 인코딩한다', () => {
    expect(regionHref('경기도')).toBe('/region/%EA%B2%BD%EA%B8%B0%EB%8F%84');
    expect(regionHref('경기도', '수원시 영통구')).toBe('/region/%EA%B2%BD%EA%B8%B0%EB%8F%84/%EC%88%98%EC%9B%90%EC%8B%9C%20%EC%98%81%ED%86%B5%EA%B5%AC');
    expect(tradeHref('11680', '대치동')).toBe('/trade/11680/%EB%8C%80%EC%B9%98%EB%8F%99');
  });
});

describe('경쟁률 모음', () => {
  it('최고 경쟁률·접수·공급', () => {
    const rows = competitionRows({ items: [{ pblancNo: 'P1', name: '과천 A', sido: '경기도', sigungu: '과천시', noticeDate: '2026-10-01', maxRate: 120.5, applicants: 12050, supply: 100 }] });
    expect(rows[0]).toEqual({ name: '과천 A', href: '/apt/P1', place: '경기도 과천시', noticeDate: '2026.10.01(목)', rate: '120.5 : 1', applicants: '12,050', supply: '100' });
  });
  it('묶음이 없거나 비면 빈 배열 (Review Focus 3)', () => {
    expect(competitionRows(null)).toEqual([]);
    expect(competitionRows({ items: [] })).toEqual([]);
  });
});

describe('청약통장', () => {
  it('면적 코드는 라벨, 빈 코드는 -', () => {
    const rows = accountRows([
      { base_month: '2026-09', region: '서울', account_kind: '주택청약종합저축', area_kind: '01', subscribers: null, rank1: 1000, rank2: 200 },
      { base_month: '2026-09', region: '서울', account_kind: '청약예금', area_kind: '', subscribers: null, rank1: 5, rank2: null },
    ]);
    expect(rows[0]).toEqual({ region: '서울', kind: '주택청약종합저축', area: '85㎡ 이하', subscribers: '-', rank1: '1,000', rank2: '200' });
    expect(rows[1].area).toBe('-');
  });
  it('모르는 코드는 코드 그대로 보인다', () => {
    expect(accountRows([{ base_month: '2026-09', region: '서울', account_kind: 'x', area_kind: '07', subscribers: 1, rank1: 1, rank2: 1 }])[0].area).toBe('면적 구분 07');
  });
});

describe('지역 화면', () => {
  const sido = {
    sido: '경기도',
    notices: [
      { pblancNo: 'P1', name: '시흥 거모', sigungu: '시흥시', noticeDate: '2026-11-06', phase: 'upcoming' as const },
      { pblancNo: 'P2', name: '시흥 은계', sigungu: '시흥시', noticeDate: '2026-10-01', phase: 'closed' as const },
      { pblancNo: null, name: '이름만', sigungu: null, noticeDate: null, phase: null },
    ],
    account: [],
  };
  it('공고 줄', () => {
    expect(noticeRows(sido.notices)[0]).toEqual({ name: '시흥 거모', href: '/apt/P1', sigungu: '시흥시', noticeDate: '2026.11.06(금)', phase: '접수 예정' });
    expect(noticeRows(sido.notices)[2]).toMatchObject({ href: null, phase: '-' });
  });
  it('시군구 링크는 공고의 시군구에서 중복 없이', () => {
    expect(sigunguLinks(sido)).toEqual([{ name: '시흥시', href: regionHref('경기도', '시흥시') }]);
  });
  it('동 줄은 실거래 화면으로', () => {
    expect(dongRows({ notices: [], dongs: [{ lawdCd: '41390', dong: '거모동', count: 12, last: '2026-10-30' }] })).toEqual([
      { dong: '거모동', href: tradeHref('41390', '거모동'), count: '12', last: '2026.10.30(금)' },
    ]);
  });
});

describe('tradeView', () => {
  it('단지별·면적대별로 묶고 최근 거래 먼저, 해제 표시', () => {
    const v = tradeView({
      lawdCd: '11680', dong: '대치동',
      complexes: [{ name: '래미안대치', buildYear: 2015, trades: [
        { date: '2026-10-01', area: 84.97, floor: 10, amount: 280000, cancelled: false },
        { date: '2026-10-05', area: 59.9, floor: 3, amount: 200000, cancelled: true },
        { date: '2026-10-09', area: 84.97, floor: 12, amount: 285000, cancelled: false },
      ] }],
    });
    expect(v.title).toBe('대치동 아파트 실거래');
    const c = v.complexes[0];
    expect(c.buildYear).toBe('2015년 준공');
    expect(c.areas.map((a) => a.area)).toEqual(['59.9㎡(18평)', '84.97㎡(26평)']);
    expect(c.areas[1].rows.map((r) => r.date)).toEqual(['2026.10.09(금)', '2026.10.01(목)']);
    expect(c.areas[0].rows[0]).toMatchObject({ amount: '20억원', cancelled: true });
  });
  it('면적·금액 없는 거래도 깨지지 않는다', () => {
    const v = tradeView({ lawdCd: '1', dong: 'x', complexes: [{ name: 'a', buildYear: null, trades: [{ date: null, area: null, floor: null, amount: null, cancelled: false }] }] });
    expect(v.complexes[0].areas[0]).toMatchObject({ area: '-', rows: [{ date: '-', floor: '-', amount: '-', cancelled: false }] });
  });
});
```

- [ ] **Step 2: 시험이 실패하는지 본다**

Run: `npm test -- tests/view-region.test.ts`
Expected: FAIL — `Failed to resolve import "../src/lib/view/region"`

- [ ] **Step 3: view 함수를 쓴다**

```ts
// file: src/lib/view/region.ts
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

// BLNC_SECD — 실응답으로 확인한 값만 적는다(docs/api-fields.md). 나머지는 코드 그대로
export const AREA_KIND_LABEL: Record<string, string> = { '01': '85㎡ 이하', '04': '모든 면적' };

export function accountRows(rows: AccountRow[]) {
  return rows.map((r) => ({
    region: r.region, kind: r.account_kind,
    area: r.area_kind ? AREA_KIND_LABEL[r.area_kind] ?? `면적 구분 ${r.area_kind}` : '-',
    subscribers: formatCount(r.subscribers), rank1: formatCount(r.rank1), rank2: formatCount(r.rank2),
  }));
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
```

- [ ] **Step 4: 시험이 통과하는지 본다**

Run: `npm test -- tests/view-region.test.ts`
Expected: PASS

- [ ] **Step 5: 페이지를 쓴다**

```astro
---
// file: src/pages/competition.astro
import Base from '../layouts/Base.astro';
import { KV_KEYS } from '../lib/kv-keys';
import { getJson } from '../server/kv';
import { setPublicCache } from '../server/cache';
import { competitionRows } from '../lib/view/region';
import type { CompetitionBundle } from '../lib/view/bundle-types';

const rows = competitionRows(await getJson<CompetitionBundle>(KV_KEYS.competition));
setPublicCache(Astro.response.headers);
---
<Base title="청약 경쟁률 모음" description="최근 아파트 청약 단지별 최고 경쟁률과 접수 건수" sources={['competition', 'applyhome']}>
  <h1>청약 경쟁률 모음</h1>
  {rows.length === 0 ? <p class="empty">경쟁률 자료가 아직 없습니다.</p> : (
    <div class="table-wrap"><table class="data-table">
      <thead><tr><th>단지</th><th>지역</th><th>모집공고</th><th class="num">최고 경쟁률</th><th class="num">접수</th><th class="num">공급</th></tr></thead>
      <tbody>{rows.map((r) => <tr><td><a href={r.href}>{r.name}</a></td><td>{r.place}</td><td class="num">{r.noticeDate}</td><td class="num">{r.rate}</td><td class="num">{r.applicants}</td><td class="num">{r.supply}</td></tr>)}</tbody>
    </table></div>
  )}
</Base>
```

```astro
---
// file: src/pages/region/index.astro
import Base from '../../layouts/Base.astro';
import { SIDO_LIST, regionHref } from '../../lib/view/region';
import { setPublicCache } from '../../server/cache';
setPublicCache(Astro.response.headers);
---
<Base title="지역별 청약·실거래" description="시도별 청약 공고와 동별 아파트 실거래, 청약통장 가입 현황" sources={['applyhome', 'trade', 'account']}>
  <h1>지역별 청약·실거래</h1>
  <ul class="tiles">{SIDO_LIST.map((s) => <li><a class="tile" href={regionHref(s)}>{s}</a></li>)}</ul>
</Base>
```

```astro
---
// file: src/pages/region/[sido]/index.astro
import Base from '../../../layouts/Base.astro';
import NotFound from '../../../components/NotFound.astro';
import { KV_KEYS } from '../../../lib/kv-keys';
import { getJson } from '../../../server/kv';
import { setPublicCache } from '../../../server/cache';
import { safeParam } from '../../../lib/view/format';
import { SIDO_LIST, noticeRows, sigunguLinks, accountRows } from '../../../lib/view/region';
import type { SidoBundle, AccountBundle } from '../../../lib/view/bundle-types';

const sido = safeParam(Astro.params.sido);
const known = sido !== null && SIDO_LIST.includes(sido);
const [b, acc] = known ? await Promise.all([getJson<SidoBundle>(KV_KEYS.region(sido)), getJson<AccountBundle>(KV_KEYS.account)]) : [null, null];
// 공고가 없는 시도도 화면은 보여 준다(빈 안내)
const notices = noticeRows(b?.notices ?? []);
const links = b ? sigunguLinks(b) : [];
const account = accountRows(b?.account ?? []);
if (known) setPublicCache(Astro.response.headers);
else Astro.response.status = 404;
---
<Base title={known ? `${sido} 청약 공고·실거래` : '지역을 찾을 수 없습니다'} description={known ? `${sido} 아파트 청약 공고와 시군구별 실거래, 청약통장 가입 현황` : ''} sources={['applyhome', 'trade', 'account']} noindex={!known}>
  {!known ? <NotFound message="시도 이름을 다시 확인해 주세요." /> : (
    <section>
      <h1>{sido}</h1>
      <h2>시군구</h2>
      {links.length === 0 ? <p class="empty">최근 공고가 있는 시군구가 없습니다.</p> : <ul class="tiles">{links.map((l) => <li><a class="tile" href={l.href}>{l.name}</a></li>)}</ul>}
      <h2>청약 공고</h2>
      {notices.length === 0 ? <p class="empty">최근 청약 공고가 없습니다.</p> : (
        <div class="table-wrap"><table class="data-table">
          <thead><tr><th>단지</th><th>시군구</th><th>모집공고</th><th>상태</th></tr></thead>
          <tbody>{notices.map((n) => <tr><td>{n.href ? <a href={n.href}>{n.name}</a> : n.name}</td><td>{n.sigungu}</td><td class="num">{n.noticeDate}</td><td>{n.phase}</td></tr>)}</tbody>
        </table></div>
      )}
      <h2>청약통장 가입 현황{acc?.baseMonth ? ` (${acc.baseMonth} 기준)` : ''}</h2>
      {account.length === 0 ? <p class="empty">청약통장 통계가 아직 없습니다.</p> : (
        <div class="table-wrap"><table class="data-table">
          <thead><tr><th>지역</th><th>통장</th><th>면적</th><th class="num">가입자</th><th class="num">1순위</th><th class="num">2순위</th></tr></thead>
          <tbody>{account.map((r) => <tr><td>{r.region}</td><td>{r.kind}</td><td>{r.area}</td><td class="num">{r.subscribers}</td><td class="num">{r.rank1}</td><td class="num">{r.rank2}</td></tr>)}</tbody>
        </table></div>
      )}
    </section>
  )}
</Base>
```

`stats:account` 는 기준월 표시용으로만 읽는다(묶음 50KB 이하). 시도 묶음의 `account` 가 이미 그 시도 줄만 담고 있다.

```astro
---
// file: src/pages/region/[sido]/[sigungu].astro
import Base from '../../../layouts/Base.astro';
import NotFound from '../../../components/NotFound.astro';
import { KV_KEYS } from '../../../lib/kv-keys';
import { getJson } from '../../../server/kv';
import { setPublicCache } from '../../../server/cache';
import { safeParam } from '../../../lib/view/format';
import { SIDO_LIST, noticeRows, dongRows, regionHref } from '../../../lib/view/region';
import type { SigunguBundle } from '../../../lib/view/bundle-types';

const sido = safeParam(Astro.params.sido);
const sigungu = safeParam(Astro.params.sigungu);
const b = sido && sigungu && SIDO_LIST.includes(sido) ? await getJson<SigunguBundle>(KV_KEYS.region(sido, sigungu)) : null;
if (b) setPublicCache(Astro.response.headers);
else Astro.response.status = 404;
const notices = noticeRows(b?.notices ?? []);
const dongs = b ? dongRows(b) : [];
---
<Base title={b ? `${sido} ${sigungu} 청약·실거래` : '지역을 찾을 수 없습니다'} description={b ? `${sido} ${sigungu} 청약 공고와 법정동별 아파트 실거래` : ''} sources={['applyhome', 'trade']} noindex={!b}>
  {!b ? <NotFound message="최근 공고가 있는 시군구만 볼 수 있습니다." /> : (
    <section>
      <p><a href={regionHref(sido!)}>{sido}</a></p>
      <h1>{sigungu}</h1>
      <h2>청약 공고</h2>
      {notices.length === 0 ? <p class="empty">최근 청약 공고가 없습니다.</p> : <ul class="rows">{notices.map((n) => <li>{n.href ? <a href={n.href}><strong>{n.name}</strong></a> : <strong>{n.name}</strong>} <span class="tabular">{n.noticeDate}</span> {n.phase}</li>)}</ul>}
      <h2>법정동별 실거래 (최근 12개월)</h2>
      {dongs.length === 0 ? <p class="empty">실거래 자료가 아직 없습니다.</p> : (
        <div class="table-wrap"><table class="data-table">
          <thead><tr><th>법정동</th><th class="num">거래</th><th class="num">최근 계약</th></tr></thead>
          <tbody>{dongs.map((d) => <tr><td><a href={d.href}>{d.dong}</a></td><td class="num">{d.count}</td><td class="num">{d.last}</td></tr>)}</tbody>
        </table></div>
      )}
    </section>
  )}
</Base>
```

```astro
---
// file: src/pages/trade/[lawd]/[dong].astro
import Base from '../../../layouts/Base.astro';
import NotFound from '../../../components/NotFound.astro';
import { KV_KEYS } from '../../../lib/kv-keys';
import { getJson } from '../../../server/kv';
import { setPublicCache } from '../../../server/cache';
import { safeParam } from '../../../lib/view/format';
import { tradeView } from '../../../lib/view/region';
import type { TradeBundle } from '../../../lib/view/bundle-types';

// 주소의 시군구 자리는 시군구코드 5자리(이름이 겹치는 '중구' 등 때문)
const lawd = safeParam(Astro.params.lawd);
const dong = safeParam(Astro.params.dong);
const b = lawd && dong && /^\d{5}$/.test(lawd) ? await getJson<TradeBundle>(KV_KEYS.trade(lawd, dong)) : null;
const v = b ? tradeView(b) : null;
if (v) setPublicCache(Astro.response.headers);
else Astro.response.status = 404;
---
<Base title={v ? v.title : '실거래를 찾을 수 없습니다'} description={v ? `${dong} 아파트 단지별·면적대별 최근 12개월 실거래` : ''} sources={['trade']} noindex={!v}>
  {!v ? <NotFound message="최근 12개월 거래가 있는 법정동만 볼 수 있습니다." /> : (
    <section>
      <h1>{v.title}</h1>
      <p class="page-notice">최근 12개월 계약 기준. 해제된 거래는 표시만 하고 시세 계산에서 뺍니다.</p>
      {v.complexes.length === 0 ? <p class="empty">거래가 없습니다.</p> : v.complexes.map((c) => (
        <section>
          <h2>{c.name} <small>{c.buildYear}</small></h2>
          {c.areas.map((a) => (
            <>
              <h3 class="tabular">{a.area}</h3>
              <div class="table-wrap"><table class="data-table">
                <thead><tr><th>계약일</th><th class="num">층</th><th class="num">거래 금액</th></tr></thead>
                <tbody>{a.rows.map((r) => <tr><td class="num">{r.date}{r.cancelled && ' (해제)'}</td><td class="num">{r.floor}</td><td class="num">{r.amount}</td></tr>)}</tbody>
              </table></div>
            </>
          ))}
        </section>
      ))}
    </section>
  )}
</Base>
```

- [ ] **Step 6: 로컬 데이터로 확인한다**

fixture 동기화 뒤 `npm run build && npx wrangler dev`, 다른 창에서:
```bash
curl -s http://localhost:8787/region | grep -c "전남광주통합특별시"
curl -s "http://localhost:8787/region/%EA%B2%BD%EA%B8%B0%EB%8F%84" | grep -c "시흥시"
curl -s "http://localhost:8787/region/%EA%B2%BD%EA%B8%B0%EB%8F%84/%EC%8B%9C%ED%9D%A5%EC%8B%9C" | grep -c "청약 공고"
curl -s "http://localhost:8787/trade/11680/%EB%8C%80%EC%B9%98%EB%8F%99" | grep -c "대치동 아파트 실거래"
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:8787/region/%EC%97%86%EB%8A%94%EB%8F%84"
curl -s http://localhost:8787/competition | grep -c "경쟁률 자료가 아직 없습니다"
```
Expected: 1 이상, 1 이상, 1 이상, 1 이상, `404`, `1`(fixture 경쟁률은 비어 있음). 끈다.

- [ ] **Step 7: 커밋**

```bash
git add src/lib/view/region.ts src/pages/competition.astro src/pages/region src/pages/trade tests/view-region.test.ts
git commit -m "화면: 경쟁률 모음, 시도·시군구 화면(청약통장 현황), 동별 실거래 표"
```

---

### Task 6: 공모주 화면 (자료 없을 때 포함)

**Files:**
- Create: `src/lib/view/ipo.ts`
- Create: `src/pages/ipo/index.astro`, `src/pages/ipo/[corp].astro`
- Test: `tests/view-ipo.test.ts`

**Interfaces:**
- Consumes: `IpoBundle`, `CalendarBundle`, `CalendarEvent`, `eventRow`, `EventRow`, `formatDay`, `formatRange`, `formatCount`, `BANNED_WORDS` (`src/lib/view/apt.ts`), `KV_KEYS`, `safeParam`
- Produces:
  - `IPO_DISCLAIMER = '투자 권유가 아닙니다.'`
  - `ipoEvents(bundles: (CalendarBundle | null)[]): EventRow[]` — `ipo-*` 일정만, 날짜순
  - `formatWon(n: number | null): string` — `'12,000원'`
  - `interface IpoView { name: string; market: string; stateBadge: string | null; schedule: InfoRow[]; price: InfoRow[]; underwriters: string; revisions: { date: string; note: string }[]; lockup: { date: string; kind: string; shares: string }[] }`, `ipoView(b: IpoBundle): IpoView`

- [ ] **Step 1: 실패하는 시험을 쓴다**

```ts
// file: tests/view-ipo.test.ts
import { describe, it, expect } from 'vitest';
import { ipoView, ipoEvents, formatWon, IPO_DISCLAIMER } from '../src/lib/view/ipo';
import { BANNED_WORDS } from '../src/lib/view/apt';
import type { IpoBundle } from '../src/lib/view/bundle-types';

const b = (over: Partial<IpoBundle['ipo']> = {}, lockup?: IpoBundle['lockup']): IpoBundle => ({
  ipo: {
    corp_code: '00123456', name: '가나다전자', stock_code: '123450', market: '코스닥', sub_start: '2026-11-20', sub_end: '2026-11-21',
    price_low: 12000, price_high: 15000, price_final: null, listing_date: null, underwriters: '한국투자증권, 미래에셋증권',
    offer_shares: 1000000, revisions: '[{"date":"2026-11-10","note":"공모가 범위 정정"}]', state: 'normal', ...over,
  },
  ...(lockup ? { lockup } : {}),
});

describe('ipoView', () => {
  it('일정·희망가·주관사·정정 이력', () => {
    const v = ipoView(b());
    expect(v.schedule).toEqual([{ label: '청약', value: '2026.11.20(금) ~ 11.21(토)' }, { label: '공모 주식 수', value: '1,000,000주' }]);
    expect(v.price).toEqual([{ label: '희망 공모가', value: '12,000원 ~ 15,000원' }]);
    expect(v.underwriters).toBe('한국투자증권, 미래에셋증권');
    expect(v.revisions).toEqual([{ date: '2026.11.10(화)', note: '공모가 범위 정정' }]);
  });
  it('확정가·상장일이 있으면 줄이 생긴다', () => {
    const v = ipoView(b({ price_final: 14000, listing_date: '2026-12-01' }));
    expect(v.price.map((r) => r.label)).toEqual(['희망 공모가', '확정 공모가']);
    expect(v.schedule.map((r) => r.label)).toContain('상장');
  });
  it('보호예수가 없으면 빈 배열 (수집 꺼짐, Review Focus 3)', () => {
    expect(ipoView(b()).lockup).toEqual([]);
    expect(ipoView(b({}, [{ release_date: '2027-05-20', share_kind: '최대주주', shares: 500000 }])).lockup).toEqual([{ date: '2027.05.20(목)', kind: '최대주주', shares: '500,000주' }]);
  });
  it('정정 이력이 깨진 JSON 이면 빈 배열', () => expect(ipoView(b({ revisions: '[x' })).revisions).toEqual([]));
  it('철회는 배지', () => expect(ipoView(b({ state: 'cancelled' })).stateBadge).toBe('철회'));
  it('어떤 값이 와도 평가어를 쓰지 않는다 (spec §13)', () => {
    const all = JSON.stringify([ipoView(b()), ipoView(b({ price_final: 14000, listing_date: '2026-12-01', state: 'corrected' })), IPO_DISCLAIMER]);
    expect(all).not.toMatch(BANNED_WORDS);
    expect(all).not.toMatch(/수익|매수|매도|전망/);
  });
  it('안내 문구', () => expect(IPO_DISCLAIMER).toBe('투자 권유가 아닙니다.'));
});

describe('ipoEvents', () => {
  it('ipo-* 일정만, 묶음이 없어도 된다', () => {
    const rows = ipoEvents([
      { month: '2026-11', events: [
        { date: '2026-11-20', endDate: '2026-11-21', kind: 'ipo-sub', ref: 'ipo:00123456', title: '가나다전자' },
        { date: '2026-11-16', kind: 'rank1', ref: 'apt:P1', title: '시흥' },
      ] },
      null,
    ]);
    expect(rows.map((r) => r.title)).toEqual(['가나다전자']);
    expect(rows[0].href).toBe('/ipo/00123456');
    expect(ipoEvents([null, null])).toEqual([]);
  });
});

describe('formatWon', () => {
  it('원 단위', () => {
    expect(formatWon(12000)).toBe('12,000원');
    expect(formatWon(null)).toBe('-');
  });
});
```

- [ ] **Step 2: 시험이 실패하는지 본다**

Run: `npm test -- tests/view-ipo.test.ts`
Expected: FAIL — `Failed to resolve import "../src/lib/view/ipo"`

- [ ] **Step 3: view 함수를 쓴다**

```ts
// file: src/lib/view/ipo.ts
// 공모주 목록·상세 (spec §7, §13). 사실만 — 의견·예상 수익·추천 금지.
// 지금은 DART 키가 없고 보호예수 수집이 꺼져 있어 ipo: 묶음과 ipo-* 일정이 없다 → 화면은 빈 안내
import type { IpoBundle, CalendarBundle } from './bundle-types';
import type { InfoRow } from './apt';
import { eventRow, type EventRow } from './calendar';
import { formatDay, formatRange, formatCount } from './format';

export const IPO_DISCLAIMER = '투자 권유가 아닙니다.';

export interface IpoView {
  name: string; market: string; stateBadge: string | null; schedule: InfoRow[]; price: InfoRow[];
  underwriters: string; revisions: { date: string; note: string }[]; lockup: { date: string; kind: string; shares: string }[];
}

export const formatWon = (n: number | null): string => (n === null ? '-' : `${n.toLocaleString('ko-KR')}원`);

export function ipoEvents(bundles: (CalendarBundle | null)[]): EventRow[] {
  return bundles
    .flatMap((b) => b?.events ?? [])
    .filter((e) => e.kind.startsWith('ipo-'))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(eventRow);
}

function revisionsOf(json: string | null): { date: string; note: string }[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json) as unknown;
    if (!Array.isArray(v)) return [];
    return v
      .filter((r): r is { date?: unknown; note?: unknown } => typeof r === 'object' && r !== null)
      .map((r) => ({ date: formatDay(typeof r.date === 'string' ? r.date : null), note: typeof r.note === 'string' ? r.note : '정정' }));
  } catch {
    return [];
  }
}

export function ipoView(b: IpoBundle): IpoView {
  const i = b.ipo;
  const schedule: InfoRow[] = [];
  if (i.sub_start || i.sub_end) schedule.push({ label: '청약', value: formatRange(i.sub_start, i.sub_end) });
  if (i.listing_date) schedule.push({ label: '상장', value: formatDay(i.listing_date) });
  if (i.offer_shares !== null) schedule.push({ label: '공모 주식 수', value: `${formatCount(i.offer_shares)}주` });
  const price: InfoRow[] = [];
  if (i.price_low !== null || i.price_high !== null) price.push({ label: '희망 공모가', value: `${formatWon(i.price_low)} ~ ${formatWon(i.price_high)}` });
  if (i.price_final !== null) price.push({ label: '확정 공모가', value: formatWon(i.price_final) });
  return {
    name: i.name,
    market: i.market ?? '-',
    stateBadge: i.state === 'cancelled' ? '철회' : i.state === 'corrected' ? '정정' : null,
    schedule,
    price,
    underwriters: i.underwriters ?? '-',
    revisions: revisionsOf(i.revisions),
    lockup: (b.lockup ?? []).map((l) => ({ date: formatDay(l.release_date), kind: l.share_kind, shares: l.shares !== null ? `${formatCount(l.shares)}주` : '-' })),
  };
}
```

`schedule` 순서는 청약 → 상장 → 공모 주식 수다. 첫 시험(상장일 없음)의 기대값 `['청약', '공모 주식 수']` 와 맞다.

- [ ] **Step 4: 시험이 통과하는지 본다**

Run: `npm test -- tests/view-ipo.test.ts`
Expected: PASS

- [ ] **Step 5: 페이지를 쓴다**

```astro
---
// file: src/pages/ipo/index.astro
import Base from '../../layouts/Base.astro';
import EventList from '../../components/EventList.astro';
import { KV_KEYS } from '../../lib/kv-keys';
import { getJson } from '../../server/kv';
import { setPublicCache } from '../../server/cache';
import { todayKst } from '../../lib/date';
import { nextMonth } from '../../lib/view/calendar';
import { ipoEvents, IPO_DISCLAIMER } from '../../lib/view/ipo';
import type { CalendarBundle } from '../../lib/view/bundle-types';

const ym = todayKst().slice(0, 7);
const rows = ipoEvents(await Promise.all([getJson<CalendarBundle>(KV_KEYS.calendar(ym)), getJson<CalendarBundle>(KV_KEYS.calendar(nextMonth(ym)))]));
setPublicCache(Astro.response.headers);
---
<Base title="공모주 일정" description="공모주 청약·환불·상장·보호예수 해제 일정" sources={['dart', 'fsc']}>
  <h1>공모주 일정</h1>
  <p class="hint">{IPO_DISCLAIMER}</p>
  <EventList rows={rows} empty="공모주 일정 수집을 준비하고 있습니다. 지금은 아파트 청약 일정만 제공합니다." />
</Base>
```

```astro
---
// file: src/pages/ipo/[corp].astro
import Base from '../../layouts/Base.astro';
import NotFound from '../../components/NotFound.astro';
import { KV_KEYS } from '../../lib/kv-keys';
import { getJson } from '../../server/kv';
import { setPublicCache } from '../../server/cache';
import { safeParam } from '../../lib/view/format';
import { ipoView, IPO_DISCLAIMER } from '../../lib/view/ipo';
import type { IpoBundle } from '../../lib/view/bundle-types';

const corp = safeParam(Astro.params.corp);
const b = corp && /^\d{8}$/.test(corp) ? await getJson<IpoBundle>(KV_KEYS.ipo(corp)) : null;
const v = b ? ipoView(b) : null;
if (v) setPublicCache(Astro.response.headers);
else Astro.response.status = 404;
---
<Base title={v ? `${v.name} 공모주 일정` : '공모주를 찾을 수 없습니다'} description={v ? `${v.name} 청약 일정, 희망·확정 공모가, 주관사, 보호예수 해제 일정` : ''} sources={['dart', 'fsc']} noindex={!v}>
  {!v ? <NotFound message="공모주 자료 수집을 준비하고 있습니다." /> : (
    <article>
      <h1>{v.name}</h1>
      <p><span class="badge">{v.market}</span>{v.stateBadge && <span class="badge badge--corrected">{v.stateBadge}</span>}</p>
      <p class="hint">{IPO_DISCLAIMER}</p>
      <h2>일정</h2>
      <dl class="info">{v.schedule.map((r) => <><dt>{r.label}</dt><dd class="tabular">{r.value}</dd></>)}</dl>
      <h2>공모가</h2>
      {v.price.length === 0 ? <p class="empty">공모가 정보가 아직 없습니다.</p> : <dl class="info">{v.price.map((r) => <><dt>{r.label}</dt><dd class="tabular">{r.value}</dd></>)}</dl>}
      <p>주관사: {v.underwriters}</p>
      {v.revisions.length > 0 && (<><h2>정정 이력</h2><ul class="rows">{v.revisions.map((r) => <li><span class="tabular">{r.date}</span> {r.note}</li>)}</ul></>)}
      {v.lockup.length > 0 && (
        <>
          <h2>보호예수 해제 일정</h2>
          <div class="table-wrap"><table class="data-table">
            <thead><tr><th>해제일</th><th>구분</th><th class="num">주식 수</th></tr></thead>
            <tbody>{v.lockup.map((l) => <tr><td class="num">{l.date}</td><td>{l.kind}</td><td class="num">{l.shares}</td></tr>)}</tbody>
          </table></div>
        </>
      )}
    </article>
  )}
</Base>
```

- [ ] **Step 6: 로컬로 확인한다**

`npm run build && npx wrangler dev`, 다른 창에서:
```bash
curl -s http://localhost:8787/ipo | grep -c "투자 권유가 아닙니다."
curl -s http://localhost:8787/ipo | grep -c "공모주 일정 수집을 준비하고 있습니다"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8787/ipo/00123456
```
Expected: `1`, `1`, `404`(묶음 없음). 끈다.

- [ ] **Step 7: 커밋**

```bash
git add src/lib/view/ipo.ts src/pages/ipo tests/view-ipo.test.ts
git commit -m "화면: 공모주 목록·상세 — 자료 없을 때 안내, 보호예수 없으면 숨김, 평가어 금지 시험"
```

---

### Task 7: 자격 판정 화면

**Files:**
- Create: `src/lib/view/eligibility-form.ts`
- Create: `src/components/EligibilityForm.astro`, `src/scripts/eligibility-client.ts`
- Create: `src/pages/eligibility/index.astro`, `src/pages/eligibility/[no]/[model].astro`
- Test: `tests/view-eligibility-form.test.ts`, `tests/eligibility-no-leak.test.ts`

**Interfaces:**
- Consumes: `judgeAll(a: ApplicantInput, n: NoticeInput): TypeResult[]`, `TYPE_LABEL`, `VERDICT_LABEL`, `DISCLAIMER`, 타입 `ApplicantInput`, `NoticeInput`, `Child`, `TypeResult`, `Verdict` (`src/lib/eligibility`), `AptBundle`, `normalizeDate` (`src/lib/date.ts`), `safeParam`, `KV_KEYS`
- Produces:
  - `type FormValues = Record<string, string>` — 입력칸 `data-field` 이름 → 값(빈 문자열은 '모름')
  - `MAX_CHILDREN = 6`
  - `interface FieldError { field: string; message: string }`
  - `interface ParsedForm { applicant: ApplicantInput; notice: NoticeInput; errors: FieldError[] }`, `parseForm(v: FormValues): ParsedForm`
  - `prefillFromApt(b: AptBundle, modelNo: string): FormValues | null`
  - `interface ResultView { label: string; verdict: string; verdictClass: 'ok' | 'no' | 'check'; rank: string | null; checks: { label: string; article: string; verdict: string; note: string | null }[] }`, `resultView(results: TypeResult[]): ResultView[]`
  - `EligibilityForm.astro` Props: `{ prefill: FormValues; title: string | null }`

입력칸 이름(`data-field`): `supplyKind`, `areaExcl`, `noticeDate`, `publicBuilder`, `homeOwner`, `everOwned`, `householdHead`, `singleHousehold`, `marriageDate`, `childCount`, `children.{i}.kind`, `children.{i}.birth`(i = 0..5), `householdSize`, `monthlyIncome`(만원), `dualIncome`, `incomeTaxYears`, `savingsMonths`, `savingsPayments`, `savingsTotal`(만원), `priorSpecial`, `parentBirth`, `parentSince`, `parentSpouseHomeless`. 예·아니오 칸 값은 `'true' | 'false' | ''`.

- [ ] **Step 1: 실패하는 시험을 쓴다**

```ts
// file: tests/view-eligibility-form.test.ts
import { describe, it, expect } from 'vitest';
import { parseForm, prefillFromApt, resultView } from '../src/lib/view/eligibility-form';
import type { AptBundle } from '../src/lib/view/bundle-types';

const base = {
  supplyKind: 'national', areaExcl: '59.9', noticeDate: '2026-11-06', publicBuilder: '',
  homeOwner: 'none', everOwned: 'false', householdHead: 'true', singleHousehold: 'false',
  marriageDate: '2024-05-01', childCount: '1', 'children.0.kind': 'born', 'children.0.birth': '2025-03-01',
  householdSize: '3', monthlyIncome: '600', dualIncome: 'true', incomeTaxYears: '5',
  savingsMonths: '30', savingsPayments: '30', savingsTotal: '600', priorSpecial: 'false',
  parentBirth: '', parentSince: '', parentSpouseHomeless: '',
};

describe('parseForm', () => {
  it('값을 입력 타입으로 바꾼다 (월소득 만원 → 원)', () => {
    const p = parseForm(base);
    expect(p.errors).toEqual([]);
    expect(p.notice).toEqual({ supplyKind: 'national', areaExcl: 59.9, noticeDate: '2026-11-06', publicBuilder: null });
    expect(p.applicant).toMatchObject({
      homeOwner: 'none', everOwned: false, householdHead: true, marriageDate: '2024-05-01',
      children: [{ kind: 'born', birth: '2025-03-01' }], householdSize: 3, monthlyIncome: 6_000_000,
      savingsTotal: 600, priorSpecial: false, parent: null,
    });
  });
  it('빈 칸은 모름(null)', () => {
    const p = parseForm({ ...base, everOwned: '', householdSize: '', monthlyIncome: '' });
    expect(p.applicant.everOwned).toBeNull();
    expect(p.applicant.householdSize).toBeNull();
    expect(p.applicant.monthlyIncome).toBeNull();
  });
  it('가구원 수가 자녀 수보다 적으면 오류 (Plan B 결정)', () => {
    const p = parseForm({ ...base, childCount: '2', 'children.1.kind': 'fetus', 'children.1.birth': '', householdSize: '1' });
    expect(p.errors).toContainEqual({ field: 'householdSize', message: '세대 구성원 수(태아 포함)가 자녀 수보다 적습니다.' });
  });
  it('공고일보다 뒤인 날짜는 오류, 태아 출산 예정일은 예외', () => {
    const p = parseForm({ ...base, marriageDate: '2026-12-01', childCount: '1', 'children.0.kind': 'fetus', 'children.0.birth': '2027-02-01' });
    expect(p.errors).toEqual([{ field: 'marriageDate', message: '공고일(2026-11-06)보다 뒤 날짜입니다.' }]);
  });
  it('형식이 틀린 날짜·음수·숫자 아님은 오류', () => {
    const p = parseForm({ ...base, marriageDate: '2024-13-01', savingsMonths: '-1', monthlyIncome: '육백' });
    expect(p.errors.map((e) => e.field).sort()).toEqual(['marriageDate', 'monthlyIncome', 'savingsMonths']);
  });
  it('공급 구분을 안 고르면 오류', () => {
    expect(parseForm({ ...base, supplyKind: '' }).errors).toContainEqual({ field: 'supplyKind', message: '국민주택·민영주택 중 하나를 고르세요.' });
  });
  it('자녀 수는 0~6, 보이지 않는 자녀 칸은 무시', () => {
    expect(parseForm({ ...base, childCount: '0' }).applicant.children).toEqual([]);
    expect(parseForm({ ...base, childCount: '9' }).errors.map((e) => e.field)).toContain('childCount');
  });
  it('부모 칸에 하나라도 값이 있으면 parent 를 만든다', () => {
    expect(parseForm({ ...base, parentBirth: '1955-01-01', parentSince: '2020-01-01', parentSpouseHomeless: 'true' }).applicant.parent)
      .toEqual({ birth: '1955-01-01', since: '2020-01-01', spouseHomeless: true });
  });
});

describe('prefillFromApt', () => {
  const b = {
    notice: { pblanc_no: 'P1', supply_kind: 'private', notice_date: '2026-11-01' },
    models: [{ model_no: '01', area_excl: 84.99 }],
  } as unknown as AptBundle;
  it('공개값 세 개만 채운다', () => expect(prefillFromApt(b, '01')).toEqual({ supplyKind: 'private', areaExcl: '84.99', noticeDate: '2026-11-01' }));
  it('주택형이 없으면 null', () => expect(prefillFromApt(b, '99')).toBeNull());
});

describe('resultView', () => {
  it('라벨·판정·순위', () => {
    const v = resultView([{ type: 'newlywed', article: '제41조', verdict: 'check', rank: '1순위', checks: [{ label: '무주택', article: '제41조', verdict: 'ok' }] }]);
    expect(v[0]).toEqual({ label: '신혼부부', verdict: '확인 필요', verdictClass: 'check', rank: '1순위', checks: [{ label: '무주택', article: '제41조', verdict: '가능', note: null }] });
  });
});
```

`TYPE_LABEL.newlywed` 가 `'신혼부부'` 가 아니면 `src/lib/eligibility/index.ts` 의 실제 값으로 기대값을 바꾼다(라벨은 Plan B 소관).

```ts
// file: tests/eligibility-no-leak.test.ts
// Review Focus 4: 판정 입력값이 브라우저 밖으로 나갈 길이 없는지 소스로 확인한다
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const files = [
  'src/scripts/eligibility-client.ts',
  'src/components/EligibilityForm.astro',
  'src/pages/eligibility/index.astro',
  'src/pages/eligibility/[no]/[model].astro',
];
const banned: [RegExp, string][] = [
  [/<form\b/i, '<form> (제출하면 주소 쿼리로 나간다)'],
  [/\bfetch\s*\(/, 'fetch'],
  [/XMLHttpRequest/, 'XMLHttpRequest'],
  [/sendBeacon/, 'sendBeacon'],
  [/\blocation\b/, 'location'],
  [/\bhistory\./, 'history'],
  [/localStorage|sessionStorage|indexedDB|document\.cookie/, '저장소'],
  [/new\s+(WebSocket|EventSource|Image)\b/, '외부 연결'],
  [/\bname=["']/, 'name 속성 (폼 값 수집 대상)'],
];

describe('판정 입력 유출 없음', () => {
  for (const f of files) {
    it(f, () => {
      const src = readFileSync(f, 'utf8');
      for (const [re, what] of banned) expect(re.test(src), `${f} 에 ${what}`).toBe(false);
    });
  }
});
```

- [ ] **Step 2: 시험이 실패하는지 본다**

Run: `npm test -- tests/view-eligibility-form.test.ts tests/eligibility-no-leak.test.ts`
Expected: FAIL — `Failed to resolve import "../src/lib/view/eligibility-form"`, `ENOENT ... eligibility-client.ts`

- [ ] **Step 3: 폼 로직을 쓴다**

```ts
// file: src/lib/view/eligibility-form.ts
// 자격 판정 폼 값 → 판정 입력 (spec §8). 브라우저에서만 쓴다 — 값은 서버·URL·저장소로 보내지 않는다
import type { ApplicantInput, NoticeInput, Child, HomeOwner, TypeResult, Verdict } from '../eligibility/types';
import { TYPE_LABEL, VERDICT_LABEL } from '../eligibility';
import type { AptBundle } from './bundle-types';
import { normalizeDate } from '../date';

export type FormValues = Record<string, string>;
export interface FieldError { field: string; message: string }
export interface ParsedForm { applicant: ApplicantInput; notice: NoticeInput; errors: FieldError[] }
export const MAX_CHILDREN = 6;

const HOME_OWNER: readonly HomeOwner[] = ['none', 'self_or_spouse', 'other_member'];
const CHILD_KIND: readonly Child['kind'][] = ['born', 'fetus', 'adopted'];

export function parseForm(v: FormValues): ParsedForm {
  const errors: FieldError[] = [];
  const get = (k: string) => (v[k] ?? '').trim();
  const err = (field: string, message: string) => errors.push({ field, message });
  const bool = (k: string): boolean | null => (get(k) === 'true' ? true : get(k) === 'false' ? false : null);
  const num = (k: string, opts: { int?: boolean; max?: number } = {}): number | null => {
    const s = get(k).replace(/,/g, '');
    if (!s) return null;
    const n = Number(s);
    if (!Number.isFinite(n) || n < 0 || (opts.int && !Number.isInteger(n)) || (opts.max !== undefined && n > opts.max)) {
      err(k, '0 이상의 올바른 숫자를 넣으세요.');
      return null;
    }
    return n;
  };
  const date = (k: string): string | null => {
    const s = get(k);
    if (!s) return null;
    const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? normalizeDate(s) : null;
    if (!d || d !== s) { err(k, '날짜 형식이 맞지 않습니다(YYYY-MM-DD).'); return null; }
    return d;
  };

  const supply = get('supplyKind');
  if (supply !== 'national' && supply !== 'private') err('supplyKind', '국민주택·민영주택 중 하나를 고르세요.');
  const notice: NoticeInput = {
    supplyKind: supply === 'private' ? 'private' : 'national',
    areaExcl: num('areaExcl'),
    noticeDate: date('noticeDate'),
    publicBuilder: bool('publicBuilder'),
  };

  const childCount = num('childCount', { int: true, max: MAX_CHILDREN }) ?? 0;
  const children: Child[] = [];
  for (let i = 0; i < childCount; i++) {
    const kind = get(`children.${i}.kind`) as Child['kind'];
    children.push({ kind: CHILD_KIND.includes(kind) ? kind : 'born', birth: date(`children.${i}.birth`) });
  }

  const owner = get('homeOwner') as HomeOwner;
  const parentBirth = date('parentBirth');
  const parentSince = date('parentSince');
  const parentSpouse = bool('parentSpouseHomeless');
  const income = num('monthlyIncome');

  const applicant: ApplicantInput = {
    homeOwner: HOME_OWNER.includes(owner) ? owner : null,
    everOwned: bool('everOwned'),
    householdHead: bool('householdHead'),
    singleHousehold: bool('singleHousehold'),
    marriageDate: date('marriageDate'),
    children,
    householdSize: num('householdSize', { int: true, max: 20 }),
    monthlyIncome: income === null ? null : Math.round(income * 10_000),
    dualIncome: bool('dualIncome'),
    incomeTaxYears: num('incomeTaxYears', { int: true, max: 80 }),
    savingsMonths: num('savingsMonths', { int: true, max: 1200 }),
    savingsPayments: num('savingsPayments', { int: true, max: 1200 }),
    savingsTotal: num('savingsTotal'),
    priorSpecial: bool('priorSpecial'),
    parent: parentBirth || parentSince || parentSpouse !== null ? { birth: parentBirth, since: parentSince, spouseHomeless: parentSpouse } : null,
  };

  if (applicant.householdSize !== null && applicant.householdSize < children.length) {
    err('householdSize', '세대 구성원 수(태아 포함)가 자녀 수보다 적습니다.');
  }
  const nd = notice.noticeDate;
  if (nd) {
    const dated: [string, string | null][] = [
      ['marriageDate', applicant.marriageDate],
      ['parentBirth', parentBirth],
      ['parentSince', parentSince],
      ...children.map((c, i): [string, string | null] => [`children.${i}.birth`, c.kind === 'fetus' ? null : c.birth]),
    ];
    for (const [field, d] of dated) if (d && d > nd) err(field, `공고일(${nd})보다 뒤 날짜입니다.`);
  }
  return { applicant, notice, errors };
}

export function prefillFromApt(b: AptBundle, modelNo: string): FormValues | null {
  const m = b.models.find((x) => x.model_no === modelNo);
  if (!m) return null;
  return {
    supplyKind: b.notice.supply_kind ?? '',
    areaExcl: m.area_excl !== null ? String(m.area_excl) : '',
    noticeDate: b.notice.notice_date ?? '',
  };
}

export interface ResultView {
  label: string; verdict: string; verdictClass: Verdict; rank: string | null;
  checks: { label: string; article: string; verdict: string; note: string | null }[];
}

export function resultView(results: TypeResult[]): ResultView[] {
  return results.map((r) => ({
    label: TYPE_LABEL[r.type], verdict: VERDICT_LABEL[r.verdict], verdictClass: r.verdict, rank: r.rank ?? null,
    checks: r.checks.map((c) => ({ label: c.label, article: c.article, verdict: VERDICT_LABEL[c.verdict], note: c.note ?? null })),
  }));
}
```

- [ ] **Step 4: 폼·스크립트·페이지를 쓴다**

```astro
---
// file: src/components/EligibilityForm.astro
// <form> 과 name 속성을 쓰지 않는다 — 제출·주소 쿼리로 값이 나갈 길을 없앤다 (tests/eligibility-no-leak.test.ts)
import { MAX_CHILDREN, type FormValues } from '../lib/view/eligibility-form';
import { DISCLAIMER } from '../lib/eligibility';
interface Props { prefill: FormValues; title: string | null }
const { prefill, title } = Astro.props;
const val = (k: string) => prefill[k] ?? '';
const yesNo = [['', '모름'], ['true', '예'], ['false', '아니오']];
---
<section class="elig" data-elig>
  {title && <p class="hint">{title} 공고값을 채워 두었습니다. 다른 공고로 보려면 고치세요.</p>}
  <p class="hint">입력값은 이 기기 안에서만 계산하고 어디에도 보내거나 저장하지 않습니다.</p>

  <fieldset><legend>공고</legend>
    <label>공급 구분 <select data-field="supplyKind">
      {[['', '선택'], ['national', '국민주택'], ['private', '민영주택']].map(([v, t]) => <option value={v} selected={val('supplyKind') === v}>{t}</option>)}
    </select></label>
    <label>전용면적(㎡) <input data-field="areaExcl" inputmode="decimal" value={val('areaExcl')} /></label>
    <label>입주자모집공고일 <input data-field="noticeDate" type="date" value={val('noticeDate')} /></label>
    <label>국가·지자체·LH·지방공사 공급 <select data-field="publicBuilder">{yesNo.map(([v, t]) => <option value={v}>{t}</option>)}</select></label>
  </fieldset>

  <fieldset><legend>세대</legend>
    <label>지금 세대의 주택 소유 <select data-field="homeOwner">
      {[['', '모름'], ['none', '세대 전원 무주택'], ['self_or_spouse', '본인·배우자 소유'], ['other_member', '다른 세대원 소유']].map(([v, t]) => <option value={v}>{t}</option>)}
    </select></label>
    <label>과거 주택 소유 이력 <select data-field="everOwned">{yesNo.map(([v, t]) => <option value={v}>{t}</option>)}</select></label>
    <label>세대주인가 <select data-field="householdHead">{yesNo.map(([v, t]) => <option value={v}>{t}</option>)}</select></label>
    <label>단독세대주·동거인 <select data-field="singleHousehold">{yesNo.map(([v, t]) => <option value={v}>{t}</option>)}</select></label>
    <label>혼인신고일(미혼이면 비움) <input data-field="marriageDate" type="date" /></label>
    <label>세대 구성원 수(태아 포함) <input data-field="householdSize" inputmode="numeric" /></label>
    <label>자녀 수 <select data-field="childCount">{Array.from({ length: MAX_CHILDREN + 1 }, (_, i) => <option value={String(i)}>{i}명</option>)}</select></label>
    {Array.from({ length: MAX_CHILDREN }, (_, i) => (
      <div class="child" data-child={i} hidden>
        <label>{i + 1}째 <select data-field={`children.${i}.kind`}>{[['born', '출생'], ['fetus', '태아'], ['adopted', '입양']].map(([v, t]) => <option value={v}>{t}</option>)}</select></label>
        <label>생년월일(태아는 출산 예정일) <input data-field={`children.${i}.birth`} type="date" /></label>
      </div>
    ))}
  </fieldset>

  <fieldset><legend>소득·통장</legend>
    <label>세대 월평균 소득(만원) <input data-field="monthlyIncome" inputmode="numeric" /></label>
    <label>배우자도 소득이 있다 <select data-field="dualIncome">{yesNo.map(([v, t]) => <option value={v}>{t}</option>)}</select></label>
    <label>소득세 납부 연수 <input data-field="incomeTaxYears" inputmode="numeric" /></label>
    <label>청약통장 가입 개월 <input data-field="savingsMonths" inputmode="numeric" /></label>
    <label>납입 회차 <input data-field="savingsPayments" inputmode="numeric" /></label>
    <label>납입 총액(만원) <input data-field="savingsTotal" inputmode="numeric" /></label>
    <label>본인·배우자 특별공급 당첨 이력 <select data-field="priorSpecial">{yesNo.map(([v, t]) => <option value={v}>{t}</option>)}</select></label>
  </fieldset>

  <fieldset><legend>65세 이상 직계존속 부양(해당하면)</legend>
    <label>생년월일 <input data-field="parentBirth" type="date" /></label>
    <label>같은 등본에 오른 날 <input data-field="parentSince" type="date" /></label>
    <label>그 배우자도 무주택 <select data-field="parentSpouseHomeless">{yesNo.map(([v, t]) => <option value={v}>{t}</option>)}</select></label>
  </fieldset>

  <button type="button" class="btn" data-judge>판정하기</button>
  <div data-errors role="alert"></div>
  <div data-result aria-live="polite"></div>
  <p class="page-notice">{DISCLAIMER}</p>
</section>
```

```ts
// file: src/scripts/eligibility-client.ts
// 판정은 이 기기 안에서만. 네트워크·주소·저장소를 쓰지 않는다 (tests/eligibility-no-leak.test.ts)
import { judgeAll, DISCLAIMER } from '../lib/eligibility';
import { parseForm, resultView, type FormValues } from '../lib/view/eligibility-form';

const root = document.querySelector<HTMLElement>('[data-elig]');
if (root) {
  const fields = () => root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-field]');
  const values = (): FormValues => {
    const out: FormValues = {};
    fields().forEach((el) => { out[el.dataset.field as string] = el.value; });
    return out;
  };
  const showChildren = () => {
    const n = Number((root.querySelector<HTMLSelectElement>('[data-field="childCount"]')?.value) ?? 0);
    root.querySelectorAll<HTMLElement>('[data-child]').forEach((el) => { el.hidden = Number(el.dataset.child) >= n; });
  };
  const el = (tag: string, text?: string, cls?: string) => {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  };

  root.querySelector('[data-field="childCount"]')?.addEventListener('change', showChildren);
  showChildren();

  root.querySelector('[data-judge]')?.addEventListener('click', () => {
    const errBox = root.querySelector<HTMLElement>('[data-errors]')!;
    const out = root.querySelector<HTMLElement>('[data-result]')!;
    errBox.replaceChildren();
    out.replaceChildren();
    fields().forEach((f) => f.removeAttribute('aria-invalid'));

    const { applicant, notice, errors } = parseForm(values());
    if (errors.length) {
      for (const e of errors) {
        root.querySelector(`[data-field="${CSS.escape(e.field)}"]`)?.setAttribute('aria-invalid', 'true');
        errBox.append(el('p', e.message, 'field-error'));
      }
      return;
    }
    for (const r of resultView(judgeAll(applicant, notice))) {
      const box = el('section', undefined, 'benefit-card');
      const h = el('h3', r.label);
      h.append(' ', el('span', r.verdict, `verdict--${r.verdictClass}`));
      if (r.rank) h.append(' ', el('span', r.rank, 'badge'));
      const ul = el('ul', undefined, 'bullets');
      for (const c of r.checks) ul.append(el('li', `${c.label} (${c.article}) — ${c.verdict}${c.note ? ` · ${c.note}` : ''}`));
      box.append(h, ul);
      out.append(box);
    }
    out.append(el('p', DISCLAIMER, 'page-notice'));
  });
}
```

```astro
---
// file: src/pages/eligibility/index.astro
import Base from '../../layouts/Base.astro';
import EligibilityForm from '../../components/EligibilityForm.astro';
import { setPublicCache } from '../../server/cache';
setPublicCache(Astro.response.headers);
---
<Base title="특별공급 자격 판정" description="신생아·다자녀·신혼부부·생애최초·노부모 부양 특별공급 자격을 이 기기 안에서 판정합니다." sources={['applyhome']}>
  <h1>특별공급 자격 판정</h1>
  <p>「주택공급에 관한 규칙」 기준. 모르는 칸은 비워 두면 '확인 필요'로 나옵니다.</p>
  <EligibilityForm prefill={{}} title={null} />
  <script>import '../../scripts/eligibility-client';</script>
</Base>
```

```astro
---
// file: src/pages/eligibility/[no]/[model].astro
// 단지 상세의 공개값(공급 구분·전용면적·공고일)만 경로로 받는다. 사용자 입력은 경로·쿼리에 없다
import Base from '../../../layouts/Base.astro';
import NotFound from '../../../components/NotFound.astro';
import EligibilityForm from '../../../components/EligibilityForm.astro';
import { KV_KEYS } from '../../../lib/kv-keys';
import { getJson } from '../../../server/kv';
import { setPublicCache } from '../../../server/cache';
import { safeParam } from '../../../lib/view/format';
import { prefillFromApt } from '../../../lib/view/eligibility-form';
import type { AptBundle } from '../../../lib/view/bundle-types';

const no = safeParam(Astro.params.no);
const model = safeParam(Astro.params.model);
const b = no && model && /^[0-9A-Za-z_-]{1,30}$/.test(no) ? await getJson<AptBundle>(KV_KEYS.apt(no)) : null;
const prefill = b && model ? prefillFromApt(b, model) : null;
if (prefill) setPublicCache(Astro.response.headers);
else Astro.response.status = 404;
---
<Base title={b && prefill ? `${b.notice.name} 특별공급 자격 판정` : '공고를 찾을 수 없습니다'} description="단지 공고값을 채운 특별공급 자격 판정" sources={['applyhome']} noindex canonicalPath="/eligibility">
  {!prefill || !b ? <NotFound message="공고나 주택형을 찾을 수 없습니다. 판정 화면에서 직접 입력할 수 있습니다." /> : (
    <>
      <h1>특별공급 자격 판정</h1>
      <p><a href={`/apt/${encodeURIComponent(b.notice.pblanc_no)}`}>{b.notice.name}</a></p>
      <EligibilityForm prefill={prefill} title={b.notice.name} />
    </>
  )}
  <script>import '../../../scripts/eligibility-client';</script>
</Base>
```

- [ ] **Step 5: 시험이 통과하는지 본다**

Run: `npm test -- tests/view-eligibility-form.test.ts tests/eligibility-no-leak.test.ts && npm run typecheck`
Expected: PASS, typecheck 오류 0

- [ ] **Step 6: 브라우저로 확인한다**

`npm run build && npx wrangler dev` 뒤 브라우저에서 `http://localhost:8787/eligibility/2026820015/01` 을 연다.
- 공급 구분 '국민주택', 전용면적 55, 공고일 2026-11-06 이 채워져 있다.
- 자녀 수 2명 → 자녀 칸 두 개가 보인다. 세대 구성원 수 1 → '판정하기' → "세대 구성원 수(태아 포함)가 자녀 수보다 적습니다." 가 보인다.
- 값을 고쳐 '판정하기' → 유형 다섯 개 결과와 "판정은 입력값 기준 참고 결과이며, 당첨 후 서류 심사로 최종 결정됩니다." 가 보인다.
- 개발자 도구 Network 탭에서 '판정하기' 를 눌러도 요청이 하나도 생기지 않고 주소창이 바뀌지 않는다.
끈다.

- [ ] **Step 7: 커밋**

```bash
git add src/lib/view/eligibility-form.ts src/components/EligibilityForm.astro src/scripts/eligibility-client.ts src/pages/eligibility tests/view-eligibility-form.test.ts tests/eligibility-no-leak.test.ts
git commit -m "화면: 특별공급 자격 판정(브라우저 안에서만, 단지 공개값 미리 채우기, 입력 검증)"
```

---

### Task 8: 사이트맵과 매일 점검(ops:daily)

**Files:**
- Create: `src/lib/view/sitemap.ts`, `src/pages/sitemap.xml.ts`
- Create: `sync/ops/daily-summary.ts`, `sync/ops-daily.ts`
- Modify: `package.json` (`scripts` 에 `ops:daily`)
- Test: `tests/view-sitemap.test.ts`, `tests/ops-daily.test.ts`

**Interfaces:**
- Consumes: `KV_KEYS`, `setPublicCache(headers, sMaxAge)`, `todayKst`, `SITE`, `d1Query`, `kvGetText` (`sync/cloudflare.ts`), `KvManifest` (`sync/bundles.ts`)
- Produces:
  - `SITEMAP_PREFIXES = ['apt:', 'lh:', 'region:', 'trade:']`, `pathOfKey(key: string): string | null`, `staticPaths(today: string): string[]`, `sitemapXml(base: string, paths: string[]): string`
  - `RumRow`, `RumSummary`, `refererLabel(host)`, `tabOf(path)`, `summarizeRum(rows)`, `LOG_HEADER`, `logRow(date, s, names)`, `appendLogRow(existing, date, row)`, `yesterdayKst(now)`, `previousDays(date, n)`, `limitLine(label, used, limit)`, `RunInfo`, `actionsLatest(runs)`, `repoFromRemote(url: string): string | null`, `dayUsage(v: { date: string; used: number } | null, day: string): number`
  - npm 스크립트 `ops:daily`

- [ ] **Step 1: 실패하는 시험을 쓴다**

```ts
// file: tests/view-sitemap.test.ts
import { describe, it, expect } from 'vitest';
import { pathOfKey, staticPaths, sitemapXml } from '../src/lib/view/sitemap';

describe('pathOfKey', () => {
  it('묶음 키 → 화면 주소', () => {
    expect(pathOfKey('apt:2026000557')).toBe('/apt/2026000557');
    expect(pathOfKey('lh:0000061174')).toBe('/lh/0000061174');
    expect(pathOfKey('region:경기도')).toBe('/region/%EA%B2%BD%EA%B8%B0%EB%8F%84');
    expect(pathOfKey('region:경기도:시흥시')).toBe('/region/%EA%B2%BD%EA%B8%B0%EB%8F%84/%EC%8B%9C%ED%9D%A5%EC%8B%9C');
    expect(pathOfKey('trade:11680:대치동')).toBe('/trade/11680/%EB%8C%80%EC%B9%98%EB%8F%99');
  });
  it('화면이 없는 키는 null', () => {
    for (const k of ['home', 'meta:sources', 'calendar:2026-11', 'backfill:trade', 'trade:11680', 'apt:']) expect(pathOfKey(k)).toBeNull();
  });
});

describe('sitemapXml', () => {
  it('고정 주소에 이번 달 캘린더', () => {
    expect(staticPaths('2026-11-07')).toEqual(['/', '/competition', '/region', '/ipo', '/eligibility', '/calendar/2026-11']);
  });
  it('XML 과 이스케이프, 끝 / 정리', () => {
    const xml = sitemapXml('https://a.com/', ['/', '/apt/1&2']);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<loc>https://a.com/</loc>');
    expect(xml).toContain('<loc>https://a.com/apt/1&amp;2</loc>');
  });
});
```

```ts
// file: tests/ops-daily.test.ts
import { describe, it, expect } from 'vitest';
import { summarizeRum, logRow, appendLogRow, tabOf, refererLabel, yesterdayKst, previousDays, limitLine, actionsLatest, repoFromRemote, dayUsage, LOG_HEADER, type RumRow } from '../sync/ops/daily-summary';

const r = (path: string, count: number, visits: number, referer = '', device = 'mobile'): RumRow =>
  ({ count, sum: { visits }, dimensions: { requestPath: path, refererHost: referer, deviceType: device, countryName: 'KR' } });

describe('summarizeRum', () => {
  it('조회·방문·유입·탭·많이 본 페이지', () => {
    const s = summarizeRum([r('/', 10, 5, 'm.search.naver.com'), r('/apt/2026000557', 6, 3, 'www.google.com'), r('/eligibility', 2, 1)]);
    expect(s.views).toBe(18);
    expect(s.visits).toBe(9);
    expect(s.referers).toEqual({ 네이버: 5, 구글: 3, 직접: 1 });
    expect(s.tabs).toEqual({ 홈: 10, '단지 상세': 6, '자격 판정': 2 });
    expect(s.topPages[0]).toEqual({ path: '/', views: 10 });
  });
  it('인코딩된 한글 경로를 풀고 깨진 값은 그대로', () => {
    expect(summarizeRum([r('/region/%EA%B2%BD%EA%B8%B0%EB%8F%84', 1, 1)]).topPages[0].path).toBe('/region/경기도');
    expect(summarizeRum([r('/region/%E0%A4%A', 1, 1)]).topPages[0].path).toBe('/region/%E0%A4%A');
  });
  it('탭 이름', () => {
    expect(tabOf('/trade/11680/대치동')).toBe('실거래·지역');
    expect(tabOf('/calendar/2026-11')).toBe('캘린더');
    expect(tabOf('/lh/1')).toBe('LH 공고');
    expect(tabOf('/x')).toBe('기타');
    expect(refererLabel('cheongyakdamoa.com')).toBe('사이트 안');
  });
});

describe('기록 줄', () => {
  it('단지 이름으로 바꾸고 상세 비중을 계산한다', () => {
    const s = summarizeRum([r('/apt/P1', 5, 2), r('/', 5, 3)]);
    expect(logRow('2026-11-20', s, { P1: '시흥 거모' })).toBe('| 2026-11-20 | 5 | 10 | 0 | 0 | 5 | 50% | 0 | 시흥 거모 5, / 5 |');
  });
  it('같은 날짜는 다시 붙이지 않는다', () => {
    const first = appendLogRow(null, '2026-11-20', '| 2026-11-20 | x |');
    expect(first).toBe(`${LOG_HEADER}| 2026-11-20 | x |\n`);
    expect(appendLogRow(first, '2026-11-20', '| 2026-11-20 | y |')).toBeNull();
  });
});

describe('날짜·한도·Actions', () => {
  it('어제(한국 날짜)와 앞 날짜', () => {
    expect(yesterdayKst(new Date('2026-11-07T16:00:00Z'))).toBe('2026-11-07');
    expect(previousDays('2026-11-07', 2)).toEqual(['2026-11-06', '2026-11-05']);
  });
  it('한도 줄은 70% 넘으면 경고', () => {
    expect(limitLine('KV 쓰기', 800, 1000)).toBe('KV 쓰기 800 / 1,000 (80%) ⚠ 70% 넘음');
    expect(limitLine('D1 쓴 행', 10, 100000)).toBe('D1 쓴 행 10 / 100,000 (0%)');
  });
  it('그날 기록만 사용량으로 센다', () => {
    expect(dayUsage({ date: '2026-11-07', used: 300 }, '2026-11-07')).toBe(300);
    expect(dayUsage({ date: '2026-11-06', used: 300 }, '2026-11-07')).toBe(0);
    expect(dayUsage(null, '2026-11-07')).toBe(0);
  });
  it('워크플로별 최근 결과와 실패 수', () => {
    const runs = [
      { name: 'sync', conclusion: 'success', status: 'completed', created_at: '2026-11-07T00:00:00Z' },
      { name: 'sync', conclusion: 'failure', status: 'completed', created_at: '2026-11-06T00:00:00Z' },
    ];
    expect(actionsLatest(runs)).toEqual([{ name: 'sync', latest: 'success', at: '2026-11-07 09:00', failures: 1 }]);
  });
  it('저장소 주소에서 owner/repo', () => {
    expect(repoFromRemote('https://github.com/a/cheongyak.git')).toBe('a/cheongyak');
    expect(repoFromRemote('git@github.com:a/cheongyak.git')).toBe('a/cheongyak');
    expect(repoFromRemote('')).toBeNull();
  });
});
```

- [ ] **Step 2: 시험이 실패하는지 본다**

Run: `npm test -- tests/view-sitemap.test.ts tests/ops-daily.test.ts`
Expected: FAIL — `Failed to resolve import "../src/lib/view/sitemap"`, `"../sync/ops/daily-summary"`

- [ ] **Step 3: 사이트맵을 쓴다**

```ts
// file: src/lib/view/sitemap.ts
// 사이트맵 (spec §12: 배포 뒤 서치콘솔에 낸다). KV 키 목록 → 화면 주소
export const SITEMAP_PREFIXES = ['apt:', 'lh:', 'region:', 'trade:'] as const;

const enc = encodeURIComponent;
export function pathOfKey(key: string): string | null {
  const [kind, ...rest] = key.split(':');
  if (rest.some((p) => !p)) return null;
  if ((kind === 'apt' || kind === 'lh') && rest.length === 1) return `/${kind}/${enc(rest[0])}`;
  if (kind === 'region' && (rest.length === 1 || rest.length === 2)) return `/region/${rest.map(enc).join('/')}`;
  if (kind === 'trade' && rest.length === 2) return `/trade/${rest.map(enc).join('/')}`;
  return null;
}

export const staticPaths = (today: string): string[] => ['/', '/competition', '/region', '/ipo', '/eligibility', `/calendar/${today.slice(0, 7)}`];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export function sitemapXml(base: string, paths: string[]): string {
  const root = base.replace(/\/+$/, '');
  const urls = paths.map((p) => `<url><loc>${esc(root + p)}</loc></url>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}
```

```ts
// file: src/pages/sitemap.xml.ts
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { SITEMAP_PREFIXES, pathOfKey, staticPaths, sitemapXml } from '../lib/view/sitemap';
import { setPublicCache } from '../server/cache';
import { todayKst } from '../lib/date';

// KV list 는 무료 하루 1,000회 — 응답을 하루 캐시해 한 지역 캐시당 하루 몇 번만 부른다
export const GET: APIRoute = async () => {
  const paths = staticPaths(todayKst());
  for (const prefix of SITEMAP_PREFIXES) {
    let cursor: string | undefined;
    do {
      const page = await env.KV.list({ prefix, cursor });
      for (const k of page.keys) {
        const p = pathOfKey(k.name);
        if (p) paths.push(p);
      }
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor && paths.length < 45_000);
  }
  const headers = new Headers({ 'Content-Type': 'application/xml; charset=utf-8' });
  setPublicCache(headers, 86_400);
  return new Response(sitemapXml(env.SITE_URL, paths), { headers });
};
```

- [ ] **Step 4: 매일 점검 집계를 쓴다**

```ts
// file: sync/ops/daily-summary.ts
// 매일 점검의 집계 — 네트워크 없이 시험할 수 있는 부분 (지원금다모아 sync/ops/daily-summary.ts 를 청약다모아에 맞춰 새로 씀)
import { SITE } from '../../src/lib/site-meta';

export interface RumRow {
  count: number;
  sum: { visits: number };
  dimensions: { requestPath: string; refererHost: string; deviceType: string; countryName: string };
}
export interface RumSummary {
  views: number; visits: number;
  referers: Record<string, number>; devices: Record<string, number>; tabs: Record<string, number>;
  topPages: { path: string; views: number }[];
}

const SELF_HOST = new URL(SITE.url).hostname;
export function refererLabel(host: string): string {
  if (!host) return '직접';
  if (/naver/.test(host)) return '네이버';
  if (/google/.test(host)) return '구글';
  if (/daum/.test(host)) return '다음';
  if (host === SELF_HOST || host.endsWith(`.${SELF_HOST}`)) return '사이트 안';
  return host;
}

const TABS: [RegExp, string][] = [
  [/^\/$/, '홈'],
  [/^\/apt\//, '단지 상세'],
  [/^\/lh\//, 'LH 공고'],
  [/^\/competition\b/, '경쟁률'],
  [/^\/calendar\b/, '캘린더'],
  [/^\/ipo\b/, '공모주'],
  [/^\/(region|trade)\b/, '실거래·지역'],
  [/^\/eligibility\b/, '자격 판정'],
];
export const tabOf = (path: string): string => TABS.find(([re]) => re.test(path))?.[1] ?? '기타';

function decodePath(p: string): string {
  try { return decodeURIComponent(p); } catch { return p; }
}
const add = (o: Record<string, number>, k: string, n: number) => { if (n > 0) o[k] = (o[k] ?? 0) + n; };

export function summarizeRum(rows: RumRow[]): RumSummary {
  const s: RumSummary = { views: 0, visits: 0, referers: {}, devices: {}, tabs: {}, topPages: [] };
  const pages: Record<string, number> = {};
  for (const r of rows) {
    const path = decodePath(r.dimensions.requestPath);
    s.views += r.count;
    s.visits += r.sum.visits;
    add(s.referers, refererLabel(r.dimensions.refererHost), r.sum.visits);
    add(s.devices, r.dimensions.deviceType, r.sum.visits);
    add(s.tabs, tabOf(path), r.count);
    add(pages, path, r.count);
  }
  s.topPages = Object.entries(pages).map(([path, views]) => ({ path, views })).sort((a, b) => b.views - a.views).slice(0, 5);
  return s;
}

export const LOG_HEADER = '# 방문 기록\n\n'
  + 'Cloudflare 웹 분석(RUM) 표본 추정치, 한국 날짜. `npm run ops:daily -- --write-log` 가 하루 한 줄씩 붙인다.\n\n'
  + '| 날짜 | 방문 | 조회 | 네이버 | 구글 | 직접 | 상세 비중 | 판정 조회 | 많이 본 페이지 |\n'
  + '|---|---|---|---|---|---|---|---|---|\n';

export function logRow(date: string, s: RumSummary, names: Record<string, string>): string {
  const detail = s.views > 0 ? Math.round(((s.tabs['단지 상세'] ?? 0) / s.views) * 100) : 0;
  const top = s.topPages.map((p) => {
    const id = p.path.match(/^\/apt\/([^/?#]+)/)?.[1];
    return `${(id && names[id]) || p.path} ${p.views}`;
  }).join(', ');
  const r = s.referers;
  return `| ${date} | ${s.visits} | ${s.views} | ${r['네이버'] ?? 0} | ${r['구글'] ?? 0} | ${r['직접'] ?? 0} | ${detail}% | ${s.tabs['자격 판정'] ?? 0} | ${top} |`;
}

export function appendLogRow(existing: string | null, date: string, row: string): string | null {
  if (existing === null) return `${LOG_HEADER}${row}\n`;
  if (existing.includes(`| ${date} |`)) return null;
  return `${existing.replace(/\s*$/, '\n')}${row}\n`;
}

const KST = 9 * 3600 * 1000;
export const yesterdayKst = (now: Date): string => new Date(now.getTime() + KST - 86400 * 1000).toISOString().slice(0, 10);

export function previousDays(date: string, n: number): string[] {
  const t = Date.parse(`${date}T00:00:00Z`);
  return Array.from({ length: n }, (_, i) => new Date(t - (i + 1) * 86400 * 1000).toISOString().slice(0, 10));
}

const fmt = (n: number) => n.toLocaleString('en-US');
export function limitLine(label: string, used: number, limit: number): string {
  const pct = Math.round((used / limit) * 100);
  return `${label} ${fmt(used)} / ${fmt(limit)} (${pct}%)${pct > 70 ? ' ⚠ 70% 넘음' : ''}`;
}

// 동기화가 KV 에 남긴 하루 사용량(meta:kvhash·meta:d1rows 의 {date, used}) — 다른 날 기록이면 0
export const dayUsage = (v: { date: string; used: number } | null, day: string): number => (v && v.date === day ? v.used : 0);

export interface RunInfo { name: string; conclusion: string | null; status: string; created_at: string }
export function actionsLatest(runs: RunInfo[]): { name: string; latest: string; at: string; failures: number }[] {
  const out = new Map<string, { name: string; latest: string; at: string; failures: number }>();
  for (const r of runs) {
    let e = out.get(r.name);
    if (!e) {
      const at = new Date(Date.parse(r.created_at) + KST).toISOString().slice(0, 16).replace('T', ' ');
      e = { name: r.name, latest: r.conclusion ?? r.status, at, failures: 0 };
      out.set(r.name, e);
    }
    if (r.conclusion === 'failure') e.failures++;
  }
  return [...out.values()];
}

export function repoFromRemote(url: string): string | null {
  const m = /github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(url.trim());
  return m ? `${m[1]}/${m[2]}` : null;
}
```

`'| 2026-11-20 | 5 | 10 | 0 | 0 | 5 | 50% | 0 | 시흥 거모 5, / 5 |'` 기대값의 '직접 5' 는 두 줄 모두 refererHost 가 빈 값이라 방문 2+3 이다.

- [ ] **Step 5: 점검 명령을 쓴다**

```ts
// file: sync/ops-daily.ts
// 매일 점검 한 줄 명령. 읽기만 한다(--write-log 일 때 docs/traffic-log.md 에 한 줄 붙이는 것만 씀). 배포 뒤에 켠다 (spec §12)
//   npm run ops:daily
//   npm run ops:daily -- --date 2026-11-20 --write-log
// .env: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, GH_TOKEN — 값은 출력하지 않는다
import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { d1Query, kvGetText } from './cloudflare';
import { SITE } from '../src/lib/site-meta';
import {
  summarizeRum, logRow, appendLogRow, yesterdayKst, previousDays, limitLine, actionsLatest, repoFromRemote, dayUsage,
  type RumRow, type RunInfo,
} from './ops/daily-summary';

const LOG_PATH = 'docs/traffic-log.md';
const WORKFLOWS = ['sync'];
const LIVE_PATHS = ['/', '/calendar', '/competition', '/region', '/ipo', '/eligibility', '/sitemap.xml', '/robots.txt'];

async function graphql<T>(query: string): Promise<T> {
  const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const body = await res.json() as { data?: { viewer: { accounts: T[] } }; errors?: unknown };
  const acc = body.data?.viewer.accounts[0];
  if (!acc) throw new Error(`Cloudflare GraphQL 오류: ${JSON.stringify(body.errors).slice(0, 300)}`);
  return acc;
}
const account = () => `accounts(filter:{accountTag:"${process.env.CLOUDFLARE_ACCOUNT_ID}"})`;

async function rumDay(date: string): Promise<RumRow[]> {
  const acc = await graphql<{ rumPageloadEventsAdaptiveGroups: RumRow[] }>(`{ viewer { ${account()} {
    rumPageloadEventsAdaptiveGroups(limit:5000, filter:{date:"${date}"}) { count sum { visits } dimensions { requestPath refererHost deviceType countryName } }
  } } }`);
  return acc.rumPageloadEventsAdaptiveGroups;
}
async function rumTotals(date: string): Promise<{ views: number; visits: number }> {
  const acc = await graphql<{ rumPageloadEventsAdaptiveGroups: { count: number; sum: { visits: number } }[] }>(`{ viewer { ${account()} {
    rumPageloadEventsAdaptiveGroups(limit:1, filter:{date:"${date}"}) { count sum { visits } }
  } } }`);
  const g = acc.rumPageloadEventsAdaptiveGroups[0];
  return { views: g?.count ?? 0, visits: g?.sum.visits ?? 0 };
}

interface CfUsage {
  workersInvocationsAdaptive: { sum: { requests: number; errors: number }; quantiles: { cpuTimeP50: number; cpuTimeP99: number }; dimensions: { scriptName: string; status: string } }[];
  d1AnalyticsAdaptiveGroups: { sum: { rowsRead: number; rowsWritten: number } }[];
}
async function cfUsage(date: string): Promise<CfUsage> {
  return graphql<CfUsage>(`{ viewer { ${account()} {
    workersInvocationsAdaptive(limit:100, filter:{date:"${date}"}) { sum { requests errors } quantiles { cpuTimeP50 cpuTimeP99 } dimensions { scriptName status } }
    d1AnalyticsAdaptiveGroups(limit:100, filter:{date:"${date}"}) { sum { rowsRead rowsWritten } }
  } } }`);
}

async function actionRuns(): Promise<RunInfo[]> {
  const remote = spawnSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' }).stdout.trim();
  const repo = repoFromRemote(remote);
  if (!repo || !process.env.GH_TOKEN) throw new Error('GitHub 저장소 주소나 GH_TOKEN 이 없습니다');
  const res = await fetch(`https://api.github.com/repos/${repo}/actions/runs?per_page=100`, {
    headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'cheongyak-ops' },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const body = await res.json() as { workflow_runs: (RunInfo & { path: string })[] };
  return body.workflow_runs.map((r) => ({ ...r, name: r.path.replace(/^.*\//, '').replace(/\.ya?ml$/, '') }));
}

async function liveCheck(base: string, path: string): Promise<string> {
  try {
    const res = await fetch(`${base}${encodeURI(path)}`, { headers: { 'User-Agent': 'cheongyak-ops-check' }, redirect: 'manual' });
    const type = res.headers.get('content-type') ?? '';
    let note = '';
    if (type.includes('html')) {
      const html = await res.text();
      const title = html.match(/<title>([^<]*)<\/title>/)?.[1]?.trim() ?? '(제목 없음)';
      const notice = html.includes('참고용이며 최종 자격과 가격은') ? '' : ' · 안내 문구 없음';
      note = ` — ${title.slice(0, 50)}${notice}`;
    } else {
      await res.arrayBuffer();
    }
    const ok = res.status === 200 || (path === '/calendar' && res.status === 302);
    return `${ok ? '✓' : '✗'} ${res.status} ${path}${note}`;
  } catch (e) {
    return `✗ 실패 ${path} — ${(e as Error).message}`;
  }
}

async function section(title: string, body: () => Promise<string[]>): Promise<void> {
  console.log(`\n## ${title}`);
  try {
    for (const line of await body()) console.log(line);
  } catch (e) {
    console.log(`(확인 못 함) ${(e as Error).message}`);
  }
}

const parse = <T>(s: string | null): T | null => { try { return s ? JSON.parse(s) as T : null; } catch { return null; } };

async function main() {
  const { values } = parseArgs({ options: { date: { type: 'string' }, 'write-log': { type: 'boolean', default: false } } });
  const date = values.date ?? yesterdayKst(new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`날짜 형식은 YYYY-MM-DD: ${date}`);
  console.log(`# ${SITE.name} 매일 점검 — ${date} (한국 날짜)`);

  await section('방문 (Cloudflare RUM, 표본 추정치)', async () => {
    const s = summarizeRum(await rumDay(date));
    const past = await Promise.all(previousDays(date, 7).map(rumTotals));
    const avg = (k: 'visits' | 'views') => (past.reduce((a, p) => a + p[k], 0) / past.length).toFixed(1);
    const ids = s.topPages.map((p) => p.path.match(/^\/apt\/([0-9A-Za-z_-]+)$/)?.[1]).filter((x): x is string => !!x);
    const names: Record<string, string> = {};
    if (ids.length) {
      for (const r of d1Query<{ pblanc_no: string; name: string }>(`SELECT pblanc_no, name FROM apt_notice WHERE pblanc_no IN (${ids.map((i) => `'${i}'`).join(',')})`, 'remote')) names[r.pblanc_no] = r.name;
    }
    const row = logRow(date, s, names);
    const lines = [
      `방문 ${s.visits} · 조회 ${s.views} (앞 7일 평균 방문 ${avg('visits')} · 조회 ${avg('views')})`,
      `유입(방문): ${Object.entries(s.referers).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') || '없음'}`,
      `기기(방문): ${Object.entries(s.devices).map(([k, v]) => `${k} ${v}`).join(', ') || '없음'}`,
      `탭별 조회: ${Object.entries(s.tabs).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') || '없음'}`,
      `기록 줄: ${row}`,
    ];
    if (values['write-log']) {
      const next = appendLogRow(existsSync(LOG_PATH) ? readFileSync(LOG_PATH, 'utf8') : null, date, row);
      if (next === null) lines.push(`${LOG_PATH}: 이미 ${date} 줄이 있어 그대로 둠`);
      else { writeFileSync(LOG_PATH, next); lines.push(`${LOG_PATH}: ${date} 줄을 붙임`); }
    }
    return lines;
  });

  await section('Cloudflare 사용량 (무료 한도 대비)', async () => {
    const u = await cfUsage(date);
    const w = u.workersInvocationsAdaptive;
    const requests = w.reduce((a, r) => a + r.sum.requests, 0);
    const errors = w.reduce((a, r) => a + r.sum.errors, 0);
    const d1 = u.d1AnalyticsAdaptiveGroups.reduce((a, r) => ({ read: a.read + r.sum.rowsRead, written: a.written + r.sum.rowsWritten }), { read: 0, written: 0 });
    // 동기화가 남긴 그날(UTC) 사용량 — 동기화 기록은 UTC 날짜라 date 와 하루 어긋날 수 있다
    const kv = parse<{ date: string; used: number }>(kvGetText('meta:kvhash', 'remote'));
    const d1Sync = parse<{ date: string; used: number }>(kvGetText('meta:d1rows', 'remote'));
    return [
      limitLine('Worker 요청', requests, 100_000),
      `Worker 오류 ${errors}건 · CPU(ms) 중앙값·p99: ${w.map((r) => `${r.dimensions.status} ${(r.quantiles.cpuTimeP50 / 1000).toFixed(1)}·${(r.quantiles.cpuTimeP99 / 1000).toFixed(1)}`).join(', ') || '-'}`,
      limitLine('D1 읽은 행', d1.read, 5_000_000),
      limitLine('D1 쓴 행', d1.written, 100_000),
      limitLine(`KV 쓰기(동기화 기록 ${kv?.date ?? '-'})`, dayUsage(kv, kv?.date ?? ''), 1_000),
      limitLine(`D1 쓴 행(동기화 기록 ${d1Sync?.date ?? '-'})`, dayUsage(d1Sync, d1Sync?.date ?? ''), 100_000),
    ];
  });

  await section('자동 작업 (GitHub Actions 최근 100회 안)', async () => {
    const latest = actionsLatest(await actionRuns()).filter((a) => WORKFLOWS.includes(a.name));
    const missing = WORKFLOWS.filter((n) => !latest.some((a) => a.name === n));
    return [
      ...latest.map((a) => `${a.latest === 'success' ? '✓' : a.latest === 'failure' ? '✗' : '…'} ${a.name}: 최근 ${a.latest} (${a.at})${a.failures ? ` · 실패 ${a.failures}회` : ''}`),
      ...missing.map((n) => `- ${n}: 최근 100회 안에 실행 없음`),
    ];
  });

  await section('실서버 응답', async () => {
    const base = (process.env.SITE_URL ?? SITE.url).replace(/\/$/, '');
    return Promise.all(LIVE_PATHS.map((p) => liveCheck(base, p)));
  });
}

await main();
```

`kvGetText(key, target)` 의 실제 시그니처가 `sync/cloudflare.ts:27` 과 같은지 확인한다(`(key: string, target: CfTarget, run?) => string | null`).

`package.json` 의 `scripts` 에 한 줄을 더한다.

```json
    "ops:daily": "node --env-file-if-exists=.env --import tsx sync/ops-daily.ts",
```

- [ ] **Step 6: 시험·타입을 확인한다**

Run: `npm test -- tests/view-sitemap.test.ts tests/ops-daily.test.ts && npm run typecheck`
Expected: PASS, 오류 0. `npm run ops:daily` 는 배포 전이라 실행하지 않는다(원격 계정 없음 — 각 구역이 '(확인 못 함)' 으로 끝나는 것이 정상).

- [ ] **Step 7: 로컬 사이트맵을 확인한다**

fixture 동기화 뒤 `npm run build && npx wrangler dev`, 다른 창에서 `curl -s http://localhost:8787/sitemap.xml | grep -o "<loc>[^<]*</loc>" | head -20` → `/apt/2026820015`, `/region/%EA%B2%BD…`, `/trade/11680/…` 이 보인다. 끈다.

- [ ] **Step 8: 커밋**

```bash
git add src/lib/view/sitemap.ts src/pages/sitemap.xml.ts sync/ops/daily-summary.ts sync/ops-daily.ts package.json tests/view-sitemap.test.ts tests/ops-daily.test.ts
git commit -m "사이트맵(KV 키 목록, 하루 캐시)과 매일 점검 npm run ops:daily"
```

---

### Task 9: 배포 절차서·문서 갱신·전체 검증

**Files:**
- Create: `docs/deploy.md`
- Modify: `CLAUDE.md` (구조·명령어), `PLAN.md` (체크리스트·진행률·다음 작업·결정 사항)
- Test: 전체 (`npm test`, `npm run typecheck`, `npm run build`, 로컬 미리보기)

**Interfaces:**
- Consumes: 앞 Task 의 모든 화면·명령
- Produces: `docs/deploy.md` (사용자 몫 표시 포함)

- [ ] **Step 1: 배포 절차서를 쓴다**

```markdown
<!-- file: docs/deploy.md -->
# 배포·운영 절차

> **사용자 확인 필요** 표시가 붙은 단계는 사용자가 직접 한다(계정·결제·외부 등록). Claude 는 로컬 빌드·미리보기와 이 문서 갱신까지만 한다.
> 비밀값은 `.env`(로컬)와 GitHub Secrets 에만 둔다. 이 문서에 키 값을 적지 않는다.

## 0. 배포 전 로컬 점검
1. `npm test && npm run typecheck && npm run build`
2. `npm run db:migrate:local && npm run sync -- --target local --fixtures sync/fixtures`
3. `npx wrangler dev` → `/`, `/calendar/<이번 달>`, `/apt/2026820015`, `/region`, `/ipo`, `/eligibility`, `/sitemap.xml`, `/robots.txt` 가 200(또는 `/calendar` 302)

## 1. Cloudflare — **사용자 확인 필요**
1. Cloudflare 가입(지원금다모아와 별도 계정).
2. `npx wrangler login` (또는 `.env` 의 `CLOUDFLARE_API_TOKEN` — 권한: Workers 편집, D1 편집, Workers KV 편집, Account Analytics 읽기).
3. `npx wrangler d1 create cheongyak-damoa` → 나온 `database_id` 를 `wrangler.jsonc` 의 `d1_databases[0].database_id` 에.
4. `npx wrangler kv namespace create KV` → 나온 `id` 를 `wrangler.jsonc` 의 `kv_namespaces[0].id` 에.
5. `wrangler.jsonc` 의 `vars.SITE_URL` 을 대표 주소(도메인 전에는 workers.dev 주소)로.

## 2. 원격 스키마 — 0001 확인 먼저 (**사용자 확인 필요**)
`migrations/0001_init.sql` 은 제자리에서 고쳤다(`account_stats.area_kind` 추가). 옛 0001 이 원격에 적용된 적이 있으면 새 열이 생기지 않는다.
1. `npx wrangler d1 migrations list DB --remote` — 0001 이 **적용 안 됨**이면 3으로.
2. 이미 적용됨이면 `npx wrangler d1 execute DB --remote --command "PRAGMA table_info(account_stats)"` 로 `area_kind` 열을 확인한다. 없으면 표에 자료가 없는 지금 `DROP TABLE account_stats` 뒤 0001 의 `CREATE TABLE account_stats …` 문만 실행한다(사용자와 함께).
3. `npm run db:migrate:remote`

## 3. 첫 배포 — **사용자 확인 필요**
1. `npm run deploy`
2. 표시된 workers.dev 주소에서 0단계 3번 주소들을 다시 확인한다.

## 4. GitHub 저장소와 Secrets — **사용자 확인 필요**
1. 저장소를 만들고 push.
2. Secrets: `DATA_GO_KR_KEY`, `DART_API_KEY`(발급 뒤), `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
3. 변수 `SYNC_ENABLED=true` 를 켜면 `.github/workflows/sync.yml` 이 돈다. 첫 실행은 Actions 화면에서 수동 실행하고 로그에 키가 찍히지 않는지 본다.
4. 첫 동기화가 끝나면 `/` 에 오늘 일정이, `/competition` 에 경쟁률이 보이는지 확인한다.

## 5. 도메인 — **사용자 확인 필요**
1. 도메인 구입 → Cloudflare 에 사이트 추가 → Workers 사용자 지정 도메인 연결.
2. `src/lib/site-meta.ts` 의 `SITE.url` 과 `wrangler.jsonc` 의 `SITE_URL` 을 새 주소로(이 두 곳만).
3. `npm run deploy`. 옛 workers.dev·www 주소는 미들웨어가 301 로 넘긴다.

## 6. 검색 등록 — **사용자 확인 필요** (도메인 연결 뒤)
1. 구글 서치콘솔: 도메인 속성 추가, `https://<도메인>/sitemap.xml` 제출.
2. 네이버 서치어드바이저: 사이트 등록, 확인 메타 태그는 `src/layouts/Base.astro` 머리에 넣고 배포, 사이트맵 제출.
3. IndexNow 는 배포·도메인 연결 뒤에 켠다(이 계획 범위 밖).

## 7. 애드센스 — **사용자 확인 필요**
1. 콘텐츠가 쌓인 뒤 신청.
2. 승인되면 `src/components/AdSlot.astro` 만 고친다(지금은 빈 자리).

## 8. 매일 점검
- 배포 뒤 `.env` 에 `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `GH_TOKEN` 을 두고 `npm run ops:daily -- --write-log`.
- 읽기만 한다(어제 방문, Worker·D1·KV 한도, Actions, 실서버 응답). `docs/traffic-log.md` 에 하루 한 줄.

## 9. 실거래 지역코드 확인 — **사용자 확인 필요**
- 실데이터 첫 동기화 뒤 `LAWD_CD` 가 `12xxx`(통합 시도 신설 코드)로 오는 지역이 있는지 확인한다: `npx wrangler d1 execute DB --remote --command "SELECT DISTINCT substr(lawd_cd,1,2) FROM trade"`.
```

- [ ] **Step 2: CLAUDE.md 를 갱신한다**

`CLAUDE.md` 의 `## 구조` 에서 `- \`src/server/\` D1·KV 바인딩 코드, \`src/pages/\` 페이지` 줄을 아래로 바꾼다.

```markdown
- `src/lib/view/` 화면 계산(묶음 → 표시 모델, 순수 함수). `bundle-types.ts` 는 `sync/bundles.ts` 결과 모양, `kv-keys.ts` 는 키 계약(`tests/kv-keys.test.ts`)
- `src/server/` KV 읽기(`getJson` 50KB 이하 묶음, `getStream`)·캐시 머리글, `src/middleware.ts` 대표 주소 301·Cache API
- `src/pages/` 페이지: `/`, `/calendar/YYYY-MM`, `/apt/{공고번호}`, `/lh/{id}`, `/ipo[/{고유번호}]`, `/region[/{시도}[/{시군구}]]`, `/trade/{시군구코드}/{법정동}`, `/competition`, `/eligibility[/{공고번호}/{주택형}]`, `/sitemap.xml`
- `src/scripts/` 브라우저 스크립트. `eligibility-client.ts` 는 네트워크·주소·저장소 금지(`tests/eligibility-no-leak.test.ts`)
- `sync/ops-daily.ts` 매일 점검(읽기만)
```

`## 명령어` 에 두 줄을 더한다.

```markdown
- `npm run sync -- --target local --fixtures sync/fixtures` 샘플 데이터로 로컬 동기화 → `npx wrangler dev` 로 미리보기
- `npm run ops:daily -- --write-log` 매일 점검(배포 뒤). 배포 절차는 `docs/deploy.md`
```

- [ ] **Step 3: 전체 검증**

Run:
```bash
npm test
npm run typecheck
npm run build
npm run db:migrate:local
npm run sync -- --target local --fixtures sync/fixtures
npx wrangler dev
```
다른 창에서:
```bash
for p in / /calendar/2026-11 /apt/2026820015 /lh/0000061174 /competition /region /ipo /eligibility /eligibility/2026820015/01 /sitemap.xml /robots.txt; do
  printf "%s " "$p"; curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:8787$p"
done
curl -s http://localhost:8787/apt/2026820015 | grep -Ec "차익|싸다|비싸|저렴"
```
Expected: 시험 전부 PASS, 오류 0, 각 주소 `200`, 마지막 줄 `0`. 브라우저에서 폭 375px 로 `/`, `/calendar/2026-11`, `/apt/2026820015` 를 열어 하단 탭 다섯 개와 표 가로 스크롤을 본다. 끈다.

- [ ] **Step 4: PLAN.md 를 갱신한다**

`PLAN.md` 의 체크리스트에서 Plan D 줄을 `- [x]` 로, 진행률(완료 n / 전체 m, 2026-11-07)을 고치고, `## 5. 다음에 할 작업` 을 아래로 바꾼다.

```markdown
1. **사용자 확인 필요** `docs/deploy.md` 1~3단계: Cloudflare 가입, D1·KV 만들기, 0001 적용 여부 확인 뒤 원격 스키마, 첫 배포
2. **사용자 확인 필요** 4단계: GitHub 저장소·Secrets, `SYNC_ENABLED=true`, 첫 동기화 수동 실행
3. 첫 실데이터 동기화 뒤 화면 점검: `/competition`·`/region/{시도}` 청약통장 표, `BLNC_SECD` 02·03 라벨(`src/lib/view/region.ts` AREA_KIND_LABEL), 실거래 `LAWD_CD` 12xxx
4. 도메인 연결 뒤 서치콘솔·네이버 사이트맵 제출, `npm run ops:daily` 예약
5. DART 키 발급 뒤 `ipo:{고유번호}` 묶음과 `ipo-*` 일정 생산(동기화 쪽) — 화면은 준비됨
```

`## 6. 결정 사항` 에 붙인다.

```markdown
- Plan D: 공모주 화면은 `ipo:` 묶음·`ipo-*` 일정이 없으면 빈 안내/404 (생산자 없음). `/ipo` 목록은 이번 달·다음 달 `calendar:` 에서 고른다
- Plan D: 분양가 ㎡당은 **전용면적** 기준(주변 시세 중위가와 같은 기준)
- Plan D: `/trade/{시군구}` 자리는 시군구코드 5자리(이름 겹침 때문). 지역 화면은 이름, 실거래 표는 코드
- Plan D: 캘린더는 이번 달·지난달 묶음을 함께 읽는다(묶음이 시작일 달에만 있어서)
- Plan D: 사이트맵은 Worker 에서 KV list(하루 1,000회 한도) → 응답을 하루 캐시
- Plan D: 판정 폼은 `<form>`·`name` 없이 `data-field` 입력, 월소득은 만원으로 받아 원으로 바꾼다. 날짜가 공고일보다 뒤면 오류(태아 출산 예정일 제외)
```

- [ ] **Step 5: 커밋**

```bash
git add docs/deploy.md CLAUDE.md PLAN.md
git commit -m "배포 절차서(사용자 몫 표시, 0001 확인), CLAUDE.md·PLAN.md 갱신"
```

배포·push·merge 는 하지 않는다 — `docs/deploy.md` 의 **사용자 확인 필요** 단계로 넘긴다.
