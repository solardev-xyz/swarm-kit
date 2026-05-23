import { publishBytes, publishJson, publishText, readBytes, readJson, readText } from './chunks.js';
import { createEpochFeed } from './epoch-feed.js';
import {
  getSigningIdentity,
  readSocBytesByAddress,
  readSocBytesByOwnerAndIdentifier,
  readSocJsonByAddress,
  readSocJsonByOwnerAndIdentifier,
  readSocTextByAddress,
  readSocTextByOwnerAndIdentifier,
  writeSocBytes,
  writeSocJson,
  writeSocText,
} from './soc.js';
import { callSwarm, getWindowSwarm, type SwarmProvider } from './provider.js';

export function createSwarmKit(provider: SwarmProvider = getWindowSwarm()) {
  return {
    provider,
    requestAccess: () => callSwarm(provider, 'swarm_requestAccess'),
    getCapabilities: () => callSwarm(provider, 'swarm_getCapabilities'),
    publishBytes: publishBytes.bind(null, provider),
    readBytes: readBytes.bind(null, provider),
    publishText: publishText.bind(null, provider),
    readText: readText.bind(null, provider),
    publishJson: publishJson.bind(null, provider),
    readJson: readJson.bind(null, provider),
    getSigningIdentity: getSigningIdentity.bind(null, provider),
    writeSocBytes: writeSocBytes.bind(null, provider),
    readSocBytesByAddress: readSocBytesByAddress.bind(null, provider),
    readSocBytesByOwnerAndIdentifier: readSocBytesByOwnerAndIdentifier.bind(null, provider),
    writeSocText: writeSocText.bind(null, provider),
    readSocTextByAddress: readSocTextByAddress.bind(null, provider),
    readSocTextByOwnerAndIdentifier: readSocTextByOwnerAndIdentifier.bind(null, provider),
    writeSocJson: writeSocJson.bind(null, provider),
    readSocJsonByAddress: readSocJsonByAddress.bind(null, provider),
    readSocJsonByOwnerAndIdentifier: readSocJsonByOwnerAndIdentifier.bind(null, provider),
    createEpochFeed: <T = unknown>(options: Parameters<typeof createEpochFeed<T>>[1]) => createEpochFeed<T>(provider, options),
  };
}

export type SwarmKit = ReturnType<typeof createSwarmKit>;
