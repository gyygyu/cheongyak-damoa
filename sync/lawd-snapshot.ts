// 법정동코드 전체를 받아 content/lawd/lawd.json 에 저장한다. 실패하면 직전 파일을 그대로 둔다 (spec §3).
import { mkdirSync, writeFileSync } from 'node:fs';
import { getText, serviceKeyParam } from './http';
import { parseLawdPage, type LawdRow } from './lawd-parse';

const key = process.env.DATA_GO_KR_KEY ?? '';
if (!key) throw new Error('DATA_GO_KR_KEY 가 없습니다');
const BASE = 'https://apis.data.go.kr/1741000/StanReginCd/getStanReginCdList';
const PER = 1000;
const all: LawdRow[] = [];
let total = Infinity;
for (let page = 1; (page - 1) * PER < total; page++) {
  const { status, body } = await getText(`${BASE}?serviceKey=${serviceKeyParam(key)}&type=json&numOfRows=${PER}&pageNo=${page}`, [key]);
  if (status !== 200) throw new Error(`법정동코드 ${page}쪽 응답 ${status}`);
  const res = parseLawdPage(JSON.parse(body));
  total = res.total;
  all.push(...res.rows);
}
if (all.length < 10000) throw new Error(`법정동코드가 ${all.length}건뿐입니다 — 저장하지 않습니다`);
all.sort((a, b) => a.code.localeCompare(b.code));
mkdirSync('content/lawd', { recursive: true });
writeFileSync('content/lawd/lawd.json', '[\n' + all.map((r) => JSON.stringify([r.code, r.name])).join(',\n') + '\n]\n');
console.log(`법정동코드 ${all.length}건 저장`);
