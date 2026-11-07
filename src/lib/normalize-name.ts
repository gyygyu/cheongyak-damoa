// 단지명 정규화 (분양권 매칭·LH 매칭 공용, spec §9). 차수·단지 번호 숫자는 남겨 다른 단지가 합쳐지지 않게 한다.
const ROMAN: Record<string, string> = { Ⅰ: '1', Ⅱ: '2', Ⅲ: '3', Ⅳ: '4', Ⅴ: '5', Ⅵ: '6', Ⅶ: '7', Ⅷ: '8', Ⅸ: '9', Ⅹ: '10' };

export function normalizeComplexName(name: string): string {
  return name
    .replace(/[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]/g, (c) => ROMAN[c])
    .normalize('NFKC')
    .toLowerCase()
    .replace(/아파트/g, '')
    .replace(/(\d)\s*-\s*(?=\d)/g, '$1#') // 숫자 사이 하이픈(1-2단지·A6-2블록)은 구분 문자로 남긴다
    .replace(/[\s()[\]{}<>·.,'"_\-]/g, '')
    .replace(/#/g, '-')
    .replace(/제?(\d+)차/g, '$1');
}
