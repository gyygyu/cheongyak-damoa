# 청약다모아 — PLAN

## 1. 목표 / 전체 작업 계획
아파트 청약·공모주 일정과 실거래가 조회 사이트. 운영비 월 0원, 검색 유입 광고 수익.
- 설계: `docs/superpowers/specs/2026-11-07-cheongyak-site-design.md`
- Plan A 기반·순수 로직: `docs/superpowers/plans/2026-11-07-cheongyak-foundation.md`
- Plan B 특공 판정: `docs/superpowers/plans/2026-11-07-cheongyak-special-supply.md`
- Plan C 동기화: `docs/superpowers/plans/2026-11-07-cheongyak-sync.md`
- 뒤이을 계획: Plan D 화면·배포 문서·ops

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
- [ ] Plan D 화면·배포 문서·ops
- [ ] plan-a-foundation·plan-b-special-supply·plan-c-sync 브랜치 main 병합 (사용자 확인 필요)

## 4. 진행률
완료 13 / 전체 15 (마지막 갱신 2026-11-07, Plan D 2/9)

## 5. 다음에 할 작업
- Plan D 실행 중(브랜치 plan-d-screens): 계획 docs/superpowers/plans/2026-11-07-cheongyak-screens.md. Task 1(공용 틀, e544e13)·Task 2(표시 형식, d4b6c85) 완료 — 전체 시험 313 통과. **다음은 Task 3(홈·캘린더)**: `task-start <계획> 3` 으로 브리프를 받아 Task별 구현 에이전트에 맡긴다(원장 .superpowers/sdd/2026-11-07-cheongyak-screens/progress.md). Task 9까지 끝나면 opus 최종 리뷰 → 수정 한 번
  - task-done 스크립트가 vitest 결과 줄을 잘못 적음 → 원장 줄을 실제 'N files, M passed'로 고친다
  - CSS는 지원금다모아 복사 후 강조색 3줄만 바꿈 — 옛 녹색 rgba 잔존 여부 미확인
- 배포 전 확인: 원격 D1 에 옛 0001(area_kind 없음)이 적용된 적 없는지 — 0001 을 제자리에서 고쳤음
- Plan C 실키 첫 수집 때 확인: 실거래 LAWD_CD 가 12xxx(전남광주통합특별시)인지 옛 29xxx/46xxx 인지

## 6. 결정 사항 · 막혔던 문제
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
