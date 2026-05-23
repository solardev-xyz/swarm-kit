import { base64ToBytes, bytesToJson, bytesToUtf8, jsonToBytes, normalizeBytes, utf8ToBytes, type BytesLike } from './bytes.js';
import { callSwarm, type SwarmChunkReadResult, type SwarmProvider, type SwarmPublishChunkResult } from './provider.js';

export interface ReadBytesResult {
  bytes: Uint8Array;
  span: number | bigint;
}

export async function publishBytes(
  provider: SwarmProvider,
  data: BytesLike,
  options: { span?: number | bigint } = {},
): Promise<SwarmPublishChunkResult> {
  return callSwarm(provider, 'swarm_publishChunk', {
    data: normalizeBytes(data),
    span: options.span,
  });
}

export async function readBytes(provider: SwarmProvider, reference: string): Promise<ReadBytesResult> {
  const result = await callSwarm<SwarmChunkReadResult>(provider, 'swarm_readChunk', { reference });
  return {
    bytes: base64ToBytes(result.data),
    span: result.span,
  };
}

export async function publishText(
  provider: SwarmProvider,
  text: string,
  options: { span?: number | bigint } = {},
): Promise<SwarmPublishChunkResult> {
  return publishBytes(provider, utf8ToBytes(text), options);
}

export async function readText(provider: SwarmProvider, reference: string): Promise<string> {
  return bytesToUtf8((await readBytes(provider, reference)).bytes);
}

export async function publishJson(
  provider: SwarmProvider,
  value: unknown,
  options: { span?: number | bigint } = {},
): Promise<SwarmPublishChunkResult> {
  return publishBytes(provider, jsonToBytes(value), options);
}

export async function readJson<T = unknown>(provider: SwarmProvider, reference: string): Promise<T> {
  return bytesToJson<T>((await readBytes(provider, reference)).bytes);
}
