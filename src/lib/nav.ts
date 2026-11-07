// 머리말 메뉴(PC)와 하단 탭(휴대폰). spec §7 탭 다섯 개
export const NAV_ITEMS = [
  { href: '/', label: '아파트 청약' },
  { href: '/ipo', label: '공모주' },
  { href: '/region', label: '실거래' },
  { href: '/calendar', label: '캘린더' },
  { href: '/eligibility', label: '자격 판정' },
] as const;

const SECTION: Record<string, string[]> = {
  '/': ['/apt', '/lh', '/competition'],
  '/ipo': ['/ipo'],
  '/region': ['/region', '/trade'],
  '/calendar': ['/calendar'],
  '/eligibility': ['/eligibility'],
};

export function navActive(pathname: string, href: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (href === '/' && path === '/') return true;
  return (SECTION[href] ?? [href]).some((p) => path === p || path.startsWith(`${p}/`));
}
