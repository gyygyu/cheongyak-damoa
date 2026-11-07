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
- [x] A-T1 골격
- [x] A-T2 API 조사·fixtures·법정동 스냅숏
- [x] A-T3 D1 스키마
- [x] A-T4 지역 해석
- [x] A-T5 실거래 로직
- [x] A-T6 분양권 매칭
- [x] A-T7 공고 상태·일정·LH 매칭
- [x] A-T8 공모주 판·보호예수
- [x] Plan A 최종 리뷰·수정 5건 (443dee6, 104/104)
- [ ] Plan B 특공 판정
- [ ] Plan C 동기화
- [ ] Plan D 화면·배포 문서·ops
- [ ] plan-a-foundation 브랜치 main 병합 (사용자 확인 필요)

## 4. 진행률
완료 11 / 전체 15 (마지막 갱신 2026-11-07)

## 5. 다음에 할 작업
- Plan B(특공 판정) 계획 작성 → 실행: 근거는 `docs/special-supply-rules.md`(조문 요약·2026 소득 기준표), `content/income-table/2026.json` 생성, 판정은 브라우저 전용(입력값 서버 전송 금지)
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
