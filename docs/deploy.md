# 배포·운영 절차

> **사용자 확인 필요** 표시가 붙은 단계는 사용자가 직접 한다(계정·결제·외부 등록·원격 쓰기). Claude 는 로컬 빌드·미리보기와 이 문서 갱신까지만 한다.
> 비밀값은 `.env`(로컬)와 GitHub Secrets 에만 둔다. 이 문서에 키 값을 적지 않는다.

## 0. 배포 전 로컬 점검
1. 새로 clone 했으면 `npm ci` 뒤 `npm run cf-typegen` — `worker-configuration.d.ts` 는 git 에서 빠져 있어 이걸 만들지 않으면 typecheck 가 깨진다(`wrangler.jsonc` 를 고친 뒤에도 다시).
2. `npm test && npm run typecheck && npm run build`
3. `npm run db:migrate:local && npm run sync -- --target local --fixtures sync/fixtures`
4. `npx wrangler dev` → `/`, `/calendar/<이번 달>`, `/apt/2026820015`, `/lh/0000061174`, `/competition`, `/region`, `/ipo`, `/eligibility`, `/sitemap.xml`, `/robots.txt` 가 200(`/calendar` 는 302). 다 보면 끈다(wrangler·workerd 프로세스가 남지 않았는지, `:8787` 이 응답하지 않는지).

## 1. Cloudflare — **사용자 확인 필요**
1. Cloudflare 가입(지원금다모아와 별도 계정).
2. `npx wrangler login` (또는 `.env` 의 `CLOUDFLARE_API_TOKEN` — 권한: Workers 편집, D1 편집, Workers KV 편집, Account Analytics 읽기). `CLOUDFLARE_ACCOUNT_ID` 도 `.env` 에.
3. `npx wrangler d1 create cheongyak-damoa` → 나온 `database_id` 를 `wrangler.jsonc` 의 `d1_databases[0].database_id` 에(지금은 0 으로 채운 자리값).
4. `npx wrangler kv namespace create KV` → 나온 `id` 를 `wrangler.jsonc` 의 `kv_namespaces[0].id` 에.
5. `wrangler.jsonc` 의 `vars.SITE_URL` 을 대표 주소로 바꾼다. **지금은 `http://localhost:4321`** 이라 그대로 배포하면 사이트맵·`robots.txt`·canonical 이 전부 localhost 주소로 나간다. 도메인 전에는 첫 배포 뒤 나오는 workers.dev 주소(`https://cheongyak-damoa.<계정>.workers.dev`)를 넣고 한 번 더 배포한다. `SITE_URL` 이 localhost·workers.dev 이면 미들웨어는 301 을 하지 않는다.
6. 고친 뒤 `npm run cf-typegen`.

## 2. 원격 스키마 — 0001 확인 먼저 (**사용자 확인 필요**)
`migrations/0001_init.sql` 은 제자리에서 고쳤다(`account_stats.area_kind` 열과 기본키 추가). 옛 0001 이 원격에 적용된 적이 있으면 마이그레이션이 다시 돌지 않아 새 열이 생기지 않는다.
1. `npx wrangler d1 migrations list DB --remote` — 0001 이 **적용 안 됨**이면 3으로.
2. 이미 적용됨이면 `npx wrangler d1 execute DB --remote --command "PRAGMA table_info(account_stats)"` 로 `area_kind` 열을 확인한다. 없으면 `DROP TABLE account_stats` 뒤 0001 의 `CREATE TABLE account_stats …` 문만 실행한다(사용자와 함께). 이 표는 동기화가 D1 과 비교해 다시 채우므로 지워도 다음 동기화에서 돌아온다.
3. `npm run db:migrate:remote`

## 3. 첫 배포 — **사용자 확인 필요**
1. `npm run deploy`
2. 표시된 workers.dev 주소에서 0단계 4번 주소들을 다시 확인한다(첫 동기화 전이라 화면은 "자료가 아직 없습니다" 안내가 정상).
3. `/sitemap.xml`·`/robots.txt` 와 페이지 머리의 canonical 이 localhost 가 아닌지 본다(1단계 5번).

## 4. GitHub 저장소와 Secrets — **사용자 확인 필요**
1. 저장소를 만들고 `git remote add origin <주소>` 뒤 push. **지금 이 저장소에는 remote 가 없다** — origin 을 정하기 전에는 `npm run ops:daily` 의 Actions 구역이 '(확인 못 함)'으로 나온다.
2. Secrets: `DATA_GO_KR_KEY`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `DART_API_KEY`(발급 뒤 — 지금 `sync.yml` 은 쓰지 않음).
3. 저장소 변수 `SYNC_ENABLED=true` 를 켜면 `.github/workflows/sync.yml` 이 하루 두 번(KST 04:00·16:00) 돈다. 첫 실행은 Actions 화면에서 수동 실행하고 로그에 키가 찍히지 않는지 본다.
4. 첫 동기화가 끝나면 `/` 에 오늘 일정이, `/competition` 에 경쟁률이 보이는지 확인한다. 이어서 9단계 확인.

## 5. 도메인 — **사용자 확인 필요**
1. 도메인 구입 → Cloudflare 에 사이트 추가 → Workers 사용자 지정 도메인 연결.
2. `src/lib/site-meta.ts` 의 `SITE.url` 과 `wrangler.jsonc` 의 `SITE_URL` 을 새 주소로(이 두 곳만).
3. `npm run deploy`. 이제 workers.dev·www·http 주소는 미들웨어가 대표 주소로 301 넘긴다.
4. 방문 수(`ops:daily` 의 "어제 방문")를 보려면 Cloudflare 대시보드에서 이 사이트의 Web Analytics 를 켠다.

## 6. 검색 등록 — **사용자 확인 필요** (도메인 연결 뒤)
1. 구글 서치콘솔: 도메인 속성 추가, `https://<도메인>/sitemap.xml` 제출.
2. 네이버 서치어드바이저: 사이트 등록, 확인 메타 태그는 `src/layouts/Base.astro` 머리에 넣고 배포, 사이트맵 제출.
3. IndexNow 는 배포·도메인 연결 뒤에 켠다(이 계획 범위 밖).

## 7. 애드센스 — **사용자 확인 필요**
1. 콘텐츠가 쌓인 뒤 신청.
2. 승인되면 `src/components/AdSlot.astro` 만 고친다(지금은 빈 자리).

## 8. 매일 점검
- 배포 뒤 `.env` 에 `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `GH_TOKEN`(Actions 읽기) 을 두고 `npm run ops:daily -- --write-log`.
- 실서버 응답은 `.env` 의 `SITE_URL` 이 있으면 그 주소, 없으면 `SITE.url` 을 본다. 도메인 전에는 `SITE.url` 이 아직 사지 않은 주소이므로 `.env` 에 `SITE_URL=<workers.dev 주소>` 를 둔다.
- 읽기만 한다(어제 방문, Worker·D1·KV 한도, Actions, 실서버 응답). `docs/traffic-log.md` 에 하루 한 줄. Actions 구역은 4단계 1번(origin) 전에는 '(확인 못 함)'.

## 9. 실데이터 첫 동기화 뒤 확인 — **사용자 확인 필요**
1. 실거래 지역코드: 광주·전남이 전남광주통합특별시(코드 12)로 합쳐져 `LAWD_CD` 가 `12xxx`(신설 코드)로 오는지, 옛 `29xxx`(광주)·`46xxx`(전남) 로 오는지 본다: `npx wrangler d1 execute DB --remote --command "SELECT substr(lawd_cd,1,2) AS sido, COUNT(*) FROM trade GROUP BY 1"`. 어느 쪽인지에 따라 법정동 표(`content/lawd/lawd.json`)와 `/trade/{시군구코드}` 주소가 맞는지 확인한다.
2. 청약통장 면적 구분: `BLNC_SECD` 02·03 은 실응답에서 뜻이 적혀 오지 않아 지금은 **'102㎡ 이하'·'135㎡ 이하'로 추정해** 붙였다(`src/lib/view/region.ts` 의 `AREA_KIND_LABEL`, 01 '85㎡ 이하'·04 '모든 면적'). 출처 문서나 청약홈 화면과 대조해 맞는지 확인하고, 다르면 이 표만 고친다.
3. `/competition`·`/region/{시도}` 의 청약통장 표가 비어 있지 않은지 본다.
