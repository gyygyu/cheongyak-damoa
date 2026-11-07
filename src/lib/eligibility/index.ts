// 특별공급 자격 판정 진입점 (spec §8) — 화면은 이 모듈만 가져다 쓴다. 브라우저 안에서만 계산한다.
import { normalizeDate } from '../date';
import { judgeElderly } from './elderly';
import { judgeFirstLife } from './first-life';
import type { IncomeTable } from './income';
import { judgeMultichild } from './multichild';
import { judgeNewborn } from './newborn';
import { judgeNewlywed } from './newlywed';
import { INCOME_TABLES } from './tables';
import type { ApplicantInput, NoticeInput, SpecialType, TypeResult, Verdict } from './types';

export * from './types';
export { INCOME_TABLES } from './tables';

export const TYPE_LABEL: Record<SpecialType, string> = {
  newborn: '신생아', multichild: '다자녀', newlywed: '신혼부부', first_life: '생애최초', elderly_parent: '노부모 부양',
};
export const VERDICT_LABEL: Record<Verdict, string> = { ok: '가능', no: '불가', check: '확인 필요' };

/** 화면 입력을 판정 전에 정리한다 — 형식에 맞지 않는 날짜('' 포함)와 유효하지 않은 면적은 모름(null)으로 본다 */
function normalizeInput(a: ApplicantInput, n: NoticeInput): [ApplicantInput, NoticeInput] {
  const area = n.areaExcl;
  return [
    {
      ...a,
      marriageDate: normalizeDate(a.marriageDate),
      children: a.children.map((c) => ({ ...c, birth: normalizeDate(c.birth) })),
      parent: a.parent == null ? null : { ...a.parent, birth: normalizeDate(a.parent.birth), since: normalizeDate(a.parent.since) },
    },
    { ...n, noticeDate: normalizeDate(n.noticeDate), areaExcl: area != null && Number.isFinite(area) && area > 0 ? area : null },
  ];
}

export function judgeAll(a: ApplicantInput, n: NoticeInput, tables: readonly IncomeTable[] = INCOME_TABLES): TypeResult[] {
  const [na, nn] = normalizeInput(a, n);
  return [judgeNewborn, judgeMultichild, judgeNewlywed, judgeFirstLife, judgeElderly].map((f) => f(na, nn, tables));
}
