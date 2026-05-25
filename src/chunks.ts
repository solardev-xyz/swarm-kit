import { bytesToJson, bytesToUtf8, jsonToBytes, utf8ToBytes, type BytesLike } from './bytes.js';
import { normalizeDriverBytes, toSwarmKitDriver, type SwarmKitDriverInput } from './driver.js';
import type { SwarmPublishChunkResult } from './provider.js';

export interface ReadBytesResult {
  bytes: Uint8Array;
  span: number | bigint;
}

export async function publishBytes(
  provider: SwarmKitDriverInput,
  data: BytesLike,
  options: { span?: number | bigint } = {},
): Promise<SwarmPublishChunkResult> {
  return toSwarmKitDriver(provider).publishChunk({
    data: normalizeDriverBytes(data),
    ...(options.span !== undefined ? { span: options.span } : {}),
  });
}

export async function readBytes(provider: SwarmKitDriverInput, reference: string): Promise<ReadBytesResult> {
  const result = await toSwarmKitDriver(provider).readChunk({ reference });
  return {
    bytes: result.data,
    span: result.span,
  };
}

export async function publishText(
  provider: SwarmKitDriverInput,
  text: string,
  options: { span?: number | bigint } = {},
): Promise<SwarmPublishChunkResult> {
  return publishBytes(provider, utf8ToBytes(text), options);
}

export async function readText(provider: SwarmKitDriverInput, reference: string): Promise<string> {
  return bytesToUtf8((await readBytes(provider, reference)).bytes);
}

export async function publishJson(
  provider: SwarmKitDriverInput,
  value: unknown,
  options: { span?: number | bigint } = {},
): Promise<SwarmPublishChunkResult> {
  return publishBytes(provider, jsonToBytes(value), options);
}

export async function readJson<T = unknown>(provider: SwarmKitDriverInput, reference: string): Promise<T> {
  return bytesToJson<T>((await readBytes(provider, reference)).bytes);
}
