// 머리말 메뉴(PC)와 하단 탭(휴대폰). 공모주(/ipo)는 자료가 생길 때까지 탭에서 빼고 꼬리말 링크로만 둔다
export type NavIcon = 'home' | 'chart' | 'map' | 'calendar' | 'check';

export const NAV_ITEMS: readonly { href: string; label: string; icon: NavIcon }[] = [
  { href: '/', label: '아파트 청약', icon: 'home' },
  { href: '/competition', label: '경쟁률', icon: 'chart' },
  { href: '/region', label: '실거래', icon: 'map' },
  { href: '/calendar', label: '캘린더', icon: 'calendar' },
  { href: '/eligibility', label: '자격 판정', icon: 'check' },
];

const SECTION: Record<string, string[]> = {
  '/': ['/apt', '/lh'],
  '/competition': ['/competition'],
  '/region': ['/region', '/trade'],
  '/calendar': ['/calendar'],
  '/eligibility': ['/eligibility'],
};

export function navActive(pathname: string, href: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (href === '/' && path === '/') return true;
  return (SECTION[href] ?? [href]).some((p) => path === p || path.startsWith(`${p}/`));
}
