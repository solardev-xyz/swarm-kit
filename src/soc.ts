import { bytesToJson, bytesToUtf8, jsonToBytes, utf8ToBytes, type BytesLike } from './bytes.js';
import { normalizeDriverBytes, toSwarmKitDriver, type SwarmKitDriverInput, type SwarmKitReadSingleOwnerChunkResult } from './driver.js';
import type { SwarmSigningIdentity, SwarmWriteSingleOwnerChunkResult } from './provider.js';

export interface ReadSocBytesResult {
  bytes: Uint8Array;
  span: number | bigint;
  reference: string;
  owner: string;
  identifier: string;
  signature?: string;
}

export async function getSigningIdentity(provider: SwarmKitDriverInput): Promise<SwarmSigningIdentity> {
  const driver = toSwarmKitDriver(provider);
  if (!driver.getSigningIdentity) {
    throw new Error('Swarm driver does not support getSigningIdentity');
  }
  return driver.getSigningIdentity();
}

export async function writeSocBytes(
  provider: SwarmKitDriverInput,
  identifier: string,
  data: BytesLike,
  options: { span?: number | bigint } = {},
): Promise<SwarmWriteSingleOwnerChunkResult> {
  return toSwarmKitDriver(provider).writeSingleOwnerChunk({
    identifier,
    data: normalizeDriverBytes(data),
    ...(options.span !== undefined ? { span: options.span } : {}),
  });
}

export async function readSocBytesByAddress(provider: SwarmKitDriverInput, address: string): Promise<ReadSocBytesResult> {
  return decodeSocRead(await toSwarmKitDriver(provider).readSingleOwnerChunk({ address }));
}

export async function readSocBytesByOwnerAndIdentifier(
  provider: SwarmKitDriverInput,
  owner: string,
  identifier: string,
): Promise<ReadSocBytesResult> {
  return decodeSocRead(await toSwarmKitDriver(provider).readSingleOwnerChunk({ owner, identifier }));
}

export async function writeSocText(
  provider: SwarmKitDriverInput,
  identifier: string,
  text: string,
  options: { span?: number | bigint } = {},
): Promise<SwarmWriteSingleOwnerChunkResult> {
  return writeSocBytes(provider, identifier, utf8ToBytes(text), options);
}

export async function readSocTextByAddress(provider: SwarmKitDriverInput, address: string): Promise<string> {
  return bytesToUtf8((await readSocBytesByAddress(provider, address)).bytes);
}

export async function readSocTextByOwnerAndIdentifier(
  provider: SwarmKitDriverInput,
  owner: string,
  identifier: string,
): Promise<string> {
  return bytesToUtf8((await readSocBytesByOwnerAndIdentifier(provider, owner, identifier)).bytes);
}

export async function writeSocJson(
  provider: SwarmKitDriverInput,
  identifier: string,
  value: unknown,
  options: { span?: number | bigint } = {},
): Promise<SwarmWriteSingleOwnerChunkResult> {
  return writeSocBytes(provider, identifier, jsonToBytes(value), options);
}

export async function readSocJsonByAddress<T = unknown>(provider: SwarmKitDriverInput, address: string): Promise<T> {
  return bytesToJson<T>((await readSocBytesByAddress(provider, address)).bytes);
}

export async function readSocJsonByOwnerAndIdentifier<T = unknown>(
  provider: SwarmKitDriverInput,
  owner: string,
  identifier: string,
): Promise<T> {
  return bytesToJson<T>((await readSocBytesByOwnerAndIdentifier(provider, owner, identifier)).bytes);
}

function decodeSocRead(result: SwarmKitReadSingleOwnerChunkResult): ReadSocBytesResult {
  const decoded: ReadSocBytesResult = {
    bytes: result.data,
    span: result.span,
    reference: result.reference,
    owner: result.owner,
    identifier: result.identifier,
  };
  if (result.signature !== undefined) decoded.signature = result.signature;
  return decoded;
}
