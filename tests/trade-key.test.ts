import { describe, it, expect } from 'vitest';
import { tradeKeys, type TradeKeyFields } from '../src/lib/trade/trade-key';

const row = (o: Partial<TradeKeyFields> = {}): TradeKeyFields => ({
  lawdCd: '11680', dong: '역삼동', jibun: '123-0', name: '역삼아이파크', area: 84.95, floor: 10,
  contractDate: '2026-10-05', amount: 250000, ...o,
});

describe('tradeKeys', () => {
  it('필드가 같으면 같은 키, 다르면 다른 키', () => {
    const [a] = tradeKeys([row()]);
    const [b] = tradeKeys([row()]);
    const [c] = tradeKeys([row({ floor: 11 })]);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
  it('같은 날·같은 층·같은 금액이 겹치면 순번을 붙인다', () => {
    const keys = tradeKeys([row(), row(), row({ amount: 1 }), row()]);
    expect(keys[1]).toBe(`${keys[0]}-2`);
    expect(keys[3]).toBe(`${keys[0]}-3`);
    expect(keys[2]).not.toContain('-');
  });
});
