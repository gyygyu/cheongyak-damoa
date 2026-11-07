// 공공데이터포털·OpenDART 요청 공용 — 키는 응답·로그에 남기지 않는다
export const serviceKeyParam = (key: string): string => (key.includes('%') ? key : encodeURIComponent(key));

export function redactKeys(text: string, keys: string[]): string {
  let out = text;
  for (const key of keys.filter(Boolean)) {
    const decoded = key.includes('%') ? decodeURIComponent(key) : key;
    for (const v of new Set([decoded, encodeURIComponent(decoded), key])) out = out.split(v).join('<KEY>');
  }
  return out;
}

export async function getText(url: string, keys: string[]): Promise<{ status: number; body: string }> {
  const res = await fetch(url, { headers: { accept: 'application/json, application/xml;q=0.9, */*;q=0.8' } });
  return { status: res.status, body: redactKeys(await res.text(), keys) };
}
