-- 청약다모아 D1 스키마 (spec §5, 실필드는 docs/api-fields.md). 모든 표: hash = 원본 정규화 값의 해시, 바뀐 행만 쓴다.
-- 금액 단위는 모두 만원으로 맞춘다(LH 원 단위는 변환 때 나눈다). 날짜는 YYYY-MM-DD.

CREATE TABLE apt_notice (
  pblanc_no TEXT PRIMARY KEY,       -- 공고번호 PBLANC_NO
  house_manage_no TEXT,             -- 주택관리번호 HOUSE_MANAGE_NO
  name TEXT NOT NULL,               -- 단지명 HOUSE_NM
  house_kind TEXT,                  -- HOUSE_SECD_NM (APT·신혼희망타운 등)
  rent_kind TEXT,                   -- RENT_SECD_NM (분양주택·분양전환 임대 등)
  area_code TEXT,                   -- 공급지역 코드 SUBSCRPT_AREA_CODE
  sido TEXT, sigungu TEXT, address TEXT,
  lawd_cd TEXT, dong TEXT,          -- 법정동 해석 결과 (없으면 NULL)
  supply_kind TEXT,                 -- 'national' 국민 | 'private' 민영 (HOUSE_DTL_SECD)
  public_land INTEGER,              -- 공공택지 1/0
  price_cap INTEGER,                -- 분양가상한제 1/0
  speculative INTEGER, adjusted INTEGER, -- 투기과열·조정대상 (출처에 있을 때)
  notice_date TEXT,                 -- 모집공고일
  special_start TEXT, special_end TEXT,
  rank1_start TEXT, rank1_end TEXT, -- 1순위(해당지역 기준 — 기타지역 날짜는 rank_dates)
  rank2_start TEXT, rank2_end TEXT,
  rank_dates TEXT,                  -- 해당·기타경기·기타지역별 순위 접수일 JSON
  winner_date TEXT,
  contract_start TEXT, contract_end TEXT,
  move_in_ym TEXT,                  -- 입주예정월 YYYY-MM
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
  top_price INTEGER,                -- 최고 분양가 (만원, LTTOT_TOP_AMOUNT)
  hash TEXT NOT NULL, updated_at TEXT NOT NULL,
  PRIMARY KEY (pblanc_no, model_no)
);

CREATE TABLE apt_competition (
  pblanc_no TEXT NOT NULL, model_no TEXT NOT NULL,
  rank INTEGER NOT NULL,            -- 1 | 2
  residence TEXT NOT NULL,          -- 거주 구분 (RESIDE_SENM 해당지역·기타경기·기타지역)
  supply_count INTEGER, applicants INTEGER,
  rate REAL,                        -- 수치로 바뀌지 않으면 NULL
  rate_text TEXT,                   -- 출처 원문 (예: '2.05', '(△36)')
  hash TEXT NOT NULL, updated_at TEXT NOT NULL,
  PRIMARY KEY (pblanc_no, model_no, rank, residence)
);

CREATE TABLE apt_special_status (
  pblanc_no TEXT NOT NULL, model_no TEXT NOT NULL,
  special_type TEXT NOT NULL,       -- multichild | newlywed | first_life | elderly_parent | newborn | youth | institution
  residence TEXT NOT NULL,          -- local 해당지역 | province 기타경기 | other 기타지역 | all
  allotted INTEGER, applicants INTEGER,
  hash TEXT NOT NULL, updated_at TEXT NOT NULL,
  PRIMARY KEY (pblanc_no, model_no, special_type, residence)
);

CREATE TABLE trade (
  trade_key TEXT PRIMARY KEY,       -- 거래 해시(+순번) — src/lib/trade/trade-key.ts
  lawd_cd TEXT NOT NULL,            -- 시군구 5자리 sggCd
  umd_cd TEXT,                      -- 법정동 5자리
  dong TEXT NOT NULL, jibun TEXT,
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
  kind TEXT,                        -- 분양권 | 입주권 (ownershipGbn)
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
  price_low INTEGER, price_high INTEGER, price_final INTEGER, -- 원 (주당)
  listing_date TEXT, underwriters TEXT, offer_shares INTEGER,
  revisions TEXT,                   -- 정정 이력 JSON
  state TEXT NOT NULL DEFAULT 'normal',
  hash TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX ipo_stock ON ipo (stock_code);
CREATE INDEX ipo_crno ON ipo (crno);

-- 보호예수: 주식발행정보는 상업적 이용금지(docs/api-fields.md 0장) — 표만 두고 계약 전까지 채우지 않는다.
CREATE TABLE ipo_lockup (
  corp_code TEXT NOT NULL, release_date TEXT NOT NULL, share_kind TEXT NOT NULL,
  shares INTEGER, base_date TEXT,
  hash TEXT NOT NULL, updated_at TEXT NOT NULL,
  PRIMARY KEY (corp_code, release_date, share_kind)
);

CREATE TABLE lh_notice (
  lh_id TEXT PRIMARY KEY,           -- PAN_ID
  title TEXT NOT NULL,
  kind TEXT NOT NULL,               -- sale | rent
  sub_kind TEXT,                    -- AIS_TP_CD_NM (공공분양·신혼희망타운·행복주택·국민임대 등)
  upp_ais_tp_cd TEXT, spl_inf_tp_cd TEXT, ccr_cnnt_sys_ds_cd TEXT, -- 상세·공급 재조회에 필요한 코드
  sido TEXT, sigungu TEXT, lawd_cd TEXT, address TEXT,
  posted_date TEXT, receipt_start TEXT, receipt_end TEXT,
  winner_date TEXT, contract_start TEXT, contract_end TEXT,
  url TEXT, state TEXT,             -- PAN_SS (공고중·접수중·접수마감 등)
  pblanc_no TEXT,                   -- 맞춘 청약홈 공고 (분양만)
  hash TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX lh_notice_posted ON lh_notice (posted_date);

CREATE TABLE lh_supply (
  lh_id TEXT NOT NULL,
  supply_type TEXT NOT NULL,        -- dsList01~05 번호 (공급 유형별 표)
  house_ty TEXT NOT NULL,           -- HTY_NM
  area_excl REAL, households INTEGER,
  price INTEGER, deposit INTEGER, monthly_rent INTEGER, -- 만원 (원 단위를 나눔)
  hash TEXT NOT NULL, updated_at TEXT NOT NULL,
  PRIMARY KEY (lh_id, supply_type, house_ty)
);

CREATE TABLE account_stats (
  base_month TEXT NOT NULL,         -- YYYY-MM (DELNG_OCCRRNC_YM)
  region TEXT NOT NULL, account_kind TEXT NOT NULL, -- 지역명·통장 종류명
  subscribers INTEGER, rank1 INTEGER, rank2 INTEGER,
  hash TEXT NOT NULL, updated_at TEXT NOT NULL,
  PRIMARY KEY (base_month, region, account_kind)
);
