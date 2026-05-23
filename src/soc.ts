import { base64ToBytes, bytesToJson, bytesToUtf8, jsonToBytes, normalizeBytes, utf8ToBytes, type BytesLike } from './bytes.js';
import {
  callSwarm,
  type SwarmProvider,
  type SwarmReadSingleOwnerChunkResult,
  type SwarmSigningIdentity,
  type SwarmWriteSingleOwnerChunkResult,
} from './provider.js';

export interface ReadSocBytesResult {
  bytes: Uint8Array;
  span: number | bigint;
  reference: string;
  owner: string;
  identifier: string;
  signature?: string;
}

export async function getSigningIdentity(provider: SwarmProvider): Promise<SwarmSigningIdentity> {
  return callSwarm(provider, 'swarm_getSigningIdentity');
}

export async function writeSocBytes(
  provider: SwarmProvider,
  identifier: string,
  data: BytesLike,
  options: { span?: number | bigint } = {},
): Promise<SwarmWriteSingleOwnerChunkResult> {
  return callSwarm(provider, 'swarm_writeSingleOwnerChunk', {
    identifier,
    data: normalizeBytes(data),
    span: options.span,
  });
}

export async function readSocBytesByAddress(provider: SwarmProvider, address: string): Promise<ReadSocBytesResult> {
  return decodeSocRead(await callSwarm(provider, 'swarm_readSingleOwnerChunk', { address }));
}

export async function readSocBytesByOwnerAndIdentifier(
  provider: SwarmProvider,
  owner: string,
  identifier: string,
): Promise<ReadSocBytesResult> {
  return decodeSocRead(await callSwarm(provider, 'swarm_readSingleOwnerChunk', { owner, identifier }));
}

export async function writeSocText(
  provider: SwarmProvider,
  identifier: string,
  text: string,
  options: { span?: number | bigint } = {},
): Promise<SwarmWriteSingleOwnerChunkResult> {
  return writeSocBytes(provider, identifier, utf8ToBytes(text), options);
}

export async function readSocTextByAddress(provider: SwarmProvider, address: string): Promise<string> {
  return bytesToUtf8((await readSocBytesByAddress(provider, address)).bytes);
}

export async function readSocTextByOwnerAndIdentifier(
  provider: SwarmProvider,
  owner: string,
  identifier: string,
): Promise<string> {
  return bytesToUtf8((await readSocBytesByOwnerAndIdentifier(provider, owner, identifier)).bytes);
}

export async function writeSocJson(
  provider: SwarmProvider,
  identifier: string,
  value: unknown,
  options: { span?: number | bigint } = {},
): Promise<SwarmWriteSingleOwnerChunkResult> {
  return writeSocBytes(provider, identifier, jsonToBytes(value), options);
}

export async function readSocJsonByAddress<T = unknown>(provider: SwarmProvider, address: string): Promise<T> {
  return bytesToJson<T>((await readSocBytesByAddress(provider, address)).bytes);
}

export async function readSocJsonByOwnerAndIdentifier<T = unknown>(
  provider: SwarmProvider,
  owner: string,
  identifier: string,
): Promise<T> {
  return bytesToJson<T>((await readSocBytesByOwnerAndIdentifier(provider, owner, identifier)).bytes);
}

function decodeSocRead(result: SwarmReadSingleOwnerChunkResult): ReadSocBytesResult {
  const decoded: ReadSocBytesResult = {
    bytes: base64ToBytes(result.data),
    span: result.span,
    reference: result.reference,
    owner: result.owner,
    identifier: result.identifier,
  };
  if (result.signature !== undefined) decoded.signature = result.signature;
  return decoded;
}
