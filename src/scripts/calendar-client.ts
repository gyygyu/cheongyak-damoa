// 캘린더 거르기 버튼 — 화면 표시만 바꾼다 (주소·저장소 안 씀)
const wrap = document.querySelector<HTMLElement>('.cal-wrap');
wrap?.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((btn) => {
  btn.addEventListener('click', () => {
    wrap.dataset.show = btn.dataset.filter ?? 'all';
    wrap.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
  });
});
