// 페이지 캐시(Cache API)의 이름. 배포 판 번호를 붙여 새로 배포하면 예전 저장본을 쓰지 않는다
export function cacheKeyUrl(url: string, build: string): string {
  const u = new URL(url);
  u.searchParams.set('__v', build);
  return u.toString();
}
