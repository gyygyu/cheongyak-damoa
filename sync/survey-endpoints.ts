// 출처별 조사 요청 — 응답은 sync/fixtures/<source>/<name>.<ext> 로 저장된다
export interface SurveyEndpoint {
  source: string; // 폴더 이름
  name: string; // 파일 이름
  key: 'data' | 'dart';
  url: (k: string) => string; // k = 인코딩된 키
}

const ODCLOUD = 'https://api.odcloud.kr/api';
const DATA = 'https://apis.data.go.kr';
const MOLIT = `${DATA}/1613000`;

export const ENDPOINTS: SurveyEndpoint[] = [
  { source: 'applyhome', name: 'notice-detail', key: 'data',
    url: (k) => `${ODCLOUD}/ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancDetail?page=1&perPage=3&serviceKey=${k}` },
  { source: 'applyhome', name: 'notice-model', key: 'data',
    url: (k) => `${ODCLOUD}/ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancMdl?page=1&perPage=3&serviceKey=${k}` },
  { source: 'applyhome-cmpet', name: 'competition', key: 'data',
    url: (k) => `${ODCLOUD}/ApplyhomeInfoCmpetRtSvc/v1/getAPTLttotPblancCmpet?page=1&perPage=3&serviceKey=${k}` },
  { source: 'applyhome-cmpet', name: 'special-status', key: 'data',
    url: (k) => `${ODCLOUD}/ApplyhomeInfoCmpetRtSvc/v1/getAPTSpsplyReqstStus?page=1&perPage=3&serviceKey=${k}` },
  { source: 'molit-apt', name: 'trade-11680-202610', key: 'data',
    url: (k) => `${MOLIT}/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev?serviceKey=${k}&LAWD_CD=11680&DEAL_YMD=202610&numOfRows=5&pageNo=1` },
  { source: 'molit-presale', name: 'presale-41117-202610', key: 'data',
    url: (k) => `${MOLIT}/RTMSDataSvcSilvTrade/getRTMSDataSvcSilvTrade?serviceKey=${k}&LAWD_CD=41117&DEAL_YMD=202610&numOfRows=5&pageNo=1` },
  // LH 분양임대공고 (11-07 확인). 상세·공급정보는 목록의 PAN_ID·SPL_INF_TP_CD·CCR_CNNT_SYS_DS_CD·UPP_AIS_TP_CD 가 필요
  { source: 'lh', name: 'notice-list', key: 'data',
    url: (k) => `${DATA}/B552555/lhLeaseNoticeInfo1/lhLeaseNoticeInfo1?serviceKey=${k}&PG_SZ=50&PAGE=1&UPP_AIS_TP_CD=05` },
  { source: 'lh', name: 'notice-detail', key: 'data',
    url: (k) => `${DATA}/B552555/lhLeaseNoticeDtlInfo1/getLeaseNoticeDtlInfo1?serviceKey=${k}&SPL_INF_TP_CD=050&CCR_CNNT_SYS_DS_CD=02&PAN_ID=0000061205&UPP_AIS_TP_CD=05` },
  { source: 'lh', name: 'notice-supply', key: 'data',
    url: (k) => `${DATA}/B552555/lhLeaseNoticeSplInfo1/getLeaseNoticeSplInfo1?serviceKey=${k}&SPL_INF_TP_CD=050&CCR_CNNT_SYS_DS_CD=02&PAN_ID=0000061205&UPP_AIS_TP_CD=05` },
  // 청약통장 통계 (한국부동산원, odcloud)
  { source: 'account-stats', name: 'all', key: 'data',
    url: (k) => `${ODCLOUD}/ApplyhomeBnkbStatSvc/v1/getBnkbAcnutAllStat?page=1&perPage=20&serviceKey=${k}` },
  { source: 'account-stats', name: 'deposit', key: 'data',
    url: (k) => `${ODCLOUD}/ApplyhomeBnkbStatSvc/v1/getBnkbAcnutDpstStat?page=1&perPage=20&serviceKey=${k}` },
  { source: 'account-stats', name: 'subscribe', key: 'data',
    url: (k) => `${ODCLOUD}/ApplyhomeBnkbStatSvc/v1/getBnkbAcnutSbscrbStat?page=1&perPage=20&serviceKey=${k}` },
  // 금융위원회 주식발행정보 V3 (공공누리 2유형 — 상업적 이용금지, docs/api-fields.md)
  { source: 'fsc-stock', name: 'lockup', key: 'data',
    url: (k) => `${DATA}/1160100/GetStocIssuInfoService_V3/getLockUpRetuInfo_V3?serviceKey=${k}&numOfRows=10&pageNo=1&resultType=json&beginBasDt=20261001` },
  { source: 'fsc-stock', name: 'item-basic', key: 'data',
    url: (k) => `${DATA}/1160100/GetStocIssuInfoService_V3/getItemBasiInfo_V3?serviceKey=${k}&numOfRows=5&pageNo=1&resultType=json` },
  { source: 'fsc-corp', name: 'outline', key: 'data',
    url: (k) => `${DATA}/1160100/service/GetCorpBasicInfoService_V2/getCorpOutline_V2?serviceKey=${k}&numOfRows=5&pageNo=1&resultType=json` },
  { source: 'lawd', name: 'page1', key: 'data',
    url: (k) => `${DATA}/1741000/StanReginCd/getStanReginCdList?serviceKey=${k}&type=json&numOfRows=5&pageNo=1` },
  // OpenDART(공시 목록, 지분증권): pblntf_ty=C, pblntf_detail_ty=C001
  { source: 'dart', name: 'list-equity', key: 'dart',
    url: (k) => `https://opendart.fss.or.kr/api/list.json?crtfc_key=${k}&bgn_de=20261001&end_de=20261107&pblntf_ty=C&pblntf_detail_ty=C001&page_count=5` },
];
