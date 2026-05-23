import type { SwarmProviderErrorLike } from './provider.js';

export class SwarmKitError extends Error {
  readonly code: number | undefined;
  readonly reason: string | undefined;
  readonly cause: unknown;

  constructor(message: string, options: { code?: number | undefined; reason?: string | undefined; cause?: unknown } = {}) {
    super(message);
    this.name = 'SwarmKitError';
    this.code = options.code;
    this.reason = options.reason;
    this.cause = options.cause;
  }
}

export function getSwarmErrorReason(error: unknown): string | undefined {
  return (error as SwarmProviderErrorLike | undefined)?.data?.reason
    ?? (error as SwarmKitError | undefined)?.reason;
}

export function isSwarmReason(error: unknown, reason: string): boolean {
  return getSwarmErrorReason(error) === reason;
}

export function normalizeError(error: unknown): SwarmKitError {
  if (error instanceof SwarmKitError) return error;
  const providerError = error as SwarmProviderErrorLike;
  return new SwarmKitError(providerError?.message || String(error), buildErrorOptions(providerError, error));
}

function buildErrorOptions(providerError: SwarmProviderErrorLike, cause: unknown): { code?: number; reason?: string; cause: unknown } {
  const options: { code?: number; reason?: string; cause: unknown } = { cause };
  if (providerError.code !== undefined) options.code = providerError.code;
  if (providerError.data?.reason !== undefined) options.reason = providerError.data.reason;
  return options;
}
