// 자격 판정 폼 값 → 판정 입력 (spec §8). 브라우저에서만 쓴다 — 값은 서버·URL·저장소로 보내지 않는다
import type { ApplicantInput, NoticeInput, Child, HomeOwner, TypeResult, Verdict } from '../eligibility/types';
import { TYPE_LABEL, VERDICT_LABEL } from '../eligibility';
import type { AptBundle } from './bundle-types';
import { normalizeDate } from '../date';

export type FormValues = Record<string, string>;
export interface FieldError { field: string; message: string }
export interface ParsedForm { applicant: ApplicantInput; notice: NoticeInput; errors: FieldError[] }
export const MAX_CHILDREN = 6;

const HOME_OWNER: readonly HomeOwner[] = ['none', 'self_or_spouse', 'other_member'];
const CHILD_KIND: readonly Child['kind'][] = ['born', 'fetus', 'adopted'];

export function parseForm(v: FormValues): ParsedForm {
  const errors: FieldError[] = [];
  const get = (k: string) => (v[k] ?? '').trim();
  const err = (field: string, message: string) => errors.push({ field, message });
  const bool = (k: string): boolean | null => (get(k) === 'true' ? true : get(k) === 'false' ? false : null);
  const num = (k: string, opts: { int?: boolean; max?: number } = {}): number | null => {
    const s = get(k).replace(/,/g, '');
    if (!s) return null;
    const n = Number(s);
    if (!Number.isFinite(n) || n < 0 || (opts.int && !Number.isInteger(n)) || (opts.max !== undefined && n > opts.max)) {
      err(k, '0 이상의 올바른 숫자를 넣으세요.');
      return null;
    }
    return n;
  };
  const date = (k: string): string | null => {
    const s = get(k);
    if (!s) return null;
    const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? normalizeDate(s) : null;
    if (!d || d !== s) { err(k, '날짜 형식이 맞지 않습니다(YYYY-MM-DD).'); return null; }
    return d;
  };

  const supply = get('supplyKind');
  if (supply !== 'national' && supply !== 'private') err('supplyKind', '국민주택·민영주택 중 하나를 고르세요.');
  const notice: NoticeInput = {
    supplyKind: supply === 'private' ? 'private' : 'national',
    areaExcl: num('areaExcl'),
    noticeDate: date('noticeDate'),
    publicBuilder: bool('publicBuilder'),
  };

  const childCount = num('childCount', { int: true, max: MAX_CHILDREN }) ?? 0;
  const children: Child[] = [];
  for (let i = 0; i < childCount; i++) {
    const kind = get(`children.${i}.kind`) as Child['kind'];
    children.push({ kind: CHILD_KIND.includes(kind) ? kind : 'born', birth: date(`children.${i}.birth`) });
  }

  const owner = get('homeOwner') as HomeOwner;
  const parentBirth = date('parentBirth');
  const parentSince = date('parentSince');
  const parentSpouse = bool('parentSpouseHomeless');
  const income = num('monthlyIncome');

  const applicant: ApplicantInput = {
    homeOwner: HOME_OWNER.includes(owner) ? owner : null,
    everOwned: bool('everOwned'),
    householdHead: bool('householdHead'),
    singleHousehold: bool('singleHousehold'),
    marriageDate: date('marriageDate'),
    children,
    householdSize: num('householdSize', { int: true, max: 20 }),
    monthlyIncome: income === null ? null : Math.round(income * 10_000),
    dualIncome: bool('dualIncome'),
    incomeTaxYears: num('incomeTaxYears', { int: true, max: 80 }),
    savingsMonths: num('savingsMonths', { int: true, max: 1200 }),
    savingsPayments: num('savingsPayments', { int: true, max: 1200 }),
    savingsTotal: num('savingsTotal'),
    priorSpecial: bool('priorSpecial'),
    parent: parentBirth || parentSince || parentSpouse !== null ? { birth: parentBirth, since: parentSince, spouseHomeless: parentSpouse } : null,
  };

  if (applicant.householdSize !== null && applicant.householdSize < children.length) {
    err('householdSize', '세대 구성원 수(태아 포함)가 자녀 수보다 적습니다.');
  }
  const nd = notice.noticeDate;
  if (nd) {
    const dated: [string, string | null][] = [
      ['marriageDate', applicant.marriageDate],
      ['parentBirth', parentBirth],
      ['parentSince', parentSince],
      ...children.map((c, i): [string, string | null] => [`children.${i}.birth`, c.kind === 'fetus' ? null : c.birth]),
    ];
    for (const [field, d] of dated) if (d && d > nd) err(field, `공고일(${nd})보다 뒤 날짜입니다.`);
  }
  return { applicant, notice, errors };
}

export function prefillFromApt(b: AptBundle, modelNo: string): FormValues | null {
  const m = b.models.find((x) => x.model_no === modelNo);
  if (!m) return null;
  return {
    supplyKind: b.notice.supply_kind ?? '',
    areaExcl: m.area_excl !== null ? String(m.area_excl) : '',
    noticeDate: b.notice.notice_date ?? '',
  };
}

export interface ResultView {
  label: string; verdict: string; verdictClass: Verdict; rank: string | null;
  checks: { label: string; article: string; verdict: string; note: string | null }[];
}

export function resultView(results: TypeResult[]): ResultView[] {
  return results.map((r) => ({
    label: TYPE_LABEL[r.type], verdict: VERDICT_LABEL[r.verdict], verdictClass: r.verdict, rank: r.rank ?? null,
    checks: r.checks.map((c) => ({ label: c.label, article: c.article, verdict: VERDICT_LABEL[c.verdict], note: c.note ?? null })),
  }));
}
