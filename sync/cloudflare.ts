// wrangler CLI 로 D1·KV — 지원금다모아 sync/cloudflare.ts 를 옮김 (spec §4)
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

export type CfTarget = 'local' | 'remote';

const WRANGLER = join(process.cwd(), 'node_modules', 'wrangler', 'bin', 'wrangler.js');

function wrangler(args: string[]): string {
  const res = spawnSync(process.execPath, [WRANGLER, ...args], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 1024, env: process.env });
  if (res.status !== 0) throw new Error(`wrangler ${args.slice(0, 3).join(' ')} 실패:\n${res.stderr || res.stdout}`);
  return res.stdout;
}

export function d1Query<T>(sql: string, target: CfTarget): T[] {
  const out = wrangler(['d1', 'execute', 'DB', `--${target}`, '--json', '--command', sql]);
  const parsed = JSON.parse(out) as { results?: T[] }[];
  return parsed[0]?.results ?? [];
}

export function d1ExecFile(path: string, target: CfTarget): void {
  wrangler(['d1', 'execute', 'DB', `--${target}`, '--yes', '--file', path]);
}

// 없는 키는 null. 그 밖의 오류(인증·네트워크)는 던진다
// 없는 키: 로컬은 'Value not found' 출력(종료 코드 0), 원격은 그 키 주소의 '404: Not Found' 오류
export function kvGetText(key: string, target: CfTarget, run: (args: string[]) => string = wrangler): string | null {
  let out: string;
  try {
    out = run(['kv', 'key', 'get', key, '--binding', 'KV', `--${target}`, '--text']);
  } catch (err) {
    const msg = String(err instanceof Error ? err.message : err);
    if (msg.includes(`/values/${encodeURIComponent(key)} - 404: Not Found`) || msg.includes(`/values/${key} - 404: Not Found`)) return null;
    throw err;
  }
  return out.trim() === 'Value not found' ? null : out;
}

// [{ "key": "...", "value": "..." }] 파일을 한 번에 쓴다
export function kvBulkPut(path: string, target: CfTarget): void {
  wrangler(['kv', 'bulk', 'put', path, '--binding', 'KV', `--${target}`]);
}
