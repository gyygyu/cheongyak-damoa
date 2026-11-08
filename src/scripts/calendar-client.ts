// 캘린더 화면 표시만 바꾼다 (저장소 안 씀): 종류·지역 거르기, 달력 칸 건수 → 아래 목록의 그날로 갈 때 접힌 주·지난 일정을 편다
const wrap = document.querySelector<HTMLElement>('.cal-wrap');
// HTMLSelectElement 는 remove() 겹침 때문에 querySelector<T> 제약에 안 맞아 값만 쓰는 모양으로 받는다
const sidoSelect = (wrap?.querySelector('[data-sido-filter]') ?? null) as (HTMLElement & { value: string }) | null;

// 종류(data-show, 달력 칸은 CSS 가 거른다) + 지역으로 아래 목록 줄을 거르고, 빈 날·빈 주는 숨기고 건수를 다시 센다
function apply(): void {
  if (!wrap) return;
  const show = wrap.dataset.show ?? 'all';
  const sido = sidoSelect?.value ?? '';
  wrap.querySelectorAll<HTMLElement>('.day-list .ev').forEach((li) => {
    li.hidden = (show !== 'all' && li.dataset.group !== show) || (sido !== '' && li.dataset.sido !== sido);
  });
  wrap.querySelectorAll<HTMLElement>('.day-list .day').forEach((day) => {
    day.hidden = !day.querySelector('.ev:not([hidden])');
  });
  let total = 0;
  wrap.querySelectorAll<HTMLDetailsElement>('.cal-week, .cal-past').forEach((box) => {
    const n = box.querySelectorAll('.ev:not([hidden])').length;
    const count = box.querySelector('summary [data-count]');
    if (count) count.textContent = String(n);
    box.hidden = n === 0;
    total += n;
  });
  const hasRows = wrap.querySelector('.cal-week, .cal-past') !== null;
  const empty = wrap.querySelector<HTMLElement>('[data-filter-empty]');
  if (empty) empty.hidden = !hasRows || total > 0;
  const hint = wrap.querySelector<HTMLElement>('[data-sido-hint]');
  if (hint) hint.hidden = sido === '';
}

wrap?.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((btn) => {
  btn.addEventListener('click', () => {
    wrap.dataset.show = btn.dataset.filter ?? 'all';
    wrap.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    apply();
  });
});
sidoSelect?.addEventListener('change', apply);
apply(); // 뒤로 가기로 돌아와 select 값이 남아 있을 때

// 날짜 목록 id 는 d-YYYY-MM-DD (lib/view/calendar.ts dayId). 그날이 든 접힌 칸(주·지난 일정)을 편다
function reveal(hash: string, scroll = false): void {
  if (!/^#d-\d{4}-\d{2}-\d{2}$/.test(hash)) return;
  const target = document.getElementById(hash.slice(1));
  const details = target?.closest('details');
  if (!details || details.open) return;
  details.open = true;
  if (scroll) target?.scrollIntoView();
}

// 기본 동작(그날로 스크롤)보다 먼저 펴 두어야 접힌 칸 안으로도 스크롤된다
wrap?.addEventListener('click', (ev) => {
  const a = (ev.target as Element | null)?.closest<HTMLAnchorElement>('a[href^="#d-"]');
  if (a) reveal(a.getAttribute('href') ?? '');
});
window.addEventListener('hashchange', () => reveal(location.hash, true));
reveal(location.hash, true);
