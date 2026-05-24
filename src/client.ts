import { publishBytes, publishJson, publishText, readBytes, readJson, readText } from './chunks.js';
import { createDidDocument, didDocumentIdentifier, didDocumentRevisionIdentifier, readDidDocument, writeDidDocument } from './did.js';
import {
  decryptBytes,
  decryptJson,
  decryptText,
  deriveEncryptionKeyFromPassword,
  encryptBytes,
  encryptJson,
  encryptText,
  exportEncryptionKey,
  generateEncryptionKey,
  importEncryptionKey,
  publishEncryptedBytes,
  publishEncryptedJson,
  publishEncryptedText,
  readEncryptedBytes,
  readEncryptedEnvelope,
  readEncryptedJson,
  readEncryptedText,
} from './encryption.js';
import { createEpochFeed } from './epoch-feed.js';
import { createHashChain } from './hash-chain.js';
import { createKeyedLookup } from './lookup.js';
import { createMultiWriterFeed } from './multi-writer-feed.js';
import { publishObjectBytes, publishObjectJson, publishObjectText, readObjectBytes, readObjectJson, readObjectText } from './objects.js';
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
  const chunks = {
    publishBytes: publishBytes.bind(null, provider),
    readBytes: readBytes.bind(null, provider),
    publishText: publishText.bind(null, provider),
    readText: readText.bind(null, provider),
    publishJson: publishJson.bind(null, provider),
    readJson: readJson.bind(null, provider),
  };
  const soc = {
    getSigningIdentity: getSigningIdentity.bind(null, provider),
    writeBytes: writeSocBytes.bind(null, provider),
    readBytesByAddress: readSocBytesByAddress.bind(null, provider),
    readBytesByOwnerAndIdentifier: readSocBytesByOwnerAndIdentifier.bind(null, provider),
    writeText: writeSocText.bind(null, provider),
    readTextByAddress: readSocTextByAddress.bind(null, provider),
    readTextByOwnerAndIdentifier: readSocTextByOwnerAndIdentifier.bind(null, provider),
    writeJson: writeSocJson.bind(null, provider),
    readJsonByAddress: readSocJsonByAddress.bind(null, provider),
    readJsonByOwnerAndIdentifier: readSocJsonByOwnerAndIdentifier.bind(null, provider),
  };
  const epochFeed = {
    create: <T = unknown>(options: Parameters<typeof createEpochFeed<T>>[1]) => createEpochFeed<T>(provider, options),
  };
  const objects = {
    publishBytes: publishObjectBytes.bind(null, provider),
    readBytes: readObjectBytes.bind(null, provider),
    publishText: publishObjectText.bind(null, provider),
    readText: readObjectText.bind(null, provider),
    publishJson: publishObjectJson.bind(null, provider),
    readJson: readObjectJson.bind(null, provider),
  };
  const did = {
    documentIdentifier: didDocumentIdentifier,
    revisionIdentifier: didDocumentRevisionIdentifier,
    create: <T = unknown>(options: Parameters<typeof createDidDocument<T>>[1] = {}) => createDidDocument<T>(provider, options),
    writeDocument: writeDidDocument.bind(null, provider),
    readDocument: readDidDocument.bind(null, provider),
  };
  const hashChain = {
    create: <T = unknown>(options: Parameters<typeof createHashChain<T>>[1]) => createHashChain<T>(provider, options),
  };
  const multiWriterFeed = {
    create: <T = unknown>(options: Parameters<typeof createMultiWriterFeed<T>>[1]) => createMultiWriterFeed<T>(provider, options),
  };
  const crypto = {
    generateKey: generateEncryptionKey,
    exportKey: exportEncryptionKey,
    importKey: importEncryptionKey,
    deriveKeyFromPassword: deriveEncryptionKeyFromPassword,
    encryptBytes,
    decryptBytes,
    encryptText,
    decryptText,
    encryptJson,
    decryptJson,
    publishBytes: publishEncryptedBytes.bind(null, provider),
    readBytes: readEncryptedBytes.bind(null, provider),
    publishText: publishEncryptedText.bind(null, provider),
    readText: readEncryptedText.bind(null, provider),
    publishJson: publishEncryptedJson.bind(null, provider),
    readJson: readEncryptedJson.bind(null, provider),
    readEnvelope: readEncryptedEnvelope.bind(null, provider),
  };
  const lookup = {
    create: <T = unknown>(options: Parameters<typeof createKeyedLookup<T>>[1]) => createKeyedLookup<T>(provider, options),
  };

  return {
    provider,
    requestAccess: () => callSwarm(provider, 'swarm_requestAccess'),
    getCapabilities: () => callSwarm(provider, 'swarm_getCapabilities'),
    chunks,
    soc,
    epochFeed,
    objects,
    did,
    hashChain,
    multiWriterFeed,
    crypto,
    lookup,
    publishBytes: chunks.publishBytes,
    readBytes: chunks.readBytes,
    publishText: chunks.publishText,
    readText: chunks.readText,
    publishJson: chunks.publishJson,
    readJson: chunks.readJson,
    getSigningIdentity: soc.getSigningIdentity,
    writeSocBytes: soc.writeBytes,
    readSocBytesByAddress: soc.readBytesByAddress,
    readSocBytesByOwnerAndIdentifier: soc.readBytesByOwnerAndIdentifier,
    writeSocText: soc.writeText,
    readSocTextByAddress: soc.readTextByAddress,
    readSocTextByOwnerAndIdentifier: soc.readTextByOwnerAndIdentifier,
    writeSocJson: soc.writeJson,
    readSocJsonByAddress: soc.readJsonByAddress,
    readSocJsonByOwnerAndIdentifier: soc.readJsonByOwnerAndIdentifier,
    createEpochFeed: epochFeed.create,
  };
}

export type SwarmKit = ReturnType<typeof createSwarmKit>;
