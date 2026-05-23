import { bytesToJson, bytesToUtf8, concatBytes, jsonToBytes, normalizeBytes, utf8ToBytes, type BytesLike } from './bytes.js';
import { publishBytes as publishChunkBytes, readBytes as readChunkBytes } from './chunks.js';
import type { SwarmProvider } from './provider.js';

export interface ObjectPublishOptions {
  chunkSize?: number;
}

export interface ObjectReadOptions {
  maxDepth?: number;
}

export interface PublishObjectResult {
  reference: string;
  size: number;
  chunkCount: number;
  nodeCount: number;
}

interface ChunkGraphNode {
  version: 1;
  type: 'swarm-kit:chunk-graph';
  size: number;
  children: ChunkGraphChild[];
}

type ChunkGraphChild =
  | { type: 'chunk'; reference: string; size: number }
  | { type: 'node'; reference: string; size: number };

const DEFAULT_CHUNK_SIZE = 4096;
const MAX_CHILDREN_PER_NODE = 32;
const DEFAULT_MAX_DEPTH = 16;

export async function publishObjectBytes(
  provider: SwarmProvider,
  data: BytesLike,
  options: ObjectPublishOptions = {},
): Promise<PublishObjectResult> {
  const bytes = normalizeBytes(data);
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  if (!Number.isSafeInteger(chunkSize) || chunkSize <= 0 || chunkSize > DEFAULT_CHUNK_SIZE) {
    throw new Error(`Object chunk size must be an integer between 1 and ${DEFAULT_CHUNK_SIZE}`);
  }

  const leaves: ChunkGraphChild[] = [];
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunkBytes = bytes.slice(offset, offset + chunkSize);
    const published = await publishChunkBytes(provider, chunkBytes);
    leaves.push({
      type: 'chunk',
      reference: published.reference,
      size: chunkBytes.length,
    });
  }

  const root = await publishNode(provider, leaves, bytes.length);
  return {
    reference: root.reference,
    size: bytes.length,
    chunkCount: leaves.length,
    nodeCount: root.nodeCount,
  };
}

export async function readObjectBytes(
  provider: SwarmProvider,
  reference: string,
  options: ObjectReadOptions = {},
): Promise<Uint8Array> {
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  if (!Number.isSafeInteger(maxDepth) || maxDepth < 0) {
    throw new Error('Object read maxDepth must be a non-negative safe integer');
  }

  const result = await readNode(provider, reference, 0, maxDepth);
  return result.bytes;
}

export function publishObjectText(
  provider: SwarmProvider,
  text: string,
  options: ObjectPublishOptions = {},
): Promise<PublishObjectResult> {
  return publishObjectBytes(provider, utf8ToBytes(text), options);
}

export async function readObjectText(
  provider: SwarmProvider,
  reference: string,
  options: ObjectReadOptions = {},
): Promise<string> {
  return bytesToUtf8(await readObjectBytes(provider, reference, options));
}

export function publishObjectJson(
  provider: SwarmProvider,
  value: unknown,
  options: ObjectPublishOptions = {},
): Promise<PublishObjectResult> {
  return publishObjectBytes(provider, jsonToBytes(value), options);
}

export async function readObjectJson<T = unknown>(
  provider: SwarmProvider,
  reference: string,
  options: ObjectReadOptions = {},
): Promise<T> {
  return bytesToJson<T>(await readObjectBytes(provider, reference, options));
}

async function publishNode(
  provider: SwarmProvider,
  children: ChunkGraphChild[],
  size: number,
): Promise<{ reference: string; nodeCount: number }> {
  if (children.length <= MAX_CHILDREN_PER_NODE) {
    const manifest = createNode(children, size);
    const published = await publishChunkBytes(provider, jsonToBytes(manifest));
    return { reference: published.reference, nodeCount: 1 };
  }

  const nodeChildren: ChunkGraphChild[] = [];
  let nodeCount = 0;
  for (let offset = 0; offset < children.length; offset += MAX_CHILDREN_PER_NODE) {
    const group = children.slice(offset, offset + MAX_CHILDREN_PER_NODE);
    const groupSize = sumChildren(group);
    const published = await publishNode(provider, group, groupSize);
    nodeChildren.push({
      type: 'node',
      reference: published.reference,
      size: groupSize,
    });
    nodeCount += published.nodeCount;
  }

  const root = await publishNode(provider, nodeChildren, size);
  return {
    reference: root.reference,
    nodeCount: nodeCount + root.nodeCount,
  };
}

async function readNode(
  provider: SwarmProvider,
  reference: string,
  depth: number,
  maxDepth: number,
): Promise<{ bytes: Uint8Array; size: number }> {
  if (depth > maxDepth) {
    throw new Error('Object graph exceeds maxDepth');
  }

  const node = parseNode(await readChunkBytes(provider, reference).then(result => result.bytes));
  const parts = await Promise.all(node.children.map(async child => {
    if (child.type === 'chunk') {
      const chunk = await readChunkBytes(provider, child.reference);
      if (chunk.bytes.length !== child.size) {
        throw new Error(`Object chunk size mismatch for ${child.reference}`);
      }
      return chunk.bytes;
    }

    const childNode = await readNode(provider, child.reference, depth + 1, maxDepth);
    if (childNode.size !== child.size) {
      throw new Error(`Object node size mismatch for ${child.reference}`);
    }
    return childNode.bytes;
  }));

  const bytes = concatBytes(parts);
  if (bytes.length !== node.size) {
    throw new Error(`Object graph size mismatch for ${reference}`);
  }
  return { bytes, size: node.size };
}

function createNode(children: ChunkGraphChild[], size: number): ChunkGraphNode {
  return {
    version: 1,
    type: 'swarm-kit:chunk-graph',
    size,
    children,
  };
}

function parseNode(bytes: Uint8Array): ChunkGraphNode {
  const value = bytesToJson<Partial<ChunkGraphNode>>(bytes);
  if (
    value.version !== 1 ||
    value.type !== 'swarm-kit:chunk-graph' ||
    typeof value.size !== 'number' ||
    !Number.isSafeInteger(value.size) ||
    value.size < 0 ||
    !Array.isArray(value.children)
  ) {
    throw new Error('Invalid object graph node');
  }

  for (const child of value.children) {
    if (!isChild(child)) {
      throw new Error('Invalid object graph child');
    }
  }

  return value as ChunkGraphNode;
}

function isChild(value: unknown): value is ChunkGraphChild {
  if (!value || typeof value !== 'object') return false;
  const child = value as Partial<ChunkGraphChild>;
  return (
    (child.type === 'chunk' || child.type === 'node') &&
    typeof child.reference === 'string' &&
    typeof child.size === 'number' &&
    Number.isSafeInteger(child.size) &&
    child.size >= 0
  );
}

function sumChildren(children: readonly ChunkGraphChild[]): number {
  return children.reduce((sum, child) => sum + child.size, 0);
}
