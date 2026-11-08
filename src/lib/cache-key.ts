// 페이지 캐시(Cache API)의 이름. 배포 판 번호를 붙여 새로 배포하면 예전 저장본을 쓰지 않는다.
// 요청 쿼리·조각(#)은 지운다 — 쿼리를 쓰는 페이지가 없어 ?utm= 같은 쿼리로 캐시를 우회해 매번 KV 를 읽지 않게 한다
export function cacheKeyUrl(url: string, build: string): string {
  const u = new URL(url);
  u.search = '';
  u.hash = '';
  u.searchParams.set('__v', build);
  return u.toString();
}
