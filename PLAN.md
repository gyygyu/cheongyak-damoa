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
