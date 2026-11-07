// 출처별 실응답을 fixtures 로 저장한다 (키는 지운다). 실패해도 다음 출처로 넘어간다.
import { mkdirSync, writeFileSync } from 'node:fs';
import { ENDPOINTS } from './survey-endpoints';
import { getText, serviceKeyParam } from './http';

const keys = { data: process.env.DATA_GO_KR_KEY ?? '', dart: process.env.DART_API_KEY ?? '' };
const only = process.argv[2]; // 출처 하나만: npm run survey -- lh-notice

for (const ep of ENDPOINTS.filter((e) => !only || e.source === only)) {
  const key = keys[ep.key];
  if (!key) { console.log(`건너뜀 ${ep.source}/${ep.name}: 키 없음`); continue; }
  try {
    const { status, body } = await getText(ep.url(serviceKeyParam(key)), [keys.data, keys.dart]);
    const ext = body.trimStart().startsWith('<') ? 'xml' : 'json';
    mkdirSync(`sync/fixtures/${ep.source}`, { recursive: true });
    writeFileSync(`sync/fixtures/${ep.source}/${ep.name}.${ext}`, body);
    console.log(`${status} ${ep.source}/${ep.name}.${ext} (${body.length}자)`);
  } catch (e) {
    console.log(`실패 ${ep.source}/${ep.name}: ${(e as Error).message}`);
  }
}
