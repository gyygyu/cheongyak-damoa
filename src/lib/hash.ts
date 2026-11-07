// FNV-1a 64비트 — 브라우저·Worker·Node 공용(동기). 보안용 아님, 변경 감지·키용
export function fnv64(s: string): string {
  let h = 0xcbf29ce484222325n;
  const bytes = new TextEncoder().encode(s);
  for (const b of bytes) {
    h ^= BigInt(b);
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return h.toString(16).padStart(16, '0');
}
