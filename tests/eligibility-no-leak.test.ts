// Review Focus 4: 판정 입력값이 브라우저 밖으로 나갈 길이 없는지 소스로 확인한다
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const files = [
  'src/scripts/eligibility-client.ts',
  'src/components/EligibilityForm.astro',
  'src/pages/eligibility/index.astro',
  'src/pages/eligibility/[no]/[model].astro',
];
const banned: [RegExp, string][] = [
  [/<form\b/i, '<form> (제출하면 주소 쿼리로 나간다)'],
  [/\bfetch\s*\(/, 'fetch'],
  [/XMLHttpRequest/, 'XMLHttpRequest'],
  [/sendBeacon/, 'sendBeacon'],
  [/\blocation\b/, 'location'],
  [/\bhistory\./, 'history'],
  [/localStorage|sessionStorage|indexedDB|document\.cookie/, '저장소'],
  [/new\s+(WebSocket|EventSource|Image)\b/, '외부 연결'],
  [/\bname=["']/, 'name 속성 (폼 값 수집 대상)'],
];

describe('판정 입력 유출 없음', () => {
  for (const f of files) {
    it(f, () => {
      const src = readFileSync(f, 'utf8');
      for (const [re, what] of banned) expect(re.test(src), `${f} 에 ${what}`).toBe(false);
    });
  }
});
