// 자격 판정 폼 값 → 판정 입력 (spec §8). 브라우저에서만 쓴다 — 값은 서버·URL·저장소로 보내지 않는다
import type { ApplicantInput, NoticeInput, Child, HomeOwner, TypeResult, Verdict } from '../eligibility/types';
import { TYPE_LABEL, VERDICT_LABEL } from '../eligibility';
import type { AptBundle } from './bundle-types';
import { normalizeDate } from '../date';

export type FormValues = Record<string, string>;
export interface FieldError { field: string; message: string }
export interface ParsedForm { applicant: ApplicantInput; notice: NoticeInput; errors: FieldError[] }
export const MAX_CHILDREN = 6;

/** 선택 칸 보기 [값, 글자]. 판정에 쓰는 칸은 첫 값이 ''(모름) — 고르지 않으면 '확인 필요'가 된다 */
export type Options = readonly (readonly [string, string])[];
export const SUPPLY_OPTIONS: Options = [['', '선택'], ['national', '국민주택'], ['private', '민영주택']];
export const YES_NO_OPTIONS: Options = [['', '모름'], ['true', '예'], ['false', '아니오']];
export const HOME_OWNER_OPTIONS: Options = [['', '모름'], ['none', '세대 전원 무주택'], ['self_or_spouse', '본인·배우자 소유'], ['other_member', '다른 세대원 소유']];
export const MARRIED_OPTIONS: Options = [['', '모름'], ['true', '혼인 중'], ['false', '미혼(혼인 중 아님)']];
export const PARENT_CARE_OPTIONS: Options = [['', '모름'], ['true', '예, 부양하고 있음'], ['false', '아니오']];
export const CHILD_COUNT_OPTIONS: Options = [['', '모름'], ['0', '없음'], ...Array.from({ length: MAX_CHILDREN }, (_, i): [string, string] => [String(i + 1), `${i + 1}명`])];
export const CHILD_KIND_OPTIONS: Options = [['born', '출생'], ['fetus', '태아'], ['adopted', '입양']];

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

  // 자녀 수를 고르지 않으면(null) '자녀 수 모름' — 0명(자녀 없음)과 구분한다
  const childCount = num('childCount', { int: true, max: MAX_CHILDREN });
  let children: Child[] | null = null;
  if (childCount != null) {
    children = [];
    for (let i = 0; i < childCount; i++) {
      const kind = get(`children.${i}.kind`) as Child['kind'];
      children.push({ kind: CHILD_KIND.includes(kind) ? kind : 'born', birth: date(`children.${i}.birth`) });
    }
  }

  // 미혼을 고르면 (숨겨진) 혼인신고일 칸은 읽지 않는다
  const married = bool('married');
  const marriageDate = married === false ? null : date('marriageDate');
  // 부양하지 않는다고 고르면 parent 없음(불가). 모름이면 날짜를 모르는 부양으로 보아 '확인 필요'
  const parentCare = bool('parentCare');
  const parentBirth = parentCare === false ? null : date('parentBirth');
  const parentSince = parentCare === false ? null : date('parentSince');
  const parentSpouse = parentCare === false ? null : bool('parentSpouseHomeless');

  const owner = get('homeOwner') as HomeOwner;
  const income = num('monthlyIncome');

  const applicant: ApplicantInput = {
    homeOwner: HOME_OWNER.includes(owner) ? owner : null,
    everOwned: bool('everOwned'),
    householdHead: bool('householdHead'),
    singleHousehold: bool('singleHousehold'),
    married: marriageDate != null ? true : married,
    marriageDate,
    children,
    householdSize: num('householdSize', { int: true, max: 20 }),
    monthlyIncome: income === null ? null : Math.round(income * 10_000),
    dualIncome: bool('dualIncome'),
    incomeTaxYears: num('incomeTaxYears', { int: true, max: 80 }),
    savingsMonths: num('savingsMonths', { int: true, max: 1200 }),
    savingsPayments: num('savingsPayments', { int: true, max: 1200 }),
    savingsTotal: num('savingsTotal'),
    priorSpecial: bool('priorSpecial'),
    parent: parentCare === false ? null : { birth: parentBirth, since: parentSince, spouseHomeless: parentSpouse },
  };

  if (applicant.householdSize !== null && children && applicant.householdSize < children.length) {
    err('householdSize', '세대 구성원 수(태아 포함)가 자녀 수보다 적습니다.');
  }
  const nd = notice.noticeDate;
  if (nd) {
    const dated: [string, string | null][] = [
      ['marriageDate', applicant.marriageDate],
      ['parentBirth', parentBirth],
      ['parentSince', parentSince],
      ...(children ?? []).map((c, i): [string, string | null] => [`children.${i}.birth`, c.kind === 'fetus' ? null : c.birth]),
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

export interface CheckView {
  label: string;
  /** 유형의 적용 조문과 다를 때만 — 같은 조문을 줄마다 되풀이하지 않는다 */
  article: string | null;
  verdict: string; verdictClass: Verdict; note: string | null;
}
export interface ResultView {
  label: string; article: string; verdict: string; verdictClass: Verdict; rank: string | null;
  /** 불가 → 확인 필요 → 가능 순 */
  checks: CheckView[];
  /** '다음에 할 일' 한 줄 — 판정 사유 글에서 만든다(가능이면 null) */
  next: string | null;
}
export interface ResultSummary { ok: number; no: number; check: number; text: string }

const ORDER: Record<Verdict, number> = { no: 0, check: 1, ok: 2 };

/** 확인 필요 사유 글 → 짧은 할 일. 사유에 적힌 곳(청약홈·공고문)과 넣을 값만 옮기고 새 기준을 만들지 않는다 */
function todo(c: { label: string; note?: string }): string {
  const note = c.note ?? '';
  const put = /^(.+?)[을를] 넣으면/.exec(note);
  if (put) return `${put[1]} 입력`;
  if (note.includes('청약홈')) return `청약홈에서 ${c.label} 확인`;
  if (note.includes('공고문')) return `공고문에서 ${c.label} 확인`;
  return `${c.label} 확인`;
}

function nextStep(r: TypeResult): string | null {
  if (r.verdict === 'ok') return null;
  if (r.verdict === 'no') {
    const no = r.checks.filter((c) => c.verdict === 'no').map((c) => c.label);
    return `입력값이 맞다면 신청할 수 없습니다 — ${no.join(', ')} 입력을 다시 확인하세요.`;
  }
  const items = [...new Set(r.checks.filter((c) => c.verdict === 'check').map(todo))];
  return items.length ? items.join(' · ') : null;
}

export function resultView(results: TypeResult[]): ResultView[] {
  return results.map((r) => ({
    label: TYPE_LABEL[r.type], article: r.article, verdict: VERDICT_LABEL[r.verdict], verdictClass: r.verdict, rank: r.rank ?? null,
    checks: [...r.checks].sort((x, y) => ORDER[x.verdict] - ORDER[y.verdict]).map((c) => ({
      label: c.label,
      article: c.article === r.article || c.label.includes(c.article) ? null : c.article,
      verdict: VERDICT_LABEL[c.verdict], verdictClass: c.verdict, note: c.note ?? null,
    })),
    next: nextStep(r),
  }));
}

export function resultSummary(results: readonly TypeResult[]): ResultSummary {
  const n = (v: Verdict) => results.filter((r) => r.verdict === v).length;
  const [ok, no, check] = [n('ok'), n('no'), n('check')];
  return { ok, no, check, text: `가능 ${ok} · 불가 ${no} · 확인 필요 ${check}` };
}
