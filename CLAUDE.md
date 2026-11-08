# 청약다모아(가칭)

아파트 청약·공모주 일정과 실거래가 조회 사이트. 청약홈·LH·국토부 실거래·OpenDART·금융위원회 → GitHub Actions 동기화 → Cloudflare D1·KV → Astro(SSR, Cloudflare Workers). 설계: `docs/superpowers/specs/2026-11-07-cheongyak-site-design.md`

## 구조
- `src/lib/` 순수 로직 (Cloudflare·Node API 금지 — 브라우저·Worker·Node 공용). 테스트는 `tests/`
  - `region/` 주소 → 법정동·`lawdCd`, 지번 / `trade/` 금액·거래 해시·중위가·주변 시세·분양권 매칭 / `apt/` 공고 상태·일정·LH 매칭 / `ipo/` DART 판 고르기·보호예수 매칭 / `units.ts` ㎡↔평 / `site-meta.ts` 사이트 이름(여기서만 바꾼다)
  - 입력은 내부 타입. 출처 원본 → 내부 타입 변환은 `sync/` 쪽
- `src/lib/view/` 화면 계산(묶음 → 표시 모델, 순수 함수). `bundle-types.ts` 는 `sync/bundles.ts` 결과 모양. 키 계약은 `src/lib/kv-keys.ts`(`tests/kv-keys.test.ts`)
- `src/server/` KV 읽기(`getJson` 50KB 이하 묶음, `getStream`)·캐시 머리글, `src/middleware.ts` 대표 주소 301·Cache API
- `src/pages/` 페이지: `/`, `/calendar/YYYY-MM`, `/apt/{공고번호}`, `/lh/{id}`, `/ipo[/{고유번호}]`, `/region[/{시도}[/{시군구}]]`, `/trade/{시군구코드}/{법정동}`, `/competition`, `/eligibility[/{공고번호}/{주택형}]`, `/sitemap.xml`
- `src/scripts/` 브라우저 스크립트. `eligibility-client.ts` 는 네트워크·주소·저장소 금지(`tests/eligibility-no-leak.test.ts`)
- `sync/ops-daily.ts` 매일 점검(읽기만)
- `sync/` Node 전용 동기화. `survey.ts`(실응답 → `sync/fixtures/<출처>/`, 키 제거), `lawd-snapshot.ts`(법정동코드 → `content/lawd/lawd.json`)
- `migrations/` D1 스키마, `content/` 법정동 표·소득 기준표, `docs/api-fields.md` 실응답 필드

## 명령어
- `npm test` / `npm run typecheck` / `npm run build` / `npm run dev`
- `npm run survey` 출처별 실응답 저장 (`.env` 의 `DATA_GO_KR_KEY`, `DART_API_KEY`)
- `npm run lawd:snapshot` 법정동코드 스냅숏 갱신
- `npm run db:migrate:local` 로컬 D1 스키마
- `npm run sync -- --target local --fixtures sync/fixtures` 샘플 데이터로 로컬 동기화 → `npx wrangler dev` 로 미리보기
- `npm run ops:daily -- --write-log` 매일 점검(배포 뒤). 배포 절차는 `docs/deploy.md`
- 새로 clone 하면 `npm run cf-typegen` (`worker-configuration.d.ts` 는 git 제외)

## 지켜야 할 것
- 자격 판정 입력값은 서버로 보내지 않는다 (URL 쿼리 포함)
- Workers CPU 10ms: Worker 에서 큰 JSON 파싱 금지, 페이지마다 KV 묶음 하나
- D1 쓰기 하루 10만 행, KV 쓰기 하루 1,000건: 바뀐 것만 쓴다
- 비밀값은 `.env`·GitHub Secrets 에만. fixtures 에 키를 남기지 않는다
- 공모주: 투자 권유·예상 수익·"차익" 문구 금지, 보호예수는 사실만. 시세 비교에 "싸다·비싸다" 금지
- 지원금다모아 저장소는 고치지 않는다 (복사만)
