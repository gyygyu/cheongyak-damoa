# 청약다모아 Plan A — 기반과 순수 로직 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 새 저장소에 Astro·Cloudflare 골격을 세우고, 실제 API 응답을 fixtures로 받아 두고, D1 스키마와 데이터 연결 순수 로직(지역 해석·실거래·분양권 매칭·공고 상태·LH 매칭·공모주 판 고르기·보호예수 매칭)을 테스트와 함께 만든다.

**Architecture:** `src/lib/` 아래 순수 함수만 만든다(Cloudflare·Node API 금지). 입력은 출처 원본 필드가 아니라 **내부 타입**이다 — 출처 원본 → 내부 타입 변환은 Plan C(동기화)에서 fixtures를 보고 만든다. 이번 계획의 sync 코드는 조사용(`sync/survey.ts`)과 법정동 스냅숏(`sync/lawd-snapshot.ts`)뿐이다.

**Tech Stack:** Astro 7 SSR + `@astrojs/cloudflare` 14, D1, KV, TypeScript 6, vitest 5, tsx, Node 24(`node:sqlite`로 스키마 시험)

**Spec:** `docs/superpowers/specs/2026-11-07-cheongyak-site-design.md`

**후속 계획(이 문서 범위 밖):** Plan B 특공 판정(§8), Plan C 동기화(수집기·이상치 차단·SQL·KV·백필, §10), Plan D 화면·`docs/deploy.md`·ops(§7·§12·§13)

## Global Constraints

- 버전은 지원금다모아와 같게: astro ^7.3.8, @astrojs/cloudflare ^14.3.4, @astrojs/check ^0.9.10, @types/node ^26.6.5, esbuild 0.28.2, tsx ^4.23.15, typescript ^6.0.3, vitest ^5.0.4, wrangler ^4.149.0
- `src/lib/`는 Cloudflare·Node API를 쓰지 않는다(브라우저·Worker·Node 공용).
- 키 없이 `npm test`가 통과해야 한다.
- 비밀값은 `.env`(로컬)와 GitHub Secrets에만 둔다. fixtures·로그·커밋에 키를 남기지 않는다(`serviceKey`·`crtfc_key` 값 제거).
- 공공데이터포털 키 이름은 `DATA_GO_KR_KEY`, OpenDART 키는 `DART_API_KEY`.
- 금액은 만원 단위 정수. 면적은 ㎡ 실수. 날짜는 `YYYY-MM-DD` 문자열.
- 지원금다모아 저장소는 읽기·복사만 한다. 고치지 않는다.
- 주변 시세 문구에 "싸다·비싸다·차익" 같은 평가를 넣지 않는다(§9). 보호예수는 사실만(§3).
- 코드 주석·커밋 메시지는 한국어. 커밋 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- `.claude/`는 커밋하지 않는다.

## Review Focus

1. 공고 주소가 시도 약칭·옛 이름(`경기 수원시…`, `강원도 춘천시…`, `전라북도 전주시…`)으로 와도 지역이 해석되어야 한다 → Task 4 `resolveAddress` 테스트.
2. 실거래 금액·면적 칸이 비었거나 `-`이면 그 행만 빠지고 계산이 죽지 않아야 한다 → Task 5 `parseDealAmount`·`parseArea` 테스트.
3. 출처마다 날짜 형식이 다르다(`20261107`, `2026-11-07`, `2026.11.07`, `2026. 11. 7.`) → Task 5 `normalizeDate` 테스트.
4. 단지명 정규화가 지나쳐 다른 단지(`1단지`↔`2단지`, `1차`↔`2차`)를 합치면 안 된다 → Task 6 `normalizeComplexName` 테스트.
5. 전용면적 ±10㎡ 경계(정확히 10㎡ 차이는 포함)와 12개월 경계(정확히 12개월 전 날짜는 포함) → Task 5 `nearbyPrice` 테스트.

## 파일 구조

| 파일 | 책임 |
|---|---|
| `package.json`, `tsconfig.json`, `tsconfig.sync.json`, `astro.config.mjs`, `wrangler.jsonc`, `vitest.config.ts`, `src/env.d.ts`, `.env.example` | 골격(지원금다모아 설정 복사·수정) |
| `src/lib/site-meta.ts` | 사이트 이름·주소 한 곳 |
| `src/lib/units.ts` | ㎡↔평, 만원 표기 |
| `src/lib/date.ts` | 날짜 정규화·계산 |
| `src/lib/hash.ts` | 브라우저·Node 공용 문자열 해시(FNV-1a 64) |
| `src/lib/normalize-name.ts` | 단지명 정규화(분양권·LH 매칭 공용) |
| `src/lib/region/lawd.ts` | 법정동 표 색인, 주소 → `lawdCd`·법정동 |
| `src/lib/region/jibun.ts` | 지번 해석·키 |
| `src/lib/trade/amount.ts` | 금액·면적 문자열 → 숫자 |
| `src/lib/trade/trade-key.ts` | 거래 해시와 순번 |
| `src/lib/trade/median.ts` | 중위값 |
| `src/lib/trade/nearby.ts` | 주변 시세(동 → 시군구 넓히기) |
| `src/lib/trade/presale-match.ts` | 분양권 ↔ 공고 매칭 |
| `src/lib/apt/status.ts` | 공고 상태 |
| `src/lib/apt/schedule.ts` | 공고 일정 → 캘린더 일정 |
| `src/lib/apt/lh-match.ts` | LH 분양 ↔ 청약홈 공고 |
| `src/lib/ipo/filing.ts` | DART 신고서 판 고르기 |
| `src/lib/ipo/lockup.ts` | 보호예수 ↔ 공모주 매칭 |
| `migrations/0001_init.sql` | D1 스키마(§5의 12개 표) |
| `sync/http.ts` | 키 인코딩·키 지우기·요청 |
| `sync/survey-endpoints.ts`, `sync/survey.ts` | 출처별 실응답을 fixtures로 저장 |
| `sync/lawd-parse.ts`, `sync/lawd-snapshot.ts` | 법정동코드 전체 → `content/lawd/lawd.json` |
| `docs/api-fields.md` | 실응답 필드 조사 |
| `CLAUDE.md`, `PLAN.md` | 구조 / 진행 상태 |

---

### Task 1: 골격 (설정·site-meta·units·CLAUDE.md·PLAN.md)

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.sync.json`, `astro.config.mjs`, `wrangler.jsonc`, `vitest.config.ts`, `src/env.d.ts`, `.env.example`, `src/lib/site-meta.ts`, `src/lib/units.ts`, `src/pages/index.astro`, `CLAUDE.md`, `PLAN.md`
- Modify: `.gitignore`
- Test: `tests/units.test.ts`

**Interfaces:**
- Produces: `SITE` 상수(`name`, `url`, `tagline`), `sqmToPyeong(m2: number): number`(소수 1자리), `formatArea(m2: number): string`("84㎡(25평)"), `perSqmToPerPyeong(manwonPerSqm: number): number`(정수), `formatManwon(n: number): string`("12억 3,456만원")

- [ ] **Step 1: 설정 파일 만들기**

`package.json`:
```json
{
  "name": "cheongyak-damoa",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro build && wrangler dev",
    "deploy": "astro build && wrangler deploy",
    "test": "vitest run",
    "typecheck": "astro check && tsc --noEmit -p tsconfig.sync.json",
    "cf-typegen": "wrangler types",
    "db:migrate:local": "wrangler d1 migrations apply DB --local",
    "db:migrate:remote": "wrangler d1 migrations apply DB --remote",
    "survey": "node --env-file-if-exists=.env --import tsx sync/survey.ts",
    "lawd:snapshot": "node --env-file-if-exists=.env --import tsx sync/lawd-snapshot.ts"
  },
  "dependencies": {
    "@astrojs/cloudflare": "^14.3.4",
    "astro": "^7.3.8"
  },
  "devDependencies": {
    "@astrojs/check": "^0.9.10",
    "@types/node": "^26.6.5",
    "esbuild": "0.28.2",
    "tsx": "^4.23.15",
    "typescript": "^6.0.3",
    "vitest": "^5.0.4",
    "wrangler": "^4.149.0"
  },
  "allowScripts": {
    "esbuild@0.28.2": true,
    "workerd@1.20261006.1": true
  }
}
```

`tsconfig.json`:
```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "worker-configuration.d.ts", "src/**/*", "tests/**/*"],
  "exclude": ["dist", "sync"]
}
```

`tsconfig.sync.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022", "module": "ESNext", "moduleResolution": "Bundler",
    "strict": true, "noEmit": true, "skipLibCheck": true, "resolveJsonModule": true,
    "types": ["node"]
  },
  "include": ["sync/**/*.ts", "src/lib/**/*.ts"]
}
```

`astro.config.mjs`:
```js
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  site: process.env.SITE_URL ?? 'http://localhost:4321',
  output: 'server',
  adapter: cloudflare({ imageService: 'passthrough' }),
  // 사이트 CSS는 HTML 안에 넣는다 — CSS 파일을 따로 받을 때까지 화면이 비는 시간을 없앤다
  build: { inlineStylesheets: 'always' },
  // 배포 판 번호: 페이지 캐시 이름에 붙인다
  vite: { define: { __BUILD_ID__: JSON.stringify(Date.now().toString(36)) } },
});
```

`wrangler.jsonc` (계정·도메인은 11-17 이후 사용자가 만든다. 그때 `database_id`·`id`·`routes`를 채운다):
```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "cheongyak-damoa",
  "compatibility_date": "2026-09-01",
  "compatibility_flags": ["nodejs_compat"],
  "observability": { "enabled": true },
  // 로컬 개발용 자리값 — 배포 전에 실제 ID로 바꾼다 (docs/deploy.md)
  "d1_databases": [
    { "binding": "DB", "database_name": "cheongyak-damoa", "database_id": "00000000-0000-0000-0000-000000000000", "migrations_dir": "migrations" }
  ],
  "kv_namespaces": [
    { "binding": "KV", "id": "00000000000000000000000000000000" }
  ],
  "vars": { "SITE_URL": "http://localhost:4321" }
}
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/**/*.test.ts'], environment: 'node' } });
```

`src/env.d.ts`:
```ts
/// <reference types="astro/client" />
type Runtime = import('@astrojs/cloudflare').Runtime;
declare namespace App {
  interface Locals extends Runtime {}
}

// 빌드마다 바뀌는 배포 판 번호 (astro.config.mjs vite.define)
declare const __BUILD_ID__: string;
```

`.env.example`:
```
# 공공데이터포털 인증키 (청약홈·LH·국토부 실거래·금융위원회·법정동코드)
DATA_GO_KR_KEY=
# OpenDART 인증키
DART_API_KEY=
# 배포 (11-17 이후)
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ACCOUNT_ID=
```

`.gitignore`에 덧붙인다(이미 있는 `.env`, `.claude/`, `node_modules/`, `dist/`, `.wrangler/`, `.astro/`, `.superpowers/`는 그대로):
```
.env.*
!.env.example
.dev.vars
*.log
worker-configuration.d.ts
sync/.out/
```

`src/pages/index.astro`(Plan D에서 바꾼다):
```astro
---
import { SITE } from '../lib/site-meta';
---
<html lang="ko"><head><meta charset="utf-8" /><title>{SITE.name}</title></head>
<body><h1>{SITE.name}</h1><p>{SITE.tagline}</p></body></html>
```

`src/lib/site-meta.ts`:
```ts
// 사이트 이름·주소는 이 파일에서만 바꾼다 (도메인 미확정 — spec §2)
export const SITE = {
  name: '청약다모아',
  url: 'https://cheongyakdamoa.com',
  tagline: '아파트 청약·공모주 일정과 실거래가를 한곳에서',
} as const;
```

- [ ] **Step 2: 설치와 `.env` 키 복사**

Run: `npm install`
Expected: 오류 없이 끝남(`allowScripts` 경고만 허용)

지원금다모아 `.env`의 `GOV24_API_KEY` 값을 화면에 내지 않고 새 `.env`의 `DATA_GO_KR_KEY`로 옮긴다:
```bash
node -e "const fs=require('fs');const src=fs.readFileSync('../지원금다모아/.env','utf8');const m=src.match(/^GOV24_API_KEY=(.*)$/m);if(!m)throw new Error('키 없음');const lines=['DATA_GO_KR_KEY='+m[1].trim(),'DART_API_KEY='];fs.writeFileSync('.env',lines.join('\n')+'\n');console.log('복사함 (길이',m[1].trim().length,')')"
```
Expected: `복사함 (길이 N )` — 키 값은 출력되지 않는다.

- [ ] **Step 3: units 실패 테스트 쓰기**

`tests/units.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { sqmToPyeong, formatArea, perSqmToPerPyeong, formatManwon } from '../src/lib/units';

describe('units', () => {
  it('㎡를 평으로 바꾼다 (1평 = 3.3058㎡, 소수 1자리)', () => {
    expect(sqmToPyeong(84)).toBe(25.4);
    expect(sqmToPyeong(59.99)).toBe(18.1);
  });
  it('면적을 "84㎡(25평)"처럼 적는다 (㎡는 소수 버림 없이 그대로 최대 2자리, 평은 반올림 정수)', () => {
    expect(formatArea(84)).toBe('84㎡(25평)');
    expect(formatArea(84.9512)).toBe('84.95㎡(26평)');
  });
  it('㎡당 가격을 평당 가격으로 바꾼다 (정수 만원)', () => {
    expect(perSqmToPerPyeong(1000)).toBe(3306);
  });
  it('만원 금액을 억·만원으로 적는다', () => {
    expect(formatManwon(123456)).toBe('12억 3,456만원');
    expect(formatManwon(50000)).toBe('5억원');
    expect(formatManwon(9800)).toBe('9,800만원');
    expect(formatManwon(0)).toBe('0원');
  });
});
```

- [ ] **Step 4: 실패 확인**

Run: `npx vitest run tests/units.test.ts`
Expected: FAIL — `Failed to resolve import "../src/lib/units"`

- [ ] **Step 5: 구현**

`src/lib/units.ts`:
```ts
// 면적·금액 표기 (spec §7: 면적은 "84㎡(25평)", 숫자는 tabular-nums)
const SQM_PER_PYEONG = 3.3058;

export const sqmToPyeong = (m2: number): number => Math.round((m2 / SQM_PER_PYEONG) * 10) / 10;

export function formatArea(m2: number): string {
  const sqm = Math.round(m2 * 100) / 100;
  return `${sqm}㎡(${Math.round(m2 / SQM_PER_PYEONG)}평)`;
}

export const perSqmToPerPyeong = (manwonPerSqm: number): number => Math.round(manwonPerSqm * SQM_PER_PYEONG);

export function formatManwon(n: number): string {
  if (n === 0) return '0원';
  const eok = Math.floor(n / 10000);
  const man = n % 10000;
  const parts: string[] = [];
  if (eok) parts.push(`${eok.toLocaleString('ko-KR')}억`);
  if (man) parts.push(`${man.toLocaleString('ko-KR')}만`);
  return `${parts.join(' ')}원`;
}
```

- [ ] **Step 6: 통과 확인**

Run: `npx vitest run tests/units.test.ts`
Expected: PASS 4/4

- [ ] **Step 7: CLAUDE.md·PLAN.md 쓰기**

`CLAUDE.md`:
```markdown
# 청약다모아(가칭)

아파트 청약·공모주 일정과 실거래가 조회 사이트. 청약홈·LH·국토부 실거래·OpenDART·금융위원회 → GitHub Actions 동기화 → Cloudflare D1·KV → Astro(SSR, Cloudflare Workers). 설계: `docs/superpowers/specs/2026-11-07-cheongyak-site-design.md`

## 구조
- `src/lib/` 순수 로직 (Cloudflare·Node API 금지 — 브라우저·Worker·Node 공용). 테스트는 `tests/`
  - `region/` 주소 → 법정동·`lawdCd`, 지번 / `trade/` 금액·거래 해시·중위가·주변 시세·분양권 매칭 / `apt/` 공고 상태·일정·LH 매칭 / `ipo/` DART 판 고르기·보호예수 매칭 / `units.ts` ㎡↔평 / `site-meta.ts` 사이트 이름(여기서만 바꾼다)
  - 입력은 내부 타입. 출처 원본 → 내부 타입 변환은 `sync/` 쪽
- `src/server/` D1·KV 바인딩 코드, `src/pages/` 페이지
- `sync/` Node 전용 동기화. `survey.ts`(실응답 → `sync/fixtures/<출처>/`, 키 제거), `lawd-snapshot.ts`(법정동코드 → `content/lawd/lawd.json`)
- `migrations/` D1 스키마, `content/` 법정동 표·소득 기준표, `docs/api-fields.md` 실응답 필드

## 명령어
- `npm test` / `npm run typecheck` / `npm run build` / `npm run dev`
- `npm run survey` 출처별 실응답 저장 (`.env` 의 `DATA_GO_KR_KEY`, `DART_API_KEY`)
- `npm run lawd:snapshot` 법정동코드 스냅숏 갱신
- `npm run db:migrate:local` 로컬 D1 스키마

## 지켜야 할 것
- 자격 판정 입력값은 서버로 보내지 않는다 (URL 쿼리 포함)
- Workers CPU 10ms: Worker 에서 큰 JSON 파싱 금지, 페이지마다 KV 묶음 하나
- D1 쓰기 하루 10만 행, KV 쓰기 하루 1,000건: 바뀐 것만 쓴다
- 비밀값은 `.env`·GitHub Secrets 에만. fixtures 에 키를 남기지 않는다
- 공모주: 투자 권유·예상 수익·"차익" 문구 금지, 보호예수는 사실만. 시세 비교에 "싸다·비싸다" 금지
- 지원금다모아 저장소는 고치지 않는다 (복사만)
```

`PLAN.md`:
```markdown
# 청약다모아 — PLAN

## 1. 목표 / 전체 작업 계획
아파트 청약·공모주 일정과 실거래가 조회 사이트. 운영비 월 0원, 검색 유입 광고 수익.
- 설계: `docs/superpowers/specs/2026-11-07-cheongyak-site-design.md`
- Plan A 기반·순수 로직: `docs/superpowers/plans/2026-11-07-cheongyak-foundation.md`
- 뒤이을 계획: Plan B 특공 판정 / Plan C 동기화 / Plan D 화면·배포 문서·ops

## 2. 단계별 구현 계획
1. Plan A: 골격(T1), API 조사·fixtures(T2), D1 스키마(T3), 지역(T4), 실거래(T5), 분양권 매칭(T6), 공고·LH(T7), 공모주(T8)
2. Plan B: 특공 판정 (조문 확인·소득 기준표)
3. Plan C: 동기화 (수집기·이상치 차단·SQL·KV·백필)
4. Plan D: 화면, docs/deploy.md, ops
5. 11-17 이후(사용자): Cloudflare 가입, 도메인, Secrets, 서치콘솔, 애드센스

## 3. 체크리스트
- [x] 설계 문서 작성·승인
- [x] Plan A 작성
- [ ] A-T1 골격
- [ ] A-T2 API 조사·fixtures·법정동 스냅숏
- [ ] A-T3 D1 스키마
- [ ] A-T4 지역 해석
- [ ] A-T5 실거래 로직
- [ ] A-T6 분양권 매칭
- [ ] A-T7 공고 상태·일정·LH 매칭
- [ ] A-T8 공모주 판·보호예수
- [ ] Plan B·C·D 작성과 실행

## 4. 진행률
완료 2 / 전체 11 (마지막 갱신 2026-11-07)

## 5. 다음에 할 작업
- Plan A Task 2: `npm run survey` 로 출처별 실응답을 fixtures 에 저장하고 `docs/api-fields.md` 작성

## 6. 결정 사항 · 막혔던 문제
- 청약홈 분양정보 API 401(11-07) — 개통 대기로 추정. survey 때 다시 확인
- OpenDART 키는 사용자가 발급해 `.env` 에 넣는다
- 도메인 미확정 — `src/lib/site-meta.ts` 에서만 바꾼다
```

- [ ] **Step 8: 빌드·타입 확인**

Run: `npm run build`
Expected: `Complete!` 로 끝남

Run: `npm run typecheck`
Expected: `0 errors`

- [ ] **Step 9: 커밋**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.sync.json astro.config.mjs wrangler.jsonc vitest.config.ts .gitignore .env.example src tests CLAUDE.md PLAN.md
git commit -m "골격: Astro·Cloudflare 설정, site-meta, 면적·금액 표기" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: API 조사 (survey·fixtures·법정동 스냅숏·api-fields.md)

**Files:**
- Create: `sync/http.ts`, `sync/survey-endpoints.ts`, `sync/survey.ts`, `sync/lawd-parse.ts`, `sync/lawd-snapshot.ts`, `sync/fixtures/<출처>/*`, `content/lawd/lawd.json`, `docs/api-fields.md`
- Test: `tests/sync-http.test.ts`, `tests/lawd-parse.test.ts`

**Interfaces:**
- Produces: `serviceKeyParam(key: string): string`, `redactKeys(text: string, keys: string[]): string`, `getText(url: string, keys: string[]): Promise<{status: number; body: string}>`(body는 키 제거됨), `parseLawdPage(json: unknown): {total: number; rows: LawdRow[]}`, `LawdRow = { code: string; name: string }`, 파일 `content/lawd/lawd.json` = `[code10, name][]`(현존 코드만)

- [ ] **Step 1: http 실패 테스트**

`tests/sync-http.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { serviceKeyParam, redactKeys } from '../sync/http';

describe('serviceKeyParam', () => {
  it('이미 인코딩된 키(% 포함)는 그대로 둔다', () => {
    expect(serviceKeyParam('abc%2Bdef%3D%3D')).toBe('abc%2Bdef%3D%3D');
  });
  it('디코딩 키는 인코딩한다', () => {
    expect(serviceKeyParam('abc+def==')).toBe('abc%2Bdef%3D%3D');
  });
});

describe('redactKeys', () => {
  it('원문 키와 인코딩된 키를 모두 지운다', () => {
    const t = 'serviceKey=abc%2Bdef%3D%3D&x=1 abc+def==';
    expect(redactKeys(t, ['abc+def=='])).toBe('serviceKey=<KEY>&x=1 <KEY>');
  });
  it('빈 키는 무시한다', () => {
    expect(redactKeys('abc', [''])).toBe('abc');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/sync-http.test.ts`
Expected: FAIL — `Failed to resolve import "../sync/http"`

- [ ] **Step 3: 구현**

`sync/http.ts`:
```ts
// 공공데이터포털·OpenDART 요청 공용 — 키는 응답·로그에 남기지 않는다
export const serviceKeyParam = (key: string): string => (key.includes('%') ? key : encodeURIComponent(key));

export function redactKeys(text: string, keys: string[]): string {
  let out = text;
  for (const key of keys.filter(Boolean)) {
    const decoded = key.includes('%') ? decodeURIComponent(key) : key;
    for (const v of new Set([decoded, encodeURIComponent(decoded), key])) out = out.split(v).join('<KEY>');
  }
  return out;
}

export async function getText(url: string, keys: string[]): Promise<{ status: number; body: string }> {
  const res = await fetch(url, { headers: { accept: 'application/json, application/xml;q=0.9, */*;q=0.8' } });
  return { status: res.status, body: redactKeys(await res.text(), keys) };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/sync-http.test.ts`
Expected: PASS 4/4

- [ ] **Step 5: 엔드포인트 이름 확인**

공공데이터포털 마이페이지 → 활용신청 현황에서 각 서비스의 "상세 기능"·요청 주소를 Claude 브라우저로 읽는다(로그인은 사용자가 이미 했거나 사용자가 한다). 확인할 것: LH 3종, 청약통장 통계, 주식발행정보(의무보호예수 반환), 금융위원회 기업기본정보, 법정동코드, 청약홈 분양정보의 주택형별 오퍼레이션. 읽은 주소로 아래 파일의 `TODO_CONFIRM`이 아닌 실제 값만 남긴다 — 확인하지 못한 항목은 목록에서 빼고 `docs/api-fields.md`의 "미확인"에 적는다.

`sync/survey-endpoints.ts` (청약홈·국토부 4개는 11-07에 확인한 주소다. 나머지는 Step 5에서 확인한 주소로 채운다):
```ts
// 출처별 조사 요청 — 응답은 sync/fixtures/<source>/<name>.<ext> 로 저장된다
export interface SurveyEndpoint {
  source: string; // 폴더 이름
  name: string; // 파일 이름
  key: 'data' | 'dart';
  url: (k: string) => string; // k = 인코딩된 키
}

const ODCLOUD = 'https://api.odcloud.kr/api';
const MOLIT = 'https://apis.data.go.kr/1613000';

export const ENDPOINTS: SurveyEndpoint[] = [
  { source: 'applyhome', name: 'notice-detail', key: 'data',
    url: (k) => `${ODCLOUD}/ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancDetail?page=1&perPage=3&serviceKey=${k}` },
  { source: 'applyhome', name: 'notice-model', key: 'data',
    url: (k) => `${ODCLOUD}/ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancMdl?page=1&perPage=3&serviceKey=${k}` },
  { source: 'applyhome-cmpet', name: 'competition', key: 'data',
    url: (k) => `${ODCLOUD}/ApplyhomeInfoCmpetRtSvc/v1/getAPTLttotPblancCmpet?page=1&perPage=3&serviceKey=${k}` },
  { source: 'molit-apt', name: 'trade-11680-202610', key: 'data',
    url: (k) => `${MOLIT}/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev?serviceKey=${k}&LAWD_CD=11680&DEAL_YMD=202610&numOfRows=5&pageNo=1` },
  { source: 'molit-presale', name: 'presale-41117-202610', key: 'data',
    url: (k) => `${MOLIT}/RTMSDataSvcSilvTrade/getRTMSDataSvcSilvTrade?serviceKey=${k}&LAWD_CD=41117&DEAL_YMD=202610&numOfRows=5&pageNo=1` },
  // Step 5에서 확인한 주소를 여기에 더한다: lh-notice, lh-detail, lh-supply, account-stats, fsc-stock, fsc-corp, lawd
  // OpenDART(공시 목록, 지분증권): pblntf_ty=C, pblntf_detail_ty=C001
  { source: 'dart', name: 'list-equity', key: 'dart',
    url: (k) => `https://opendart.fss.or.kr/api/list.json?crtfc_key=${k}&bgn_de=20261001&end_de=20261107&pblntf_ty=C&pblntf_detail_ty=C001&page_count=5` },
];
```

`sync/survey.ts`:
```ts
// 출처별 실응답을 fixtures 로 저장한다 (키는 지운다). 실패해도 다음 출처로 넘어간다.
import { mkdirSync, writeFileSync } from 'node:fs';
import { ENDPOINTS } from './survey-endpoints';
import { getText, serviceKeyParam } from './http';

const keys = { data: process.env.DATA_GO_KR_KEY ?? '', dart: process.env.DART_API_KEY ?? '' };
const only = process.argv[2]; // 출처 하나만: npm run survey -- lh-notice

for (const ep of ENDPOINTS.filter((e) => !only || e.source === only)) {
  const key = keys[ep.key];
  if (!key) { console.log(`건너뜀 ${ep.source}/${ep.name}: 키 없음`); continue; }
  try {
    const { status, body } = await getText(ep.url(serviceKeyParam(key)), [keys.data, keys.dart]);
    const ext = body.trimStart().startsWith('<') ? 'xml' : 'json';
    mkdirSync(`sync/fixtures/${ep.source}`, { recursive: true });
    writeFileSync(`sync/fixtures/${ep.source}/${ep.name}.${ext}`, body);
    console.log(`${status} ${ep.source}/${ep.name}.${ext} (${body.length}자)`);
  } catch (e) {
    console.log(`실패 ${ep.source}/${ep.name}: ${(e as Error).message}`);
  }
}
```

- [ ] **Step 6: 조사 실행**

Run: `npm run survey`
Expected: 출처마다 한 줄. 국토부 2개는 `200`. 청약홈은 `200` 또는 `401`(401이면 개통 대기 — api-fields.md에 적는다). DART 키가 없으면 `건너뜀 dart/...`.

키가 남지 않았는지 확인:
Run: `node -e "const fs=require('fs');const k=fs.readFileSync('.env','utf8').match(/^DATA_GO_KR_KEY=(.*)$/m)[1].trim();const d=decodeURIComponent(k);const hit=require('child_process').execSync('git ls-files -o --exclude-standard sync/fixtures').toString().split('\n').filter(Boolean).filter(f=>{const t=fs.readFileSync(f,'utf8');return t.includes(d)||t.includes(encodeURIComponent(d))});console.log(hit.length?'키 발견: '+hit.join(','):'키 없음')"`
Expected: `키 없음`

- [ ] **Step 7: 법정동 파서 실패 테스트**

법정동코드 API(`StanReginCd`) JSON 응답은 `{"StanReginCd":[{"head":[{"totalCount":N},…]},{"row":[{"region_cd":"1111010100","locatadd_nm":"서울특별시 종로구 청운동",…}]}]}` 형태로 예상한다. Step 6의 fixture가 다르면 테스트의 입력과 파서를 fixture에 맞추고 ledger에 Ruling으로 남긴다.

`tests/lawd-parse.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseLawdPage } from '../sync/lawd-parse';

const page = {
  StanReginCd: [
    { head: [{ totalCount: 3 }, { numOfRows: '1000', pageNo: '1', type: 'json' }, { RESULT: { resultCode: 'INFO-0', resultMsg: 'NOMAL SERVICE' } }] },
    { row: [
      { region_cd: '1100000000', locatadd_nm: '서울특별시' },
      { region_cd: '1168000000', locatadd_nm: '서울특별시 강남구' },
      { region_cd: '1168010100', locatadd_nm: '서울특별시 강남구 역삼동 ' },
    ] },
  ],
};

describe('parseLawdPage', () => {
  it('전체 건수와 코드·이름을 꺼낸다 (이름 끝 공백 제거)', () => {
    expect(parseLawdPage(page)).toEqual({
      total: 3,
      rows: [
        { code: '1100000000', name: '서울특별시' },
        { code: '1168000000', name: '서울특별시 강남구' },
        { code: '1168010100', name: '서울특별시 강남구 역삼동' },
      ],
    });
  });
  it('형식이 다르면 오류를 낸다 (빈 표로 덮어쓰지 않게)', () => {
    expect(() => parseLawdPage({ RESULT: { resultCode: 'INFO-200' } })).toThrow('법정동');
  });
});
```

- [ ] **Step 8: 실패 확인**

Run: `npx vitest run tests/lawd-parse.test.ts`
Expected: FAIL — `Failed to resolve import "../sync/lawd-parse"`

- [ ] **Step 9: 파서와 스냅숏 스크립트**

`sync/lawd-parse.ts`:
```ts
// 행정안전부 법정동코드(StanReginCd) 한 페이지 → 코드·이름
export interface LawdRow { code: string; name: string }

export function parseLawdPage(json: unknown): { total: number; rows: LawdRow[] } {
  const parts = (json as { StanReginCd?: unknown[] })?.StanReginCd;
  if (!Array.isArray(parts)) throw new Error('법정동코드 응답 형식이 다릅니다');
  const head = (parts.find((p: any) => p?.head) as any)?.head ?? [];
  const total = Number(head.find((h: any) => h?.totalCount !== undefined)?.totalCount);
  const rows = ((parts.find((p: any) => p?.row) as any)?.row ?? []) as { region_cd: string; locatadd_nm: string }[];
  if (!Number.isFinite(total)) throw new Error('법정동코드 전체 건수가 없습니다');
  return { total, rows: rows.map((r) => ({ code: String(r.region_cd), name: String(r.locatadd_nm).trim() })) };
}
```

`sync/lawd-snapshot.ts`:
```ts
// 법정동코드 전체를 받아 content/lawd/lawd.json 에 저장한다. 실패하면 직전 파일을 그대로 둔다 (spec §3).
import { mkdirSync, writeFileSync } from 'node:fs';
import { getText, serviceKeyParam } from './http';
import { parseLawdPage, type LawdRow } from './lawd-parse';

const key = process.env.DATA_GO_KR_KEY ?? '';
if (!key) throw new Error('DATA_GO_KR_KEY 가 없습니다');
const BASE = 'https://apis.data.go.kr/1741000/StanReginCd/getStanReginCdList';
const PER = 1000;
const all: LawdRow[] = [];
let total = Infinity;
for (let page = 1; (page - 1) * PER < total; page++) {
  const { status, body } = await getText(`${BASE}?serviceKey=${serviceKeyParam(key)}&type=json&numOfRows=${PER}&pageNo=${page}`, [key]);
  if (status !== 200) throw new Error(`법정동코드 ${page}쪽 응답 ${status}`);
  const res = parseLawdPage(JSON.parse(body));
  total = res.total;
  all.push(...res.rows);
}
if (all.length < 10000) throw new Error(`법정동코드가 ${all.length}건뿐입니다 — 저장하지 않습니다`);
all.sort((a, b) => a.code.localeCompare(b.code));
mkdirSync('content/lawd', { recursive: true });
writeFileSync('content/lawd/lawd.json', '[\n' + all.map((r) => JSON.stringify([r.code, r.name])).join(',\n') + '\n]\n');
console.log(`법정동코드 ${all.length}건 저장`);
```

- [ ] **Step 10: 통과 확인과 스냅숏 실행**

Run: `npx vitest run tests/lawd-parse.test.ts`
Expected: PASS 2/2

Run: `npm run lawd:snapshot`
Expected: `법정동코드 N건 저장` (N은 약 2만 이상). 폐지 코드가 응답에 섞여 오면(폐지 여부 필드가 있으면) 파서에서 현존 코드만 남기도록 고치고 Ruling을 남긴다.

- [ ] **Step 11: docs/api-fields.md 쓰기**

fixtures마다 다음을 표로 적는다: 요청 주소(키 없이), 응답 형식(JSON/XML), 페이지 크기·전체 건수 필드, 이 사이트가 쓸 필드(원본 이름 → 내부 이름 → 예시 값), 날짜·금액 형식, 확인 못 한 것. spec §14의 8개 항목 각각에 "확인함/미확인(이유)"를 적는다. spec과 다르면 spec 문서도 고친다.

- [ ] **Step 12: 커밋**

```bash
git add sync/http.ts sync/survey-endpoints.ts sync/survey.ts sync/lawd-parse.ts sync/lawd-snapshot.ts sync/fixtures content/lawd docs/api-fields.md tests/sync-http.test.ts tests/lawd-parse.test.ts package.json
git commit -m "API 조사: 출처별 실응답 fixtures, 법정동코드 스냅숏, 필드 조사 문서" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: D1 스키마

**Files:**
- Create: `migrations/0001_init.sql`
- Test: `tests/schema.test.ts`

**Interfaces:**
- Produces: 표 12개 — `apt_notice`, `apt_model`, `apt_competition`, `apt_special_status`, `trade`, `presale_trade`, `presale_link`, `ipo`, `ipo_lockup`, `lh_notice`, `lh_supply`, `account_stats`. 모든 표에 `hash TEXT NOT NULL`, `updated_at TEXT NOT NULL`.

- [ ] **Step 1: 실패 테스트**

`tests/schema.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const TABLES = ['apt_notice', 'apt_model', 'apt_competition', 'apt_special_status', 'trade', 'presale_trade',
  'presale_link', 'ipo', 'ipo_lockup', 'lh_notice', 'lh_supply', 'account_stats'];

function db() {
  const d = new DatabaseSync(':memory:');
  d.exec(readFileSync('migrations/0001_init.sql', 'utf8'));
  return d;
}

describe('0001_init.sql', () => {
  it('spec §5의 표 12개를 만든다', () => {
    const names = db().prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r: any) => r.name);
    for (const t of TABLES) expect(names).toContain(t);
  });
  it('모든 표에 hash·updated_at 열이 있다', () => {
    const d = db();
    for (const t of TABLES) {
      const cols = d.prepare(`PRAGMA table_info(${t})`).all().map((r: any) => r.name);
      expect(cols, t).toEqual(expect.arrayContaining(['hash', 'updated_at']));
    }
  });
  it('apt_model 은 공고번호+주택형 번호가 기본 키다', () => {
    const d = db();
    const ins = d.prepare("INSERT INTO apt_model (pblanc_no, model_no, house_ty, hash, updated_at) VALUES ('P1','01','084.9512A','h','t')");
    ins.run();
    expect(() => ins.run()).toThrow();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/schema.test.ts`
Expected: FAIL — `ENOENT ... migrations/0001_init.sql`

- [ ] **Step 3: 스키마 쓰기**

`migrations/0001_init.sql`:
```sql
-- 청약다모아 D1 스키마 (spec §5). 모든 표: hash = 원본 정규화 값의 해시, 바뀐 행만 쓴다.
CREATE TABLE apt_notice (
  pblanc_no TEXT PRIMARY KEY,       -- 공고번호
  house_manage_no TEXT,             -- 주택관리번호
  name TEXT NOT NULL,               -- 단지명
  sido TEXT, sigungu TEXT, address TEXT,
  lawd_cd TEXT, dong TEXT,          -- 법정동 해석 결과 (없으면 NULL)
  supply_kind TEXT,                 -- 'national' 국민 | 'private' 민영
  public_land INTEGER,              -- 공공택지 1/0
  speculative INTEGER, adjusted INTEGER, -- 투기과열·조정 (출처에 있을 때)
  notice_date TEXT,                 -- 모집공고일
  special_start TEXT, special_end TEXT,
  rank1_start TEXT, rank1_end TEXT,
  rank2_start TEXT, rank2_end TEXT,
  winner_date TEXT,
  contract_start TEXT, contract_end TEXT,
  total_households INTEGER,
  url TEXT,
  state TEXT NOT NULL DEFAULT 'normal', -- normal | corrected | cancelled
  hash TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX apt_notice_lawd ON apt_notice (lawd_cd, dong);
CREATE INDEX apt_notice_date ON apt_notice (notice_date);

CREATE TABLE apt_model (
  pblanc_no TEXT NOT NULL, model_no TEXT NOT NULL,
  house_ty TEXT NOT NULL,           -- 주택형 표기 (예: 084.9512A)
  area_excl REAL, area_supply REAL, -- 전용·공급 면적 ㎡
  general_count INTEGER,
  special_counts TEXT,              -- 특공 유형별 세대수 JSON
  top_price INTEGER,                -- 최고 분양가 (만원)
  hash TEXT NOT NULL, updated_at TEXT NOT NULL,
  PRIMARY KEY (pblanc_no, model_no)
);

CREATE TABLE apt_competition (
  pblanc_no TEXT NOT NULL, model_no TEXT NOT NULL,
  rank INTEGER NOT NULL,            -- 1 | 2
  residence TEXT NOT NULL,          -- 거주 구분 (해당지역·기타지역 등 출처 값)
  supply_count INTEGER, applicants INTEGER, rate REAL,
  hash TEXT NOT NULL, updated_at TEXT NOT NULL,
  PRIMARY KEY (pblanc_no, model_no, rank, residence)
);

CREATE TABLE apt_special_status (
  pblanc_no TEXT NOT NULL, model_no TEXT NOT NULL,
  special_type TEXT NOT NULL,       -- 신혼부부·생애최초·신생아·다자녀·노부모 등
  allotted INTEGER, applicants INTEGER,
  hash TEXT NOT NULL, updated_at TEXT NOT NULL,
  PRIMARY KEY (pblanc_no, model_no, special_type)
);

CREATE TABLE trade (
  trade_key TEXT PRIMARY KEY,       -- 거래 해시(+순번) — src/lib/trade/trade-key.ts
  lawd_cd TEXT NOT NULL, dong TEXT NOT NULL, jibun TEXT,
  apt_seq TEXT, name TEXT NOT NULL,
  area REAL NOT NULL, floor INTEGER,
  contract_date TEXT NOT NULL,      -- YYYY-MM-DD
  amount INTEGER NOT NULL,          -- 만원
  build_year INTEGER,
  cancelled INTEGER NOT NULL DEFAULT 0, cancel_date TEXT,
  hash TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX trade_dong ON trade (lawd_cd, dong, contract_date);
CREATE INDEX trade_apt ON trade (apt_seq);

CREATE TABLE presale_trade (
  trade_key TEXT PRIMARY KEY,
  sgg_cd TEXT NOT NULL, dong TEXT NOT NULL, jibun TEXT,
  name TEXT NOT NULL, area REAL NOT NULL, floor INTEGER,
  contract_date TEXT NOT NULL, amount INTEGER NOT NULL,
  kind TEXT,                        -- 분양권 | 입주권
  cancelled INTEGER NOT NULL DEFAULT 0,
  hash TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX presale_dong ON presale_trade (sgg_cd, dong, contract_date);

CREATE TABLE presale_link (
  trade_key TEXT PRIMARY KEY,       -- presale_trade.trade_key
  pblanc_no TEXT,                   -- 맞춘 공고 (없으면 NULL)
  method TEXT NOT NULL,             -- jibun | name | none
  hash TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX presale_link_notice ON presale_link (pblanc_no);

CREATE TABLE ipo (
  corp_code TEXT PRIMARY KEY,       -- DART 고유번호
  name TEXT NOT NULL, stock_code TEXT, crno TEXT, market TEXT,
  rcept_no TEXT,                    -- 최신 접수번호
  sub_start TEXT, sub_end TEXT,     -- 청약일
  price_low INTEGER, price_high INTEGER, price_final INTEGER, -- 원
  listing_date TEXT, underwriters TEXT, offer_shares INTEGER,
  revisions TEXT,                   -- 정정 이력 JSON
  state TEXT NOT NULL DEFAULT 'normal',
  hash TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE ipo_lockup (
  corp_code TEXT NOT NULL, release_date TEXT NOT NULL, share_kind TEXT NOT NULL,
  shares INTEGER, base_date TEXT,
  hash TEXT NOT NULL, updated_at TEXT NOT NULL,
  PRIMARY KEY (corp_code, release_date, share_kind)
);

CREATE TABLE lh_notice (
  lh_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  kind TEXT NOT NULL,               -- sale | rent
  sub_kind TEXT,                    -- 공공분양·신혼희망타운·행복주택·국민임대 등
  sido TEXT, sigungu TEXT, lawd_cd TEXT,
  posted_date TEXT, receipt_start TEXT, receipt_end TEXT,
  winner_date TEXT, contract_start TEXT, contract_end TEXT,
  url TEXT, state TEXT,
  pblanc_no TEXT,                   -- 맞춘 청약홈 공고 (분양만)
  hash TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE lh_supply (
  lh_id TEXT NOT NULL, house_ty TEXT NOT NULL,
  area_excl REAL, households INTEGER,
  price INTEGER, deposit INTEGER, monthly_rent INTEGER, -- 만원
  hash TEXT NOT NULL, updated_at TEXT NOT NULL,
  PRIMARY KEY (lh_id, house_ty)
);

CREATE TABLE account_stats (
  base_month TEXT NOT NULL,         -- YYYY-MM
  region TEXT NOT NULL, account_kind TEXT NOT NULL,
  subscribers INTEGER, rank1 INTEGER,
  hash TEXT NOT NULL, updated_at TEXT NOT NULL,
  PRIMARY KEY (base_month, region, account_kind)
);
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/schema.test.ts`
Expected: PASS 3/3 (`node:sqlite` 실험 기능 경고는 허용)

Run: `npm run db:migrate:local`
Expected: `0001_init.sql` 적용 완료 (로컬 `.wrangler/state`)

- [ ] **Step 5: 커밋**

```bash
git add migrations tests/schema.test.ts
git commit -m "D1 스키마: 공고·주택형·경쟁률·특공·실거래·분양권·공모주·보호예수·LH·청약통장" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: 지역 해석 (주소 → lawdCd·법정동, 지번)

**Files:**
- Create: `src/lib/region/lawd.ts`, `src/lib/region/jibun.ts`
- Test: `tests/region-lawd.test.ts`, `tests/region-jibun.test.ts`

**Interfaces:**
- Consumes: `content/lawd/lawd.json` 형식 `[code10, name][]` (Task 2)
- Produces:
  - `type LawdTable = [string, string][]`
  - `buildLawdIndex(table: LawdTable): LawdIndex`
  - `resolveAddress(index: LawdIndex, address: string): ResolvedAddress | null`
  - `interface ResolvedAddress { lawdCd: string /*5자리*/; code: string /*10자리*/; sido: string; sigungu: string | null; dong: string | null; rest: string /*남은 주소*/ }`
  - `parseJibun(s: string): Jibun | null`, `interface Jibun { san: boolean; main: number; sub: number }`
  - `jibunKey(j: Jibun): string` ("산12-3", "123-0")
  - `extractJibun(rest: string): Jibun | null` (남은 주소 첫 지번)

- [ ] **Step 1: 실패 테스트**

`tests/region-lawd.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildLawdIndex, resolveAddress, type LawdTable } from '../src/lib/region/lawd';

const TABLE: LawdTable = [
  ['1100000000', '서울특별시'], ['1168000000', '서울특별시 강남구'], ['1168010100', '서울특별시 강남구 역삼동'],
  ['4100000000', '경기도'], ['4111000000', '경기도 수원시'], ['4111700000', '경기도 수원시 영통구'],
  ['4111710700', '경기도 수원시 영통구 이의동'],
  ['4159000000', '경기도 화성시'], ['4159025300', '경기도 화성시 봉담읍'], ['4159025321', '경기도 화성시 봉담읍 동화리'],
  ['3600000000', '세종특별자치시'], ['3611000000', '세종특별자치시'], ['3611011200', '세종특별자치시 반곡동'],
  ['5000000000', '제주특별자치도'], ['5011000000', '제주특별자치도 제주시'], ['5011010100', '제주특별자치도 제주시 일도일동'],
  ['5100000000', '강원특별자치도'], ['5111000000', '강원특별자치도 춘천시'], ['5111010100', '강원특별자치도 춘천시 봉의동'],
  ['5200000000', '전북특별자치도'], ['5211100000', '전북특별자치도 전주시 완산구'], ['5211110100', '전북특별자치도 전주시 완산구 중앙동1가'],
];
const idx = buildLawdIndex(TABLE);

describe('resolveAddress', () => {
  it('지번 주소: 시군구·법정동과 남은 주소를 낸다', () => {
    expect(resolveAddress(idx, '서울특별시 강남구 역삼동 123-4번지 일원')).toEqual({
      lawdCd: '11680', code: '1168010100', sido: '서울특별시', sigungu: '강남구', dong: '역삼동', rest: '123-4번지 일원',
    });
  });
  it('도로명 주소: 법정동 없이 시군구까지만', () => {
    expect(resolveAddress(idx, '서울특별시 강남구 테헤란로 123')).toMatchObject({ lawdCd: '11680', dong: null, rest: '테헤란로 123' });
  });
  it('행정구가 있는 시: 구 코드로 잡는다', () => {
    expect(resolveAddress(idx, '경기도 수원시 영통구 이의동 1234')).toMatchObject({ lawdCd: '41117', sigungu: '수원시 영통구', dong: '이의동' });
  });
  it('읍면 아래 리까지 법정동으로 잡는다', () => {
    expect(resolveAddress(idx, '경기도 화성시 봉담읍 동화리 100')).toMatchObject({ lawdCd: '41590', dong: '봉담읍 동화리' });
  });
  it('세종: 시군구가 없다', () => {
    expect(resolveAddress(idx, '세종특별자치시 반곡동 4-1생활권')).toMatchObject({ lawdCd: '36110', sigungu: null, dong: '반곡동' });
  });
  it('제주: 제주시가 시군구', () => {
    expect(resolveAddress(idx, '제주특별자치도 제주시 일도일동 1')).toMatchObject({ lawdCd: '50110', sigungu: '제주시', dong: '일도일동' });
  });
  it('시도 약칭·옛 이름도 해석한다', () => {
    expect(resolveAddress(idx, '경기 수원시 영통구 이의동 1')).toMatchObject({ lawdCd: '41117' });
    expect(resolveAddress(idx, '강원도 춘천시 봉의동 1')).toMatchObject({ lawdCd: '51110', sido: '강원특별자치도' });
    expect(resolveAddress(idx, '전라북도 전주시 완산구 중앙동1가 1')).toMatchObject({ lawdCd: '52111' });
    expect(resolveAddress(idx, '서울 강남구 역삼동')).toMatchObject({ lawdCd: '11680', dong: '역삼동', rest: '' });
  });
  it('시군구까지 못 잡으면 null', () => {
    expect(resolveAddress(idx, '경기도 어딘가')).toBeNull();
    expect(resolveAddress(idx, '')).toBeNull();
  });
});
```

`tests/region-jibun.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseJibun, jibunKey, extractJibun } from '../src/lib/region/jibun';

describe('parseJibun', () => {
  it('본번-부번', () => expect(parseJibun('123-4')).toEqual({ san: false, main: 123, sub: 4 }));
  it('부번 없음은 0', () => expect(parseJibun('123')).toEqual({ san: false, main: 123, sub: 0 }));
  it('산 지번 (붙여 쓰기·띄어 쓰기)', () => {
    expect(parseJibun('산12-3')).toEqual({ san: true, main: 12, sub: 3 });
    expect(parseJibun('산 12')).toEqual({ san: true, main: 12, sub: 0 });
  });
  it('"번지"·앞자리 0을 정리한다', () => expect(parseJibun('0123-0004번지')).toEqual({ san: false, main: 123, sub: 4 }));
  it('지번이 아니면 null', () => {
    expect(parseJibun('테헤란로')).toBeNull();
    expect(parseJibun('')).toBeNull();
  });
});

describe('jibunKey', () => {
  it('같은 지번은 같은 키', () => {
    expect(jibunKey(parseJibun('123')!)).toBe('123-0');
    expect(jibunKey(parseJibun('123-0')!)).toBe('123-0');
    expect(jibunKey(parseJibun('산 12-3')!)).toBe('산12-3');
  });
});

describe('extractJibun', () => {
  it('남은 주소 첫 낱말이 지번이면 꺼낸다', () => {
    expect(extractJibun('123-4번지 일원')).toEqual({ san: false, main: 123, sub: 4 });
    expect(extractJibun('산 5 외 3필지')).toEqual({ san: true, main: 5, sub: 0 });
  });
  it('도로명·블록은 null', () => {
    expect(extractJibun('테헤란로 123')).toBeNull();
    expect(extractJibun('A-3블록')).toBeNull();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/region-lawd.test.ts tests/region-jibun.test.ts`
Expected: FAIL — `Failed to resolve import`

- [ ] **Step 3: 구현**

`src/lib/region/lawd.ts`:
```ts
// 주소 → 법정동코드 (spec §9). 표는 content/lawd/lawd.json (행정안전부 법정동코드 스냅숏)
export type LawdTable = [string, string][];

export interface ResolvedAddress {
  lawdCd: string; // 시군구 5자리 (실거래 API LAWD_CD)
  code: string; // 가장 깊게 맞은 10자리 코드
  sido: string;
  sigungu: string | null; // 세종처럼 없으면 null
  dong: string | null; // 시군구 아래 법정동 이름 (읍면 리 포함). 도로명 주소면 null
  rest: string;
}

export interface LawdIndex { byName: Map<string, string>; maxWords: number }

// 공고 주소에 섞여 오는 시도 약칭·옛 이름 → 현재 이름
const SIDO_ALIAS: Record<string, string> = {
  서울: '서울특별시', 부산: '부산광역시', 대구: '대구광역시', 인천: '인천광역시', 광주: '광주광역시',
  대전: '대전광역시', 울산: '울산광역시', 세종: '세종특별자치시', 세종시: '세종특별자치시', 경기: '경기도',
  강원: '강원특별자치도', 강원도: '강원특별자치도', 충북: '충청북도', 충남: '충청남도',
  전북: '전북특별자치도', 전라북도: '전북특별자치도', 전남: '전라남도', 경북: '경상북도', 경남: '경상남도',
  제주: '제주특별자치도', 제주도: '제주특별자치도',
};

const isSidoCode = (c: string) => c.endsWith('00000000');
const isSigunguCode = (c: string) => !isSidoCode(c) && c.endsWith('00000');

export function buildLawdIndex(table: LawdTable): LawdIndex {
  const byName = new Map<string, string>();
  let maxWords = 0;
  for (const [code, name] of table) {
    // 같은 이름(세종특별자치시 시도·시군구)은 더 깊은 코드를 남긴다
    const prev = byName.get(name);
    if (!prev || code > prev) byName.set(name, code);
    maxWords = Math.max(maxWords, name.split(' ').length);
  }
  return { byName, maxWords };
}

export function resolveAddress(index: LawdIndex, address: string): ResolvedAddress | null {
  const words = address.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  words[0] = SIDO_ALIAS[words[0]] ?? words[0];

  let best: { code: string; n: number } | null = null;
  let sigungu: { code: string; n: number } | null = null;
  for (let n = 1; n <= Math.min(words.length, index.maxWords); n++) {
    const code = index.byName.get(words.slice(0, n).join(' '));
    if (!code) continue;
    best = { code, n };
    if (isSigunguCode(code)) sigungu = { code, n };
  }
  if (!best || !sigungu) return null;

  const sido = words[0];
  const sigunguName = words.slice(1, sigungu.n).join(' ') || null;
  const dong = best.n > sigungu.n ? words.slice(sigungu.n, best.n).join(' ') : null;
  return {
    lawdCd: sigungu.code.slice(0, 5),
    code: best.code,
    sido,
    sigungu: sigunguName,
    dong,
    rest: words.slice(best.n).join(' '),
  };
}
```

`src/lib/region/jibun.ts`:
```ts
// 지번 해석 (분양권 매칭 1차 키, spec §9)
export interface Jibun { san: boolean; main: number; sub: number }

const JIBUN = /^(산)?\s*0*(\d+)(?:-0*(\d+))?(?:번지)?$/;

export function parseJibun(s: string): Jibun | null {
  const m = s.trim().match(JIBUN);
  if (!m) return null;
  return { san: !!m[1], main: Number(m[2]), sub: m[3] ? Number(m[3]) : 0 };
}

export const jibunKey = (j: Jibun): string => `${j.san ? '산' : ''}${j.main}-${j.sub}`;

export function extractJibun(rest: string): Jibun | null {
  const words = rest.trim().split(/\s+/);
  // "산 5" 처럼 띄어 쓴 산 지번
  if (words[0] === '산' && words[1]) return parseJibun(`산${words[1]}`);
  return words[0] ? parseJibun(words[0]) : null;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/region-lawd.test.ts tests/region-jibun.test.ts`
Expected: PASS 8/8, 8/8

- [ ] **Step 5: 실제 표로 표본 확인**

Run: `node --import tsx -e "import t from './content/lawd/lawd.json' with {type:'json'};import {buildLawdIndex,resolveAddress} from './src/lib/region/lawd.ts';const i=buildLawdIndex(t);for(const a of ['서울특별시 강남구 역삼동 1','경기도 수원시 영통구 이의동 1','세종특별자치시 반곡동 1','강원도 춘천시 봉의동 1'])console.log(a,'→',JSON.stringify(resolveAddress(i,a)))"`
Expected: 네 줄 모두 `lawdCd`가 채워짐(11680, 41117, 36110, 51110). 실제 표에서 이름이 다르면(예: 세종 코드) 테스트 표를 실제와 맞추고 Ruling을 남긴다.

- [ ] **Step 6: 커밋**

```bash
git add src/lib/region tests/region-lawd.test.ts tests/region-jibun.test.ts
git commit -m "지역 해석: 주소 → 법정동코드·법정동, 지번 키" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: 실거래 로직 (날짜·금액·거래 해시·중위가·주변 시세)

**Files:**
- Create: `src/lib/date.ts`, `src/lib/hash.ts`, `src/lib/trade/amount.ts`, `src/lib/trade/trade-key.ts`, `src/lib/trade/median.ts`, `src/lib/trade/nearby.ts`
- Test: `tests/date.test.ts`, `tests/hash.test.ts`, `tests/trade-amount.test.ts`, `tests/trade-key.test.ts`, `tests/trade-nearby.test.ts`

**Interfaces:**
- Produces:
  - `normalizeDate(s: string | null | undefined): string | null` — `YYYY-MM-DD`
  - `ymd(y: number | string, m: number | string, d: number | string): string`
  - `addMonths(date: string, n: number): string` (말일 보정)
  - `daysBetween(a: string, b: string): number` (b − a, 일)
  - `todayKst(now?: Date): string`
  - `fnv64(s: string): string` (16자리 hex)
  - `parseDealAmount(s: string | number | null | undefined): number | null` (만원)
  - `parseArea(s: string | number | null | undefined): number | null`
  - `interface TradeKeyFields { lawdCd: string; dong: string; jibun: string; name: string; area: number; floor: number | null; contractDate: string; amount: number }`
  - `tradeKeys(rows: TradeKeyFields[]): string[]` (같은 해시는 `-2`, `-3`… 순번)
  - `median(nums: number[]): number | null`
  - `interface TradeRecord { lawdCd: string; dong: string; area: number; contractDate: string; amount: number; buildYear: number | null; cancelled: boolean }`
  - `nearbyPrice(target: { lawdCd: string; dong: string | null; area: number }, trades: TradeRecord[], asOf: string): NearbyResult`
  - `type NearbyResult = { scope: 'dong' | 'sigungu'; count: number; medianPerSqm: number } | { scope: 'insufficient'; count: number } | { scope: 'none'; count: 0 }`

- [ ] **Step 1: 실패 테스트 (date·hash·amount)**

`tests/date.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { normalizeDate, ymd, addMonths, daysBetween, todayKst } from '../src/lib/date';

describe('normalizeDate', () => {
  it('출처마다 다른 날짜 형식을 YYYY-MM-DD로', () => {
    expect(normalizeDate('20261107')).toBe('2026-11-07');
    expect(normalizeDate('2026-11-07')).toBe('2026-11-07');
    expect(normalizeDate('2026.11.07')).toBe('2026-11-07');
    expect(normalizeDate('2026. 11. 7.')).toBe('2026-11-07');
    expect(normalizeDate('2026-11-07 10:00:00')).toBe('2026-11-07');
  });
  it('빈 값·틀린 날짜는 null', () => {
    expect(normalizeDate('')).toBeNull();
    expect(normalizeDate(null)).toBeNull();
    expect(normalizeDate('-')).toBeNull();
    expect(normalizeDate('20260230')).toBeNull();
  });
});

describe('날짜 계산', () => {
  it('ymd는 0을 채운다', () => expect(ymd(2026, '3', 5)).toBe('2026-03-05'));
  it('addMonths는 말일을 보정한다', () => {
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
    expect(addMonths('2026-11-07', -12)).toBe('2025-11-07');
  });
  it('daysBetween', () => {
    expect(daysBetween('2026-11-07', '2026-11-10')).toBe(3);
    expect(daysBetween('2026-11-10', '2026-11-07')).toBe(-3);
  });
  it('todayKst는 한국 날짜', () => expect(todayKst(new Date('2026-11-06T15:30:00Z'))).toBe('2026-11-07'));
});
```

`tests/hash.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { fnv64 } from '../src/lib/hash';

describe('fnv64', () => {
  it('16자리 hex, 같은 입력은 같은 값', () => {
    expect(fnv64('abc')).toMatch(/^[0-9a-f]{16}$/);
    expect(fnv64('abc')).toBe(fnv64('abc'));
  });
  it('입력이 다르면 값이 다르다 (한글 포함)', () => {
    expect(fnv64('역삼동|1')).not.toBe(fnv64('역삼동|2'));
  });
});
```

`tests/trade-amount.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseDealAmount, parseArea } from '../src/lib/trade/amount';

describe('parseDealAmount', () => {
  it('쉼표·공백을 지우고 만원 정수로', () => {
    expect(parseDealAmount('    82,500')).toBe(82500);
    expect(parseDealAmount('125,000 ')).toBe(125000);
    expect(parseDealAmount(9800)).toBe(9800);
  });
  it('빈 값·"-"·숫자 아님은 null (그 행만 빠진다)', () => {
    expect(parseDealAmount('')).toBeNull();
    expect(parseDealAmount('-')).toBeNull();
    expect(parseDealAmount(undefined)).toBeNull();
    expect(parseDealAmount('12억')).toBeNull();
  });
});

describe('parseArea', () => {
  it('문자열 면적을 실수로', () => {
    expect(parseArea('84.9512')).toBe(84.9512);
    expect(parseArea(' 59.98 ')).toBe(59.98);
  });
  it('빈 값·0 이하는 null', () => {
    expect(parseArea('')).toBeNull();
    expect(parseArea('0')).toBeNull();
    expect(parseArea(null)).toBeNull();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/date.test.ts tests/hash.test.ts tests/trade-amount.test.ts`
Expected: FAIL — `Failed to resolve import`

- [ ] **Step 3: 구현 (date·hash·amount)**

`src/lib/date.ts`:
```ts
// 날짜는 YYYY-MM-DD 문자열로만 다룬다 (시간대 문제 피하기 — 계산은 UTC 자정 기준)
const pad = (n: number | string, w = 2) => String(n).padStart(w, '0');
export const ymd = (y: number | string, m: number | string, d: number | string): string => `${pad(y, 4)}-${pad(m)}-${pad(d)}`;

function valid(y: number, m: number, d: number): boolean {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

export function normalizeDate(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim();
  const m = t.match(/^(\d{4})(\d{2})(\d{2})$/) ?? t.match(/^(\d{4})\s*[-.]\s*(\d{1,2})\s*[-.]\s*(\d{1,2})/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return valid(y, mo, d) ? ymd(y, mo, d) : null;
}

const toUtc = (date: string) => Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)));

export function addMonths(date: string, n: number): string {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7)) - 1 + n;
  const d = Number(date.slice(8, 10));
  const ty = y + Math.floor(m / 12);
  const tm = ((m % 12) + 12) % 12;
  const last = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  return ymd(ty, tm + 1, Math.min(d, last));
}

export const daysBetween = (a: string, b: string): number => Math.round((toUtc(b) - toUtc(a)) / 86_400_000);

export const todayKst = (now: Date = new Date()): string => new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
```

`src/lib/hash.ts`:
```ts
// FNV-1a 64비트 — 브라우저·Worker·Node 공용(동기). 보안용 아님, 변경 감지·키용
export function fnv64(s: string): string {
  let h = 0xcbf29ce484222325n;
  const bytes = new TextEncoder().encode(s);
  for (const b of bytes) {
    h ^= BigInt(b);
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return h.toString(16).padStart(16, '0');
}
```

`src/lib/trade/amount.ts`:
```ts
// 국토부 실거래 금액(만원, "82,500")·면적("84.9512") 해석 (spec §10)
export function parseDealAmount(s: string | number | null | undefined): number | null {
  if (typeof s === 'number') return Number.isInteger(s) && s > 0 ? s : null;
  const t = (s ?? '').replace(/[,\s]/g, '');
  return /^\d+$/.test(t) && Number(t) > 0 ? Number(t) : null;
}

export function parseArea(s: string | number | null | undefined): number | null {
  const n = typeof s === 'number' ? s : Number((s ?? '').trim() || NaN);
  return Number.isFinite(n) && n > 0 ? n : null;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/date.test.ts tests/hash.test.ts tests/trade-amount.test.ts`
Expected: PASS 6/6, 2/2, 4/4

- [ ] **Step 5: 실패 테스트 (거래 키·중위가·주변 시세)**

`tests/trade-key.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { tradeKeys, type TradeKeyFields } from '../src/lib/trade/trade-key';

const row = (o: Partial<TradeKeyFields> = {}): TradeKeyFields => ({
  lawdCd: '11680', dong: '역삼동', jibun: '123-0', name: '역삼아이파크', area: 84.95, floor: 10,
  contractDate: '2026-10-05', amount: 250000, ...o,
});

describe('tradeKeys', () => {
  it('필드가 같으면 같은 키, 다르면 다른 키', () => {
    const [a] = tradeKeys([row()]);
    const [b] = tradeKeys([row()]);
    const [c] = tradeKeys([row({ floor: 11 })]);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
  it('같은 날·같은 층·같은 금액이 겹치면 순번을 붙인다', () => {
    const keys = tradeKeys([row(), row(), row({ amount: 1 }), row()]);
    expect(keys[1]).toBe(`${keys[0]}-2`);
    expect(keys[3]).toBe(`${keys[0]}-3`);
    expect(keys[2]).not.toContain('-');
  });
});
```

`tests/trade-nearby.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { median } from '../src/lib/trade/median';
import { nearbyPrice, type TradeRecord } from '../src/lib/trade/nearby';

describe('median', () => {
  it('홀수·짝수 건수', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
  it('빈 배열은 null', () => expect(median([])).toBeNull());
});

const ASOF = '2026-11-07';
const t = (o: Partial<TradeRecord> = {}): TradeRecord => ({
  lawdCd: '11680', dong: '역삼동', area: 84, contractDate: '2026-10-01', amount: 84000, buildYear: 2020, cancelled: false, ...o,
});
const five = (o: Partial<TradeRecord> = {}) => [1, 2, 3, 4, 5].map((i) => t({ amount: 84000 + i * 840, ...o }));

describe('nearbyPrice', () => {
  const target = { lawdCd: '11680', dong: '역삼동', area: 84 };

  it('같은 법정동 5건 이상이면 동 기준 ㎡당 중위가(정수 만원)', () => {
    // ㎡당: 1010, 1020, 1030, 1040, 1050 → 1030
    expect(nearbyPrice(target, five(), ASOF)).toEqual({ scope: 'dong', count: 5, medianPerSqm: 1030 });
  });
  it('해제 거래는 뺀다', () => {
    const rows = [...five(), t({ amount: 999999, cancelled: true })];
    expect(nearbyPrice(target, rows, ASOF)).toMatchObject({ scope: 'dong', count: 5, medianPerSqm: 1030 });
  });
  it('면적 ±10㎡ 경계: 정확히 10㎡ 차이는 넣고, 넘으면 뺀다', () => {
    const rows = [...five().slice(0, 4), t({ area: 94, amount: 94 * 1030 }), t({ area: 94.01, amount: 1 })];
    expect(nearbyPrice(target, rows, ASOF)).toMatchObject({ scope: 'dong', count: 5 });
  });
  it('12개월 경계: 정확히 12개월 전 날짜는 넣고, 그 전날은 뺀다', () => {
    const rows = [...five().slice(0, 4), t({ contractDate: '2025-11-07' }), t({ contractDate: '2025-11-06' })];
    expect(nearbyPrice(target, rows, ASOF)).toMatchObject({ count: 5 });
  });
  it('준공 10년 이내만: 2016년은 넣고 2015년은 뺀다', () => {
    const rows = [...five().slice(0, 4), t({ buildYear: 2016 }), t({ buildYear: 2015 }), t({ buildYear: null })];
    expect(nearbyPrice(target, rows, ASOF)).toMatchObject({ count: 5 });
  });
  it('동에서 5건 미만이면 시군구로 넓힌다', () => {
    const rows = [...five().slice(0, 2), ...five({ dong: '대치동' }).slice(0, 3)];
    expect(nearbyPrice(target, rows, ASOF)).toMatchObject({ scope: 'sigungu', count: 5 });
  });
  it('시군구로도 5건 미만이면 비교 자료 부족(n건)', () => {
    expect(nearbyPrice(target, five().slice(0, 3), ASOF)).toEqual({ scope: 'insufficient', count: 3 });
  });
  it('법정동을 모르면 시군구부터 본다', () => {
    expect(nearbyPrice({ ...target, dong: null }, five({ dong: '대치동' }), ASOF)).toMatchObject({ scope: 'sigungu', count: 5 });
  });
  it('지역 해석이 안 됐으면(lawdCd 빈 값) 비교 자료 없음', () => {
    expect(nearbyPrice({ lawdCd: '', dong: null, area: 84 }, five(), ASOF)).toEqual({ scope: 'none', count: 0 });
  });
});
```

- [ ] **Step 6: 실패 확인**

Run: `npx vitest run tests/trade-key.test.ts tests/trade-nearby.test.ts`
Expected: FAIL — `Failed to resolve import`

- [ ] **Step 7: 구현 (거래 키·중위가·주변 시세)**

`src/lib/trade/trade-key.ts`:
```ts
// 거래 해시: 출처에 고유번호가 없어 필드를 합쳐 만든다. 겹치면 순번 (spec §5)
import { fnv64 } from '../hash';

export interface TradeKeyFields {
  lawdCd: string; dong: string; jibun: string; name: string;
  area: number; floor: number | null; contractDate: string; amount: number;
}

export function tradeKeys(rows: TradeKeyFields[]): string[] {
  const seen = new Map<string, number>();
  return rows.map((r) => {
    const base = fnv64([r.lawdCd, r.dong, r.jibun, r.name, r.area, r.floor ?? '', r.contractDate, r.amount].join('|'));
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  });
}
```

`src/lib/trade/median.ts`:
```ts
export function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
```

`src/lib/trade/nearby.ts`:
```ts
// 주변 시세 (spec §9): 같은 법정동·최근 12개월·준공 10년 이내·해제 제외·전용 ±10㎡ → ㎡당 중위가
// 5건 미만이면 시군구로 넓히고, 그래도 5건 미만이면 '비교 자료 부족(n건)'
import { addMonths } from '../date';
import { median } from './median';

export interface TradeRecord {
  lawdCd: string; dong: string; area: number; contractDate: string;
  amount: number; buildYear: number | null; cancelled: boolean;
}

export type NearbyResult =
  | { scope: 'dong' | 'sigungu'; count: number; medianPerSqm: number }
  | { scope: 'insufficient'; count: number }
  | { scope: 'none'; count: 0 };

const MIN = 5;
const AREA_TOL = 10;
const MAX_AGE = 10;

export function nearbyPrice(target: { lawdCd: string; dong: string | null; area: number }, trades: TradeRecord[], asOf: string): NearbyResult {
  if (!target.lawdCd) return { scope: 'none', count: 0 };
  const from = addMonths(asOf, -12);
  const minYear = Number(asOf.slice(0, 4)) - MAX_AGE;
  const pool = trades.filter((r) =>
    r.lawdCd === target.lawdCd && !r.cancelled &&
    r.contractDate >= from && r.contractDate <= asOf &&
    r.buildYear !== null && r.buildYear >= minYear &&
    Math.abs(r.area - target.area) <= AREA_TOL + 1e-9);

  const pick = (rows: TradeRecord[], scope: 'dong' | 'sigungu'): NearbyResult | null =>
    rows.length >= MIN ? { scope, count: rows.length, medianPerSqm: Math.round(median(rows.map((r) => r.amount / r.area))!) } : null;

  if (target.dong) {
    const hit = pick(pool.filter((r) => r.dong === target.dong), 'dong');
    if (hit) return hit;
  }
  return pick(pool, 'sigungu') ?? { scope: 'insufficient', count: pool.length };
}
```

- [ ] **Step 8: 통과 확인**

Run: `npx vitest run tests/trade-key.test.ts tests/trade-nearby.test.ts`
Expected: PASS 2/2, 11/11

- [ ] **Step 9: 커밋**

```bash
git add src/lib/date.ts src/lib/hash.ts src/lib/trade tests/date.test.ts tests/hash.test.ts tests/trade-amount.test.ts tests/trade-key.test.ts tests/trade-nearby.test.ts
git commit -m "실거래: 날짜·금액 해석, 거래 해시와 순번, 주변 시세 중위가" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: 분양권 매칭 (단지명 정규화·지번 → 공고)

**Files:**
- Create: `src/lib/normalize-name.ts`, `src/lib/trade/presale-match.ts`
- Test: `tests/normalize-name.test.ts`, `tests/presale-match.test.ts`

**Interfaces:**
- Consumes: `parseJibun`, `jibunKey`, `type Jibun` (Task 4)
- Produces:
  - `normalizeComplexName(name: string): string`
  - `interface PresaleTradeLoc { sggCd: string; dong: string; jibun: string; name: string }`
  - `interface NoticeLoc { pblancNo: string; lawdCd: string | null; dong: string | null; jibun: Jibun | null; name: string }`
  - `matchPresale(trade: PresaleTradeLoc, notices: NoticeLoc[]): { pblancNo: string | null; method: 'jibun' | 'name' | 'none' }`

- [ ] **Step 1: 실패 테스트**

`tests/normalize-name.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { normalizeComplexName } from '../src/lib/normalize-name';

describe('normalizeComplexName', () => {
  it('공백·괄호·"아파트"를 정리한다', () => {
    expect(normalizeComplexName('힐스테이트 영통 (아파트)')).toBe('힐스테이트영통');
    expect(normalizeComplexName('래미안 원베일리아파트')).toBe('래미안원베일리');
  });
  it('차수 표기를 숫자로 맞춘다', () => {
    expect(normalizeComplexName('e편한세상 수원 2차')).toBe(normalizeComplexName('e편한세상수원(제2차)'));
    expect(normalizeComplexName('자이 Ⅱ')).toBe(normalizeComplexName('자이2차'));
  });
  it('영문 대소문자를 맞춘다', () => expect(normalizeComplexName('DMC SK VIEW')).toBe('dmcskview'));
  it('차수·단지 번호가 다르면 다른 이름으로 남는다', () => {
    expect(normalizeComplexName('푸르지오 1차')).not.toBe(normalizeComplexName('푸르지오 2차'));
    expect(normalizeComplexName('LH 1단지')).not.toBe(normalizeComplexName('LH 2단지'));
  });
});
```

`tests/presale-match.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { matchPresale, type NoticeLoc } from '../src/lib/trade/presale-match';
import { parseJibun } from '../src/lib/region/jibun';

const notices: NoticeLoc[] = [
  { pblancNo: 'P1', lawdCd: '41117', dong: '이의동', jibun: parseJibun('1234'), name: '힐스테이트 광교중앙역' },
  { pblancNo: 'P2', lawdCd: '41117', dong: '이의동', jibun: parseJibun('산 5-1'), name: '광교 자이 2차' },
  { pblancNo: 'P3', lawdCd: '41117', dong: '원천동', jibun: null, name: '원천 푸르지오' },
  { pblancNo: 'P4', lawdCd: '11680', dong: '역삼동', jibun: null, name: '원천 푸르지오' },
];

describe('matchPresale', () => {
  it('1차: 시군구+법정동+지번 (부번 없음 = -0)', () => {
    expect(matchPresale({ sggCd: '41117', dong: '이의동', jibun: '1234-0', name: '다른이름' }, notices)).toEqual({ pblancNo: 'P1', method: 'jibun' });
  });
  it('"산" 지번도 맞춘다', () => {
    expect(matchPresale({ sggCd: '41117', dong: '이의동', jibun: '산5-1', name: 'x' }, notices)).toEqual({ pblancNo: 'P2', method: 'jibun' });
  });
  it('2차: 지번이 안 맞으면 같은 시군구 안에서 정규화한 단지명', () => {
    expect(matchPresale({ sggCd: '41117', dong: '원천동', jibun: '99', name: '원천푸르지오아파트' }, notices)).toEqual({ pblancNo: 'P3', method: 'name' });
  });
  it('다른 시군구의 같은 이름은 맞추지 않는다', () => {
    expect(matchPresale({ sggCd: '41590', dong: '봉담읍', jibun: '1', name: '원천 푸르지오' }, notices)).toEqual({ pblancNo: null, method: 'none' });
  });
  it('이름 후보가 둘 이상이면 맞추지 않는다', () => {
    const dup = [...notices, { pblancNo: 'P5', lawdCd: '41117', dong: '원천동', jibun: null, name: '원천푸르지오' }];
    expect(matchPresale({ sggCd: '41117', dong: '원천동', jibun: '', name: '원천 푸르지오' }, dup)).toEqual({ pblancNo: null, method: 'none' });
  });
  it('차수가 다르면 이름으로 맞추지 않는다', () => {
    expect(matchPresale({ sggCd: '41117', dong: '이의동', jibun: '', name: '광교자이 1차' }, notices)).toEqual({ pblancNo: null, method: 'none' });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/normalize-name.test.ts tests/presale-match.test.ts`
Expected: FAIL — `Failed to resolve import`

- [ ] **Step 3: 구현**

`src/lib/normalize-name.ts`:
```ts
// 단지명 정규화 (분양권 매칭·LH 매칭 공용, spec §9). 차수·단지 번호 숫자는 남겨 다른 단지가 합쳐지지 않게 한다.
const ROMAN: Record<string, string> = { Ⅰ: '1', Ⅱ: '2', Ⅲ: '3', Ⅳ: '4', Ⅴ: '5', Ⅵ: '6', Ⅶ: '7', Ⅷ: '8', Ⅸ: '9', Ⅹ: '10' };

export function normalizeComplexName(name: string): string {
  return name
    .replace(/[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]/g, (c) => ROMAN[c])
    .normalize('NFKC')
    .toLowerCase()
    .replace(/아파트/g, '')
    .replace(/[\s()[\]{}<>·.,'"_\-]/g, '')
    .replace(/제?(\d+)차/g, '$1');
}
```

`src/lib/trade/presale-match.ts`:
```ts
// 분양권 거래 ↔ 청약홈 공고 (spec §9): 1차 시군구+법정동+지번, 2차 같은 시군구 안 정규화 단지명(후보 하나일 때만)
import { normalizeComplexName } from '../normalize-name';
import { parseJibun, jibunKey, type Jibun } from '../region/jibun';

export interface PresaleTradeLoc { sggCd: string; dong: string; jibun: string; name: string }
export interface NoticeLoc { pblancNo: string; lawdCd: string | null; dong: string | null; jibun: Jibun | null; name: string }
export type PresaleMatch = { pblancNo: string | null; method: 'jibun' | 'name' | 'none' };

export function matchPresale(trade: PresaleTradeLoc, notices: NoticeLoc[]): PresaleMatch {
  const sameSgg = notices.filter((n) => n.lawdCd === trade.sggCd);
  const j = parseJibun(trade.jibun);
  if (j) {
    const key = jibunKey(j);
    const hits = sameSgg.filter((n) => n.dong === trade.dong && n.jibun && jibunKey(n.jibun) === key);
    if (hits.length === 1) return { pblancNo: hits[0].pblancNo, method: 'jibun' };
  }
  const name = normalizeComplexName(trade.name);
  const byName = sameSgg.filter((n) => normalizeComplexName(n.name) === name);
  if (byName.length === 1) return { pblancNo: byName[0].pblancNo, method: 'name' };
  return { pblancNo: null, method: 'none' };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/normalize-name.test.ts tests/presale-match.test.ts`
Expected: PASS 4/4, 6/6

- [ ] **Step 5: 커밋**

```bash
git add src/lib/normalize-name.ts src/lib/trade/presale-match.ts tests/normalize-name.test.ts tests/presale-match.test.ts
git commit -m "분양권 매칭: 지번 1차, 정규화 단지명 2차" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: 공고 상태·일정·LH 매칭

**Files:**
- Create: `src/lib/apt/status.ts`, `src/lib/apt/schedule.ts`, `src/lib/apt/lh-match.ts`
- Test: `tests/apt-status.test.ts`, `tests/apt-schedule.test.ts`, `tests/lh-match.test.ts`

**Interfaces:**
- Consumes: `daysBetween` (Task 5), `normalizeComplexName` (Task 6)
- Produces:
  - `interface AptSchedule { specialStart: string | null; specialEnd: string | null; rank1Start: string | null; rank1End: string | null; rank2Start: string | null; rank2End: string | null; winnerDate: string | null; contractStart: string | null; contractEnd: string | null }`
  - `aptPhase(s: AptSchedule, state: 'normal' | 'corrected' | 'cancelled', today: string): { phase: 'upcoming' | 'open' | 'closed' | 'cancelled'; corrected: boolean }`
  - `type EventKind = 'special' | 'rank1' | 'rank2' | 'winner' | 'contract' | 'lh-receipt' | 'ipo-sub' | 'ipo-refund' | 'ipo-listing' | 'ipo-lockup'`
  - `interface CalendarEvent { date: string; endDate?: string; kind: EventKind; ref: string; title: string }`
  - `aptEvents(ref: string, title: string, s: AptSchedule): CalendarEvent[]`
  - `groupByMonth(events: CalendarEvent[]): Record<string, CalendarEvent[]>` (키 `YYYY-MM`, 날짜순)
  - `interface LhNoticeLoc { id: string; kind: 'sale' | 'rent'; lawdCd: string | null; noticeDate: string | null; name: string }`
  - `interface AptNoticeLoc { pblancNo: string; lawdCd: string | null; noticeDate: string | null; name: string }`
  - `matchLh(lh: LhNoticeLoc, notices: AptNoticeLoc[]): string | null`

- [ ] **Step 1: 실패 테스트**

`tests/apt-status.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { aptPhase, type AptSchedule } from '../src/lib/apt/status';

const s: AptSchedule = {
  specialStart: '2026-11-10', specialEnd: '2026-11-10', rank1Start: '2026-11-11', rank1End: '2026-11-11',
  rank2Start: '2026-11-12', rank2End: '2026-11-12', winnerDate: '2026-11-19', contractStart: '2026-12-01', contractEnd: '2026-12-03',
};

describe('aptPhase', () => {
  it('첫 접수일 전은 upcoming', () => expect(aptPhase(s, 'normal', '2026-11-09')).toEqual({ phase: 'upcoming', corrected: false }));
  it('첫 접수일부터 마지막 접수일까지는 open (양 끝 포함)', () => {
    expect(aptPhase(s, 'normal', '2026-11-10').phase).toBe('open');
    expect(aptPhase(s, 'normal', '2026-11-12').phase).toBe('open');
  });
  it('마지막 접수일 다음 날부터 closed', () => expect(aptPhase(s, 'normal', '2026-11-13').phase).toBe('closed'));
  it('2순위가 없으면 1순위 마감이 마지막 접수일', () => {
    expect(aptPhase({ ...s, rank2Start: null, rank2End: null }, 'normal', '2026-11-12').phase).toBe('closed');
  });
  it('정정은 표시만 하고 단계는 그대로', () => expect(aptPhase(s, 'corrected', '2026-11-11')).toEqual({ phase: 'open', corrected: true }));
  it('취소가 가장 앞선다', () => expect(aptPhase(s, 'cancelled', '2026-11-11').phase).toBe('cancelled'));
  it('접수일을 하나도 모르면 upcoming', () => {
    const none = Object.fromEntries(Object.keys(s).map((k) => [k, null])) as unknown as AptSchedule;
    expect(aptPhase(none, 'normal', '2026-11-11').phase).toBe('upcoming');
  });
});
```

`tests/apt-schedule.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { aptEvents, groupByMonth } from '../src/lib/apt/schedule';
import type { AptSchedule } from '../src/lib/apt/status';

const s: AptSchedule = {
  specialStart: '2026-11-30', specialEnd: '2026-11-30', rank1Start: '2026-12-01', rank1End: '2026-12-01',
  rank2Start: null, rank2End: null, winnerDate: '2026-12-08', contractStart: '2026-12-20', contractEnd: '2026-12-22',
};

describe('aptEvents', () => {
  it('있는 일정만 만들고, 기간은 endDate로', () => {
    const ev = aptEvents('P1', '광교자이', s);
    expect(ev.map((e) => e.kind)).toEqual(['special', 'rank1', 'winner', 'contract']);
    expect(ev[3]).toEqual({ date: '2026-12-20', endDate: '2026-12-22', kind: 'contract', ref: 'P1', title: '광교자이' });
    expect(ev[0].endDate).toBeUndefined(); // 하루짜리는 endDate 없음
  });
});

describe('groupByMonth', () => {
  it('시작일 기준 달로 묶고 날짜순', () => {
    const g = groupByMonth(aptEvents('P1', '광교자이', s));
    expect(Object.keys(g)).toEqual(['2026-11', '2026-12']);
    expect(g['2026-12'].map((e) => e.date)).toEqual(['2026-12-01', '2026-12-08', '2026-12-20']);
  });
});
```

`tests/lh-match.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { matchLh, type AptNoticeLoc } from '../src/lib/apt/lh-match';

const notices: AptNoticeLoc[] = [
  { pblancNo: 'P1', lawdCd: '41590', noticeDate: '2026-11-05', name: '화성동탄2 A-62블록 신혼희망타운' },
  { pblancNo: 'P2', lawdCd: '41590', noticeDate: '2026-11-05', name: '화성태안3 B-2블록' },
];
const lh = { id: 'L1', kind: 'sale' as const, lawdCd: '41590', noticeDate: '2026-11-08', name: '화성동탄2 A-62블록 신혼희망타운' };

describe('matchLh', () => {
  it('시군구 같고 공고일 3일 이내이고 이름 같으면 맞춘다 (3일 경계 포함)', () => {
    expect(matchLh(lh, notices)).toBe('P1');
  });
  it('공고일이 4일 차이면 맞추지 않는다', () => {
    expect(matchLh({ ...lh, noticeDate: '2026-11-09' }, notices)).toBeNull();
  });
  it('후보가 둘 이상이면 맞추지 않는다', () => {
    const dup = [...notices, { ...notices[0], pblancNo: 'P9', noticeDate: '2026-11-06' }];
    expect(matchLh(lh, dup)).toBeNull();
  });
  it('임대 공고는 맞추지 않는다', () => {
    expect(matchLh({ ...lh, kind: 'rent' }, notices)).toBeNull();
  });
  it('시군구나 공고일을 모르면 맞추지 않는다', () => {
    expect(matchLh({ ...lh, lawdCd: null }, notices)).toBeNull();
    expect(matchLh({ ...lh, noticeDate: null }, notices)).toBeNull();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/apt-status.test.ts tests/apt-schedule.test.ts tests/lh-match.test.ts`
Expected: FAIL — `Failed to resolve import`

- [ ] **Step 3: 구현**

`src/lib/apt/status.ts`:
```ts
// 공고 단계 (spec §5 상태: 정상·정정·취소·종료). 정정은 배지(corrected)로만, 단계는 일정으로 정한다.
export interface AptSchedule {
  specialStart: string | null; specialEnd: string | null;
  rank1Start: string | null; rank1End: string | null;
  rank2Start: string | null; rank2End: string | null;
  winnerDate: string | null; contractStart: string | null; contractEnd: string | null;
}

export type AptPhase = 'upcoming' | 'open' | 'closed' | 'cancelled';

export function aptPhase(s: AptSchedule, state: 'normal' | 'corrected' | 'cancelled', today: string): { phase: AptPhase; corrected: boolean } {
  const corrected = state === 'corrected';
  if (state === 'cancelled') return { phase: 'cancelled', corrected };
  const starts = [s.specialStart, s.rank1Start, s.rank2Start].filter((d): d is string => !!d).sort();
  const ends = [s.specialEnd, s.rank1End, s.rank2End].filter((d): d is string => !!d).sort();
  if (!starts.length || today < starts[0]) return { phase: 'upcoming', corrected };
  const last = ends.at(-1) ?? starts.at(-1)!;
  return { phase: today > last ? 'closed' : 'open', corrected };
}
```

`src/lib/apt/schedule.ts`:
```ts
// 공고 일정 → 캘린더 일정 (spec §6 calendar:YYYY-MM)
import type { AptSchedule } from './status';

export type EventKind = 'special' | 'rank1' | 'rank2' | 'winner' | 'contract'
  | 'lh-receipt' | 'ipo-sub' | 'ipo-refund' | 'ipo-listing' | 'ipo-lockup';

export interface CalendarEvent { date: string; endDate?: string; kind: EventKind; ref: string; title: string }

function ev(kind: EventKind, ref: string, title: string, start: string | null, end?: string | null): CalendarEvent[] {
  if (!start) return [];
  return [{ date: start, ...(end && end !== start ? { endDate: end } : {}), kind, ref, title }];
}

export function aptEvents(ref: string, title: string, s: AptSchedule): CalendarEvent[] {
  return [
    ...ev('special', ref, title, s.specialStart, s.specialEnd),
    ...ev('rank1', ref, title, s.rank1Start, s.rank1End),
    ...ev('rank2', ref, title, s.rank2Start, s.rank2End),
    ...ev('winner', ref, title, s.winnerDate),
    ...ev('contract', ref, title, s.contractStart, s.contractEnd),
  ];
}

export function groupByMonth(events: CalendarEvent[]): Record<string, CalendarEvent[]> {
  const out: Record<string, CalendarEvent[]> = {};
  for (const e of [...events].sort((a, b) => a.date.localeCompare(b.date))) (out[e.date.slice(0, 7)] ??= []).push(e);
  return out;
}
```

`src/lib/apt/lh-match.ts`:
```ts
// LH 분양 공고 ↔ 청약홈 공고 (spec §9): 시군구 같고, 모집공고일 3일 이내, 정규화 단지명 같음. 후보가 하나일 때만.
import { daysBetween } from '../date';
import { normalizeComplexName } from '../normalize-name';

export interface LhNoticeLoc { id: string; kind: 'sale' | 'rent'; lawdCd: string | null; noticeDate: string | null; name: string }
export interface AptNoticeLoc { pblancNo: string; lawdCd: string | null; noticeDate: string | null; name: string }

const MAX_DAYS = 3;

export function matchLh(lh: LhNoticeLoc, notices: AptNoticeLoc[]): string | null {
  if (lh.kind !== 'sale' || !lh.lawdCd || !lh.noticeDate) return null;
  const name = normalizeComplexName(lh.name);
  const hits = notices.filter((n) =>
    n.lawdCd === lh.lawdCd && n.noticeDate &&
    Math.abs(daysBetween(n.noticeDate, lh.noticeDate!)) <= MAX_DAYS &&
    normalizeComplexName(n.name) === name);
  return hits.length === 1 ? hits[0].pblancNo : null;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/apt-status.test.ts tests/apt-schedule.test.ts tests/lh-match.test.ts`
Expected: PASS 7/7, 2/2, 5/5

- [ ] **Step 5: 커밋**

```bash
git add src/lib/apt tests/apt-status.test.ts tests/apt-schedule.test.ts tests/lh-match.test.ts
git commit -m "공고: 단계(예정·접수 중·종료·취소), 캘린더 일정, LH 분양 ↔ 청약홈 맞추기" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: 공모주 판 고르기·보호예수 매칭

**Files:**
- Create: `src/lib/ipo/filing.ts`, `src/lib/ipo/lockup.ts`
- Test: `tests/ipo-filing.test.ts`, `tests/ipo-lockup.test.ts`

**Interfaces:**
- Produces:
  - `interface Filing { rceptNo: string; reportNm: string; rceptDt: string }`
  - `isEquityFiling(reportNm: string): boolean` (증권신고서(지분증권) 판만)
  - `pickFiling(filings: Filing[]): { latest: Filing; revisions: Revision[] } | null`
  - `interface Revision { rceptNo: string; rceptDt: string; corrected: boolean }`
  - `interface LockupRow { stockCode: string | null; crno: string | null; releaseDate: string; shareKind: string; shares: number }`
  - `interface IpoIds { corpCode: string; stockCode: string | null; crno: string | null }`
  - `normalizeStockCode(s: string | null): string | null`, `normalizeCrno(s: string | null): string | null`
  - `matchLockups(rows: LockupRow[], ipos: IpoIds[]): (LockupRow & { corpCode: string })[]`

- [ ] **Step 1: 실패 테스트**

`tests/ipo-filing.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { pickFiling, isEquityFiling, type Filing } from '../src/lib/ipo/filing';

const f = (rceptNo: string, reportNm: string): Filing => ({ rceptNo, reportNm, rceptDt: rceptNo.slice(0, 8) });

describe('isEquityFiling', () => {
  it('증권신고서(지분증권)와 그 정정만', () => {
    expect(isEquityFiling('증권신고서(지분증권)')).toBe(true);
    expect(isEquityFiling('[기재정정]증권신고서(지분증권)')).toBe(true);
    expect(isEquityFiling('증권신고서(채무증권)')).toBe(false);
    expect(isEquityFiling('투자설명서')).toBe(false);
  });
});

describe('pickFiling', () => {
  it('접수번호가 가장 늦은 판을 쓴다 (입력 순서와 무관)', () => {
    const r = pickFiling([f('20261020000200', '[기재정정]증권신고서(지분증권)'), f('20261001000100', '증권신고서(지분증권)')]);
    expect(r!.latest.rceptNo).toBe('20261020000200');
  });
  it('정정 이력: 접수번호 순, [기재정정] 표시', () => {
    const r = pickFiling([
      f('20261001000100', '증권신고서(지분증권)'),
      f('20261020000200', '[기재정정]증권신고서(지분증권)'),
      f('20261025000300', '[기재정정]증권신고서(지분증권)'),
    ]);
    expect(r!.revisions).toEqual([
      { rceptNo: '20261001000100', rceptDt: '20261001', corrected: false },
      { rceptNo: '20261020000200', rceptDt: '20261020', corrected: true },
      { rceptNo: '20261025000300', rceptDt: '20261025', corrected: true },
    ]);
  });
  it('지분증권 신고서가 없으면 null', () => {
    expect(pickFiling([f('20261001000100', '투자설명서')])).toBeNull();
    expect(pickFiling([])).toBeNull();
  });
});
```

`tests/ipo-lockup.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { matchLockups, normalizeStockCode, normalizeCrno, type LockupRow, type IpoIds } from '../src/lib/ipo/lockup';

const ipos: IpoIds[] = [
  { corpCode: '00100001', stockCode: '012345', crno: '1101111234567' },
  { corpCode: '00100002', stockCode: null, crno: '1101119876543' },
];
const row = (o: Partial<LockupRow>): LockupRow => ({ stockCode: null, crno: null, releaseDate: '2027-05-01', shareKind: '보통주', shares: 1000, ...o });

describe('정규화', () => {
  it('종목코드: 앞 A 제거, 6자리', () => {
    expect(normalizeStockCode('A012345')).toBe('012345');
    expect(normalizeStockCode('12345')).toBe('012345');
    expect(normalizeStockCode('')).toBeNull();
  });
  it('법인등록번호: 하이픈 제거, 13자리만', () => {
    expect(normalizeCrno('110111-1234567')).toBe('1101111234567');
    expect(normalizeCrno('123')).toBeNull();
  });
});

describe('matchLockups', () => {
  it('1차 종목코드로 맞춘다', () => {
    expect(matchLockups([row({ stockCode: 'A012345' })], ipos)[0].corpCode).toBe('00100001');
  });
  it('종목코드가 없으면 법인등록번호로 맞춘다', () => {
    expect(matchLockups([row({ crno: '110111-9876543' })], ipos)[0].corpCode).toBe('00100002');
  });
  it('종목코드가 있어도 맞는 공모주가 없으면 법인등록번호로 다시 본다', () => {
    expect(matchLockups([row({ stockCode: '999999', crno: '1101119876543' })], ipos)[0].corpCode).toBe('00100002');
  });
  it('둘 다 없거나 맞지 않으면 버린다', () => {
    expect(matchLockups([row({}), row({ stockCode: '999999' })], ipos)).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/ipo-filing.test.ts tests/ipo-lockup.test.ts`
Expected: FAIL — `Failed to resolve import`

- [ ] **Step 3: 구현**

`src/lib/ipo/filing.ts`:
```ts
// DART 증권신고서(지분증권) 판 고르기 (spec §9): 접수번호가 가장 늦은 판을 쓰고, 정정은 이력에 남긴다
export interface Filing { rceptNo: string; reportNm: string; rceptDt: string }
export interface Revision { rceptNo: string; rceptDt: string; corrected: boolean }

export const isEquityFiling = (reportNm: string): boolean => /증권신고서\s*\(지분증권\)/.test(reportNm);

export function pickFiling(filings: Filing[]): { latest: Filing; revisions: Revision[] } | null {
  const eq = filings.filter((f) => isEquityFiling(f.reportNm)).sort((a, b) => a.rceptNo.localeCompare(b.rceptNo));
  if (!eq.length) return null;
  return {
    latest: eq.at(-1)!,
    revisions: eq.map((f) => ({ rceptNo: f.rceptNo, rceptDt: f.rceptDt, corrected: f.reportNm.includes('[기재정정]') })),
  };
}
```

`src/lib/ipo/lockup.ts`:
```ts
// 의무보호예수 반환 ↔ 공모주 (spec §9): 종목코드, 안 되면 법인등록번호. 맞추지 못하면 버린다. 해석 없이 사실만 쓴다.
export interface LockupRow { stockCode: string | null; crno: string | null; releaseDate: string; shareKind: string; shares: number }
export interface IpoIds { corpCode: string; stockCode: string | null; crno: string | null }

export function normalizeStockCode(s: string | null): string | null {
  const t = (s ?? '').trim().replace(/^A/i, '');
  return /^\d{1,6}$/.test(t) ? t.padStart(6, '0') : null;
}

export function normalizeCrno(s: string | null): string | null {
  const t = (s ?? '').replace(/[-\s]/g, '');
  return /^\d{13}$/.test(t) ? t : null;
}

export function matchLockups(rows: LockupRow[], ipos: IpoIds[]): (LockupRow & { corpCode: string })[] {
  const byStock = new Map<string, string>();
  const byCrno = new Map<string, string>();
  for (const i of ipos) {
    const s = normalizeStockCode(i.stockCode);
    const c = normalizeCrno(i.crno);
    if (s) byStock.set(s, i.corpCode);
    if (c) byCrno.set(c, i.corpCode);
  }
  const out: (LockupRow & { corpCode: string })[] = [];
  for (const r of rows) {
    const s = normalizeStockCode(r.stockCode);
    const c = normalizeCrno(r.crno);
    const corpCode = (s && byStock.get(s)) || (c && byCrno.get(c)) || null;
    if (corpCode) out.push({ ...r, corpCode });
  }
  return out;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/ipo-filing.test.ts tests/ipo-lockup.test.ts`
Expected: PASS 4/4, 6/6

- [ ] **Step 5: 전체 확인**

Run: `npm test`
Expected: 모든 테스트 PASS

Run: `npm run typecheck`
Expected: `0 errors`

- [ ] **Step 6: PLAN.md 갱신과 커밋**

`PLAN.md` 체크리스트 A-T1~A-T8을 `[x]`로, 진행률을 `완료 10 / 전체 11`로, 다음 작업을 "Plan B(특공 판정) 계획 작성: klaw로 「주택공급에 관한 규칙」 제35조의3·제40조·제41조·제43조·제46조·제48조·제55조·제55조의3 원문 확인, 2026 도시근로자 월평균소득 기준표 출처 확인"으로 고친다.

```bash
git add src/lib/ipo tests/ipo-filing.test.ts tests/ipo-lockup.test.ts PLAN.md
git commit -m "공모주: DART 신고서 판 고르기·정정 이력, 보호예수 맞추기" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
