export const PUBLIC_CACHE = 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400';

// 미들웨어는 s-maxage 가 붙은 200 응답만 Cache API 에 저장한다
export function setPublicCache(headers: Headers, sMaxAge = 3600): void {
  headers.set('Cache-Control', sMaxAge === 3600 ? PUBLIC_CACHE : `public, max-age=0, s-maxage=${sMaxAge}, stale-while-revalidate=86400`);
}
