// 바닥글 출처 이름 뒤에 갱신 시각을 붙인다. 사용자 입력은 다루지 않는다
import { sourceLines, type SourceKey, type SourceMeta } from '../lib/view/sources';

const el = document.querySelector<HTMLElement>('[data-sources]');
if (el) {
  const keys = (el.dataset.sources ?? '').split(',').filter(Boolean) as SourceKey[];
  fetch('/api/meta.json')
    .then((r) => (r.ok ? (r.json() as Promise<Record<string, SourceMeta>>) : null))
    .then((meta) => { el.textContent = sourceLines(meta, keys).join(' · '); })
    .catch(() => {});
}
