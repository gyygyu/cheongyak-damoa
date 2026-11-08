// 판정은 이 기기 안에서만. 네트워크·주소·저장소를 쓰지 않는다 (tests/eligibility-no-leak.test.ts)
// worker-configuration.d.ts 의 HTMLRewriter Element 가 DOM Element 와 합쳐져 append·remove 타입이 바뀐다 —
// 그래서 querySelectorAll 은 HTMLElement 로 받고, 자식 붙이기는 appendChild·replaceChildren 만 쓴다
type FieldEl = HTMLInputElement | HTMLSelectElement;
import { judgeAll } from '../lib/eligibility';
import { parseForm, resultSummary, resultView, type FormValues } from '../lib/view/eligibility-form';

const root = document.querySelector<HTMLElement>('[data-elig]');
if (root) {
  const fields = () => root.querySelectorAll<HTMLElement>('[data-field]');
  const fieldEl = (key: string) => root.querySelector<HTMLElement>(`[data-field="${CSS.escape(key)}"]`) as FieldEl | null;
  // 숨긴 칸(앞 답에 따라 필요 없는 칸)은 답하지 않은 것('')으로 넘긴다 — 판정은 '모름'으로 본다
  const values = (): FormValues => {
    const out: FormValues = {};
    fields().forEach((el) => { out[el.dataset.field as string] = el.closest('[hidden]') ? '' : (el as FieldEl).value; });
    return out;
  };
  const el = (tag: string, text?: string, cls?: string) => {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  };

  // 앞 답에 따라 칸을 보이고 숨긴다: data-when="칸:값" 이면 그 값일 때만, data-unless="칸:값" 이면 그 값일 때 숨김
  const matches = (rule: string) => {
    const [key, want] = rule.split(':');
    return (fieldEl(key)?.value ?? '') === want;
  };
  const refresh = () => {
    const n = Number(fieldEl('childCount')?.value || 0);
    root.querySelectorAll<HTMLElement>('[data-child]').forEach((c) => { c.hidden = Number(c.dataset.child) >= n; });
    root.querySelectorAll<HTMLElement>('[data-when]').forEach((f) => { f.hidden = !matches(f.dataset.when as string); });
    root.querySelectorAll<HTMLElement>('[data-unless]').forEach((f) => { f.hidden = matches(f.dataset.unless as string); });
  };
  root.addEventListener('change', refresh);
  refresh();

  const errBox = root.querySelector<HTMLElement>('[data-errors]')!;
  const out = root.querySelector<HTMLElement>('[data-result]')!;

  const clearErrors = () => {
    errBox.replaceChildren();
    root.querySelectorAll<HTMLElement>('.f-error').forEach((p) => p.parentNode?.removeChild(p));
    fields().forEach((f) => {
      f.removeAttribute('aria-invalid');
      const ids = (f.getAttribute('aria-describedby') ?? '').split(' ').filter((id) => id && !id.endsWith('-error'));
      if (ids.length) f.setAttribute('aria-describedby', ids.join(' '));
      else f.removeAttribute('aria-describedby');
    });
  };

  root.querySelector('[data-judge]')?.addEventListener('click', () => {
    clearErrors();
    out.replaceChildren();

    const { applicant, notice, errors } = parseForm(values());
    if (errors.length) {
      let first: FieldEl | null = null;
      for (const e of errors) {
        const f = fieldEl(e.field);
        if (!f) continue;
        first ??= f;
        f.setAttribute('aria-invalid', 'true');
        const id = `${f.id}-error`;
        const msg = el('p', e.message, 'f-error');
        msg.id = id;
        f.closest('.f')?.appendChild(msg);
        f.setAttribute('aria-describedby', [f.getAttribute('aria-describedby'), id].filter(Boolean).join(' '));
      }
      errBox.appendChild(el('p', `입력값 ${errors.length}곳을 확인하세요.`));
      first?.focus();
      return;
    }

    const results = judgeAll(applicant, notice);
    const sum = resultSummary(results);
    const title = el('h2', '판정 결과', 'r-title');
    title.tabIndex = -1;
    const counts = el('ul', undefined, 'r-summary');
    counts.setAttribute('aria-label', sum.text);
    for (const [cls, label, n] of [['ok', '가능', sum.ok], ['no', '불가', sum.no], ['check', '확인 필요', sum.check]] as const) {
      const li = el('li', undefined, `r-count is-${cls}`);
      li.replaceChildren(label, ' ', el('b', String(n)));
      counts.appendChild(li);
    }

    const list = el('div', undefined, 'r-list');
    for (const r of resultView(results)) {
      const box = el('details', undefined, 'r-type');
      const head = el('summary');
      const parts: Node[] = [el('span', r.label, 'r-name'), el('span', r.verdict, `r-badge is-${r.verdictClass}`)];
      if (r.rank && r.verdictClass !== 'no') parts.push(el('span', r.rank === '확인 필요' ? '공급 순위 확인 필요' : `공급 순위 ${r.rank}`, 'r-rank'));
      parts.push(el('span', r.article, 'r-article'));
      head.replaceChildren(...parts);

      const body = el('div', undefined, 'r-body');
      if (r.next) {
        const next = el('p', undefined, 'r-next');
        next.replaceChildren(el('b', '다음에 할 일'), r.next);
        body.appendChild(next);
      }
      const ul = el('ul', undefined, 'r-checks');
      for (const c of r.checks) {
        const li = el('li', undefined, 'r-check');
        const what = el('span');
        what.replaceChildren(c.label, ...(c.article ? [el('span', c.article, 'r-check-article')] : []));
        li.replaceChildren(el('span', c.verdict, `r-mark is-${c.verdictClass}`), what);
        if (c.note) li.appendChild(el('p', c.note, 'r-check-note'));
        ul.appendChild(li);
      }
      body.appendChild(ul);
      box.replaceChildren(head, body);
      list.appendChild(box);
    }
    out.replaceChildren(title, counts, list);
    title.focus();
  });
}
