// 판정은 이 기기 안에서만. 네트워크·주소·저장소를 쓰지 않는다 (tests/eligibility-no-leak.test.ts)
// worker-configuration.d.ts 의 HTMLRewriter Element 가 DOM Element 와 합쳐져 append·remove 타입이 바뀐다 —
// 그래서 querySelectorAll 은 HTMLElement 로 받고, 자식 붙이기는 appendChild·replaceChildren 만 쓴다
type FieldEl = HTMLInputElement | HTMLSelectElement;
import { judgeAll, DISCLAIMER } from '../lib/eligibility';
import { parseForm, resultView, type FormValues } from '../lib/view/eligibility-form';

const root = document.querySelector<HTMLElement>('[data-elig]');
if (root) {
  const fields = () => root.querySelectorAll<HTMLElement>('[data-field]');
  const values = (): FormValues => {
    const out: FormValues = {};
    fields().forEach((el) => { out[el.dataset.field as string] = (el as FieldEl).value; });
    return out;
  };
  const showChildren = () => {
    const n = Number((root.querySelector<HTMLElement>('[data-field="childCount"]') as FieldEl | null)?.value ?? 0);
    root.querySelectorAll<HTMLElement>('[data-child]').forEach((el) => { el.hidden = Number(el.dataset.child) >= n; });
  };
  const el = (tag: string, text?: string, cls?: string) => {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  };

  root.querySelector('[data-field="childCount"]')?.addEventListener('change', showChildren);
  showChildren();

  root.querySelector('[data-judge]')?.addEventListener('click', () => {
    const errBox = root.querySelector<HTMLElement>('[data-errors]')!;
    const out = root.querySelector<HTMLElement>('[data-result]')!;
    errBox.replaceChildren();
    out.replaceChildren();
    fields().forEach((f) => f.removeAttribute('aria-invalid'));

    const { applicant, notice, errors } = parseForm(values());
    if (errors.length) {
      for (const e of errors) {
        root.querySelector(`[data-field="${CSS.escape(e.field)}"]`)?.setAttribute('aria-invalid', 'true');
        errBox.appendChild(el('p', e.message, 'field-error'));
      }
      return;
    }
    for (const r of resultView(judgeAll(applicant, notice))) {
      const box = el('section', undefined, 'benefit-card');
      const head: (Node | string)[] = [r.label, ' ', el('span', r.verdict, `verdict--${r.verdictClass}`)];
      if (r.rank) head.push(' ', el('span', r.rank, 'badge'));
      const h = el('h3');
      h.replaceChildren(...head);
      const ul = el('ul', undefined, 'bullets');
      for (const c of r.checks) ul.appendChild(el('li', `${c.label} (${c.article}) — ${c.verdict}${c.note ? ` · ${c.note}` : ''}`));
      box.replaceChildren(h, ul);
      out.appendChild(box);
    }
    out.appendChild(el('p', DISCLAIMER, 'page-notice'));
  });
}
