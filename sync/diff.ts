// 변경분 비교(해시)와 이상치 차단 (spec §10)
import { fnv64 } from '../src/lib/hash';
import type { Row } from './sql';

export function rowHash(row: Row): string {
  const pairs = Object.keys(row)
    .filter((k) => k !== 'hash' && k !== 'updated_at')
    .sort()
    .map((k) => [k, row[k]]);
  return fnv64(JSON.stringify(pairs));
}

export function withHash(row: Row, now: string): Row {
  return { ...row, hash: rowHash(row), updated_at: now };
}

// D1 쪽 hashQuerySql 의 k 와 같은 모양이어야 한다
export const keyBy = (cols: string[]) => (r: Row): string =>
  cols.map((c) => (r[c] === null || r[c] === undefined ? '' : String(r[c]))).join('|');

export function diffRows(rows: Row[], keyOf: (r: Row) => string, previous: ReadonlyMap<string, string>): Row[] {
  const byKey = new Map<string, Row>();
  for (const r of rows) byKey.set(keyOf(r), r);
  return [...byKey].filter(([k, r]) => previous.get(k) !== r.hash).map(([, r]) => r);
}

export function hashQuerySql(table: string, keyCols: string[]): string {
  const k = keyCols.map((c) => `COALESCE(CAST(${c} AS TEXT),'')`).join(`||'|'||`);
  return `SELECT ${k} AS k, hash FROM ${table}`;
}

export interface Guard { ok: boolean; reason?: string }

export function guardCount(count: number, last: number | null, maxDrop = 0.7): Guard {
  if (count === 0) return { ok: false, reason: '0건' };
  if (last && last > 0 && (last - count) / last > maxDrop) {
    return { ok: false, reason: `직전 ${last}건 → ${count}건 (${Math.round(((last - count) / last) * 100)}% 감소)` };
  }
  return { ok: true };
}
