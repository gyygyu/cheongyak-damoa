// 키 없이 sync/fixtures/ 실응답 샘플로 같은 길을 돌린다. 2쪽 이상과 픽스처가 없는 작업은 빈 응답
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Fetch } from './collect';

const EMPTY_XML = '<response><header><resultCode>000</resultCode><resultMsg>OK</resultMsg></header><body><items></items><numOfRows>1000</numOfRows><pageNo>1</pageNo><totalCount>0</totalCount></body></response>';
const EMPTY_LH = '[{"dsSch":[]},{"dsList":[]}]';

const ODCLOUD: [string, string][] = [
  ['getAPTLttotPblancDetail', 'applyhome/notice-detail.json'],
  ['getAPTLttotPblancMdl', 'applyhome/notice-model.json'],
  ['getAPTLttotPblancCmpet', 'applyhome-cmpet/competition.json'],
  ['getAPTSpsplyReqstStus', 'applyhome-cmpet/special-status.json'],
  ['getBnkbAcnutAllStat', 'account-stats/all.json'],
  ['getBnkbAcnutDpstStat', 'account-stats/deposit.json'],
  ['getBnkbAcnutSbscrbStat', 'account-stats/subscribe.json'],
];
const LH_FILES: [string, string][] = [
  ['getLeaseNoticeDtlInfo1', 'lh/notice-detail.json'],
  ['getLeaseNoticeSplInfo1', 'lh/notice-supply.json'],
  ['lhLeaseNoticeInfo1', 'lh/notice-list.json'],
];
const MOLIT_FILES: Record<string, string> = {
  'RTMSDataSvcAptTradeDev:11680:202610': 'molit-apt/trade-11680-202610.xml',
  'RTMSDataSvcSilvTrade:41117:202610': 'molit-presale/presale-41117-202610.xml',
};

export function fixtureFetch(dir: string): Fetch {
  const cache = new Map<string, string>();
  const read = (file: string) => {
    let v = cache.get(file);
    if (v === undefined) cache.set(file, (v = readFileSync(join(dir, file), 'utf8')));
    return v;
  };
  return async (url) => {
    const u = new URL(url);
    const q = u.searchParams;
    const page = Number(q.get('page') ?? q.get('PAGE') ?? q.get('pageNo') ?? '1');
    if (u.hostname === 'api.odcloud.kr') {
      const hit = ODCLOUD.find(([op]) => u.pathname.endsWith(op));
      if (!hit) return { status: 404, body: 'no fixture' };
      return { status: 200, body: page > 1 ? '{"data":[],"matchCount":0}' : read(hit[1]) };
    }
    if (u.pathname.includes('/B552555/')) {
      const hit = LH_FILES.find(([op]) => u.pathname.endsWith(op));
      if (!hit) return { status: 404, body: 'no fixture' };
      return { status: 200, body: page > 1 ? EMPTY_LH : read(hit[1]) };
    }
    if (u.pathname.includes('/1613000/')) {
      const svc = u.pathname.split('/')[2];
      const file = MOLIT_FILES[`${svc}:${q.get('LAWD_CD')}:${q.get('DEAL_YMD')}`];
      return { status: 200, body: page > 1 || !file ? EMPTY_XML : read(file) };
    }
    return { status: 404, body: 'no fixture' };
  };
}
