export interface SwarmProviderErrorData {
  reason?: string;
  [key: string]: unknown;
}

export interface SwarmProviderErrorLike {
  code?: number;
  message?: string;
  data?: SwarmProviderErrorData;
}

export interface SwarmCapabilities {
  specVersion?: string;
  canPublish: boolean;
  reason: string | null;
  limits?: {
    maxDataBytes?: number;
    maxFilesBytes?: number;
    maxFileCount?: number;
    maxPathBytes?: number;
    maxChunkPayloadBytes?: number;
  };
}

export interface SwarmChunkReadResult {
  data: string;
  encoding: 'base64';
  span: number | bigint;
}

export interface SwarmPublishChunkResult {
  reference: string;
}

export interface SwarmSigningIdentity {
  owner: string;
  identityMode?: string;
}

export interface SwarmWriteSingleOwnerChunkResult {
  reference: string;
  owner: string;
  identifier: string;
}

export interface SwarmReadSingleOwnerChunkResult extends SwarmChunkReadResult {
  reference: string;
  owner: string;
  identifier: string;
  signature?: string;
}

export interface SwarmProvider {
  isFreedomBrowser?: boolean;
  request?: <T = unknown>(request: { method: string; params?: unknown }) => Promise<T>;
  requestAccess?: () => Promise<unknown>;
  getCapabilities?: () => Promise<SwarmCapabilities>;
  publishChunk?: (params: { data: string | Uint8Array | ArrayBuffer; span?: number | bigint }) => Promise<SwarmPublishChunkResult>;
  readChunk?: (params: { reference: string }) => Promise<SwarmChunkReadResult>;
  writeSingleOwnerChunk?: (params: { identifier: string; data: string | Uint8Array | ArrayBuffer; span?: number | bigint }) => Promise<SwarmWriteSingleOwnerChunkResult>;
  readSingleOwnerChunk?: (params: { address: string } | { owner: string; identifier: string }) => Promise<SwarmReadSingleOwnerChunkResult>;
  getSigningIdentity?: () => Promise<SwarmSigningIdentity>;
}

export interface DetectWindowSwarmOptions {
  requireFreedomBrowser?: boolean;
}

export interface WaitForSwarmOptions extends DetectWindowSwarmOptions {
  timeoutMs?: number;
  pollIntervalMs?: number;
}

export function getWindowSwarm(): SwarmProvider {
  const swarm = detectWindowSwarm();
  if (!swarm) {
    throw new Error('window.swarm provider is not available');
  }
  return swarm;
}

export function detectWindowSwarm(options: DetectWindowSwarmOptions = {}): SwarmProvider | null {
  const swarm = (globalThis as { window?: { swarm?: SwarmProvider }; swarm?: SwarmProvider }).window?.swarm
    ?? (globalThis as { swarm?: SwarmProvider }).swarm;
  if (!swarm) return null;
  if (options.requireFreedomBrowser && !swarm.isFreedomBrowser) return null;
  return swarm;
}

export async function waitForSwarm(options: WaitForSwarmOptions = {}): Promise<SwarmProvider> {
  const timeoutMs = options.timeoutMs ?? 5_000;
  const pollIntervalMs = options.pollIntervalMs ?? 50;
  const deadline = Date.now() + timeoutMs;

  do {
    const swarm = detectWindowSwarm(options);
    if (swarm) return swarm;
    await sleep(Math.max(1, pollIntervalMs));
  } while (Date.now() <= deadline);

  throw new Error('window.swarm provider is not available');
}

export async function callSwarm<T>(
  provider: SwarmProvider,
  method: string,
  params?: unknown,
): Promise<T> {
  const directName = directMethodName(method);
  const direct = directName
    ? provider[directName] as ((params?: unknown) => Promise<T>) | undefined
    : undefined;
  if (typeof direct === 'function') {
    return direct.call(provider, params);
  }
  if (provider.request) {
    return provider.request<T>({ method, params });
  }
  throw new Error(`Provider does not support ${method}`);
}

function directMethodName(method: string): keyof SwarmProvider | null {
  switch (method) {
    case 'swarm_requestAccess': return 'requestAccess';
    case 'swarm_getCapabilities': return 'getCapabilities';
    case 'swarm_publishChunk': return 'publishChunk';
    case 'swarm_readChunk': return 'readChunk';
    case 'swarm_writeSingleOwnerChunk': return 'writeSingleOwnerChunk';
    case 'swarm_readSingleOwnerChunk': return 'readSingleOwnerChunk';
    case 'swarm_getSigningIdentity': return 'getSigningIdentity';
    default: return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
