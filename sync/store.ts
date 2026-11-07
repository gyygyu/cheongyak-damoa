// D1·KV 저장소 — 실제는 wrangler CLI, 시험은 node:sqlite 메모리 DB
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { KvWrite } from './bundles';
import { d1Query, d1ExecFile, kvGetText, kvBulkPut, type CfTarget } from './cloudflare';

export interface Store {
  query<T = Record<string, unknown>>(sql: string): Promise<T[]>;
  exec(statements: string[]): Promise<void>;
  kvGet(key: string): Promise<string | null>;
  kvPut(writes: KvWrite[]): Promise<void>;
}

export function sqliteStore(migrationsDir = 'migrations'): Store & { kv: Map<string, string> } {
  const db = new DatabaseSync(':memory:');
  for (const f of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) db.exec(readFileSync(join(migrationsDir, f), 'utf8'));
  const kv = new Map<string, string>();
  return {
    kv,
    async query<T>(sql: string) { return db.prepare(sql).all() as T[]; },
    async exec(statements) { if (statements.length) db.exec(statements.join('\n')); },
    async kvGet(key) { return kv.get(key) ?? null; },
    async kvPut(writes) { for (const w of writes) kv.set(w.key, w.value); },
  };
}

export function wranglerStore(target: CfTarget, outDir: string, dryRun: boolean): Store {
  mkdirSync(outDir, { recursive: true });
  let n = 0;
  return {
    async query<T>(sql: string) { return d1Query<T>(sql, target); },
    async exec(statements) {
      if (!statements.length) return;
      const path = join(outDir, `d1-${String(++n).padStart(3, '0')}.sql`);
      writeFileSync(path, statements.join('\n'));
      if (!dryRun) d1ExecFile(path, target);
    },
    async kvGet(key) { return kvGetText(key, target); },
    async kvPut(writes) {
      if (!writes.length) return;
      const path = join(outDir, `kv-${String(++n).padStart(3, '0')}.json`);
      writeFileSync(path, JSON.stringify(writes));
      if (!dryRun) kvBulkPut(path, target);
    },
  };
}
