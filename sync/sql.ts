// D1 SQL 문 만들기 — 지원금다모아 sync/sql.ts 의 sqlLiteral(NUL 제거·2만 자 자름)을 옮겨 표 공용으로 (spec §4)
export type SqlValue = string | number | null;
export type Row = Record<string, SqlValue>;

const MAX_TEXT = 20_000; // D1 은 문 하나 100KB 제한
const MAX_STMT = 90_000;
const IDENT = /^[a-z_][a-z0-9_]*$/;

function ident(s: string): string {
  if (!IDENT.test(s)) throw new Error(`잘못된 식별자: ${s}`);
  return s;
}

export function sqlLiteral(v: SqlValue): string {
  if (v === null) return 'NULL';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error(`유한하지 않은 숫자: ${v}`);
    return String(v);
  }
  return `'${v.replace(/\u0000/g, '').slice(0, MAX_TEXT).replace(/'/g, "''")}'`;
}

export function upsertSql(table: string, keyCols: string[], rows: Row[], maxRows = 100): string[] {
  if (rows.length === 0) return [];
  ident(table);
  const cols = Object.keys(rows[0]).map(ident);
  for (const k of keyCols) if (!cols.includes(ident(k))) throw new Error(`${table}: 키 열 없음 ${k}`);
  const rest = cols.filter((c) => !keyCols.includes(c));
  const conflict = rest.length ? `DO UPDATE SET ${rest.map((c) => `${c}=excluded.${c}`).join(', ')}` : 'DO NOTHING';
  const head = `INSERT INTO ${table} (${cols.join(', ')}) VALUES `;
  const tail = ` ON CONFLICT(${keyCols.join(', ')}) ${conflict};`;

  const out: string[] = [];
  let values: string[] = [];
  let size = 0;
  const flush = () => {
    if (values.length) out.push(head + values.join(', ') + tail);
    values = [];
    size = 0;
  };
  for (const r of rows) {
    const keys = Object.keys(r);
    if (keys.length !== cols.length || keys.some((k) => !cols.includes(k))) throw new Error(`${table}: 열이 다른 행`);
    const v = `(${cols.map((c) => sqlLiteral(r[c])).join(', ')})`;
    if (values.length >= maxRows || (values.length > 0 && size + v.length > MAX_STMT)) flush();
    values.push(v);
    size += v.length + 2;
  }
  flush();
  return out;
}
