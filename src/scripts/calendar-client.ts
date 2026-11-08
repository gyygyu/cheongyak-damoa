// 캘린더 화면 표시만 바꾼다 (저장소 안 씀): 거르기 버튼, 달력 칸 건수 → 아래 목록의 그날로 갈 때 접힌 '지난 일정'을 편다
const wrap = document.querySelector<HTMLElement>('.cal-wrap');

wrap?.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((btn) => {
  btn.addEventListener('click', () => {
    wrap.dataset.show = btn.dataset.filter ?? 'all';
    wrap.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
  });
});

// 날짜 목록 id 는 d-YYYY-MM-DD (lib/view/calendar.ts dayId)
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
