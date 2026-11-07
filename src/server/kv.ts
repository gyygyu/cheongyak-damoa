import { env } from 'cloudflare:workers';

// KV 묶음은 50KB 이하(spec §6, sync/bundles.ts MAX_VALUE_BYTES) — 파싱해도 CPU 한도 안
export function getJson<T>(key: string): Promise<T | null> {
  return env.KV.get<T>(key, { type: 'json', cacheTtl: 300 });
}

// 파싱 없이 스트림으로 넘긴다 (Workers CPU 10ms)
export function getStream(key: string): Promise<ReadableStream | null> {
  return env.KV.get(key, { type: 'stream', cacheTtl: 300 });
}
