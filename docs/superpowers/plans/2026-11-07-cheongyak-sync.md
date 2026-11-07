# 청약다모아 Plan C — 동기화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공공데이터(청약홈 분양·경쟁률, 국토부 실거래·분양권, LH 공고, 청약통장 통계)를 받아 D1 표와 KV 묶음으로 만드는 동기화(`npm run sync`)와 GitHub Actions 워크플로를 만든다.

**Architecture:** 수집(`sync/collect.ts`, 출처별 독립) → 변환(`src/lib/**-transform.ts`, 순수 함수) → 이상치 차단·연결(LH·분양권) → 해시 비교로 바뀐 행만 D1 SQL 파일 → KV 묶음(`sync/bundles.ts`)은 매니페스트 해시로 바뀐 것만, 실행당 400건 예산(`trade:` 맨 뒤). 키 없이 `sync/fixtures/` 로 같은 길을 돌려 회귀 시험한다.

**Tech Stack:** TypeScript 6, Node 24(tsx), vitest 5, wrangler 4 CLI(D1·KV), GitHub Actions

**Spec:** `docs/superpowers/specs/2026-11-07-cheongyak-site-design.md` (§3 출처, §5 표, §6 KV, §9 연결, §10 오류·한도, §11 테스트)

## Global Constraints

- 비밀값은 `.env`(로컬)와 GitHub Secrets 에만. 키는 로그·SQL·KV·fixture 에 남기지 않는다(`sync/http.ts` 의 `redactKeys`).
- 공공데이터포털 키는 `DATA_GO_KR_KEY` 하나 (spec §3).
- D1 무료 쓰기 하루 10만 행: 해시가 바뀐 행만 쓴다. 한 실행 상한 70,000행.
- KV 무료 쓰기 하루 1,000건: 바뀐 묶음만, 실행당 400건(하루 2회 = 800). 넘치면 `trade:` 묶음부터 다음 실행으로 미룬다 (spec §10).
- KV 값 하나는 50KB 안쪽 (spec §6).
- 받은 건수가 0이거나 직전보다 70% 넘게 줄면 그 출처는 반영하지 않는다. 한 출처 실패는 다른 출처에 영향 없음. 같은 출처 3회 연속 실패면 GitHub 이슈 (spec §10).
- 해제 거래는 행에 남기되 통계(중위가)에서 뺀다 (`nearbyPrice` 가 이미 처리).
- `src/lib/` 는 순수 로직 — `node:` 모듈·Cloudflare API 금지. Node 전용 코드는 `sync/`.
- 지원금다모아 저장소는 읽기만 한다. 옮겨 오는 코드는 이 저장소에 새로 쓴다 (spec §4).
- 보호예수(공공누리 2유형)·DART(키 없음)는 이 계획에서 받지 않는다. `ipo`·`ipo_lockup` 표는 비워 둔다.
- 테스트는 `tests/**/*.test.ts`, `npm test` 는 키 없이 통과해야 한다.

## Review Focus

1. **D1 열 이름과 변환 행의 열이 어긋남** — 변환이 만든 열이 `migrations/0001_init.sql` 에 없으면 원격에서만 터진다. Task 9 의 `sql 열이 스키마와 맞음` 시험이 모든 표의 열을 스키마와 대조한다.
2. **출처 하나가 실패했을 때 KV 묶음에서 그 출처 내용이 사라짐** — 실패한 출처의 표는 D1 직전 값으로 채워 묶음을 만든다. Task 9 의 `실패한 출처는 직전 행으로 묶음을 만든다` 시험.
3. **값이 '-'·공백·빈 문자열·null 로 오는 필드** — 경쟁률 '-', 실거래 `cdealType` 공백 등. Task 2 의 `raw` 시험과 Task 3·4 의 '-'·공백 시험.
4. **KV 예산 초과 시 미룬 묶음이 영영 안 써짐** — 미룬 키는 매니페스트에 옛 해시를 남겨 다음 실행에 다시 고른다. Task 7 의 `미룬 키는 다음 실행에 다시 고른다` 시험.
5. **이상치 차단 경계(정확히 70% 감소는 통과)와 부동소수 오차** — Task 1 의 `정확히 70% 감소는 통과` 시험.

---

### Task 1: SQL 문 만들기와 변경분 비교

**Files:**
- Create: `sync/sql.ts`, `sync/diff.ts`
- Test: `tests/sync-sql.test.ts`, `tests/sync-diff.test.ts`

**Interfaces:**
- Consumes: `fnv64(s: string): string` (`src/lib/hash.ts`)
- Produces:
  - `type SqlValue = string | number | null`, `type Row = Record<string, SqlValue>`
  - `sqlLiteral(v: SqlValue): string`
  - `upsertSql(table: string, keyCols: string[], rows: Row[], maxRows = 100): string[]`
  - `rowHash(row: Row): string`, `withHash(row: Row, now: string): Row`
  - `keyBy(cols: string[]): (r: Row) => string`
  - `diffRows(rows: Row[], keyOf: (r: Row) => string, previous: ReadonlyMap<string, string>): Row[]`
  - `hashQuerySql(table: string, keyCols: string[]): string`
  - `interface Guard { ok: boolean; reason?: string }`, `guardCount(count: number, last: number | null, maxDrop = 0.7): Guard`

- [ ] **Step 1: Write the failing test**

```ts
// file: tests/sync-sql.test.ts
import { describe, it, expect } from 'vitest';
import { sqlLiteral, upsertSql } from '../sync/sql';

describe('sqlLiteral', () => {
  it('NULL·숫자·문자열', () => {
    expect(sqlLiteral(null)).toBe('NULL');
    expect(sqlLiteral(12.5)).toBe('12.5');
    expect(sqlLiteral("O'Neil")).toBe("'O''Neil'");
  });
  it('NUL 문자를 지우고 2만 자로 자른다', () => {
    expect(sqlLiteral('a\u0000b')).toBe("'ab'");
    expect(sqlLiteral('x'.repeat(30_000)).length).toBe(20_002);
  });
  it('유한하지 않은 숫자는 오류', () => {
    expect(() => sqlLiteral(Number.NaN)).toThrow();
  });
});

describe('upsertSql', () => {
  const rows = [{ id: 'a', n: 1 }, { id: 'b', n: null }];
  it('키 충돌이면 나머지 열을 덮어쓴다', () => {
    expect(upsertSql('t', ['id'], rows)).toEqual([
      "INSERT INTO t (id, n) VALUES ('a', 1), ('b', NULL) ON CONFLICT(id) DO UPDATE SET n=excluded.n;",
    ]);
  });
  it('키 열만 있으면 DO NOTHING', () => {
    expect(upsertSql('t', ['id'], [{ id: 'a' }])).toEqual(["INSERT INTO t (id) VALUES ('a') ON CONFLICT(id) DO NOTHING;"]);
  });
  it('maxRows 로 나눈다', () => {
    expect(upsertSql('t', ['id'], rows, 1)).toHaveLength(2);
  });
  it('빈 배열이면 문이 없다', () => {
    expect(upsertSql('t', ['id'], [])).toEqual([]);
  });
  it('문 하나가 10만 자를 넘지 않게 나눈다', () => {
    const big = Array.from({ length: 10 }, (_, i) => ({ id: String(i), t: 'x'.repeat(20_000) }));
    const out = upsertSql('t', ['id'], big);
    expect(out.length).toBeGreaterThan(1);
    for (const s of out) expect(s.length).toBeLessThan(100_000);
  });
  it('잘못된 식별자·키 열 없음·열이 다른 행은 오류', () => {
    expect(() => upsertSql('t; DROP', ['id'], rows)).toThrow();
    expect(() => upsertSql('t', ['nope'], rows)).toThrow();
    expect(() => upsertSql('t', ['id'], [{ id: 'a', n: 1 }, { id: 'b', m: 2 }])).toThrow();
  });
});
```

```ts
// file: tests/sync-diff.test.ts
import { describe, it, expect } from 'vitest';
import { rowHash, withHash, keyBy, diffRows, hashQuerySql, guardCount } from '../sync/diff';

const now = '2026-11-07T00:00:00.000Z';

describe('rowHash·withHash', () => {
  it('열 순서·hash·updated_at 과 무관하고 값이 바뀌면 달라진다', () => {
    expect(rowHash({ a: 1, b: 'x' })).toBe(rowHash({ b: 'x', a: 1, hash: 'z', updated_at: 't' }));
    expect(rowHash({ a: 1 })).not.toBe(rowHash({ a: 2 }));
    expect(rowHash({ a: null })).not.toBe(rowHash({ a: '' }));
  });
  it('withHash 는 hash·updated_at 을 붙인다', () => {
    const r = withHash({ a: 1 }, now);
    expect(r).toEqual({ a: 1, hash: rowHash({ a: 1 }), updated_at: now });
  });
});

describe('keyBy·diffRows', () => {
  it('null 은 빈 문자열, 열은 | 로 잇는다', () => {
    expect(keyBy(['a', 'b'])({ a: 'x', b: null })).toBe('x|');
    expect(keyBy(['a', 'b'])({ a: 'x', b: 2 })).toBe('x|2');
  });
  it('해시가 바뀐 행만, 같은 키는 마지막 행을 쓴다', () => {
    const k = keyBy(['id']);
    const r1 = withHash({ id: 'a', n: 1 }, now);
    const r2 = withHash({ id: 'b', n: 2 }, now);
    const r2b = withHash({ id: 'b', n: 3 }, now);
    const prev = new Map([['a', r1.hash as string], ['b', r2.hash as string]]);
    expect(diffRows([r1, r2, r2b], k, prev)).toEqual([r2b]);
  });
});

describe('hashQuerySql', () => {
  it('키 열을 문자열로 이어 붙여 hash 와 함께 읽는다', () => {
    expect(hashQuerySql('apt_model', ['pblanc_no', 'model_no'])).toBe(
      "SELECT COALESCE(CAST(pblanc_no AS TEXT),'')||'|'||COALESCE(CAST(model_no AS TEXT),'') AS k, hash FROM apt_model",
    );
  });
});

describe('guardCount', () => {
  it('0건은 막는다', () => {
    expect(guardCount(0, 10)).toEqual({ ok: false, reason: '0건' });
    expect(guardCount(0, null)).toEqual({ ok: false, reason: '0건' });
  });
  it('70% 넘게 줄면 막는다', () => {
    expect(guardCount(29, 100)).toEqual({ ok: false, reason: '직전 100건 → 29건 (71% 감소)' });
  });
  it('정확히 70% 감소는 통과', () => {
    expect(guardCount(30, 100)).toEqual({ ok: true });
  });
  it('직전 기록이 없으면 통과', () => {
    expect(guardCount(5, null)).toEqual({ ok: true });
    expect(guardCount(5, 0)).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sync-sql.test.ts tests/sync-diff.test.ts`
Expected: FAIL — `Failed to resolve import "../sync/sql"` / `"../sync/diff"`

- [ ] **Step 3: Write minimal implementation**

```ts
// file: sync/sql.ts
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
```

```ts
// file: sync/diff.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/sync-sql.test.ts tests/sync-diff.test.ts`
Expected: PASS (2 files)

- [ ] **Step 5: Commit**

```bash
git add sync/sql.ts sync/diff.ts tests/sync-sql.test.ts tests/sync-diff.test.ts
git commit -m "동기화: SQL 문 만들기와 변경분·이상치 비교"
```

### Task 2: 응답 값 다루기와 분양 공고 변환

**Files:**
- Create: `src/lib/raw.ts`, `src/lib/apt/notice-transform.ts`
- Test: `tests/notice-transform.test.ts`

**Interfaces:**
- Consumes: `normalizeDate`, `resolveAddress(index, address): ResolvedAddress | null`, `LawdIndex`
- Produces:
  - `type Raw = Record<string, unknown>`, `type DbRow = Record<string, string | number | null>`
  - `str(v): string | null` (빈칸·공백·'-' 는 null), `int(v): number | null`, `num(v): number | null`, `yn(v): 0 | 1 | null`
  - `toNoticeRow(raw: Raw, idx: LawdIndex): DbRow | null` — 열: pblanc_no, house_manage_no, name, house_kind, rent_kind, area_code, sido, sigungu, address, lawd_cd, dong, supply_kind, public_land, price_cap, speculative, adjusted, notice_date, special_start, special_end, rank1_start, rank1_end, rank2_start, rank2_end, rank_dates, winner_date, contract_start, contract_end, move_in_ym, total_households, url, state
  - `toModelRow(raw: Raw): DbRow | null` — 열: pblanc_no, model_no, house_ty, area_excl, area_supply, general_count, special_counts, top_price
  - `houseTyArea(houseTy: string): number | null`, `moveInYm(v): string | null`

- [ ] **Step 1: Write the failing test**

```ts
// file: tests/notice-transform.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildLawdIndex } from '../src/lib/region/lawd';
import { str, int, num, yn } from '../src/lib/raw';
import { toNoticeRow, toModelRow, houseTyArea, moveInYm } from '../src/lib/apt/notice-transform';

const idx = buildLawdIndex(JSON.parse(readFileSync('content/lawd/lawd.json', 'utf8')));
const detail: Record<string, unknown>[] = JSON.parse(readFileSync('sync/fixtures/applyhome/notice-detail.json', 'utf8')).data;
const model: Record<string, unknown>[] = JSON.parse(readFileSync('sync/fixtures/applyhome/notice-model.json', 'utf8')).data;
const byNo = (no: string) => detail.find((d) => d.PBLANC_NO === no)!;

describe('raw', () => {
  it('str: 빈칸·공백·- 는 null, 숫자는 문자열', () => {
    expect(str(' ')).toBeNull();
    expect(str('-')).toBeNull();
    expect(str(undefined)).toBeNull();
    expect(str(0)).toBe('0');
    expect(str(' a ')).toBe('a');
  });
  it('int·num·yn', () => {
    expect(int('1,234')).toBe(1234);
    expect(int(27)).toBe(27);
    expect(int('12.5')).toBeNull();
    expect(num('84.9961')).toBe(84.9961);
    expect(num('(△3)')).toBeNull();
    expect(yn('Y')).toBe(1);
    expect(yn('n')).toBe(0);
    expect(yn(null)).toBeNull();
  });
});

describe('toNoticeRow', () => {
  it('신혼희망타운(국민) 공고', () => {
    const r = toNoticeRow(byNo('2026820015'), idx)!;
    expect(r).toMatchObject({
      pblanc_no: '2026820015', house_manage_no: '2026820015', house_kind: '신혼희망타운', rent_kind: '분양주택',
      area_code: '410', sido: '경기도', sigungu: '시흥시', supply_kind: 'national',
      public_land: 1, price_cap: 1, speculative: 0, adjusted: 0,
      notice_date: '2026-11-06', special_start: null, special_end: null,
      rank1_start: '2026-11-16', rank1_end: '2026-11-26', rank2_start: '2026-11-27', rank2_end: '2026-11-27',
      winner_date: '2026-12-08', contract_start: '2027-03-11', contract_end: '2027-03-14',
      move_in_ym: '2029-09', total_households: 480, state: 'normal',
    });
  });
  it('민영 공고: 특공 일정, 기타경기 없는 순위 일정, 법정동', () => {
    const r = toNoticeRow(byNo('2026000557'), idx)!;
    expect(r).toMatchObject({ supply_kind: 'private', lawd_cd: '41610', dong: '탄벌동', special_start: '2026-11-16', rank1_start: '2026-11-17', rank2_end: '2026-11-18' });
    const dates = JSON.parse(r.rank_dates as string);
    expect(dates.rank1).toEqual({ local: ['2026-11-17', '2026-11-17'], other: ['2026-11-17', '2026-11-17'] });
  });
  it('이름에 정정이 있으면 corrected', () => {
    const d = byNo('2026000553');
    expect(toNoticeRow({ ...d, HOUSE_NM: `${d.HOUSE_NM}(정정공고)` }, idx)!.state).toBe('corrected');
  });
  it('공고번호·이름이 없으면 null', () => {
    expect(toNoticeRow({ ...byNo('2026000553'), HOUSE_NM: ' ' }, idx)).toBeNull();
    expect(toNoticeRow({ ...byNo('2026000553'), PBLANC_NO: null }, idx)).toBeNull();
  });
  it('주소를 해석하지 못하면 지역은 null, 주소는 남긴다', () => {
    const r = toNoticeRow({ ...byNo('2026000553'), HSSPLY_ADRES: '어딘가 모르는 곳' }, idx)!;
    expect(r).toMatchObject({ address: '어딘가 모르는 곳', lawd_cd: null, sido: null, dong: null });
  });
});

describe('toModelRow', () => {
  it('주택형 행', () => {
    const m = toModelRow(model.find((x) => x.PBLANC_NO === '2026820015' && x.MODEL_NO === '01')!)!;
    expect(m).toMatchObject({ pblanc_no: '2026820015', model_no: '01', house_ty: '055.0000A', area_excl: 55, area_supply: 79.047, general_count: 0, top_price: 43390 });
    expect(JSON.parse(m.special_counts as string)).toMatchObject({ total: 277, newlywed: 0 });
  });
  it('주택형이 없으면 null', () => {
    expect(toModelRow({ ...model[0], HOUSE_TY: '' })).toBeNull();
  });
  it('houseTyArea·moveInYm', () => {
    expect(houseTyArea('084.3473A')).toBe(84.3473);
    expect(houseTyArea('A형')).toBeNull();
    expect(moveInYm('202909')).toBe('2029-09');
    expect(moveInYm('2029')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/notice-transform.test.ts`
Expected: FAIL — `Failed to resolve import "../src/lib/raw"`

- [ ] **Step 3: Write minimal implementation**

```ts
// file: src/lib/raw.ts
// 공공데이터 응답 값 다루기 — 빈 문자열·공백·'-' 는 값 없음으로 본다
export type Raw = Record<string, unknown>;
export type DbRow = Record<string, string | number | null>;

export function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  return t === '' || t === '-' ? null : t;
}

export function int(v: unknown): number | null {
  const t = str(v)?.replace(/,/g, '');
  return t && /^-?\d+$/.test(t) ? Number(t) : null;
}

export function num(v: unknown): number | null {
  const t = str(v)?.replace(/,/g, '');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function yn(v: unknown): 0 | 1 | null {
  const t = str(v)?.toUpperCase();
  return t === 'Y' ? 1 : t === 'N' ? 0 : null;
}
```

```ts
// file: src/lib/apt/notice-transform.ts
// 청약홈 분양정보(getAPTLttotPblancDetail·getAPTLttotPblancMdl) → apt_notice·apt_model 행 (spec §5)
import { normalizeDate } from '../date';
import { resolveAddress, type LawdIndex } from '../region/lawd';
import { str, int, num, yn, type Raw, type DbRow } from '../raw';

// 순위 접수일: 해당지역(CRSPAREA)·기타경기(ETC_GG)·기타지역(ETC_AREA)
const AREAS = [['local', 'CRSPAREA'], ['province', 'ETC_GG'], ['other', 'ETC_AREA']] as const;

function rankRange(raw: Raw, rank: 1 | 2) {
  const byArea: Record<string, [string, string]> = {};
  const starts: string[] = [];
  const ends: string[] = [];
  for (const [name, code] of AREAS) {
    const s = normalizeDate(str(raw[`GNRL_RNK${rank}_${code}_RCPTDE`]));
    const e = normalizeDate(str(raw[`GNRL_RNK${rank}_${code}_ENDDE`])) ?? s;
    if (!s || !e) continue;
    byArea[name] = [s, e];
    starts.push(s);
    ends.push(e);
  }
  starts.sort();
  ends.sort();
  return { start: starts[0] ?? null, end: ends[ends.length - 1] ?? null, byArea };
}

const date = (v: unknown) => normalizeDate(str(v));

export function moveInYm(v: unknown): string | null {
  const t = str(v);
  return t && /^\d{6}$/.test(t) ? `${t.slice(0, 4)}-${t.slice(4)}` : null;
}

export function toNoticeRow(raw: Raw, idx: LawdIndex): DbRow | null {
  const pblancNo = str(raw.PBLANC_NO);
  const name = str(raw.HOUSE_NM);
  if (!pblancNo || !name) return null;
  const address = str(raw.HSSPLY_ADRES);
  const loc = address ? resolveAddress(idx, address) : null;
  const r1 = rankRange(raw, 1);
  const r2 = rankRange(raw, 2);
  return {
    pblanc_no: pblancNo,
    house_manage_no: str(raw.HOUSE_MANAGE_NO) ?? pblancNo,
    name,
    house_kind: str(raw.HOUSE_SECD_NM),
    rent_kind: str(raw.RENT_SECD_NM),
    area_code: str(raw.SUBSCRPT_AREA_CODE),
    sido: loc?.sido ?? null,
    sigungu: loc?.sigungu ?? null,
    address,
    lawd_cd: loc?.lawdCd ?? null,
    dong: loc?.dong ?? null,
    supply_kind: str(raw.HOUSE_DTL_SECD) === '03' ? 'national' : 'private',
    public_land: yn(raw.PUBLIC_HOUSE_EARTH_AT),
    price_cap: yn(raw.PARCPRC_ULS_AT),
    speculative: yn(raw.SPECLT_RDN_EARTH_AT),
    adjusted: yn(raw.MDAT_TRGET_AREA_SECD),
    notice_date: date(raw.RCRIT_PBLANC_DE),
    special_start: date(raw.SPSPLY_RCEPT_BGNDE),
    special_end: date(raw.SPSPLY_RCEPT_ENDDE),
    rank1_start: r1.start,
    rank1_end: r1.end,
    rank2_start: r2.start,
    rank2_end: r2.end,
    rank_dates: JSON.stringify({ rank1: r1.byArea, rank2: r2.byArea }),
    winner_date: date(raw.PRZWNER_PRESNATN_DE),
    contract_start: date(raw.CNTRCT_CNCLS_BGNDE),
    contract_end: date(raw.CNTRCT_CNCLS_ENDDE),
    move_in_ym: moveInYm(raw.MVN_PREARNGE_YM),
    total_households: int(raw.TOT_SUPLY_HSHLDCO),
    url: str(raw.PBLANC_URL),
    state: name.includes('정정') ? 'corrected' : 'normal',
  };
}

// 주택형 "084.3473A" → 전용면적 84.3473
export function houseTyArea(houseTy: string): number | null {
  const m = houseTy.trim().match(/^(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

const SPECIAL_COUNTS = {
  multichild: 'MNYCH_HSHLDCO', newlywed: 'NWWDS_HSHLDCO', first_life: 'LFE_FRST_HSHLDCO',
  elderly_parent: 'OLD_PARNTS_SUPORT_HSHLDCO', newborn: 'NWBB_HSHLDCO', youth: 'YGMN_HSHLDCO',
  institution: 'INSTT_RECOMEND_HSHLDCO', transfer: 'TRANSR_INSTT_ENFSN_HSHLDCO', etc: 'ETC_HSHLDCO',
  total: 'SPSPLY_HSHLDCO',
} as const;

export function toModelRow(raw: Raw): DbRow | null {
  const pblancNo = str(raw.PBLANC_NO);
  const modelNo = str(raw.MODEL_NO);
  const houseTy = str(raw.HOUSE_TY);
  if (!pblancNo || !modelNo || !houseTy) return null;
  const special: Record<string, number | null> = {};
  for (const [k, f] of Object.entries(SPECIAL_COUNTS)) special[k] = int(raw[f]);
  return {
    pblanc_no: pblancNo,
    model_no: modelNo,
    house_ty: houseTy,
    area_excl: houseTyArea(houseTy),
    area_supply: num(raw.SUPLY_AR),
    general_count: int(raw.SUPLY_HSHLDCO),
    special_counts: JSON.stringify(special),
    top_price: int(raw.LTTOT_TOP_AMOUNT),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/notice-transform.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/raw.ts src/lib/apt/notice-transform.ts tests/notice-transform.test.ts
git commit -m "변환: 분양 공고·주택형 행"
```

### Task 3: 경쟁률·특공 신청현황 변환

**Files:**
- Create: `src/lib/apt/competition-transform.ts`
- Test: `tests/competition-transform.test.ts`

**Interfaces:**
- Consumes: `str`, `int`, `num`, `Raw`, `DbRow` (Task 2)
- Produces:
  - `residenceOf(name: unknown): 'local' | 'province' | 'other' | 'all'`
  - `toCompetitionRow(raw: Raw): DbRow | null` — 열: pblanc_no, model_no, rank, residence, supply_count, applicants, rate, rate_text
  - `toSpecialStatusRows(raw: Raw, modelNoOf: (pblancNo: string, houseTy: string) => string | null): DbRow[]` — 열: pblanc_no, model_no, special_type, residence, allotted, applicants

- [ ] **Step 1: Write the failing test**

```ts
// file: tests/competition-transform.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { residenceOf, toCompetitionRow, toSpecialStatusRows } from '../src/lib/apt/competition-transform';

const comp: Record<string, unknown>[] = JSON.parse(readFileSync('sync/fixtures/applyhome-cmpet/competition.json', 'utf8')).data;
const spec: Record<string, unknown>[] = JSON.parse(readFileSync('sync/fixtures/applyhome-cmpet/special-status.json', 'utf8')).data;

describe('residenceOf', () => {
  it('거주 구분 이름을 코드로', () => {
    expect(residenceOf('해당지역')).toBe('local');
    expect(residenceOf('기타경기')).toBe('province');
    expect(residenceOf('기타지역')).toBe('other');
    expect(residenceOf(null)).toBe('all');
  });
});

describe('toCompetitionRow', () => {
  it('1순위 해당지역', () => {
    expect(toCompetitionRow(comp[0])).toEqual({
      pblanc_no: '2026000532', model_no: '01', rank: 1, residence: 'local',
      supply_count: 116, applicants: 119, rate: 2.05, rate_text: '2.05',
    });
  });
  it("경쟁률 '-' 는 rate null, 원문은 남긴다", () => {
    expect(toCompetitionRow(comp[2])).toMatchObject({ rank: 2, residence: 'local', applicants: 27, rate: null, rate_text: '-' });
  });
  it('미달 표기(△) 도 원문만 남긴다', () => {
    expect(toCompetitionRow({ ...comp[0], CMPET_RATE: '(△12)' })).toMatchObject({ rate: null, rate_text: '(△12)' });
  });
  it('공고번호·주택형번호·순위가 없으면 null', () => {
    expect(toCompetitionRow({ ...comp[0], MODEL_NO: '' })).toBeNull();
    expect(toCompetitionRow({ ...comp[0], SUBSCRPT_RANK_CODE: null })).toBeNull();
  });
});

describe('toSpecialStatusRows', () => {
  const rows = toSpecialStatusRows(spec[0], (p, ty) => (p === '2026000532' && ty === '084.3473A' ? '01' : null));
  const find = (t: string, r: string) => rows.find((x) => x.special_type === t && x.residence === r);
  it('유형·거주지역별 신청 수', () => {
    expect(find('first_life', 'local')).toMatchObject({ pblanc_no: '2026000532', model_no: '01', allotted: null, applicants: 10 });
    expect(find('first_life', 'other')).toMatchObject({ applicants: 15 });
    expect(find('first_life', 'province')).toMatchObject({ applicants: 0 });
  });
  it('all 행은 배정 세대수와 신청 합계', () => {
    expect(find('first_life', 'all')).toMatchObject({ allotted: 31, applicants: 25 });
    expect(find('newlywed', 'all')).toMatchObject({ allotted: 28, applicants: 18 });
    expect(find('elderly_parent', 'all')).toMatchObject({ allotted: 6, applicants: 0 });
  });
  it('기관추천은 all 한 행(신청 = 결정 수)', () => {
    expect(rows.filter((x) => x.special_type === 'institution')).toEqual([
      { pblanc_no: '2026000532', model_no: '01', special_type: 'institution', residence: 'all', allotted: 27, applicants: 1 },
    ]);
  });
  it('주택형번호를 못 찾으면 주택형을 그대로 쓴다', () => {
    const r = toSpecialStatusRows(spec[0], () => null);
    expect(r[0].model_no).toBe('084.3473A');
  });
  it('공고번호가 없으면 행이 없다', () => {
    expect(toSpecialStatusRows({ ...spec[0], PBLANC_NO: '' }, () => '01')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/competition-transform.test.ts`
Expected: FAIL — `Failed to resolve import "../src/lib/apt/competition-transform"`

- [ ] **Step 3: Write minimal implementation**

```ts
// file: src/lib/apt/competition-transform.ts
// 청약홈 경쟁률(getAPTLttotPblancCmpet)·특공 신청현황(getAPTSpsplyReqstStus) → 행 (spec §5)
import { str, int, num, type Raw, type DbRow } from '../raw';

export function residenceOf(name: unknown): 'local' | 'province' | 'other' | 'all' {
  const t = str(name) ?? '';
  if (t.startsWith('해당')) return 'local';
  if (t.startsWith('기타경기')) return 'province';
  if (t.startsWith('기타')) return 'other';
  return 'all';
}

export function toCompetitionRow(raw: Raw): DbRow | null {
  const pblancNo = str(raw.PBLANC_NO);
  const modelNo = str(raw.MODEL_NO);
  const rank = int(raw.SUBSCRPT_RANK_CODE);
  if (!pblancNo || !modelNo || rank === null) return null;
  const rateText = raw.CMPET_RATE === null || raw.CMPET_RATE === undefined ? null : String(raw.CMPET_RATE).trim() || null;
  return {
    pblanc_no: pblancNo,
    model_no: modelNo,
    rank,
    residence: residenceOf(raw.RESIDE_SENM),
    supply_count: int(raw.SUPLY_HSHLDCO),
    applicants: int(raw.REQ_CNT),
    rate: num(raw.CMPET_RATE),
    rate_text: rateText,
  };
}

// [유형, 신청 수 필드 꼬리, 배정 세대수 필드]
const TYPES = [
  ['multichild', 'MNYCH_CNT', 'MNYCH_HSHLDCO'],
  ['newlywed', 'NWWDS_NMTW_CNT', 'NWWDS_NMTW_HSHLDCO'],
  ['first_life', 'LFE_FRST_CNT', 'LFE_FRST_HSHLDCO'],
  ['elderly_parent', 'OPS_CNT', 'OLD_PARNTS_SUPORT_HSHLDCO'],
  ['newborn', 'NWBB_NWBBSHR_CNT', 'NWBB_NWBBSHR_HSHLDCO'],
  ['youth', 'YGMN_CNT', 'YGMN_HSHLDCO'],
] as const;
const AREAS = [['local', 'CRSPAREA'], ['province', 'CTPRVN'], ['other', 'ETC_AREA']] as const;

export function toSpecialStatusRows(raw: Raw, modelNoOf: (pblancNo: string, houseTy: string) => string | null): DbRow[] {
  const pblancNo = str(raw.PBLANC_NO);
  const houseTy = str(raw.HOUSE_TY);
  if (!pblancNo || !houseTy) return [];
  const modelNo = modelNoOf(pblancNo, houseTy) ?? houseTy;
  const base = { pblanc_no: pblancNo, model_no: modelNo };
  const out: DbRow[] = [];
  for (const [type, cnt, hh] of TYPES) {
    let sum: number | null = null;
    for (const [residence, prefix] of AREAS) {
      const applicants = int(raw[`${prefix}_${cnt}`]);
      if (applicants !== null) sum = (sum ?? 0) + applicants;
      out.push({ ...base, special_type: type, residence, allotted: null, applicants });
    }
    out.push({ ...base, special_type: type, residence: 'all', allotted: int(raw[hh]), applicants: sum });
  }
  out.push({ ...base, special_type: 'institution', residence: 'all', allotted: int(raw.INSTT_RECOMEND_HSHLDCO), applicants: int(raw.INSTT_RECOMEND_DCSN_CNT) });
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/competition-transform.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/apt/competition-transform.ts tests/competition-transform.test.ts
git commit -m "변환: 경쟁률·특공 신청현황 행"
```


### Task 4: 실거래(매매·분양권) XML 변환

**Files:**
- Create: `src/lib/trade/trade-transform.ts`
- Test: `tests/trade-transform.test.ts`

**Interfaces:**
- Consumes: `Raw`, `DbRow`, `str`, `int` (`src/lib/raw.ts`, Task 2), `parseDealAmount`, `parseArea` (`src/lib/trade/amount.ts`), `ymd` (`src/lib/date.ts`), `tradeKeys` (`src/lib/trade/trade-key.ts`)
- Produces:
  - `parseMolitXml(xml: string): { resultCode: string | null; totalCount: number; items: Raw[] }`
  - `toTradeRows(items: Raw[]): DbRow[]` — `trade` 테이블 열(hash·updated_at 제외)
  - `toPresaleRows(items: Raw[]): DbRow[]` — `presale_trade` 테이블 열(hash·updated_at 제외)

- [ ] **Step 1: Write the failing test**

```ts
// file: tests/trade-transform.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseMolitXml, toTradeRows, toPresaleRows } from '../src/lib/trade/trade-transform';

const tradeXml = readFileSync('sync/fixtures/molit-apt/trade-11680-202610.xml', 'utf8');
const presaleXml = readFileSync('sync/fixtures/molit-presale/presale-41117-202610.xml', 'utf8');

describe('parseMolitXml', () => {
  it('결과 코드·전체 건수·항목을 읽는다', () => {
    const r = parseMolitXml(tradeXml);
    expect(r.resultCode).toBe('000');
    expect(r.totalCount).toBe(110);
    expect(r.items.length).toBe(5);
    expect(r.items[0].aptNm).toBe('은마');
  });
  it('엔티티를 풀고 빈 문서는 빈 목록', () => {
    const r = parseMolitXml('<response><header><resultCode>000</resultCode></header><body><items><item><aptNm>A&amp;B</aptNm></item></items><totalCount>1</totalCount></body></response>');
    expect(r.items[0].aptNm).toBe('A&B');
    expect(parseMolitXml('').items).toEqual([]);
    expect(parseMolitXml('').totalCount).toBe(0);
  });
});

describe('toTradeRows', () => {
  const rows = toTradeRows(parseMolitXml(tradeXml).items);
  it('매매 첫 항목 (은마)', () => {
    expect(rows[0]).toMatchObject({
      lawd_cd: '11680', umd_cd: '10600', dong: '대치동', jibun: '316', apt_seq: '11680-218', name: '은마',
      area: 76.79, floor: 7, contract_date: '2026-10-16', amount: 319000, build_year: 1979, cancelled: 0, cancel_date: null,
    });
    expect(String(rows[0].trade_key)).toMatch(/^[0-9a-f]{16}$/);
  });
  it('해제 거래: cdealType 이 있으면 cancelled 1, 해제일 YY.MM.DD 를 풀어 쓴다', () => {
    const [r] = toTradeRows([{ sggCd: '11680', umdNm: '대치동', aptNm: '은마', excluUseAr: '76.79', dealAmount: '1,000', dealYear: '2026', dealMonth: '10', dealDay: '1', cdealType: 'O', cdealDay: '26.10.20' }]);
    expect(r.cancelled).toBe(1);
    expect(r.cancel_date).toBe('2026-10-20');
  });
  it('금액·면적·날짜·필수 이름이 없으면 건너뛴다', () => {
    const base = { sggCd: '11680', umdNm: '대치동', aptNm: '은마', excluUseAr: '76.79', dealAmount: '1,000', dealYear: '2026', dealMonth: '10', dealDay: '1' };
    expect(toTradeRows([{ ...base, dealAmount: ' ' }])).toEqual([]);
    expect(toTradeRows([{ ...base, excluUseAr: '0' }])).toEqual([]);
    expect(toTradeRows([{ ...base, dealDay: '32' }])).toEqual([]);
    expect(toTradeRows([{ ...base, aptNm: '' }])).toEqual([]);
  });
  it('같은 필드의 거래 두 건은 키가 겹치지 않는다', () => {
    const it1 = { sggCd: '11680', umdNm: '대치동', aptNm: '은마', excluUseAr: '76.79', dealAmount: '1,000', dealYear: '2026', dealMonth: '10', dealDay: '1' };
    const keys = toTradeRows([it1, { ...it1 }]).map((r) => r.trade_key);
    expect(new Set(keys).size).toBe(2);
  });
});

describe('toPresaleRows', () => {
  it('분양권 첫 항목', () => {
    const rows = toPresaleRows(parseMolitXml(presaleXml).items);
    expect(rows.length).toBe(2);
    expect(rows[0]).toMatchObject({
      sgg_cd: '41117', dong: '영통동', jibun: '961-11', name: '영통자이 센트럴파크',
      area: 84.9961, floor: 12, contract_date: '2026-10-31', amount: 162920, kind: null, cancelled: 0,
    });
    expect(rows[1].amount).toBe(125510);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/trade-transform.test.ts`
Expected: FAIL — `Failed to resolve import "../src/lib/trade/trade-transform"`

- [ ] **Step 3: Write minimal implementation**

```ts
// file: src/lib/trade/trade-transform.ts
// 국토부 실거래(매매·분양권) XML → trade / presale_trade 행 (spec §5·§9)
import { type Raw, type DbRow, str, int } from '../raw';
import { parseDealAmount, parseArea } from './amount';
import { ymd, normalizeDate } from '../date';
import { tradeKeys } from './trade-key';

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" };
const unescape = (s: string) => s.replace(/&(amp|lt|gt|quot|apos|#39);/g, (_, k: string) => ENT[k]);

export function parseMolitXml(xml: string): { resultCode: string | null; totalCount: number; items: Raw[] } {
  const code = xml.match(/<resultCode>([^<]*)<\/resultCode>/);
  const total = xml.match(/<totalCount>(\d+)<\/totalCount>/);
  const items: Raw[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const item: Raw = {};
    for (const t of m[1].matchAll(/<([A-Za-z0-9_]+)>([^<]*)<\/\1>/g)) item[t[1]] = unescape(t[2]);
    items.push(item);
  }
  return { resultCode: code ? code[1].trim() : null, totalCount: total ? Number(total[1]) : 0, items };
}

// 계약일: 년·월·일이 실제 날짜일 때만
function contractDate(r: Raw): string | null {
  const [y, m, d] = [int(r.dealYear), int(r.dealMonth), int(r.dealDay)];
  return y && m && d ? normalizeDate(ymd(y, m, d)) : null;
}

// 해제일 "26.10.20" → 2026-10-20
function cancelDate(v: unknown): string | null {
  const m = str(v)?.match(/^(\d{2})\.(\d{1,2})\.(\d{1,2})$/);
  return m ? normalizeDate(ymd(2000 + Number(m[1]), m[2], m[3])) : null;
}

interface Base { sgg: string; dong: string; jibun: string | null; name: string; area: number; floor: number | null; date: string; amount: number; cancelled: 0 | 1 }

function base(r: Raw): Base | null {
  const sgg = str(r.sggCd), dong = str(r.umdNm), name = str(r.aptNm);
  const area = parseArea(str(r.excluUseAr)), amount = parseDealAmount(str(r.dealAmount)), date = contractDate(r);
  if (!sgg || !dong || !name || area === null || amount === null || !date) return null;
  return { sgg, dong, jibun: str(r.jibun), name, area, floor: int(r.floor), date, amount, cancelled: str(r.cdealType) ? 1 : 0 };
}

function withKeys<T extends { b: Base }>(list: T[]): (T & { key: string })[] {
  const keys = tradeKeys(list.map(({ b }) => ({ lawdCd: b.sgg, dong: b.dong, jibun: b.jibun ?? '', name: b.name, area: b.area, floor: b.floor, contractDate: b.date, amount: b.amount })));
  return list.map((x, i) => ({ ...x, key: keys[i] }));
}

export function toTradeRows(items: Raw[]): DbRow[] {
  const list = items.flatMap((r) => { const b = base(r); return b ? [{ r, b }] : []; });
  return withKeys(list).map(({ r, b, key }) => ({
    trade_key: key, lawd_cd: b.sgg, umd_cd: str(r.umdCd), dong: b.dong, jibun: b.jibun, apt_seq: str(r.aptSeq), name: b.name,
    area: b.area, floor: b.floor, contract_date: b.date, amount: b.amount, build_year: int(r.buildYear),
    cancelled: b.cancelled, cancel_date: cancelDate(r.cdealDay),
  }));
}

export function toPresaleRows(items: Raw[]): DbRow[] {
  const list = items.flatMap((r) => { const b = base(r); return b ? [{ r, b }] : []; });
  return withKeys(list).map(({ r, b, key }) => ({
    trade_key: key, sgg_cd: b.sgg, dong: b.dong, jibun: b.jibun, name: b.name, area: b.area, floor: b.floor,
    contract_date: b.date, amount: b.amount, kind: str(r.ownershipGbn), cancelled: b.cancelled,
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/trade-transform.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/trade/trade-transform.ts tests/trade-transform.test.ts
git commit -m "동기화: 실거래 매매·분양권 XML 변환"
```

### Task 5: LH 공고·공급 변환

**Files:**
- Create: `src/lib/apt/lh-transform.ts`
- Test: `tests/lh-transform.test.ts`

**Interfaces:**
- Consumes: `Raw`, `DbRow`, `str`, `num` (`src/lib/raw.ts`), `normalizeDate` (`src/lib/date.ts`), `LawdIndex`, `resolveAddress`, `buildLawdIndex` (`src/lib/region/lawd.ts`)
- Produces:
  - `mergeLh(resp: unknown): Raw` — LH 응답 배열 `[ {dsSch}, {...} ]` 을 객체 하나로 합침 (배열이 아니면 `{}`)
  - `lhListItems(resp: unknown): Raw[]` — 목록 응답의 `dsList`
  - `toLhNoticeRow(item: Raw, detail: Raw | null, idx: LawdIndex): DbRow | null` — `lh_notice` 열(hash·updated_at 제외). PAN_ID·제목이 없거나 UPP_AIS_TP_CD 가 05·06 이 아니면 null. `detail` 은 `mergeLh` 결과
  - `toLhSupplyRows(lhId: string, supply: Raw): DbRow[]` — `lh_supply` 열(hash·updated_at 제외). `supply` 는 `mergeLh` 결과

- [ ] **Step 1: Write the failing test**

```ts
// file: tests/lh-transform.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildLawdIndex } from '../src/lib/region/lawd';
import { mergeLh, lhListItems, toLhNoticeRow, toLhSupplyRows } from '../src/lib/apt/lh-transform';

const idx = buildLawdIndex(JSON.parse(readFileSync('content/lawd/lawd.json', 'utf8')));
const load = (f: string) => JSON.parse(readFileSync(`sync/fixtures/lh/${f}`, 'utf8'));
const list = lhListItems(load('notice-list.json'));
const item = list.find((x) => x.PAN_ID === '0000061205')!;
const detail = mergeLh(load('notice-detail.json'));
const supply = mergeLh(load('notice-supply.json'));

describe('lhListItems·mergeLh', () => {
  it('목록 24건', () => expect(list.length).toBe(24));
  it('배열이 아니면 빈 값', () => {
    expect(mergeLh(null)).toEqual({});
    expect(lhListItems({})).toEqual([]);
  });
});

describe('toLhNoticeRow', () => {
  it('상세 없이: 목록 값만', () => {
    const r = toLhNoticeRow(item, null, idx)!;
    expect(r).toMatchObject({
      lh_id: '0000061205', title: '안산신길2 B-1블록 공공분양주택 입주자 모집공고', kind: 'sale', sub_kind: '분양주택',
      upp_ais_tp_cd: '05', spl_inf_tp_cd: '050', ccr_cnnt_sys_ds_cd: '02', sido: '경기도', sigungu: null, lawd_cd: null,
      posted_date: '2026-11-04', receipt_start: null, receipt_end: '2026-11-18', state: '공고중', pblanc_no: null,
    });
    expect(String(r.url)).toMatch(/^https:\/\/apply\.lh\.or\.kr\//);
  });
  it('상세가 있으면 주소·일정을 채운다', () => {
    const r = toLhNoticeRow(item, detail, idx)!;
    expect(r).toMatchObject({
      address: '경기도 안산시 단원구 신길동', lawd_cd: '41273',
      receipt_start: '2026-11-09', receipt_end: '2026-11-18', winner_date: '2026-11-30',
      contract_start: '2027-03-15', contract_end: '2027-03-18',
    });
    expect(String(r.sido)).toMatch(/경기/);
    expect(String(r.sigungu)).toContain('단원구');
  });
  it('임대(06)는 rent, 분양·임대가 아니면 null', () => {
    expect(toLhNoticeRow({ ...item, UPP_AIS_TP_CD: '06' }, null, idx)!.kind).toBe('rent');
    expect(toLhNoticeRow({ ...item, UPP_AIS_TP_CD: '13' }, null, idx)).toBeNull();
    expect(toLhNoticeRow({ ...item, PAN_ID: '' }, null, idx)).toBeNull();
  });
  it('주소를 풀지 못하면 목록의 시도만 남긴다', () => {
    const r = toLhNoticeRow(item, { dsSbd: [{ LCT_ARA_ADR: '어딘가' }], dsSplScdl: [] }, idx)!;
    expect(r).toMatchObject({ sido: '경기도', lawd_cd: null, address: '어딘가', receipt_end: '2026-11-18' });
  });
});

describe('toLhSupplyRows', () => {
  const rows = toLhSupplyRows('0000061205', supply);
  it('dsList01 8행, 원 → 만원', () => {
    expect(rows.length).toBe(8);
    expect(rows[0]).toMatchObject({ lh_id: '0000061205', supply_type: '01', house_ty: '74.9400A', area_excl: 74.94, households: 80, price: 50430, deposit: null, monthly_rent: null });
  });
  it('임대 표는 보증금·월세', () => {
    const [r] = toLhSupplyRows('X', { dsList02: [{ HTY_NM: '26A', RSDN_DDO_AR: '26.5', SIL_HSH_CNT: '10', LS_GMY: '15,000,000', MM_RFE: '125000' }] });
    expect(r).toMatchObject({ supply_type: '02', price: null, deposit: 1500, monthly_rent: 13 });
  });
  it('주택형이 없는 행은 건너뛴다', () => {
    expect(toLhSupplyRows('X', { dsList01: [{ HTY_NM: '' }] })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lh-transform.test.ts`
Expected: FAIL — `Failed to resolve import "../src/lib/apt/lh-transform"`

- [ ] **Step 3: Write minimal implementation**

```ts
// file: src/lib/apt/lh-transform.ts
// LH 분양·임대 공고(목록·상세·공급) → lh_notice / lh_supply 행 (spec §5)
import { type Raw, type DbRow, str, num } from '../raw';
import { normalizeDate } from '../date';
import { type LawdIndex, resolveAddress } from '../region/lawd';

export function mergeLh(resp: unknown): Raw {
  return Array.isArray(resp) ? Object.assign({}, ...resp.filter((x) => x && typeof x === 'object')) : {};
}

const rowsOf = (v: unknown): Raw[] => (Array.isArray(v) ? (v as Raw[]) : []);

export const lhListItems = (resp: unknown): Raw[] => rowsOf(mergeLh(resp).dsList);

const KIND: Record<string, 'sale' | 'rent'> = { '05': 'sale', '06': 'rent' };
const cleanTitle = (t: string) => t.replace(/^(\s*\[[^\]]*\]\s*)+/, '').trim();
const dates = (vals: (string | null)[]) => vals.map((v) => normalizeDate(v)).filter((d): d is string => !!d).sort();
const first = (a: string[]) => a[0] ?? null;
const last = (a: string[]) => a[a.length - 1] ?? null;

export function toLhNoticeRow(item: Raw, detail: Raw | null, idx: LawdIndex): DbRow | null {
  const id = str(item.PAN_ID), title = str(item.PAN_NM);
  const kind = KIND[str(item.UPP_AIS_TP_CD) ?? ''];
  if (!id || !title || !kind) return null;
  const row: DbRow = {
    lh_id: id, title: cleanTitle(title), kind, sub_kind: str(item.AIS_TP_CD_NM),
    upp_ais_tp_cd: str(item.UPP_AIS_TP_CD), spl_inf_tp_cd: str(item.SPL_INF_TP_CD), ccr_cnnt_sys_ds_cd: str(item.CCR_CNNT_SYS_DS_CD),
    sido: str(item.CNP_CD_NM), sigungu: null, lawd_cd: null, address: null,
    posted_date: normalizeDate(str(item.PAN_NT_ST_DT)), receipt_start: null, receipt_end: normalizeDate(str(item.CLSG_DT)),
    winner_date: null, contract_start: null, contract_end: null,
    url: str(item.DTL_URL), state: str(item.PAN_SS), pblanc_no: null,
  };
  if (!detail) return row;
  const address = str(rowsOf(detail.dsSbd)[0]?.LCT_ARA_ADR);
  row.address = address;
  const loc = address ? resolveAddress(idx, address) : null;
  if (loc) Object.assign(row, { sido: loc.sido, sigungu: loc.sigungu, lawd_cd: loc.lawdCd });
  const sch = rowsOf(detail.dsSplScdl);
  const acp = sch.map((s) => (str(s.ACP_DTTM) ?? '').split('~').map((x) => x.trim()));
  const starts = dates(acp.map((p) => p[0] || null)), ends = dates(acp.map((p) => p[1] || p[0] || null));
  if (starts.length) row.receipt_start = first(starts);
  if (ends.length) row.receipt_end = last(ends);
  row.winner_date = first(dates(sch.map((s) => str(s.PZWR_ANC_DT))));
  row.contract_start = first(dates(sch.map((s) => str(s.CTRT_ST_DT))));
  row.contract_end = last(dates(sch.map((s) => str(s.CTRT_ED_DT))));
  return row;
}

// 원 → 만원 (반올림)
const man = (v: unknown): number | null => { const n = num(v); return n === null ? null : Math.round(n / 10_000); };

export function toLhSupplyRows(lhId: string, supply: Raw): DbRow[] {
  return ['01', '02', '03', '04', '05'].flatMap((t) =>
    rowsOf(supply[`dsList${t}`]).flatMap((r) => {
      const ty = str(r.HTY_NM);
      if (!ty) return [];
      const h = num(r.SIL_HSH_CNT);
      return [{
        lh_id: lhId, supply_type: t, house_ty: ty, area_excl: num(r.RSDN_DDO_AR), households: h === null ? null : Math.round(h),
        price: man(r.SIL_AMT), deposit: man(r.LS_GMY), monthly_rent: man(r.MM_RFE),
      }];
    }),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lh-transform.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/apt/lh-transform.ts tests/lh-transform.test.ts
git commit -m "동기화: LH 공고·공급 변환"
```

### Task 6: 청약통장 통계 변환

**Files:**
- Create: `src/lib/apt/account-transform.ts`
- Test: `tests/account-transform.test.ts`

**Interfaces:**
- Consumes: `Raw`, `DbRow`, `str`, `int` (`src/lib/raw.ts`)
- Produces: `toAccountRows(all: Raw[], deposit: Raw[], subscribe: Raw[]): DbRow[]` — `account_stats` 열(hash·updated_at 제외), 키 `(base_month, region, account_kind, area_kind)` 가 겹치면 수치를 합친다

규칙 (출처 3종의 지역 단위가 다르다):
- all(가입현황): region = `SUBSCRPT_AREA_CODE_NM`(서울·인천·경기·5대광역시·기타지역), area_kind = `BLNC_SECD`, rank1·rank2
- deposit(예치금액별): region = 시도와 지역명이 같으면 `SIDO_NM`, 다르면 `"${SIDO_NM} ${SUBSCRPT_AREA_CODE_NM}"`, area_kind = `''`, rank1·rank2
- subscribe(가입기간별): region 은 deposit 과 같은 규칙, area_kind = `BLNC_SECD`, `ACNUT_CO` 를 가입기간 구분 없이 합쳐 subscribers

- [ ] **Step 1: Write the failing test**

```ts
// file: tests/account-transform.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { toAccountRows } from '../src/lib/apt/account-transform';

const load = (f: string) => JSON.parse(readFileSync(`sync/fixtures/account-stats/${f}.json`, 'utf8')).data;
const rows = toAccountRows(load('all'), load('deposit'), load('subscribe'));
const find = (region: string, area: string) => rows.find((r) => r.region === region && r.account_kind === '청약예금' && r.area_kind === area);

describe('toAccountRows', () => {
  it('가입현황: 서울 85㎡ 이하 1순위, 같은 키의 가입기간별 계좌 수를 subscribers 로', () => {
    expect(find('서울', '01')).toMatchObject({ base_month: '2026-09', rank1: 95607, rank2: 0, subscribers: 205 });
  });
  it('가입현황만 있는 키는 subscribers null', () => {
    expect(find('인천·경기', '01')).toMatchObject({ rank1: 30286, subscribers: null });
  });
  it('예치금액별: 시도와 지역이 다르면 "시도 지역", area_kind 빈 문자열', () => {
    expect(find('강원 춘천', '')).toMatchObject({ rank1: 912, rank2: 0, subscribers: null });
    expect(find('서울', '')).toMatchObject({ rank1: 272768 });
  });
  it('키가 겹치지 않는다', () => {
    const keys = rows.map((r) => [r.base_month, r.region, r.account_kind, r.area_kind].join('|'));
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('같은 키는 합치고, 기준월·지역·종류가 없는 행은 버린다', () => {
    const s = { DELNG_OCCRRNC_YM: '202609', DPST_ITEM_NM: '청약예금', SIDO_NM: '서울', SUBSCRPT_AREA_CODE_NM: '서울', BLNC_SECD: '01' };
    const out = toAccountRows([], [], [{ ...s, ACNUT_CO: 2 }, { ...s, ACNUT_CO: 3 }, { ...s, DELNG_OCCRRNC_YM: '', ACNUT_CO: 9 }]);
    expect(out).toEqual([{ base_month: '2026-09', region: '서울', account_kind: '청약예금', area_kind: '01', subscribers: 5, rank1: null, rank2: null }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/account-transform.test.ts`
Expected: FAIL — `Failed to resolve import "../src/lib/apt/account-transform"`

- [ ] **Step 3: Write minimal implementation**

```ts
// file: src/lib/apt/account-transform.ts
// 청약통장 통계 3종 → account_stats 행 (spec §5). 출처마다 지역 단위가 달라 지역명 규칙을 나눈다
import { type Raw, type DbRow, str, int } from '../raw';

const month = (v: unknown): string | null => { const m = str(v)?.match(/^(\d{4})(\d{2})$/); return m ? `${m[1]}-${m[2]}` : null; };
const local = (r: Raw): string | null => {
  const sido = str(r.SIDO_NM), area = str(r.SUBSCRPT_AREA_CODE_NM);
  if (!sido) return area;
  return !area || area === sido ? sido : `${sido} ${area}`;
};
const add = (a: number | null, b: number | null) => (b === null ? a : (a ?? 0) + b);

export function toAccountRows(all: Raw[], deposit: Raw[], subscribe: Raw[]): DbRow[] {
  const map = new Map<string, DbRow>();
  const put = (r: Raw, region: string | null, area: string, v: { subscribers?: number | null; rank1?: number | null; rank2?: number | null }) => {
    const base = month(r.DELNG_OCCRRNC_YM), kind = str(r.DPST_ITEM_NM);
    if (!base || !region || !kind) return;
    const key = [base, region, kind, area].join('|');
    const row = map.get(key) ?? { base_month: base, region, account_kind: kind, area_kind: area, subscribers: null, rank1: null, rank2: null };
    row.subscribers = add(row.subscribers as number | null, v.subscribers ?? null);
    row.rank1 = add(row.rank1 as number | null, v.rank1 ?? null);
    row.rank2 = add(row.rank2 as number | null, v.rank2 ?? null);
    map.set(key, row);
  };
  for (const r of all) put(r, str(r.SUBSCRPT_AREA_CODE_NM), str(r.BLNC_SECD) ?? '', { rank1: int(r.RNK1_ACNUT_CO), rank2: int(r.RNK2_ACNUT_CO) });
  for (const r of deposit) put(r, local(r), '', { rank1: int(r.RNK1_ACNUT_CO), rank2: int(r.RNK2_ACNUT_CO) });
  for (const r of subscribe) put(r, local(r), str(r.BLNC_SECD) ?? '', { subscribers: int(r.ACNUT_CO) });
  return [...map.values()];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/account-transform.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/apt/account-transform.ts tests/account-transform.test.ts
git commit -m "동기화: 청약통장 통계 변환"
```

---

### Task 7: KV 묶음과 쓰기 예산

**Files:**
- Create: `sync/bundles.ts`
- Test: `tests/sync-bundles.test.ts`

**Interfaces:**
- Consumes: `DbRow` (Task 2), `aptPhase`·`AptSchedule` (`src/lib/apt/status.ts`), `aptEvents`·`groupByMonth`·`CalendarEvent` (`src/lib/apt/schedule.ts`), `nearbyPrice`·`TradeRecord` (`src/lib/trade/nearby.ts`), `SIDO_ALIAS` (`src/lib/region/lawd.ts`), `addMonths` (`src/lib/date.ts`), `fnv64`
- Produces:
  - `interface Dataset { notices; models; competition; special; trades; presale; presaleLinks; lhNotices; lhSupply; account: DbRow[] }` (각 표의 D1 행, hash·updated_at 있어도 됨)
  - `interface KvWrite { key: string; value: string }`
  - `interface BundleCtx { today: string; cityOf: ReadonlyMap<string, string> }`
  - `MAX_VALUE_BYTES = 50_000`, `fitValue(obj: Record<string, unknown>, listKey: string): string`
  - `buildBundles(ds: Dataset, ctx: BundleCtx): KvWrite[]` — 키: `home`, `competition`, `stats:account`, `calendar:YYYY-MM`, `apt:{공고번호}`, `lh:{ID}`(청약홈 공고와 못 맞춘 것만), `region:{시도}`, `region:{시도}:{시군구}`, `trade:{시군구코드}:{법정동}`
  - `interface KvManifest { date: string; used: number; hashes: Record<string, string> }`
  - `selectKvWrites(writes: KvWrite[], prev: KvManifest | null, opts: { today: string; budget?: number; dailyCap?: number; reserve?: number }): { put: KvWrite[]; deferred: string[]; manifest: KvManifest }` — 기본 budget 400, dailyCap 800, reserve 3(meta 키 3개 몫)

규칙:
- 값에 실행 시각을 넣지 않는다 (넣으면 매번 해시가 바뀌어 KV 쓰기를 낭비한다).
- 바뀐 키만 쓴다. `trade:` 아닌 키를 먼저, `trade:` 를 맨 뒤에. `trade:` 는 그날 누적(used + 이번 put + reserve)이 dailyCap 미만일 때만.
- 미룬 키는 매니페스트에 옛 해시를 그대로 둔다 → 다음 실행에 다시 고른다. 날짜가 바뀌면 used 는 0 부터.
- 키 삭제는 하지 않는다 (공고는 지우지 않는 출처라 생길 일이 드물다).

- [ ] **Step 1: Write the failing test**

```ts
// file: tests/sync-bundles.test.ts
import { describe, it, expect } from 'vitest';
import { buildBundles, fitValue, selectKvWrites, MAX_VALUE_BYTES, type Dataset, type KvWrite } from '../sync/bundles';

const cityOf = new Map<string, string>([['41117', '41110']]);
const ctx = { today: '2026-11-07', cityOf };

const notice = {
  pblanc_no: 'P1', house_manage_no: 'H1', name: '수원 영통 해모로', house_kind: '민영', rent_kind: null,
  area_code: '410', sido: '경기도', sigungu: '수원시 영통구', address: '경기도 수원시 영통구 망포동 100', lawd_cd: '41117', dong: '망포동',
  supply_kind: null, public_land: 0, price_cap: 0, speculative: 0, adjusted: 0, notice_date: '2026-11-01',
  special_start: '2026-11-09', special_end: '2026-11-09', rank1_start: '2026-11-10', rank1_end: '2026-11-10',
  rank2_start: '2026-11-11', rank2_end: '2026-11-11', rank_dates: null, winner_date: '2026-11-17',
  contract_start: '2026-11-28', contract_end: '2026-11-30', move_in_ym: '2029-03', total_households: 300,
  url: 'https://www.applyhome.co.kr/x', state: 'normal', hash: 'h', updated_at: 'u',
};
const model = { pblanc_no: 'P1', model_no: '01', house_ty: '084.9900A', area_excl: 84.99, area_supply: 112, general_count: 100, special_counts: null, top_price: 80000 };
const trade = (i: number, extra: Record<string, unknown> = {}) => ({
  trade_key: `T${i}`, lawd_cd: '41117', umd_cd: '10500', dong: '망포동', jibun: '1', apt_seq: 'S1', name: '망포자이',
  area: 84 + (i % 3) * 0.5, floor: 5, contract_date: `2026-10-${String(10 + i).padStart(2, '0')}`, amount: 70000 + i * 100,
  build_year: 2020, cancelled: 0, cancel_date: null, ...extra,
});
const base = (): Dataset => ({
  notices: [notice], models: [model],
  competition: [
    { pblanc_no: 'P1', model_no: '01', rank: 1, residence: 'local', supply_count: 50, applicants: 600, rate: 12, rate_text: '12' },
    { pblanc_no: 'P1', model_no: '01', rank: 1, residence: 'other', supply_count: 50, applicants: 100, rate: 2, rate_text: '2' },
  ],
  special: [], trades: [1, 2, 3, 4, 5, 6].map((i) => trade(i)), presale: [], presaleLinks: [],
  lhNotices: [], lhSupply: [], account: [],
});
const get = (ws: KvWrite[], key: string) => {
  const w = ws.find((x) => x.key === key);
  if (!w) throw new Error(`키 없음: ${key} (있는 키: ${ws.map((x) => x.key).join(', ')})`);
  return JSON.parse(w.value);
};

describe('buildBundles', () => {
  it('apt 묶음에 공고·단계·주택형별 주변 시세·경쟁률이 들어간다', () => {
    const apt = get(buildBundles(base(), ctx), 'apt:P1');
    expect(apt.notice.name).toBe('수원 영통 해모로');
    expect(apt.notice.hash).toBeUndefined();
    expect(apt.phase).toBe('upcoming');
    expect(apt.models[0].nearby.scope).toBe('dong');
    expect(apt.models[0].nearby.count).toBe(6);
    expect(apt.competition).toHaveLength(2);
  });

  it('LH 공고는 맞춘 것은 apt 묶음의 링크로, 못 맞춘 것만 lh 묶음으로', () => {
    const ds = base();
    ds.lhNotices = [
      { lh_id: 'L1', title: '영통 공공분양', kind: 'sale', pblanc_no: 'P1', url: 'https://apply.lh.or.kr/1', receipt_start: '2026-11-10', receipt_end: '2026-11-12', sido: '경기도', sigungu: '수원시 영통구' },
      { lh_id: 'L2', title: '화성 행복주택', kind: 'rent', pblanc_no: null, url: 'https://apply.lh.or.kr/2', receipt_start: '2026-11-20', receipt_end: '2026-11-21', sido: '경기도', sigungu: '화성시' },
    ];
    ds.lhSupply = [{ lh_id: 'L2', supply_type: '01', house_ty: '26A', area_excl: 26, households: 40, price: null, deposit: 1500, monthly_rent: 13 }];
    const ws = buildBundles(ds, ctx);
    expect(get(ws, 'apt:P1').lhLinks).toEqual([{ lhId: 'L1', title: '영통 공공분양', url: 'https://apply.lh.or.kr/1' }]);
    expect(ws.some((w) => w.key === 'lh:L1')).toBe(false);
    expect(get(ws, 'lh:L2').supply).toHaveLength(1);
    const cal = get(ws, 'calendar:2026-11');
    expect(cal.events.some((e: { kind: string; ref: string }) => e.kind === 'lh-receipt' && e.ref === 'lh:L2')).toBe(true);
    expect(cal.events.some((e: { kind: string; ref: string }) => e.kind === 'rank1' && e.ref === 'apt:P1')).toBe(true);
  });

  it('home 은 오늘부터 7일 안 일정과 경쟁률 상위를 담는다', () => {
    const home = get(buildBundles(base(), ctx), 'home');
    const kinds = home.events.map((e: { kind: string }) => e.kind);
    expect(kinds).toEqual(['special', 'rank1', 'rank2']); // 11-17 발표는 7일 밖
    expect(home.topCompetition[0]).toMatchObject({ pblancNo: 'P1', maxRate: 12, applicants: 700 });
  });

  it('trade 묶음은 최근 12개월만, 단지별·최신순, 해제 거래도 표시한다', () => {
    const ds = base();
    ds.trades.push(trade(7, { contract_date: '2025-10-01' }), trade(8, { name: '망포아이파크', cancelled: 1, contract_date: '2026-10-30' }));
    const t = get(buildBundles(ds, ctx), 'trade:41117:망포동');
    expect(t.complexes.map((c: { name: string }) => c.name)).toEqual(['망포아이파크', '망포자이']);
    expect(t.complexes[0].trades[0]).toMatchObject({ date: '2026-10-30', cancelled: true });
    expect(t.complexes[1].trades).toHaveLength(6); // 2025-10-01 은 12개월 밖
    expect(t.complexes[1].trades[0].date).toBe('2026-10-16');
  });

  it('region 묶음: 시도는 공고와 최신 기준월 통장 현황, 시군구는 동별 거래 요약', () => {
    const ds = base();
    ds.account = [
      { base_month: '202609', region: '경기', account_kind: '종합', area_kind: '', subscribers: 1, rank1: 1, rank2: 0 },
      { base_month: '202610', region: '경기', account_kind: '종합', area_kind: '', subscribers: 2, rank1: 2, rank2: 0 },
      { base_month: '202610', region: '서울', account_kind: '종합', area_kind: '', subscribers: 3, rank1: 3, rank2: 0 },
    ];
    const ws = buildBundles(ds, ctx);
    const sido = get(ws, 'region:경기도');
    expect(sido.notices.map((n: { pblancNo: string }) => n.pblancNo)).toEqual(['P1']);
    expect(sido.account).toEqual([expect.objectContaining({ base_month: '202610', subscribers: 2 })]);
    expect(get(ws, 'region:경기도:수원시 영통구').dongs).toEqual([{ lawdCd: '41117', dong: '망포동', count: 6, last: '2026-10-16' }]);
    expect(get(ws, 'stats:account').rows).toHaveLength(2);
  });

  it('competition 묶음은 공고별 요약을 공고일 최신순으로', () => {
    const ds = base();
    ds.notices.push({ ...notice, pblanc_no: 'P0', name: '옛 공고', notice_date: '2026-09-01' });
    ds.competition.push({ pblanc_no: 'P0', model_no: '01', rank: 1, residence: 'local', supply_count: 10, applicants: 5, rate: null, rate_text: '미달' });
    const c = get(buildBundles(ds, ctx), 'competition');
    expect(c.items.map((i: { pblancNo: string }) => i.pblancNo)).toEqual(['P1', 'P0']);
    expect(c.items[1].maxRate).toBeNull();
  });
});

describe('fitValue', () => {
  it('50KB 를 넘으면 목록 끝에서부터 덜어 내고 truncated 를 단다', () => {
    const big = { name: 'x', rows: Array.from({ length: 5000 }, (_, i) => ({ i, pad: '가나다라마바사'.repeat(3) })) };
    const v = fitValue(big, 'rows');
    expect(new TextEncoder().encode(v).length).toBeLessThan(MAX_VALUE_BYTES);
    const o = JSON.parse(v);
    expect(o.truncated).toBe(true);
    expect(o.rows[0].i).toBe(0);
    expect(fitValue({ rows: [1] }, 'rows')).toBe('{"rows":[1]}');
  });
});

describe('selectKvWrites', () => {
  const w = (key: string, value = 'v') => ({ key, value });
  it('바뀌지 않은 키는 건너뛴다', () => {
    const first = selectKvWrites([w('home'), w('apt:P1')], null, { today: '2026-11-07' });
    expect(first.put.map((x) => x.key)).toEqual(['home', 'apt:P1']);
    const again = selectKvWrites([w('home'), w('apt:P1', 'v2')], first.manifest, { today: '2026-11-07' });
    expect(again.put.map((x) => x.key)).toEqual(['apt:P1']);
  });

  it('예산을 넘으면 trade 키부터 미루고, 미룬 키는 다음 실행에 다시 고른다', () => {
    const writes = [w('trade:1:a'), w('trade:1:b'), w('home'), w('apt:P1')];
    const r1 = selectKvWrites(writes, null, { today: '2026-11-07', budget: 6, reserve: 3 });
    expect(r1.put.map((x) => x.key)).toEqual(['home', 'apt:P1', 'trade:1:a']);
    expect(r1.deferred).toEqual(['trade:1:b']);
    expect(r1.manifest.used).toBe(6);
    const r2 = selectKvWrites(writes, r1.manifest, { today: '2026-11-07', budget: 6, reserve: 3 });
    expect(r2.put.map((x) => x.key)).toEqual(['trade:1:b']);
    expect(r2.deferred).toEqual([]);
  });

  it('하루 누적이 dailyCap 에 닿으면 trade 는 미루고 나머지는 쓴다. 날짜가 바뀌면 누적을 새로 센다', () => {
    const prev = { date: '2026-11-07', used: 795, hashes: {} };
    const r = selectKvWrites([w('trade:1:a'), w('home')], prev, { today: '2026-11-07' });
    expect(r.put.map((x) => x.key)).toEqual(['home']);
    expect(r.deferred).toEqual(['trade:1:a']);
    const next = selectKvWrites([w('trade:1:a'), w('home')], { ...prev, date: '2026-11-06' }, { today: '2026-11-07' });
    expect(next.put.map((x) => x.key)).toEqual(['home', 'trade:1:a']);
    expect(next.manifest).toMatchObject({ date: '2026-11-07', used: 5 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sync-bundles.test.ts`
Expected: FAIL — `Cannot find module '../sync/bundles'`

- [ ] **Step 3: Write minimal implementation**

```ts
// file: sync/bundles.ts
// D1 행 → 화면용 KV 묶음 (spec §6), 바뀐 묶음만 고르는 쓰기 예산 (spec §10). 순수 함수
import type { DbRow } from '../src/lib/raw';
import { aptPhase, type AptSchedule } from '../src/lib/apt/status';
import { aptEvents, groupByMonth, type CalendarEvent } from '../src/lib/apt/schedule';
import { nearbyPrice, type TradeRecord } from '../src/lib/trade/nearby';
import { SIDO_ALIAS } from '../src/lib/region/lawd';
import { addMonths } from '../src/lib/date';
import { fnv64 } from '../src/lib/hash';

export interface Dataset {
  notices: DbRow[]; models: DbRow[]; competition: DbRow[]; special: DbRow[];
  trades: DbRow[]; presale: DbRow[]; presaleLinks: DbRow[];
  lhNotices: DbRow[]; lhSupply: DbRow[]; account: DbRow[];
}
export interface KvWrite { key: string; value: string }
export interface BundleCtx { today: string; cityOf: ReadonlyMap<string, string> }

export const MAX_VALUE_BYTES = 50_000;
const HOME_DAYS = 7;
const TOP_N = 10;
const COMPETITION_MAX = 200;

const s = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const n = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const bytes = (v: string): number => new TextEncoder().encode(v).length;

function strip(r: DbRow): DbRow {
  const { hash: _h, updated_at: _u, ...rest } = r;
  return rest;
}

function groupBy(rows: DbRow[], key: (r: DbRow) => string | null): Map<string, DbRow[]> {
  const out = new Map<string, DbRow[]>();
  for (const r of rows) {
    const k = key(r);
    if (k === null) continue;
    const list = out.get(k);
    if (list) list.push(r);
    else out.set(k, [r]);
  }
  return out;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function scheduleOf(r: DbRow): AptSchedule {
  return {
    specialStart: s(r.special_start), specialEnd: s(r.special_end),
    rank1Start: s(r.rank1_start), rank1End: s(r.rank1_end),
    rank2Start: s(r.rank2_start), rank2End: s(r.rank2_end),
    winnerDate: s(r.winner_date), contractStart: s(r.contract_start), contractEnd: s(r.contract_end),
  };
}

const stateOf = (v: unknown): 'normal' | 'corrected' | 'cancelled' => (v === 'corrected' || v === 'cancelled' ? v : 'normal');

export function fitValue(obj: Record<string, unknown>, listKey: string): string {
  let json = JSON.stringify(obj);
  if (bytes(json) < MAX_VALUE_BYTES) return json;
  const list = [...((obj[listKey] as unknown[] | undefined) ?? [])];
  while (list.length > 0) {
    list.length = Math.min(list.length - 1, Math.floor(list.length * 0.9));
    json = JSON.stringify({ ...obj, [listKey]: list, truncated: true });
    if (bytes(json) < MAX_VALUE_BYTES) return json;
  }
  throw new Error(`KV 값이 50KB 를 넘음 (${listKey} 를 다 덜어도)`);
}

const toTradeRecord = (r: DbRow): TradeRecord => ({
  lawdCd: s(r.lawd_cd) ?? '', dong: s(r.dong) ?? '', area: n(r.area) ?? 0, contractDate: s(r.contract_date) ?? '',
  amount: n(r.amount) ?? 0, buildYear: n(r.build_year), cancelled: r.cancelled === 1,
});

interface CompSummary { pblancNo: string; name: string | null; sido: string | null; sigungu: string | null; noticeDate: string | null; maxRate: number | null; applicants: number; supply: number }

function competitionSummaries(ds: Dataset): CompSummary[] {
  const byNotice = groupBy(ds.competition, (r) => s(r.pblanc_no));
  const out: CompSummary[] = [];
  for (const nt of ds.notices) {
    const rows = byNotice.get(s(nt.pblanc_no) ?? '');
    if (!rows) continue;
    const rates = rows.map((r) => n(r.rate)).filter((v): v is number => v !== null);
    out.push({
      pblancNo: s(nt.pblanc_no)!, name: s(nt.name), sido: s(nt.sido), sigungu: s(nt.sigungu), noticeDate: s(nt.notice_date),
      maxRate: rates.length ? Math.max(...rates) : null,
      applicants: rows.reduce((a, r) => a + (n(r.applicants) ?? 0), 0),
      supply: rows.reduce((a, r) => a + (n(r.supply_count) ?? 0), 0),
    });
  }
  return out.sort((a, b) => (b.noticeDate ?? '').localeCompare(a.noticeDate ?? '') || a.pblancNo.localeCompare(b.pblancNo));
}

function lhEvent(r: DbRow): CalendarEvent[] {
  const start = s(r.receipt_start);
  if (!start) return [];
  const end = s(r.receipt_end);
  return [{ date: start, ...(end && end !== start ? { endDate: end } : {}), kind: 'lh-receipt', ref: `lh:${s(r.lh_id)}`, title: s(r.title) ?? '' }];
}

function sidoOfRegion(region: string): string {
  const w = region.split(' ')[0];
  return SIDO_ALIAS[w] ?? w;
}

export function buildBundles(ds: Dataset, ctx: BundleCtx): KvWrite[] {
  const { today, cityOf } = ctx;
  const out: KvWrite[] = [];
  const put = (key: string, obj: Record<string, unknown>, listKey: string) => out.push({ key, value: fitValue(obj, listKey) });

  const tradeFrom = addMonths(today, -12);
  const recentTrades = ds.trades.filter((r) => (s(r.contract_date) ?? '') >= tradeFrom && (s(r.contract_date) ?? '') <= today);
  const tradeRecords = recentTrades.map(toTradeRecord);
  const modelsBy = groupBy(ds.models, (r) => s(r.pblanc_no));
  const compBy = groupBy(ds.competition, (r) => s(r.pblanc_no));
  const specialBy = groupBy(ds.special, (r) => s(r.pblanc_no));
  const presaleByKey = new Map(ds.presale.map((r) => [s(r.trade_key) ?? '', r]));
  const presaleBy = groupBy(ds.presaleLinks, (r) => s(r.pblanc_no));
  const lhBy = groupBy(ds.lhNotices, (r) => s(r.pblanc_no));
  const lhSupplyBy = groupBy(ds.lhSupply, (r) => s(r.lh_id));
  const unmatchedLh = ds.lhNotices.filter((r) => s(r.pblanc_no) === null);

  // apt:{공고번호}
  const phaseOf = new Map<string, string>();
  for (const nt of ds.notices) {
    const no = s(nt.pblanc_no);
    if (!no) continue;
    const { phase, corrected } = aptPhase(scheduleOf(nt), stateOf(nt.state), today);
    phaseOf.set(no, phase);
    const lawdCd = s(nt.lawd_cd);
    const models = (modelsBy.get(no) ?? []).map((m) => {
      const area = n(m.area_excl);
      return { ...strip(m), nearby: lawdCd && area !== null ? nearbyPrice({ lawdCd, dong: s(nt.dong), area }, tradeRecords, today, cityOf) : null };
    });
    const presale = (presaleBy.get(no) ?? [])
      .map((l) => presaleByKey.get(s(l.trade_key) ?? ''))
      .filter((r): r is DbRow => r !== undefined)
      .map(strip)
      .sort((a, b) => (s(b.contract_date) ?? '').localeCompare(s(a.contract_date) ?? ''));
    put(`apt:${no}`, {
      notice: strip(nt), phase, corrected, models,
      competition: (compBy.get(no) ?? []).map(strip),
      special: (specialBy.get(no) ?? []).map(strip),
      lhLinks: (lhBy.get(no) ?? []).map((l) => ({ lhId: s(l.lh_id), title: s(l.title), url: s(l.url) })),
      presale,
    }, 'presale');
  }

  // lh:{ID} — 청약홈 공고와 못 맞춘 LH 공고
  for (const lh of unmatchedLh) {
    const id = s(lh.lh_id);
    if (!id) continue;
    put(`lh:${id}`, { notice: strip(lh), supply: (lhSupplyBy.get(id) ?? []).map(strip) }, 'supply');
  }

  // calendar:YYYY-MM
  const events: CalendarEvent[] = [
    ...ds.notices.flatMap((nt) => aptEvents(`apt:${s(nt.pblanc_no)}`, s(nt.name) ?? '', scheduleOf(nt))),
    ...unmatchedLh.flatMap(lhEvent),
  ];
  for (const [month, list] of Object.entries(groupByMonth(events))) put(`calendar:${month}`, { month, events: list }, 'events');

  // home, competition
  const until = addDays(today, HOME_DAYS);
  const homeEvents = [...events]
    .filter((e) => e.date <= until && (e.endDate ?? e.date) >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.ref.localeCompare(b.ref));
  const summaries = competitionSummaries(ds);
  const recentFrom = addMonths(today, -2);
  const top = summaries
    .filter((c) => c.maxRate !== null && (c.noticeDate ?? '') >= recentFrom)
    .sort((a, b) => (b.maxRate ?? 0) - (a.maxRate ?? 0))
    .slice(0, TOP_N);
  put('home', { today, events: homeEvents, topCompetition: top }, 'events');
  put('competition', { items: summaries.slice(0, COMPETITION_MAX) }, 'items');

  // stats:account (최신 기준월)
  const latest = ds.account.reduce((m, r) => ((s(r.base_month) ?? '') > m ? (s(r.base_month) ?? '') : m), '');
  const accountRows = ds.account.filter((r) => s(r.base_month) === latest).map(strip);
  put('stats:account', { baseMonth: latest || null, rows: accountRows }, 'rows');

  // region:{시도}, region:{시도}:{시군구}
  const noticeSummary = (nt: DbRow) => ({ pblancNo: s(nt.pblanc_no), name: s(nt.name), sigungu: s(nt.sigungu), noticeDate: s(nt.notice_date), phase: phaseOf.get(s(nt.pblanc_no) ?? '') ?? null });
  const bySido = groupBy(ds.notices, (r) => s(r.sido));
  for (const [sido, list] of bySido) {
    put(`region:${sido}`, {
      sido,
      notices: list.map(noticeSummary).sort((a, b) => (b.noticeDate ?? '').localeCompare(a.noticeDate ?? '')),
      account: accountRows.filter((r) => sidoOfRegion(s(r.region) ?? '') === sido),
    }, 'notices');
  }
  const tradesByLawd = groupBy(recentTrades, (r) => s(r.lawd_cd));
  const bySigungu = groupBy(ds.notices, (r) => (s(r.sido) && s(r.sigungu) ? `${s(r.sido)}:${s(r.sigungu)}` : null));
  for (const [key, list] of bySigungu) {
    const lawds = [...new Set(list.map((r) => s(r.lawd_cd)).filter((v): v is string => v !== null))];
    const dongs = lawds.flatMap((lawdCd) =>
      [...groupBy(tradesByLawd.get(lawdCd) ?? [], (r) => s(r.dong))].map(([dong, rows]) => ({
        lawdCd, dong, count: rows.length,
        last: rows.reduce((m, r) => ((s(r.contract_date) ?? '') > m ? (s(r.contract_date) ?? '') : m), ''),
      })),
    ).sort((a, b) => b.count - a.count || a.dong.localeCompare(b.dong));
    put(`region:${key}`, { notices: list.map(noticeSummary), dongs }, 'dongs');
  }

  // trade:{시군구코드}:{법정동}
  for (const [k, rows] of groupBy(recentTrades, (r) => (s(r.lawd_cd) && s(r.dong) ? `${s(r.lawd_cd)}:${s(r.dong)}` : null))) {
    const [lawdCd, dong] = k.split(':');
    const complexes = [...groupBy(rows, (r) => s(r.name))].map(([name, list]) => ({
      name,
      buildYear: n(list[0].build_year),
      trades: list
        .map((r) => ({ date: s(r.contract_date), area: n(r.area), floor: n(r.floor), amount: n(r.amount), cancelled: r.cancelled === 1 }))
        .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')),
    })).sort((a, b) => (b.trades[0].date ?? '').localeCompare(a.trades[0].date ?? '') || a.name.localeCompare(b.name));
    put(`trade:${k}`, { lawdCd, dong, complexes }, 'complexes');
  }

  return out;
}

export interface KvManifest { date: string; used: number; hashes: Record<string, string> }

export function selectKvWrites(
  writes: KvWrite[],
  prev: KvManifest | null,
  opts: { today: string; budget?: number; dailyCap?: number; reserve?: number },
): { put: KvWrite[]; deferred: string[]; manifest: KvManifest } {
  const budget = opts.budget ?? 400;
  const dailyCap = opts.dailyCap ?? 800;
  const reserve = opts.reserve ?? 3;
  const used = prev && prev.date === opts.today ? prev.used : 0;
  const hashes = { ...(prev?.hashes ?? {}) };
  const changed = writes.map((w) => ({ w, h: fnv64(w.value) })).filter(({ w, h }) => hashes[w.key] !== h);
  const ordered = [...changed.filter(({ w }) => !w.key.startsWith('trade:')), ...changed.filter(({ w }) => w.key.startsWith('trade:'))];
  const put: KvWrite[] = [];
  const deferred: string[] = [];
  for (const { w, h } of ordered) {
    const isTrade = w.key.startsWith('trade:');
    const fits = put.length + reserve < budget && (!isTrade || used + put.length + reserve < dailyCap);
    if (!fits) {
      deferred.push(w.key);
      continue;
    }
    put.push(w);
    hashes[w.key] = h;
  }
  return { put, deferred, manifest: { date: opts.today, used: used + put.length + reserve, hashes } };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/sync-bundles.test.ts`
Expected: PASS (1 file, 10 tests)

- [ ] **Step 5: Commit**

```bash
git add sync/bundles.ts tests/sync-bundles.test.ts
git commit -m "동기화: KV 묶음 만들기와 쓰기 예산"
```

---

### Task 8: 수집기·픽스처 응답·실패 기록·백필

**Files:**
- Create: `sync/collect.ts`, `sync/fixture-fetch.ts`, `sync/failures.ts`, `sync/backfill.ts`, `sync/cloudflare.ts`
- Test: `tests/sync-collect.test.ts`, `tests/sync-failures.test.ts`

**Interfaces:**
- Consumes: `serviceKeyParam` (`sync/http.ts`), `Raw`·`DbRow`, `toNoticeRow`·`toModelRow` (Task 2), `toCompetitionRow`·`toSpecialStatusRows` (Task 3), `parseMolitXml`·`toTradeRows`·`toPresaleRows` (Task 4), `mergeLh`·`lhListItems`·`toLhNoticeRow`·`toLhSupplyRows` (Task 5), `toAccountRows` (Task 6), `LawdIndex`, `LawdTable`, `addMonths`
- Produces:
  - `type Fetch = (url: string) => Promise<{ status: number; body: string }>`
  - `odcloudAll(fetch: Fetch, key: string, path: string, cond: Record<string, string>, maxPages = 20): Promise<Raw[]>`
  - `collectApplyhome(fetch, key, today, idx): Promise<{ notices: DbRow[]; models: DbRow[] }>`
  - `collectCompetition(fetch, key, minHouseNo: string, modelNoOf): Promise<{ competition: DbRow[]; special: DbRow[] }>`
  - `collectLh(fetch, key, idx): Promise<{ notices: DbRow[]; supply: DbRow[] }>`
  - `interface TradeJob { lawd: string; ym: string }`, `collectTrades(fetch, key, jobs: TradeJob[]): Promise<{ trades: DbRow[]; presale: DbRow[] }>`
  - `collectAccount(fetch, key, today): Promise<DbRow[]>`
  - `fixtureFetch(dir: string): Fetch`
  - `interface SourceMeta { lastSuccess: string | null; failures: number; lastCount: number | null; lastError?: string }`, `type SourceResult = { ok: true; count: number } | { ok: false; error: string }`, `nextMeta(prev: SourceMeta | undefined, r: SourceResult, now: string): SourceMeta`, `ALERT_AFTER = 3`
  - `sigunguCodes(table: LawdTable): string[]`, `interface BackfillState { base: string; index: number }`, `nextBackfill(state: BackfillState | null, lawds: string[], today: string, max: number): { jobs: TradeJob[]; state: BackfillState; done: boolean }`, `recentMonths(today: string): string[]` (이번 달·지난달 YYYYMM)
  - `sync/cloudflare.ts`: 지원금다모아 `sync/cloudflare.ts` 와 같은 `CfTarget`, `d1Query`, `d1ExecFile`, `kvGetText`, `kvBulkPut`

출처 호출 규칙:
- odcloud 는 perPage 500. 빈 페이지이거나 matchCount 에 닿으면 멈춘다. maxPages 에 닿았는데 남았으면 오류 (조용히 잘리지 않게).
- 공고: `RCRIT_PBLANC_DE::GTE` = 오늘−2개월. 주택형·경쟁률·특공: `HOUSE_MANAGE_NO::GTE` = 받은 공고 중 가장 작은 주택관리번호 (공고마다 부르지 않는다).
- LH: 분양(05)·임대(06) 목록 1쪽(50건)씩, 항목마다 상세·공급. 상세·공급 하나가 실패하면 그 항목만 빈 값으로 (목록이 실패하면 출처 실패). 하루 2회 × 100건 = API별 하루 200회.
- 국토부: 작업(시군구 5자리 × 연월)마다 실거래·분양권 두 API, numOfRows 1000 으로 totalCount 까지. resultCode 가 `000`·`00` 이 아니면 오류.
- 통장 통계: `DELNG_OCCRRNC_YM::GTE` = 3개월 전 YYYYMM.
- 백필: 기준월(첫 실행의 지난달)부터 12개월 × 전국 시군구. 월 우선 순서(최근 달의 전국을 먼저), 실행당 max 개 작업.

- [ ] **Step 1: Write the failing test**

```ts
// file: tests/sync-collect.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { odcloudAll, collectApplyhome, collectCompetition, collectLh, collectTrades, collectAccount, type Fetch } from '../sync/collect';
import { fixtureFetch } from '../sync/fixture-fetch';
import { sigunguCodes, nextBackfill, recentMonths } from '../sync/backfill';
import { buildLawdIndex, type LawdTable } from '../src/lib/region/lawd';

const table: LawdTable = JSON.parse(readFileSync('content/lawd/lawd.json', 'utf8'));
const idx = buildLawdIndex(table);
const fx = fixtureFetch('sync/fixtures');
const KEY = 'FIXTURE';

describe('odcloudAll', () => {
  it('matchCount 에 닿거나 빈 페이지면 멈추고, 조건을 cond[필드::연산] 로 붙인다', async () => {
    const urls: string[] = [];
    const fetch: Fetch = async (url) => {
      urls.push(url);
      const page = Number(new URL(url).searchParams.get('page'));
      return { status: 200, body: JSON.stringify({ data: page === 1 ? [{ a: 1 }, { a: 2 }] : [{ a: 3 }], matchCount: 3 }) };
    };
    const rows = await odcloudAll(fetch, 'k', 'Svc/v1/op', { 'RCRIT_PBLANC_DE::GTE': '2026-09-07' });
    expect(rows).toHaveLength(3);
    expect(urls).toHaveLength(2);
    expect(urls[0]).toContain(`&${encodeURIComponent('cond[RCRIT_PBLANC_DE::GTE]')}=2026-09-07`);
    expect(urls[0]).toContain('perPage=500');
  });

  it('HTTP 오류와 페이지 상한 초과는 던진다', async () => {
    await expect(odcloudAll(async () => ({ status: 500, body: 'x' }), 'k', 'p', {})).rejects.toThrow('HTTP 500');
    const endless: Fetch = async () => ({ status: 200, body: JSON.stringify({ data: [{ a: 1 }], matchCount: 999 }) });
    await expect(odcloudAll(endless, 'k', 'p', {}, 2)).rejects.toThrow('페이지 상한');
  });
});

describe('픽스처로 출처별 수집', () => {
  it('청약홈 공고 3건과 주택형', async () => {
    const r = await collectApplyhome(fx, KEY, '2026-11-07', idx);
    expect(r.notices.map((n) => n.pblanc_no).sort()).toEqual(['2026000553', '2026000557', '2026820015']);
    expect(r.models.length).toBeGreaterThan(0);
  });

  it('경쟁률·특공', async () => {
    const r = await collectCompetition(fx, KEY, '2026000553', () => '01');
    expect(r.competition.length).toBeGreaterThan(0);
    expect(r.special.length).toBeGreaterThan(0);
  });

  it('LH 공고: 분양·임대 목록과 상세·공급, 상세가 실패해도 목록 항목은 남는다', async () => {
    const r = await collectLh(fx, KEY, idx);
    expect(r.notices.length).toBeGreaterThan(0);
    const noDetail: Fetch = async (url) => (url.includes('getLeaseNoticeDtlInfo1') ? { status: 500, body: 'x' } : fx(url));
    const r2 = await collectLh(noDetail, KEY, idx);
    expect(r2.notices.length).toBe(r.notices.length);
  });

  it('국토부 실거래·분양권: 픽스처가 있는 작업만 행이 나온다', async () => {
    const r = await collectTrades(fx, KEY, [{ lawd: '11680', ym: '202610' }, { lawd: '41117', ym: '202610' }, { lawd: '11110', ym: '202610' }]);
    expect(r.trades.length).toBeGreaterThan(0);
    expect(r.trades.every((t) => t.lawd_cd === '11680')).toBe(true);
    expect(r.presale.length).toBeGreaterThan(0);
  });

  it('국토부 resultCode 오류는 던진다', async () => {
    const bad: Fetch = async () => ({ status: 200, body: '<response><header><resultCode>30</resultCode><resultMsg>KEY ERROR</resultMsg></header></response>' });
    await expect(collectTrades(bad, KEY, [{ lawd: '11680', ym: '202610' }])).rejects.toThrow('resultCode 30');
  });

  it('통장 통계', async () => {
    expect((await collectAccount(fx, KEY, '2026-11-07')).length).toBeGreaterThan(0);
  });
});

describe('백필', () => {
  it('시군구 코드는 5자리, 시도·읍면동은 빠진다', () => {
    const codes = sigunguCodes(table);
    expect(codes).toContain('11680');
    expect(codes).toContain('41117');
    expect(codes).not.toContain('11000');
    expect(codes.every((c) => c.length === 5)).toBe(true);
  });

  it('최근 달의 전국부터, 실행당 max 개씩 이어 간다', () => {
    const lawds = ['11110', '11140', '11680'];
    const a = nextBackfill(null, lawds, '2026-11-07', 4);
    expect(a.jobs).toEqual([
      { lawd: '11110', ym: '202610' }, { lawd: '11140', ym: '202610' }, { lawd: '11680', ym: '202610' }, { lawd: '11110', ym: '202609' },
    ]);
    expect(a.state).toEqual({ base: '202610', index: 4 });
    const b = nextBackfill(a.state, lawds, '2026-12-20', 100);
    expect(b.jobs).toHaveLength(32);
    expect(b.jobs.at(-1)).toEqual({ lawd: '11680', ym: '202511' });
    expect(b.done).toBe(true);
    expect(nextBackfill(b.state, lawds, '2026-12-20', 100).jobs).toEqual([]);
  });

  it('최근 두 달', () => {
    expect(recentMonths('2026-01-15')).toEqual(['202601', '202512']);
  });
});
```

```ts
// file: tests/sync-failures.test.ts
import { describe, it, expect } from 'vitest';
import { nextMeta, ALERT_AFTER } from '../sync/failures';

describe('nextMeta', () => {
  it('성공은 실패 수를 0 으로, 건수·시각을 기록', () => {
    expect(nextMeta({ lastSuccess: null, failures: 2, lastCount: 5, lastError: 'x' }, { ok: true, count: 7 }, '2026-11-07T19:00:00Z'))
      .toEqual({ lastSuccess: '2026-11-07T19:00:00Z', failures: 0, lastCount: 7 });
  });
  it('실패는 실패 수를 늘리고 직전 성공 기록은 둔다', () => {
    const m = nextMeta(undefined, { ok: false, error: 'HTTP 500' }, 'now');
    expect(m).toEqual({ lastSuccess: null, failures: 1, lastCount: null, lastError: 'HTTP 500' });
    const m3 = nextMeta(nextMeta(m, { ok: false, error: 'e' }, 'now'), { ok: false, error: 'e3' }, 'now');
    expect(m3.failures).toBe(ALERT_AFTER);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sync-collect.test.ts tests/sync-failures.test.ts`
Expected: FAIL — `Cannot find module '../sync/collect'`, `'../sync/failures'`

- [ ] **Step 3: Write minimal implementation**

```ts
// file: sync/collect.ts
// 출처별 수집 (spec §3). fetch 는 주입한다 — 실서버는 sync/http.ts getText, 시험은 sync/fixture-fetch.ts
import { serviceKeyParam } from './http';
import type { Raw, DbRow } from '../src/lib/raw';
import type { LawdIndex } from '../src/lib/region/lawd';
import { addMonths } from '../src/lib/date';
import { toNoticeRow, toModelRow } from '../src/lib/apt/notice-transform';
import { toCompetitionRow, toSpecialStatusRows } from '../src/lib/apt/competition-transform';
import { parseMolitXml, toTradeRows, toPresaleRows } from '../src/lib/trade/trade-transform';
import { mergeLh, lhListItems, toLhNoticeRow, toLhSupplyRows } from '../src/lib/apt/lh-transform';
import { toAccountRows } from '../src/lib/stats/account-transform';

export type Fetch = (url: string) => Promise<{ status: number; body: string }>;

const OD = 'https://api.odcloud.kr/api';
const MOLIT = 'https://apis.data.go.kr/1613000';
const LH = 'https://apis.data.go.kr/B552555';
const PER_PAGE = 500;
const MOLIT_ROWS = 1000;
const LH_PAGE = 50;

async function getBody(fetch: Fetch, url: string): Promise<string> {
  const r = await fetch(url);
  if (r.status !== 200) throw new Error(`HTTP ${r.status}: ${r.body.slice(0, 200)}`);
  return r.body;
}

async function getJson(fetch: Fetch, url: string): Promise<unknown> {
  const body = await getBody(fetch, url);
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`JSON 아님: ${body.slice(0, 200)}`);
  }
}

export async function odcloudAll(fetch: Fetch, key: string, path: string, cond: Record<string, string>, maxPages = 20): Promise<Raw[]> {
  const conds = Object.entries(cond).map(([k, v]) => `&${encodeURIComponent(`cond[${k}]`)}=${encodeURIComponent(v)}`).join('');
  const out: Raw[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const j = (await getJson(fetch, `${OD}/${path}?serviceKey=${serviceKeyParam(key)}&page=${page}&perPage=${PER_PAGE}${conds}`)) as { data?: unknown; matchCount?: unknown };
    const data = Array.isArray(j.data) ? (j.data as Raw[]) : [];
    out.push(...data);
    const total = typeof j.matchCount === 'number' ? j.matchCount : 0;
    if (data.length === 0 || out.length >= total) return out;
  }
  throw new Error(`${path}: 페이지 상한 ${maxPages} 초과`);
}

const notNull = <T>(v: T | null): v is T => v !== null;

export async function collectApplyhome(fetch: Fetch, key: string, today: string, idx: LawdIndex): Promise<{ notices: DbRow[]; models: DbRow[] }> {
  const raws = await odcloudAll(fetch, key, 'ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancDetail', { 'RCRIT_PBLANC_DE::GTE': addMonths(today, -2) });
  const notices = raws.map((r) => toNoticeRow(r, idx)).filter(notNull);
  if (notices.length === 0) return { notices, models: [] };
  const minNo = minHouseNo(notices);
  const models = (await odcloudAll(fetch, key, 'ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancMdl', { 'HOUSE_MANAGE_NO::GTE': minNo }))
    .map(toModelRow).filter(notNull);
  return { notices, models };
}

export function minHouseNo(notices: DbRow[]): string {
  return notices.map((n) => String(n.house_manage_no ?? '')).filter(Boolean).sort()[0] ?? '0';
}

export async function collectCompetition(
  fetch: Fetch, key: string, minNo: string, modelNoOf: (pblancNo: string, houseTy: string) => string | null,
): Promise<{ competition: DbRow[]; special: DbRow[] }> {
  const cond = { 'HOUSE_MANAGE_NO::GTE': minNo };
  const competition = (await odcloudAll(fetch, key, 'ApplyhomeInfoCmpetRtSvc/v1/getAPTLttotPblancCmpet', cond)).map(toCompetitionRow).filter(notNull);
  const special = (await odcloudAll(fetch, key, 'ApplyhomeInfoCmpetRtSvc/v1/getAPTSpsplyReqstStus', cond)).flatMap((r) => toSpecialStatusRows(r, modelNoOf));
  return { competition, special };
}

export async function collectLh(fetch: Fetch, key: string, idx: LawdIndex): Promise<{ notices: DbRow[]; supply: DbRow[] }> {
  const k = serviceKeyParam(key);
  const notices: DbRow[] = [];
  const supply: DbRow[] = [];
  for (const tp of ['05', '06']) {
    const list = lhListItems(await getJson(fetch, `${LH}/lhLeaseNoticeInfo1/lhLeaseNoticeInfo1?serviceKey=${k}&PG_SZ=${LH_PAGE}&PAGE=1&UPP_AIS_TP_CD=${tp}`));
    for (const item of list) {
      const q = ['SPL_INF_TP_CD', 'CCR_CNNT_SYS_DS_CD', 'PAN_ID', 'UPP_AIS_TP_CD']
        .map((f) => `&${f}=${encodeURIComponent(String(item[f] ?? ''))}`).join('');
      const detail = await getJson(fetch, `${LH}/lhLeaseNoticeDtlInfo1/getLeaseNoticeDtlInfo1?serviceKey=${k}${q}`).then(mergeLh, () => null);
      const row = toLhNoticeRow(item, detail, idx);
      if (!row) continue;
      notices.push(row);
      const spl = await getJson(fetch, `${LH}/lhLeaseNoticeSplInfo1/getLeaseNoticeSplInfo1?serviceKey=${k}${q}`).then(mergeLh, () => null);
      if (spl) supply.push(...toLhSupplyRows(String(row.lh_id), spl));
    }
  }
  return { notices, supply };
}

export interface TradeJob { lawd: string; ym: string }

async function molitAll(fetch: Fetch, key: string, path: string, job: TradeJob): Promise<Raw[]> {
  const out: Raw[] = [];
  for (let page = 1; page <= 50; page++) {
    const xml = await getBody(fetch, `${MOLIT}/${path}?serviceKey=${serviceKeyParam(key)}&LAWD_CD=${job.lawd}&DEAL_YMD=${job.ym}&numOfRows=${MOLIT_ROWS}&pageNo=${page}`);
    const r = parseMolitXml(xml);
    if (r.resultCode !== '000' && r.resultCode !== '00') throw new Error(`${path} ${job.lawd}/${job.ym}: resultCode ${r.resultCode}`);
    out.push(...r.items);
    if (r.items.length === 0 || out.length >= r.totalCount) return out;
  }
  throw new Error(`${path} ${job.lawd}/${job.ym}: 페이지 상한 초과`);
}

export async function collectTrades(fetch: Fetch, key: string, jobs: TradeJob[]): Promise<{ trades: DbRow[]; presale: DbRow[] }> {
  const trades: DbRow[] = [];
  const presale: DbRow[] = [];
  for (const job of jobs) {
    trades.push(...toTradeRows(await molitAll(fetch, key, 'RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev', job)));
    presale.push(...toPresaleRows(await molitAll(fetch, key, 'RTMSDataSvcSilvTrade/getRTMSDataSvcSilvTrade', job)));
  }
  return { trades, presale };
}

export async function collectAccount(fetch: Fetch, key: string, today: string): Promise<DbRow[]> {
  const cond = { 'DELNG_OCCRRNC_YM::GTE': addMonths(today, -3).slice(0, 7).replace('-', '') };
  const svc = 'ApplyhomeBnkbStatSvc/v1';
  const all = await odcloudAll(fetch, key, `${svc}/getBnkbAcnutAllStat`, cond);
  const deposit = await odcloudAll(fetch, key, `${svc}/getBnkbAcnutDpstStat`, cond);
  const subscribe = await odcloudAll(fetch, key, `${svc}/getBnkbAcnutSbscrbStat`, cond);
  return toAccountRows(all, deposit, subscribe);
}
```

Task 2~6 이 만든 변환 모듈 경로가 위 import 와 다르면 실제 경로로 맞추고 ledger 에 Ruling 으로 남긴다.

```ts
// file: sync/fixture-fetch.ts
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
```

```ts
// file: sync/failures.ts
// 출처별 마지막 성공·연속 실패 (spec §10). 3회 연속 실패면 GitHub 이슈
export interface SourceMeta { lastSuccess: string | null; failures: number; lastCount: number | null; lastError?: string }
export type SourceResult = { ok: true; count: number } | { ok: false; error: string };
export const ALERT_AFTER = 3;

export function nextMeta(prev: SourceMeta | undefined, r: SourceResult, now: string): SourceMeta {
  if (r.ok) return { lastSuccess: now, failures: 0, lastCount: r.count };
  return { lastSuccess: prev?.lastSuccess ?? null, failures: (prev?.failures ?? 0) + 1, lastCount: prev?.lastCount ?? null, lastError: r.error.slice(0, 500) };
}
```

```ts
// file: sync/backfill.ts
// 실거래 백필 (spec §3): 12개월 × 전국 시군구를 실행마다 조금씩. 진행 위치는 KV backfill:trade
import type { LawdTable } from '../src/lib/region/lawd';
import { addMonths } from '../src/lib/date';
import type { TradeJob } from './collect';

export const BACKFILL_MONTHS = 12;
export interface BackfillState { base: string; index: number }

const ymOf = (date: string): string => date.slice(0, 7).replace('-', '');

export function recentMonths(today: string): string[] {
  return [ymOf(today), ymOf(addMonths(today, -1))];
}

export function sigunguCodes(table: LawdTable): string[] {
  return [...new Set(table
    .map(([code]) => code)
    .filter((c) => c.slice(5) === '00000' && c.slice(2, 5) !== '000')
    .map((c) => c.slice(0, 5)))].sort();
}

export function nextBackfill(state: BackfillState | null, lawds: string[], today: string, max: number): { jobs: TradeJob[]; state: BackfillState; done: boolean } {
  const base = state?.base ?? ymOf(addMonths(today, -1));
  const baseDate = `${base.slice(0, 4)}-${base.slice(4)}-01`;
  const months = Array.from({ length: BACKFILL_MONTHS }, (_, i) => ymOf(addMonths(baseDate, -i)));
  const all = months.flatMap((ym) => lawds.map((lawd) => ({ lawd, ym })));
  const start = Math.min(state?.index ?? 0, all.length);
  const end = Math.min(all.length, start + max);
  return { jobs: all.slice(start, end), state: { base, index: end }, done: end >= all.length };
}
```

```ts
// file: sync/cloudflare.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/sync-collect.test.ts tests/sync-failures.test.ts`
Expected: PASS (2 files)

- [ ] **Step 5: Commit**

```bash
git add sync/collect.ts sync/fixture-fetch.ts sync/failures.ts sync/backfill.ts sync/cloudflare.ts tests/sync-collect.test.ts tests/sync-failures.test.ts
git commit -m "동기화: 출처별 수집기·픽스처 응답·실패 기록·실거래 백필"
```

---

### Task 9: 동기화 진입점·저장소·워크플로

**Files:**
- Create: `sync/store.ts`, `sync/main.ts`, `.github/workflows/sync.yml`
- Modify: `package.json` (scripts 에 `"sync": "node --env-file-if-exists=.env --import tsx sync/main.ts"`)
- Test: `tests/sync-main.test.ts`

**Interfaces:**
- Consumes: Task 1 (`upsertSql`, `withHash`, `keyBy`, `diffRows`, `hashQuerySql`, `guardCount`, `redactKeys`), Task 7 (`buildBundles`, `selectKvWrites`, `KvWrite`, `KvManifest`, `Dataset`), Task 8 (수집기, `fixtureFetch`, `nextMeta`, `ALERT_AFTER`, `nextBackfill`, `sigunguCodes`, `recentMonths`, `minHouseNo`, `cloudflare.ts`), `matchLh`, `matchPresale`, `extractJibun`, `resolveAddress`, `buildLawdIndex`
- Produces:
  - `interface Store { query<T = Record<string, unknown>>(sql: string): Promise<T[]>; exec(statements: string[]): Promise<void>; kvGet(key: string): Promise<string | null>; kvPut(writes: KvWrite[]): Promise<void> }`
  - `sqliteStore(migrationsDir = 'migrations'): Store & { kv: Map<string, string> }` — `node:sqlite` 메모리 DB, 시험용
  - `wranglerStore(target: CfTarget, outDir: string, dryRun: boolean): Store`
  - `TABLES: Record<string, string[]>` — 표 → 키 열
  - `runSync(o: { store: Store; fetch: Fetch; keys: string[]; today: string; now: string; lawdTable: LawdTable; backfillMax?: number }): Promise<SyncReport>`
  - `interface SyncReport { sources: Record<SourceName, SourceMeta & { applied: boolean; reason?: string }>; rowsWritten: number; kvPut: number; kvDeferred: number; alerts: string[] }`

흐름 (출처 순서: applyhome → competition → lh → trade → account):
1. 출처마다 수집 → 이상치 차단(`guardCount`, 직전 건수는 `meta:sources`) → 바뀐 행만 upsert. 예외·차단은 그 출처만 실패로 기록하고 다음 출처로.
2. 경쟁률·특공의 주택관리번호 하한과 `modelNoOf` 는 D1 의 공고·주택형에서 (청약홈이 실패해도 직전 값으로).
3. LH 분양은 `matchLh` 로 D1 공고와 맞춰 `pblanc_no` 를 채운 뒤 해시.
4. 실거래 작업 = D1 공고 시군구의 최근 두 달 + 백필 다음 묶음. 분양권은 `matchPresale` 로 `presale_link`. 실거래는 작업 집합이 실행마다 달라 직전 건수 비교를 하지 않고, 작업 10개 이상인데 0건일 때만 실패.
5. 한 실행 쓰기 상한 70,000행 — 넘는 행은 이번에 쓰지 않는다 (해시가 달라 다음 실행이 다시 고른다).
6. 묶음은 D1 에서 다시 읽은 값으로 만든다 (실패한 출처는 직전 값 그대로). 공고·LH 는 최근 12개월, 실거래는 공고 시군구(같은 시의 구 포함)와 이번에 바뀐 시군구만.
7. `selectKvWrites` → 고른 묶음 + `meta:sources`·`meta:kvhash`·`backfill:trade` 를 한 번에 쓴다. 백필 위치는 실거래가 성공했을 때만 앞으로.
8. 3회 연속 실패한 출처는 `alerts` 에. CLI 는 `sync/.out/report.json`, 알림이 있으면 `sync/.out/alerts.json`.

- [ ] **Step 1: Write the failing test**

```ts
// file: tests/sync-main.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { runSync, TABLES } from '../sync/main';
import { sqliteStore } from '../sync/store';
import { fixtureFetch } from '../sync/fixture-fetch';
import { collectApplyhome, collectCompetition, collectLh, collectTrades, collectAccount, type Fetch } from '../sync/collect';
import { buildLawdIndex, type LawdTable } from '../src/lib/region/lawd';

const lawdTable: LawdTable = JSON.parse(readFileSync('content/lawd/lawd.json', 'utf8'));
const idx = buildLawdIndex(lawdTable);
const fx = fixtureFetch('sync/fixtures');
const opts = (store: ReturnType<typeof sqliteStore>, fetch: Fetch = fx) => ({
  store, fetch, keys: ['FIXTURE'], today: '2026-11-07', now: '2026-11-07T19:00:00Z', lawdTable, backfillMax: 100_000,
});
const count = async (store: ReturnType<typeof sqliteStore>, table: string) =>
  (await store.query<{ c: number }>(`SELECT COUNT(*) AS c FROM ${table}`))[0].c;
const failOn = (part: string): Fetch => async (url) => (url.includes(part) ? { status: 500, body: 'down' } : fx(url));

describe('변환 행의 열이 D1 스키마와 맞음', () => {
  it('모든 표', async () => {
    const db = new DatabaseSync(':memory:');
    db.exec(readFileSync('migrations/0001_init.sql', 'utf8'));
    const cols = (t: string) => new Set((db.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map((c) => c.name));
    const ah = await collectApplyhome(fx, 'K', '2026-11-07', idx);
    const cp = await collectCompetition(fx, 'K', '0', () => '01');
    const lh = await collectLh(fx, 'K', idx);
    const tr = await collectTrades(fx, 'K', [{ lawd: '11680', ym: '202610' }, { lawd: '41117', ym: '202610' }]);
    const samples: Record<string, Record<string, unknown>[]> = {
      apt_notice: ah.notices, apt_model: ah.models, apt_competition: cp.competition, apt_special_status: cp.special,
      lh_notice: lh.notices.map((r) => ({ ...r, pblanc_no: null })), lh_supply: lh.supply,
      trade: tr.trades, presale_trade: tr.presale, account_stats: await collectAccount(fx, 'K', '2026-11-07'),
      presale_link: [{ trade_key: 'x', pblanc_no: null, method: 'none' }],
    };
    for (const [table, rows] of Object.entries(samples)) {
      expect(rows.length, table).toBeGreaterThan(0);
      const have = cols(table);
      const missing = Object.keys(rows[0]).filter((c) => !have.has(c));
      expect(missing, table).toEqual([]);
      for (const k of TABLES[table]) expect(have.has(k), `${table}.${k}`).toBe(true);
    }
  });
});

describe('runSync (픽스처)', () => {
  it('출처 다섯 곳이 모두 반영되고 묶음과 meta 가 써진다', async () => {
    const store = sqliteStore();
    const r = await runSync(opts(store));
    for (const name of ['applyhome', 'competition', 'lh', 'trade', 'account'] as const) expect(r.sources[name].applied, name).toBe(true);
    expect(await count(store, 'apt_notice')).toBe(3);
    expect(await count(store, 'trade')).toBeGreaterThan(0);
    expect(await count(store, 'presale_link')).toBe(await count(store, 'presale_trade'));
    expect(store.kv.has('apt:2026000557')).toBe(true);
    expect(store.kv.has('home')).toBe(true);
    expect([...store.kv.keys()].some((k) => k.startsWith('trade:11680:'))).toBe(true);
    expect(JSON.parse(store.kv.get('meta:sources')!).applyhome.failures).toBe(0);
    expect(JSON.parse(store.kv.get('backfill:trade')!).index).toBeGreaterThan(0);
    expect(r.alerts).toEqual([]);
  });

  it('두 번째 실행은 바뀐 것이 없으면 행·묶음을 다시 쓰지 않는다', async () => {
    const store = sqliteStore();
    await runSync(opts(store));
    const r2 = await runSync(opts(store));
    expect(r2.rowsWritten).toBe(0);
    expect(r2.kvPut).toBe(0);
  });

  it('실패한 출처는 직전 행으로 묶음을 만든다', async () => {
    const store = sqliteStore();
    await runSync(opts(store));
    const lhKeys = [...store.kv.keys()].filter((k) => k.startsWith('lh:'));
    const before = Object.fromEntries(lhKeys.map((k) => [k, store.kv.get(k)]));
    const r = await runSync(opts(store, failOn('B552555')));
    expect(r.sources.lh.applied).toBe(false);
    expect(r.sources.lh.failures).toBe(1);
    expect(r.sources.applyhome.applied).toBe(true);
    expect(await count(store, 'lh_notice')).toBeGreaterThan(0);
    for (const k of lhKeys) expect(store.kv.get(k)).toBe(before[k]);
  });

  it('받은 건수가 0 이면 그 출처를 반영하지 않는다', async () => {
    const store = sqliteStore();
    await runSync(opts(store));
    const empty: Fetch = async (url) => (url.includes('getAPTLttotPblancDetail') ? { status: 200, body: '{"data":[],"matchCount":0}' } : fx(url));
    const r = await runSync(opts(store, empty));
    expect(r.sources.applyhome).toMatchObject({ applied: false, reason: '0건' });
    expect(await count(store, 'apt_notice')).toBe(3);
  });

  it('같은 출처가 3회 연속 실패하면 알림, 오류 문구에 키가 남지 않는다', async () => {
    const store = sqliteStore();
    const leak: Fetch = async (url) => (url.includes('BnkbAcnut') ? { status: 500, body: `bad key SECRET123` } : fx(url));
    const o = { ...opts(store, leak), keys: ['SECRET123'] };
    expect((await runSync(o)).alerts).toEqual([]);
    expect((await runSync(o)).alerts).toEqual([]);
    const r3 = await runSync(o);
    expect(r3.alerts).toHaveLength(1);
    expect(r3.alerts[0]).toContain('account');
    expect(r3.alerts[0]).not.toContain('SECRET123');
    expect(store.kv.get('meta:sources')).not.toContain('SECRET123');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sync-main.test.ts`
Expected: FAIL — `Cannot find module '../sync/main'`

- [ ] **Step 3: Write minimal implementation**

```ts
// file: sync/store.ts
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
```

```ts
// file: sync/main.ts
// 동기화 진입점 (spec §4·§10): npm run sync -- --target local|remote [--fixtures sync/fixtures] [--dry-run] [--today YYYY-MM-DD]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import type { DbRow } from '../src/lib/raw';
import { buildLawdIndex, resolveAddress, type LawdTable } from '../src/lib/region/lawd';
import { extractJibun } from '../src/lib/region/jibun';
import { matchLh } from '../src/lib/apt/lh-match';
import { matchPresale, type NoticeLoc } from '../src/lib/trade/presale-match';
import { addMonths, todayKst } from '../src/lib/date';
import { upsertSql, type Row } from './sql';
import { withHash, keyBy, diffRows, hashQuerySql, guardCount } from './diff';
import { redactKeys, getText } from './http';
import { buildBundles, selectKvWrites, type Dataset, type KvManifest } from './bundles';
import { collectApplyhome, collectCompetition, collectLh, collectTrades, collectAccount, minHouseNo, type Fetch, type TradeJob } from './collect';
import { fixtureFetch } from './fixture-fetch';
import { nextMeta, ALERT_AFTER, type SourceMeta } from './failures';
import { nextBackfill, sigunguCodes, recentMonths, type BackfillState } from './backfill';
import { wranglerStore, type Store } from './store';

export const TABLES: Record<string, string[]> = {
  apt_notice: ['pblanc_no'],
  apt_model: ['pblanc_no', 'model_no'],
  apt_competition: ['pblanc_no', 'model_no', 'rank', 'residence'],
  apt_special_status: ['pblanc_no', 'model_no', 'special_type', 'residence'],
  trade: ['trade_key'],
  presale_trade: ['trade_key'],
  presale_link: ['trade_key'],
  lh_notice: ['lh_id'],
  lh_supply: ['lh_id', 'supply_type', 'house_ty'],
  account_stats: ['base_month', 'region', 'account_kind', 'area_kind'],
};

const SOURCES = ['applyhome', 'competition', 'lh', 'trade', 'account'] as const;
type SourceName = (typeof SOURCES)[number];
const ROW_CAP = 70_000;
const BACKFILL_PER_RUN = 60;
const TRADE_EMPTY_MIN_JOBS = 10;

export interface SyncReport {
  sources: Record<SourceName, SourceMeta & { applied: boolean; reason?: string }>;
  rowsWritten: number; kvPut: number; kvDeferred: number; alerts: string[];
}

export interface SyncOptions { store: Store; fetch: Fetch; keys: string[]; today: string; now: string; lawdTable: LawdTable; backfillMax?: number }

const sqlList = (vals: string[]) => vals.map((v) => `'${v.replace(/'/g, "''")}'`).join(', ');
const parse = <T>(v: string | null): T | null => (v ? (JSON.parse(v) as T) : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

class Guarded extends Error {}

export async function runSync(o: SyncOptions): Promise<SyncReport> {
  const { store, fetch, keys, today, now } = o;
  const idx = buildLawdIndex(o.lawdTable);
  const metas = parse<Record<string, SourceMeta>>(await store.kvGet('meta:sources')) ?? {};
  const report: SyncReport = { sources: {} as SyncReport['sources'], rowsWritten: 0, kvPut: 0, kvDeferred: 0, alerts: [] };
  const changedLawds = new Set<string>();

  async function apply(table: string, rows: DbRow[], where = ''): Promise<void> {
    const keyCols = TABLES[table];
    const hashed = rows.map((r) => withHash(r as Row, now));
    const prev = new Map((await store.query<{ k: string; hash: string }>(`${hashQuerySql(table, keyCols)}${where}`)).map((r) => [r.k, r.hash]));
    let changed = diffRows(hashed, keyBy(keyCols), prev);
    const room = Math.max(0, ROW_CAP - report.rowsWritten);
    if (changed.length > room) changed = changed.slice(0, room);
    if (table === 'trade') for (const r of changed) changedLawds.add(String(r.lawd_cd));
    await store.exec(upsertSql(table, keyCols, changed));
    report.rowsWritten += changed.length;
  }

  function guard(name: SourceName, count: number): void {
    const g = guardCount(count, metas[name]?.lastCount ?? null);
    if (!g.ok) throw new Guarded(g.reason);
  }

  async function source(name: SourceName, run: () => Promise<number>): Promise<boolean> {
    try {
      const count = await run();
      metas[name] = nextMeta(metas[name], { ok: true, count }, now);
      report.sources[name] = { ...metas[name], applied: true };
      return true;
    } catch (err) {
      const msg = redactKeys(err instanceof Error ? err.message : String(err), keys);
      metas[name] = nextMeta(metas[name], { ok: false, error: msg }, now);
      report.sources[name] = { ...metas[name], applied: false, reason: msg };
      if (metas[name].failures === ALERT_AFTER) report.alerts.push(`${name}: ${ALERT_AFTER}회 연속 실패 — ${msg}`);
      return false;
    }
  }

  const key = keys[0] ?? '';
  const noticesInDb = () => store.query<DbRow>('SELECT * FROM apt_notice');

  await source('applyhome', async () => {
    const r = await collectApplyhome(fetch, key, today, idx);
    guard('applyhome', r.notices.length);
    await apply('apt_notice', r.notices);
    await apply('apt_model', r.models);
    return r.notices.length;
  });

  await source('competition', async () => {
    const notices = (await noticesInDb()).filter((n) => (str(n.notice_date) ?? '') >= addMonths(today, -2));
    const models = await store.query<DbRow>('SELECT pblanc_no, model_no, house_ty FROM apt_model');
    const byTy = new Map(models.map((m) => [`${m.pblanc_no}|${m.house_ty}`, String(m.model_no)]));
    const r = await collectCompetition(fetch, key, minHouseNo(notices), (p, ty) => byTy.get(`${p}|${ty}`) ?? null);
    guard('competition', r.competition.length + r.special.length);
    await apply('apt_competition', r.competition);
    await apply('apt_special_status', r.special);
    return r.competition.length + r.special.length;
  });

  await source('lh', async () => {
    const r = await collectLh(fetch, key, idx);
    guard('lh', r.notices.length);
    const apt = (await noticesInDb()).map((n) => ({ pblancNo: String(n.pblanc_no), lawdCd: str(n.lawd_cd), noticeDate: str(n.notice_date), name: String(n.name) }));
    const rows = r.notices.map((n) => ({
      ...n,
      pblanc_no: n.kind === 'sale'
        ? matchLh({ id: String(n.lh_id), kind: 'sale', lawdCd: str(n.lawd_cd), noticeDate: str(n.posted_date), name: String(n.title) }, apt, idx.cityOf)
        : null,
    }));
    await apply('lh_notice', rows);
    await apply('lh_supply', r.supply);
    return r.notices.length;
  });

  const backfillPrev = parse<BackfillState>(await store.kvGet('backfill:trade'));
  let backfillNext = backfillPrev;
  await source('trade', async () => {
    const lawds = [...new Set((await noticesInDb()).map((n) => str(n.lawd_cd)).filter((v): v is string => v !== null))];
    const recent: TradeJob[] = lawds.flatMap((lawd) => recentMonths(today).map((ym) => ({ lawd, ym })));
    const bf = nextBackfill(backfillPrev, sigunguCodes(o.lawdTable), today, o.backfillMax ?? BACKFILL_PER_RUN);
    const jobs = [...recent, ...bf.jobs];
    const r = await collectTrades(fetch, key, jobs);
    if (jobs.length >= TRADE_EMPTY_MIN_JOBS && r.trades.length === 0) throw new Guarded(`작업 ${jobs.length}개에서 0건`);
    const lawdsTouched = [...new Set(r.trades.map((t) => String(t.lawd_cd)))];
    await apply('trade', r.trades, lawdsTouched.length ? ` WHERE lawd_cd IN (${sqlList(lawdsTouched)})` : ' WHERE 0');
    await apply('presale_trade', r.presale);
    const locs: NoticeLoc[] = (await noticesInDb()).map((n) => {
      const res = str(n.address) ? resolveAddress(idx, String(n.address)) : null;
      return { pblancNo: String(n.pblanc_no), lawdCd: str(n.lawd_cd), dong: str(n.dong), jibun: res ? extractJibun(res.rest) : null, name: String(n.name) };
    });
    const links = r.presale.map((p) => {
      const m = matchPresale({ sggCd: String(p.sgg_cd ?? ''), dong: String(p.dong ?? ''), jibun: String(p.jibun ?? ''), name: String(p.name ?? '') }, locs, idx.cityOf);
      return { trade_key: p.trade_key, pblanc_no: m.pblancNo, method: m.method };
    });
    await apply('presale_link', links);
    backfillNext = bf.state;
    return r.trades.length + r.presale.length;
  });

  await source('account', async () => {
    const rows = await collectAccount(fetch, key, today);
    guard('account', rows.length);
    await apply('account_stats', rows);
    return rows.length;
  });

  // 묶음: D1 에서 다시 읽는다 (실패한 출처는 직전 값)
  const from = addMonths(today, -12);
  const notices = await store.query<DbRow>(`SELECT * FROM apt_notice WHERE notice_date >= '${from}' OR notice_date IS NULL`);
  const inNotices = `pblanc_no IN (SELECT pblanc_no FROM apt_notice WHERE notice_date >= '${from}' OR notice_date IS NULL)`;
  const scope = new Set<string>(changedLawds);
  for (const n of notices) {
    const l = str(n.lawd_cd);
    if (!l) continue;
    scope.add(l);
    const city = idx.cityOf.get(l) ?? l;
    scope.add(city);
    for (const [gu, c] of idx.cityOf) if (c === city) scope.add(gu);
  }
  const lhNotices = await store.query<DbRow>(`SELECT * FROM lh_notice WHERE posted_date >= '${from}' OR posted_date IS NULL`);
  const ds: Dataset = {
    notices,
    models: await store.query<DbRow>(`SELECT * FROM apt_model WHERE ${inNotices}`),
    competition: await store.query<DbRow>(`SELECT * FROM apt_competition WHERE ${inNotices}`),
    special: await store.query<DbRow>(`SELECT * FROM apt_special_status WHERE ${inNotices}`),
    trades: scope.size ? await store.query<DbRow>(`SELECT * FROM trade WHERE lawd_cd IN (${sqlList([...scope])}) AND contract_date >= '${from}'`) : [],
    presaleLinks: await store.query<DbRow>(`SELECT * FROM presale_link WHERE pblanc_no IS NOT NULL AND ${inNotices}`),
    presale: await store.query<DbRow>(`SELECT * FROM presale_trade WHERE trade_key IN (SELECT trade_key FROM presale_link WHERE pblanc_no IS NOT NULL AND ${inNotices})`),
    lhNotices,
    lhSupply: await store.query<DbRow>(`SELECT * FROM lh_supply WHERE lh_id IN (SELECT lh_id FROM lh_notice WHERE posted_date >= '${from}' OR posted_date IS NULL)`),
    account: await store.query<DbRow>('SELECT * FROM account_stats'),
  };
  const bundles = buildBundles(ds, { today, cityOf: idx.cityOf });
  const prevManifest = parse<KvManifest>(await store.kvGet('meta:kvhash'));
  const sel = selectKvWrites(bundles, prevManifest, { today });
  await store.kvPut([
    ...sel.put,
    { key: 'meta:sources', value: JSON.stringify(metas) },
    { key: 'backfill:trade', value: JSON.stringify(backfillNext ?? { base: '', index: 0 }) },
    { key: 'meta:kvhash', value: JSON.stringify(sel.manifest) },
  ]);
  report.kvPut = sel.put.length;
  report.kvDeferred = sel.deferred.length;
  return report;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const target = arg('target') === 'remote' ? 'remote' : 'local';
  const fixtures = arg('fixtures');
  const dryRun = process.argv.includes('--dry-run');
  const key = process.env.DATA_GO_KR_KEY ?? '';
  if (!fixtures && !key) throw new Error('DATA_GO_KR_KEY 가 없습니다 (.env 또는 GitHub Secrets)');
  const outDir = 'sync/.out';
  mkdirSync(outDir, { recursive: true });
  const report = await runSync({
    store: wranglerStore(target, outDir, dryRun),
    fetch: fixtures ? fixtureFetch(fixtures) : (url) => getText(url, [key]),
    keys: fixtures ? [] : [key],
    today: arg('today') ?? todayKst(),
    now: new Date().toISOString(),
    lawdTable: JSON.parse(readFileSync('content/lawd/lawd.json', 'utf8')),
    backfillMax: fixtures ? 100_000 : undefined,
  });
  writeFileSync(`${outDir}/report.json`, JSON.stringify(report, null, 2));
  if (report.alerts.length) writeFileSync(`${outDir}/alerts.json`, report.alerts.join('\n'));
  for (const [name, s] of Object.entries(report.sources)) console.log(`${name}: ${s.applied ? '반영' : `건너뜀 (${s.reason})`}`);
  console.log(`D1 ${report.rowsWritten}행, KV ${report.kvPut}건 (미룸 ${report.kvDeferred})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(redactKeys(err instanceof Error ? err.message : String(err), [process.env.DATA_GO_KR_KEY ?? '']));
    process.exit(1);
  });
}
```

```yaml
# file: .github/workflows/sync.yml
# 하루 2회 동기화 (KST 04:00·16:00). 저장소 변수 SYNC_ENABLED=true 일 때만 돈다 (배포 전에는 꺼 둠)
name: sync
on:
  schedule:
    - cron: '0 19 * * *'
    - cron: '0 7 * * *'
  workflow_dispatch:
permissions:
  contents: read
  issues: write
concurrency:
  group: sync
  cancel-in-progress: false
jobs:
  sync:
    if: vars.SYNC_ENABLED == 'true'
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run sync -- --target remote
        env:
          DATA_GO_KR_KEY: ${{ secrets.DATA_GO_KR_KEY }}
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
      - name: 3회 연속 실패 알림
        if: always() && hashFiles('sync/.out/alerts.json') != ''
        env:
          GH_TOKEN: ${{ github.token }}
        run: gh issue create --title "동기화 3회 연속 실패 $(date -u +%F)" --body-file sync/.out/alerts.json
```

`package.json` 의 scripts 에 한 줄 더한다: `"sync": "node --env-file-if-exists=.env --import tsx sync/main.ts"`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/sync-main.test.ts`
Expected: PASS (1 file, 6 tests)

Run: `npm test && npm run typecheck`
Expected: 모든 시험 통과, 타입 오류 0

Run: `npm run sync -- --target local --fixtures sync/fixtures`
Expected: 다섯 출처 `반영`, `D1 …행, KV …건` 출력 (로컬 D1 에 마이그레이션이 없으면 먼저 `npm run db:migrate:local`)

- [ ] **Step 5: Commit**

```bash
git add sync/store.ts sync/main.ts .github/workflows/sync.yml package.json tests/sync-main.test.ts
git commit -m "동기화: 진입점(출처별 반영·이상치 차단·KV 예산)과 하루 2회 워크플로"
```
