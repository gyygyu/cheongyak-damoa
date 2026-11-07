# API 필드 조사 (2026-11-07 실응답)

조사 명령: `npm run survey` (`sync/survey.ts`, 주소 목록 `sync/survey-endpoints.ts`). 응답은 `sync/fixtures/<출처>/` 에 키 없이 저장된다(키 유출 검사 `키 없음` 확인).
키: 공공데이터포털 일반 인증키 하나(`DATA_GO_KR_KEY`)로 아래 전부를 부른다. `%` 가 들어 있으면 그대로, 아니면 `encodeURIComponent` (`sync/http.ts` `serviceKeyParam`).

## 0. 이용허락범위 (상업적 이용 — 광고 사이트이므로 중요)

| 데이터 (data.go.kr 번호) | 이용허락범위 |
|---|---|
| 청약홈 분양정보 조회 (15098547) | 제한 없음 |
| 청약홈 경쟁률·특별공급 신청현황 (15098905) | 제한 없음 |
| 청약홈 청약통장 통계 (15114369) | 제한 없음 |
| LH 분양임대공고문 (15058530) · 상세정보 (15057999) · 공급정보 (15056765) | 제한 없음 |
| 국토부 아파트 매매 실거래가 (15126469) · 분양권전매 실거래가 (15126471) | 제한 없음 |
| 행정안전부 법정동코드 (15077871) | 제한 없음 |
| 금융위원회 기업기본정보 (15043184) | 제한 없음 |
| **금융위원회 주식발행정보 (15043423)** | **공공누리 제2유형: 출처표시 + 상업적 이용금지.** 상업적으로 쓰려면 원천 소유자 한국예탁결제원(증권정보부)과 정보이용계약이 필요하다고 안내되어 있음 |
| OpenDART | 키 발급 전 — 발급 때 이용약관 확인 |

결정: 보호예수 매칭 순수 로직·`ipo_lockup` 표는 만든다(해가 없음). **보호예수 수집·게시는 정보이용계약 전까지 끈다**(Plan C·D에서 설정값 `LOCKUP_ENABLED` 기본 꺼짐). 계약 여부는 운영자 판단.

## 1. 청약홈 (api.odcloud.kr, JSON)

공통: `?page=N&perPage=M&serviceKey=K` → `{ currentCount, data: [...], matchCount, page, perPage, totalCount }`. 날짜 `YYYY-MM-DD`, 연월 `YYYYMM`. 숫자가 문자열로 오는 필드가 섞여 있다(예 `LTTOT_TOP_AMOUNT: "43390"`, `REQ_CNT: "119"`).

### 1-1. 공고 `ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancDetail` (전체 2,935건)

| 원본 | 내부 | 예시 |
|---|---|---|
| `HOUSE_MANAGE_NO` | `house_manage_no` (키) | `2026820015` |
| `PBLANC_NO` | `pblanc_no` | `2026820015` |
| `HOUSE_NM` | `name` | `시흥 거모 아테라(…) 신혼희망타운(공공분양)(본청약)` |
| `HOUSE_SECD` / `_NM` | `house_kind` | `10` 신혼희망타운 (`01` APT 등) |
| `HOUSE_DTL_SECD` / `_NM` | `house_detail_kind` | `03` 국민 |
| `RENT_SECD` / `_NM` | `rent_kind` | `0` 분양주택 |
| `SUBSCRPT_AREA_CODE` / `_NM` | `area_code` | `410` 경기 |
| `HSSPLY_ADRES` | `address` | `경기도 시흥시 거모지구 내 A-6블록` |
| `TOT_SUPLY_HSHLDCO` | `total_households` | `480` (숫자) |
| `RCRIT_PBLANC_DE` | `notice_date` | `2026-11-06` |
| `SPSPLY_RCEPT_BGNDE`/`ENDDE` | 특공 접수 | `null` 가능 |
| `GNRL_RNK1_CRSPAREA_RCPTDE`/`ENDDE` 등 | 1순위 해당·기타경기·기타지역 | `2026-11-16` |
| `GNRL_RNK2_…` | 2순위 | |
| `PRZWNER_PRESNATN_DE` | `winner_date` | `2026-12-08` |
| `CNTRCT_CNCLS_BGNDE`/`ENDDE` | 계약 | `2027-03-11` |
| `MVN_PREARNGE_YM` | `move_in_ym` | `202909` |
| `PARCPRC_ULS_AT` | 분양가상한제 | `Y`/`N` |
| `SPECLT_RDN_EARTH_AT`, `MDAT_TRGET_AREA_SECD` | 투기과열·조정대상 | `N` |
| `PBLANC_URL` | `source_url` | 청약홈 공고 주소 |
| `BSNS_MBY_NM`, `CNSTRCT_ENTRPS_NM` | 시행·시공 | |

### 1-2. 주택형 `getAPTLttotPblancMdl` (15,013건)
`HOUSE_MANAGE_NO`, `MODEL_NO` `01`, `HOUSE_TY` `055.0000A`(전용면적 문자열), `SUPLY_AR` `79.0470`, `SUPLY_HSHLDCO` 일반, `SPSPLY_HSHLDCO` 특공 합계, 특공 종류별 `MNYCH_`(다자녀)·`NWWDS_`(신혼)·`LFE_FRST_`(생애최초)·`OLD_PARNTS_SUPORT_`(노부모)·`INSTT_RECOMEND_`(기관추천)·`NWBB_`(신생아)·`YGMN_`(청년)·`TRANSR_INSTT_ENFSN_`(이전기관)·`ETC_` `_HSHLDCO`, **`LTTOT_TOP_AMOUNT` 분양최고금액 — 단위 만원**(`43390` = 4억 3,390만 원).

### 1-3. 경쟁률 `ApplyhomeInfoCmpetRtSvc/v1/getAPTLttotPblancCmpet` (55,892건)
`HOUSE_MANAGE_NO`, `MODEL_NO`, `HOUSE_TY`, `SUBSCRPT_RANK_CODE` 1·2(숫자), `RESIDE_SECD`/`RESIDE_SENM` `01` 해당지역(기타경기·기타지역), `SUPLY_HSHLDCO` 116(숫자), `REQ_CNT` `"119"`(문자), `CMPET_RATE` `"2.05"`(문자, 미달이면 `△` 표기 가능 — 수치 변환 실패 시 원문 보관).

### 1-4. 특별공급 신청현황 `getAPTSpsplyReqstStus`
`HOUSE_MANAGE_NO`, `HOUSE_TY`, 종류별 배정 `*_HSHLDCO`, 신청 수 `CRSPAREA_*_CNT`(해당지역)·`CTPRVN_*_CNT`(기타경기)·`ETC_AREA_*_CNT`(기타지역), 종류 접두어 `MNYCH`·`NWWDS_NMTW`·`LFE_FRST`·`NWBB_NWBBSHR`·`YGMN`·`OPS`(노부모), 기관추천 `INSTT_RECOMEND_DCSN_CNT`·`_PREPAR_CNT`, `SUBSCRPT_RESULT_NM` `청약접수 종료`.

### 1-5. 청약통장 통계 `ApplyhomeBnkbStatSvc/v1/…` (기준월 `DELNG_OCCRRNC_YM` `202609`)
- `getBnkbAcnutAllStat` 지역·통장·면적별 순위별 계좌 수: `SUBSCRPT_AREA_CODE`/`_NM`, `DPST_ITEM`/`_NM` 청약예금 등, `BLNC_SECD`/`_NM` `85㎡ 이하`, `RNK1_ACNUT_CO`, `RNK2_ACNUT_CO`
- `getBnkbAcnutDpstStat` 시도별(`SIDO_NM`) 통장 종류별
- `getBnkbAcnutSbscrbStat` 가입기간별 `SBSCRB_PD_CODE`/`_NM` `11년이상 12년 미만`, `ACNUT_CO`
- 기준월은 한 달 이상 늦다(11-07 조회 시 최신 202609).

## 2. 국토부 실거래 (apis.data.go.kr/1613000, XML)

`<response><header>…</header><body><items><item>…</item></items><numOfRows/><pageNo/><totalCount/></body></response>`. 파라미터 `LAWD_CD`(시군구 5자리)·`DEAL_YMD`(YYYYMM)·`numOfRows`·`pageNo`.

| 원본 | 내부 | 예시 |
|---|---|---|
| `dealAmount` | `price_manwon` | `319,000` — **쉼표 포함 문자열, 만원** |
| `dealYear`/`dealMonth`/`dealDay` | `deal_date` | 2026 / 10 / 16 |
| `excluUseAr` | `area_m2` | `76.79` |
| `floor` | `floor` | `7` |
| `aptNm` | `apt_name` | 은마 |
| `aptSeq` | `apt_seq` | `11680-218` (매매만) |
| `sggCd` | `sgg_cd` | `11680` |
| `umdCd` / `umdNm` | 법정동 | `10600` / 대치동 (`umdCd` 는 매매만) |
| `jibun` | `jibun` | `316`, 분양권 `961-11` |
| `bonbun`/`bubun` | 매매만 | `0316`/`0000` |
| `buildYear` | 매매만 | `1979` |
| `cdealType`/`cdealDay` | 해제 여부 | 공백 `' '` = 해제 아님 |
| `dealingGbn` | 중개거래/직거래 | |

- 분양권(`RTMSDataSvcSilvTrade/getRTMSDataSvcSilvTrade`)에는 `aptSeq`·`umdCd`·`bonbun`이 없고 `sggNm`·`ownershipGbn`이 있다. 매칭은 `sggCd` + `umdNm` + `jibun` + 단지명.
- 빈 값이 빈 문자열이 아니라 공백 한 칸으로 온다 → 파서에서 `trim`.

## 3. LH 분양임대공고 (apis.data.go.kr/B552555, JSON 배열)

응답이 `[ {dsSch:[검색조건]}, {dsList:[…], resHeader:[{RS_DTTM, SS_CODE:'Y'}]} ]` 형태. 이름 표(`…Nm`)가 값 표와 함께 온다.

- 목록 `lhLeaseNoticeInfo1/lhLeaseNoticeInfo1?PG_SZ=50&PAGE=1&UPP_AIS_TP_CD=05`: 기간 지정 없으면 최근 2개월(`PAN_ST_DT`~`PAN_ED_DT`). 필드 `PAN_ID`(공고 ID — `0000061205` 또는 `2015122300021006` 두 형식), `PAN_NM`, `UPP_AIS_TP_CD` `05` 분양주택(`01` 토지, `06` 임대 등)·`AIS_TP_CD`·`_NM`, `SPL_INF_TP_CD` `050`/`051`, `CCR_CNNT_SYS_DS_CD` `02`/`03`, `CNP_CD_NM` 지역, `PAN_NT_ST_DT` `2026.11.06`, `PAN_DT` `20261106`, `CLSG_DT` `2026.12.23`, `PAN_SS` 공고중, `DTL_URL`, `ALL_CNT`(전체 건수, 문자열).
- 상세 `lhLeaseNoticeDtlInfo1/getLeaseNoticeDtlInfo1` · 공급 `lhLeaseNoticeSplInfo1/getLeaseNoticeSplInfo1`: 목록의 `PAN_ID`·`SPL_INF_TP_CD`·`CCR_CNNT_SYS_DS_CD`·`UPP_AIS_TP_CD` 네 개를 그대로 넣어야 한다(토지 공고로 부르면 머리말만 옴).
  - 상세 `dsSplScdl` 일정(`ACP_DTTM` `2026.11.09 10:00 ~ 2026.11.10 17:00`, `PZWR_ANC_DT` `20261130` 등 — 공고 종류마다 필드·날짜 형식이 다름), `dsSbd` 단지(`LCT_ARA_ADR` 주소, `MIN_MAX_RSDN_DDO_AR`, `SUM_TOT_HSH_CNT`, `MVIN_XPC_YM` `2029년 08월`), `dsAhflInfo` 첨부.
  - 공급 `dsList01`~`05`(공급 유형별): `HTY_NM` `74.9400A`, `RSDN_DDO_AR`, `SPL_AR`, `SIL_HSH_CNT`, **`SIL_AMT` 평균분양가격 — 단위 원**(`504296000`), 임대는 `LS_GMY` 임대보증금(원)·`MM_RFE` 월임대료(원).
- 청약홈 공고와 LH 공고는 단지명·주소로 맞춘다(spec §9) — `dsSbd.BZDT_NM` `안산신길2 B-1` ↔ 청약홈 `HOUSE_NM`.

## 4. 법정동코드 `1741000/StanReginCd/getStanReginCdList?type=json` (JSON)

`{StanReginCd:[{head:[{totalCount:20560},{numOfRows,pageNo,type},{RESULT:{resultCode:'INFO-0'}}]},{row:[…]}]}`. 한 페이지 최대 1,000행. 필드 `region_cd`(10자리), `sido_cd`, `sgg_cd`, `umd_cd`, `ri_cd`, `locatadd_nm` `대구광역시 서구 원대동3가`, `locallow_nm`, `locathigh_cd`, `adpt_de`. **폐지 여부 필드는 없다** — 응답에 나오는 것이 현존 코드(폐지 코드는 응답에서 빠짐). 스냅숏 `content/lawd/lawd.json` 20,560행.

## 5. 금융위원회 (apis.data.go.kr/1160100, `resultType=json`)

`{response:{header:{resultCode,resultMsg},body:{items:{item:[…]},numOfRows,pageNo,totalCount}}}`. 날짜 `YYYYMMDD`, 숫자 문자열.

- 주식발행정보 **V3** `GetStocIssuInfoService_V3/…` (V2·`/service/` 경로는 `NO_OPENAPI_SERVICE_ERROR`)
  - `getLockUpRetuInfo_V3` 의무보호예수 반환: `basDt`, `crno` 법인등록번호(13자리), `isinCd`, `itmsShrtnCd` 종목코드 6자리 `030350`, `stckIssuCmpyNm`, `scrsItmsKcdNm` 보통주, `lstgDcdNm` 코스닥시장, `lkupRegDt`·`lkupRegStckCnt` 예탁, `rsrnDt`·`rsrnStckCnt` 반환일·반환 주식 수, `stckLblHoldRcdNm` 사유. 기간 파라미터 `beginBasDt`.
  - `getItemBasiInfo_V3` 종목 기본: `itmsShrtnCd`, `crno`, `lstgDt` 상장일. `basDt`·`isinCd`·`crno` 중 하나로 좁힌다.
  - (상업적 이용금지 — 0장)
- 기업기본정보 `service/GetCorpBasicInfoService_V2/getCorpOutline_V2`: `crno`, `corpNm`, `bzno`, `enpKosdaqLstgDt` 등. 외국법인은 `crno` `0000000000000`.

## 6. OpenDART — 미확인

키 미발급(`.env` `DART_API_KEY` 빈 값). `npm run survey` 가 `건너뜀 dart/list-equity: 키 없음`. 발급 후 survey 를 다시 돌려 `list.json?pblntf_ty=C`(발행공시)·`estkRs.json`(증권신고서 지분증권) 필드를 여기에 적는다.

## 7. spec §14 확인 결과

1. 청약홈 개통·주택형·경쟁률·특공 — **확인함.** 200. 오퍼레이션 `getAPTLttotPblancDetail`·`getAPTLttotPblancMdl`·`getAPTLttotPblancCmpet`·`getAPTSpsplyReqstStus`.
2. OpenDART — **미확인**(키 발급 전).
3. 법정동코드 형식 — **확인함.** 1,000행/쪽, 폐지 여부 필드 없음(현존만 응답).
4. 2026 도시근로자 월평균소득 기준표 — **미확인**(Plan B 특공 판정에서 공고문으로 확인).
5. 분양권 `sggCd`·지번 — **확인함.** `sggCd` `41117`, `jibun` `961-11`, `umdCd`·`aptSeq` 없음.
6. LH 공고 ID·유형·금액 단위 — **확인함.** `PAN_ID` 두 형식, `UPP_AIS_TP_CD` `05` 분양, 금액 원 단위.
7. 청약통장 통계 기준월·지역·종류 — **확인함.** `DELNG_OCCRRNC_YM`, `SUBSCRPT_AREA_CODE_NM`/`SIDO_NM`, `DPST_ITEM_NM`.
8. 보호예수 오퍼레이션·식별 필드 — **확인함.** `getLockUpRetuInfo_V3`, `itmsShrtnCd`·`crno`. 단 **상업적 이용금지**(0장).
