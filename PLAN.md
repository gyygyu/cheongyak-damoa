# 청약다모아 — PLAN

## 1. 목표 / 전체 작업 계획
아파트 청약·공모주 일정과 실거래가 조회 사이트. 운영비 월 0원, 검색 유입 광고 수익.
- 설계: `docs/superpowers/specs/2026-11-07-cheongyak-site-design.md`
- Plan A 기반·순수 로직: `docs/superpowers/plans/2026-11-07-cheongyak-foundation.md`
- Plan B 특공 판정: `docs/superpowers/plans/2026-11-07-cheongyak-special-supply.md`
- Plan C 동기화: `docs/superpowers/plans/2026-11-07-cheongyak-sync.md`
- Plan D 화면·배포 문서·ops: `docs/superpowers/plans/2026-11-07-cheongyak-screens.md`, 배포 절차 `docs/deploy.md`

## 2. 단계별 구현 계획
1. Plan A: 골격(T1), API 조사·fixtures(T2), D1 스키마(T3), 지역(T4), 실거래(T5), 분양권 매칭(T6), 공고·LH(T7), 공모주(T8)
2. Plan B: 특공 판정 (조문 확인·소득 기준표)
3. Plan C: 동기화 (수집기·이상치 차단·SQL·KV·백필)
4. Plan D: 화면, docs/deploy.md, ops
5. 11-17 이후(사용자): Cloudflare 가입, 도메인, Secrets, 서치콘솔, 애드센스

## 3. 체크리스트
- [x] 설계 문서 작성·승인
- [x] Plan A 작성
- [x] A-T1 골격
- [x] A-T2 API 조사·fixtures·법정동 스냅숏
- [x] A-T3 D1 스키마
- [x] A-T4 지역 해석
- [x] A-T5 실거래 로직
- [x] A-T6 분양권 매칭
- [x] A-T7 공고 상태·일정·LH 매칭
- [x] A-T8 공모주 판·보호예수
- [x] Plan A 최종 리뷰·수정 5건 (443dee6, 104/104)
- [x] Plan B 특공 판정 (최종 리뷰 수정 4건 b1970bd, 189/189)
- [x] Plan C 동기화 (plan-c-sync, 최종 리뷰 수정 6건 362a28d, 287/287)
- [x] Plan D 화면·배포 문서·ops (plan-d-screens, Task 1~9, 52 files·396 passed — opus 최종 리뷰 전)
- [ ] plan-a-foundation·plan-b-special-supply·plan-c-sync 브랜치 main 병합 (사용자 확인 필요)

## 4. 진행률
완료 14 / 전체 15 (마지막 갱신 2026-11-08, Plan D 완료·최종 리뷰 반영 — 병합·배포 남음)

## 5. 다음에 할 작업
1. ~~Plan D opus 최종 리뷰·수정 한 번~~ 완료(2026-11-08, 1558fd1, 시험 409/409). 미룬 작은 것은 §6 'Plan D 최종 리뷰 미룬 것'
2. **사용자 확인 필요** 브랜치 병합: plan-a-foundation·plan-b-special-supply·plan-c-sync·plan-d-screens → main
3. **사용자 확인 필요** 배포(`docs/deploy.md`):
   1. 1~3단계: Cloudflare 가입, D1·KV 만들기, `SITE_URL`(지금 localhost) 바꾸기, 0001 적용 여부 확인 뒤 원격 스키마, 첫 배포
   2. 4단계: GitHub 저장소(origin — 지금 remote 없음)·Secrets, `SYNC_ENABLED=true`, 첫 동기화 수동 실행
   3. 첫 실데이터 동기화 뒤 화면 점검(9단계): `/competition`·`/region/{시도}` 청약통장 표, `BLNC_SECD` 02·03 라벨(`src/lib/view/region.ts` AREA_KIND_LABEL — '102㎡ 이하'·'135㎡ 이하'는 추정), 실거래 `LAWD_CD` 12xxx(전남광주통합특별시)인지 옛 29xxx/46xxx 인지
   4. 도메인 연결 뒤 서치콘솔·네이버 사이트맵 제출, `npm run ops:daily` 예약
   5. DART 키 발급 뒤 `ipo:{고유번호}` 묶음과 `ipo-*` 일정 생산(동기화 쪽) — 화면은 준비됨
- 배포 전 확인: 원격 D1 에 옛 0001(area_kind 없음)이 적용된 적 없는지 — 0001 을 제자리에서 고쳤음 (`docs/deploy.md` 2단계)
- 새로 clone 하면 `npm run cf-typegen` (`worker-configuration.d.ts` 는 git 제외)

## 6. 결정 사항 · 막혔던 문제
- Plan D 최종 리뷰 미룬 것(작은 것, 필요할 때 처리): global.css 안 쓰는 선택자 속 옛 녹색 rgba(15,110,86) / 깨진 % 주소는 Astro 가 빈 400(메뉴 없음) — Worker 진입부에서 404 화면으로 / 묶음이 없을 때도 home·competition·ipo 가 공개 캐시 1시간 / `/api/meta.json` 이 lastError(외부 응답 일부) 공개 — lastSuccess 만 / docs/deploy.md 면적 02·03 '추정' 문구 / ops-daily RUM·Workers date 필터가 UTC(한국 날짜와 9시간) / SITE_URL 이 wrangler.jsonc·site-meta.ts 두 곳 / 공모주 철회 배지 색이 정정과 같음 / LH 상세는 잘린 묶음 안내 없음 / 전전달 시작 긴 일정은 캘린더에서 빠짐 / 화면 스크립트 DOM 타입이 worker 타입과 섞임(tsconfig 분리)
- Plan D Ruling: 묶음 지역 청약통장 통계 — 세종은 기타지역, 전남광주통합특별시는 5대광역시(옛 광주)·기타지역(옛 전남) 둘 다 밝힘, 묶음 줄은 단독 줄이 없을 때만
- 청약홈 분양정보 API 401(11-07) — 개통 대기로 추정. survey 때 다시 확인
- OpenDART 키는 사용자가 발급해 `.env` 에 넣는다
- 도메인 미확정 — `src/lib/site-meta.ts` 에서만 바꾼다
- 시군구 비교는 `sameSigungu(a, b, idx.cityOf)` — 시·구 관계는 법정동 표에서 만든 cityOf 로만(코드 끝자리 추측은 영동군·증평군을 섞음)
- 광주·전남은 2026 통합: 법정동 표에 `전남광주통합특별시`(12)만 있음, 광주·전남 별칭은 그쪽으로
- 청약통장 기간별 통계(약 197만 행)는 D1 에 넣지 않음(쓰기 한도)
- Plan A 미뤄 둔 작은 것: '서울시' 줄임말·군위군 null, date.ts 끝 고정, 날짜 없는 공고 상태, lh_supply 반올림
- 보호예수(주식발행정보)는 상업적 이용금지 — 매칭 로직·표만 두고 수집은 끔. 문의: 한국예탁결제원 증권정보부(portal@ksd.or.kr)
- DART 신고서: 대괄호 머리말([기재정정]·[발행조건확정])은 모두 정정 이력, 외국법인 법인등록번호 0000000000000 은 매칭에 쓰지 않음
- 특공 판정 입력은 judgeAll 진입점에서 정리: 잘못된 날짜('' 포함)·면적(NaN·0 이하)은 모름(null) → '확인 필요'. NoticeInput.areaExcl 은 number | null
- 소득 기준표 `effectiveFrom`: 2026년 표 2026-07-01 **잠정** — 실제 적용일 운영자 확인 필요(틀리면 상반기 공고 소득이 '확인 필요')
- Plan B 미뤄 둔 작은 것: 2/29 출생 기념일, 입력 날짜 > 공고일 검사, 특례 문구 위치(제46조 ③), 생애최초 기혼 자녀, 혼인일 null 미혼·모름 구분
- Plan C 결정: 백필 12개월(스펙 24개월) — 화면이 12개월만 쓰고 D1 쓰기 절반. D1 하루 쓰기는 KV meta:d1rows(UTC 날짜, 1+인덱스 수 가중), KV 미룬 키는 meta:kvhash.pending
- Plan C 미뤄 둔 작은 것: 실행이 죽으면 alerts.json 없음, HOUSE_DTL_SECD 없으면 private, competition model_no 대체값 키 중복, 액션 SHA 고정, KV 일괄 쓰기 실패 시 trade 묶음 유실
- Plan C 실키 첫 실행 때 확인: API 일일 호출 한도, odcloud cond 필터가 실서버에서 걸리는지
- 로컬 D1 옛 판은 `.wrangler/state/v3/d1_old_20261107` 로 옮겨 둠(지워도 됨)
- Plan B 판정 근거 결정: 3년 부양 경계 포함, 제40조 ②·제46조 ③ 원문 Plan D 전 대조, 입양은 혼인 중 자녀로 봄, 가구원 수 ≥ 자녀 수는 화면에서 막음
- Plan D: 공모주 화면은 `ipo:` 묶음·`ipo-*` 일정이 없으면 빈 안내/404 (생산자 없음). `/ipo` 목록은 이번 달·다음 달 `calendar:` 에서 고른다
- Plan D: 분양가 ㎡당은 **전용면적** 기준(주변 시세 중위가와 같은 기준)
- Plan D: `/trade/{시군구}` 자리는 시군구코드 5자리(이름 겹침 때문). 지역 화면은 이름, 실거래 표는 코드
- Plan D: 캘린더는 이번 달·지난달 묶음을 함께 읽는다(묶음이 시작일 달에만 있어서)
- Plan D: 사이트맵은 Worker 에서 KV list(하루 1,000회 한도) → 응답을 하루 캐시. `ipo:` 접두어는 생산자가 생기면 더한다
- Plan D: 판정 폼은 `<form>`·`name` 없이 `data-field` 입력, 월소득은 만원으로 받아 원으로 바꾼다. 날짜가 공고일보다 뒤면 오류(태아 출산 예정일 제외)
- Plan D: 깨진 `%` 주소는 Astro 7 이 라우팅 전에 빈 400 을 돌려줌(500·KV 오조회 없음) — 404 화면이 꼭 필요하면 Worker 진입부 별도 작업
- Plan D: 청약통장 면적 구분 `BLNC_SECD` 02·03 라벨은 추정('102㎡ 이하'·'135㎡ 이하'), 공고 없는 시도는 `stats:account` 에서 골라 보여 줌
- Plan D: `worker-configuration.d.ts` 의 HTMLRewriter Element 가 DOM Element 와 겹쳐 화면 스크립트는 HTMLElement·appendChild 로 씀
- Plan D: `wrangler.jsonc` 의 `SITE_URL` 은 localhost 자리값, D1·KV ID 도 0 자리값 — 배포 때 바꾼다(`docs/deploy.md` 1단계)
