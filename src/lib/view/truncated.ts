// 잘린 묶음 안내 — sync/bundles.ts fitValue 가 50KB 에 맞추려 목록을 덜어 내면 truncated: true 를 단다.
// 화면마다 문구가 갈리지 않게 여기 한 곳에서 정한다
export const TRUNCATED_TEXT = '자료가 많아 일부만 표시합니다. 전체는 청약홈·실거래 공개 시스템에서 확인하세요.';

// 화면이 읽은 묶음 중 하나라도 잘렸으면 안내 문구, 아니면 null
export function truncatedNotice(...bundles: ({ truncated?: boolean } | null | undefined)[]): string | null {
  return bundles.some((b) => b?.truncated === true) ? TRUNCATED_TEXT : null;
}
