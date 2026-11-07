import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const TABLES = ['apt_notice', 'apt_model', 'apt_competition', 'apt_special_status', 'trade', 'presale_trade',
  'presale_link', 'ipo', 'ipo_lockup', 'lh_notice', 'lh_supply', 'account_stats'];

function db() {
  const d = new DatabaseSync(':memory:');
  d.exec(readFileSync('migrations/0001_init.sql', 'utf8'));
  return d;
}

describe('0001_init.sql', () => {
  it('spec §5의 표 12개를 만든다', () => {
    const names = db().prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r: any) => r.name);
    for (const t of TABLES) expect(names).toContain(t);
  });
  it('모든 표에 hash·updated_at 열이 있다', () => {
    const d = db();
    for (const t of TABLES) {
      const cols = d.prepare(`PRAGMA table_info(${t})`).all().map((r: any) => r.name);
      expect(cols, t).toEqual(expect.arrayContaining(['hash', 'updated_at']));
    }
  });
  it('apt_model 은 공고번호+주택형 번호가 기본 키다', () => {
    const d = db();
    const ins = d.prepare("INSERT INTO apt_model (pblanc_no, model_no, house_ty, hash, updated_at) VALUES ('P1','01','084.9512A','h','t')");
    ins.run();
    expect(() => ins.run()).toThrow();
  });
  it('특공 신청현황은 거주 구분별로 따로 쌓인다 (해당지역·기타경기·기타지역)', () => {
    const d = db();
    const ins = d.prepare("INSERT INTO apt_special_status (pblanc_no, model_no, special_type, residence, hash, updated_at) VALUES ('P1','01','newlywed',?,'h','t')");
    ins.run('local'); ins.run('province');
    expect(() => ins.run('local')).toThrow();
  });
  it('LH 공급은 같은 주택형이라도 공급 유형이 다르면 따로 쌓인다', () => {
    const d = db();
    const ins = d.prepare("INSERT INTO lh_supply (lh_id, supply_type, house_ty, hash, updated_at) VALUES ('L1',?,'74.9400A','h','t')");
    ins.run('01'); ins.run('05');
    expect(() => ins.run('01')).toThrow();
  });
  it('청약통장 통계는 면적 구분(BLNC_SECD)별로 따로 쌓인다', () => {
    const d = db();
    const ins = d.prepare("INSERT INTO account_stats (base_month, region, account_kind, area_kind, hash, updated_at) VALUES ('2026-09','서울','청약예금',?,'h','t')");
    ins.run('01'); ins.run('04'); ins.run('');
    expect(() => ins.run('01')).toThrow();
  });
});
