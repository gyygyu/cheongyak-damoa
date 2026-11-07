// 행정안전부 법정동코드(StanReginCd) 한 페이지 → 코드·이름
export interface LawdRow { code: string; name: string }

export function parseLawdPage(json: unknown): { total: number; rows: LawdRow[] } {
  const parts = (json as { StanReginCd?: unknown[] })?.StanReginCd;
  if (!Array.isArray(parts)) throw new Error('법정동코드 응답 형식이 다릅니다');
  const head = (parts.find((p: any) => p?.head) as any)?.head ?? [];
  const total = Number(head.find((h: any) => h?.totalCount !== undefined)?.totalCount);
  const rows = ((parts.find((p: any) => p?.row) as any)?.row ?? []) as { region_cd: string; locatadd_nm: string }[];
  if (!Number.isFinite(total)) throw new Error('법정동코드 전체 건수가 없습니다');
  return { total, rows: rows.map((r) => ({ code: String(r.region_cd), name: String(r.locatadd_nm).trim() })) };
}
