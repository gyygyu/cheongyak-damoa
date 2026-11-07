// 주소 → 법정동코드 (spec §9). 표는 content/lawd/lawd.json (행정안전부 법정동코드 스냅숏, 현존 코드만)
export type LawdTable = [string, string][];

export interface ResolvedAddress {
  lawdCd: string; // 시군구 5자리 (실거래 API LAWD_CD)
  code: string; // 가장 깊게 맞은 10자리 코드
  sido: string;
  sigungu: string | null; // 세종처럼 없으면 null
  dong: string | null; // 시군구 아래 법정동 이름 (읍면 리 포함). 도로명 주소면 null
  rest: string;
}

export interface LawdIndex {
  byName: Map<string, string>; // 전체 이름 → 코드
  alias: Map<string, string>; // 구를 뺀 이름(경기도 화성시 봉담읍) → 코드. 두 구에 걸치면 빠짐
  nameOf: Map<string, string>; // 코드 → 전체 이름
  maxWords: number;
}

// 공고 주소에 섞여 오는 시도 약칭·옛 이름 → 현재 이름
const SIDO_ALIAS: Record<string, string> = {
  서울: '서울특별시', 부산: '부산광역시', 대구: '대구광역시', 인천: '인천광역시', 광주: '광주광역시',
  대전: '대전광역시', 울산: '울산광역시', 세종: '세종특별자치시', 세종시: '세종특별자치시', 경기: '경기도',
  강원: '강원특별자치도', 강원도: '강원특별자치도', 충북: '충청북도', 충남: '충청남도',
  전북: '전북특별자치도', 전라북도: '전북특별자치도', 전남: '전라남도', 경북: '경상북도', 경남: '경상남도',
  제주: '제주특별자치도', 제주도: '제주특별자치도',
};

const isSidoCode = (c: string) => c.endsWith('00000000');
const isSigunguCode = (c: string) => !isSidoCode(c) && c.endsWith('00000');
const sigunguOf = (c: string) => `${c.slice(0, 5)}00000`;

export function buildLawdIndex(table: LawdTable): LawdIndex {
  const byName = new Map<string, string>();
  const nameOf = new Map<string, string>();
  let maxWords = 0;
  for (const [code, name] of table) {
    // 같은 이름(세종특별자치시 시도·시군구)은 더 깊은 코드를 남긴다
    const prev = byName.get(name);
    if (!prev || code > prev) byName.set(name, code);
    nameOf.set(code, name);
    maxWords = Math.max(maxWords, name.split(' ').length);
  }

  // 구가 있는 시(수원·화성 등): "시도 시 구 동" 을 "시도 시 동" 으로도 찾는다
  const alias = new Map<string, string>();
  const clash = new Set<string>();
  for (const [code, name] of nameOf) {
    if (!isSigunguCode(code)) continue;
    const words = name.split(' ');
    if (words.length !== 3) continue; // 시도 시 구
    const city = words.slice(0, 2).join(' ');
    const cityCode = byName.get(city);
    if (!cityCode || !isSigunguCode(cityCode) || cityCode === code) continue;
    for (const [c, n] of nameOf) {
      if (c === code || !n.startsWith(`${name} `)) continue;
      const short = `${city} ${n.slice(name.length + 1)}`;
      if (byName.has(short)) continue;
      if (alias.has(short) && alias.get(short) !== c) clash.add(short);
      else alias.set(short, c);
    }
  }
  for (const k of clash) alias.delete(k);
  return { byName, alias, nameOf, maxWords };
}

export function resolveAddress(index: LawdIndex, address: string): ResolvedAddress | null {
  const words = address.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  words[0] = SIDO_ALIAS[words[0]] ?? words[0];

  let best: { code: string; n: number } | null = null;
  for (let n = 1; n <= Math.min(words.length, index.maxWords); n++) {
    const key = words.slice(0, n).join(' ');
    const code = index.byName.get(key) ?? index.alias.get(key);
    if (code) best = { code, n };
  }
  if (!best) return null;
  const sigCode = sigunguOf(best.code);
  const sigName = index.nameOf.get(sigCode);
  if (isSidoCode(sigCode) || !sigName) return null;

  const sido = words[0];
  const sigungu = sigName.split(' ').slice(1).join(' ') || null;
  const fullName = index.nameOf.get(best.code)!;
  const dong = best.code === sigCode ? null : fullName.slice(sigName.length + 1);
  return { lawdCd: sigCode.slice(0, 5), code: best.code, sido, sigungu, dong, rest: words.slice(best.n).join(' ') };
}
