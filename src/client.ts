import { publishBytes, publishJson, publishText, readBytes, readJson, readText } from './chunks.js';
import { commitRevealCommitment, createCommitReveal, generateCommitRevealSalt } from './commit-reveal.js';
import { createDidDocument, didDocumentIdentifier, didDocumentRevisionIdentifier, readDidDocument, writeDidDocument } from './did.js';
import {
  decryptBytes,
  decryptBytesFrom,
  decryptJson,
  decryptJsonFrom,
  decryptText,
  decryptTextFrom,
  deriveEncryptionKeyFromPassword,
  encryptBytes,
  encryptBytesFor,
  encryptJson,
  encryptJsonFor,
  encryptText,
  encryptTextFor,
  exportEncryptionKey,
  exportPrivateEncryptionKey,
  exportPublicEncryptionKey,
  generateEncryptionKey,
  generateEncryptionKeyPair,
  importEncryptionKey,
  importPrivateEncryptionKey,
  importPublicEncryptionKey,
  publishEncryptedBytes,
  publishEncryptedBytesFor,
  publishEncryptedJson,
  publishEncryptedJsonFor,
  publishEncryptedText,
  publishEncryptedTextFor,
  readEncryptedBytes,
  readEncryptedBytesFrom,
  readEncryptedEnvelope,
  readEncryptedJson,
  readEncryptedJsonFrom,
  readEncryptedText,
  readEncryptedTextFrom,
  readPublicKeyEncryptedEnvelope,
} from './encryption.js';
import { createEpochFeed } from './epoch-feed.js';
import { createHashChain } from './hash-chain.js';
import { createKeyedLookup } from './lookup.js';
import { createMultiWriterFeed } from './multi-writer-feed.js';
import { publishObjectBytes, publishObjectJson, publishObjectText, readObjectBytes, readObjectJson, readObjectText } from './objects.js';
import { createOwnerRecords } from './records.js';
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
import { getWindowSwarm } from './provider.js';
import {
  assertSignedDocument,
  createEip1193PersonalSigner,
  createEip191PersonalVerifier,
  createEthereumPersonalVerifier,
  createP256DocumentSigner,
  createP256DocumentVerifier,
  exportP256PrivateSigningKey,
  exportP256PublicSigningKey,
  generateP256SigningKeyPair,
  importP256PrivateSigningKey,
  importP256PublicSigningKey,
  publishSignedDocument,
  readAndVerifySignedDocument,
  readSignedDocument,
  signDocument,
  signedDocumentPayloadBytes,
  verifySignedDocument,
} from './signed-documents.js';
import { toSwarmKitDriver, type SwarmKitDriverInput } from './driver.js';

export function createSwarmKit(input: SwarmKitDriverInput = getWindowSwarm()) {
  const provider = toSwarmKitDriver(input);
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
    generateKeyPair: generateEncryptionKeyPair,
    exportPublicKey: exportPublicEncryptionKey,
    importPublicKey: importPublicEncryptionKey,
    exportPrivateKey: exportPrivateEncryptionKey,
    importPrivateKey: importPrivateEncryptionKey,
    encryptBytes,
    decryptBytes,
    encryptText,
    decryptText,
    encryptJson,
    decryptJson,
    encryptBytesFor,
    decryptBytesFrom,
    encryptTextFor,
    decryptTextFrom,
    encryptJsonFor,
    decryptJsonFrom,
    publishBytes: publishEncryptedBytes.bind(null, provider),
    readBytes: readEncryptedBytes.bind(null, provider),
    publishText: publishEncryptedText.bind(null, provider),
    readText: readEncryptedText.bind(null, provider),
    publishJson: publishEncryptedJson.bind(null, provider),
    readJson: readEncryptedJson.bind(null, provider),
    readEnvelope: readEncryptedEnvelope.bind(null, provider),
    publishBytesFor: publishEncryptedBytesFor.bind(null, provider),
    readBytesFrom: readEncryptedBytesFrom.bind(null, provider),
    publishTextFor: publishEncryptedTextFor.bind(null, provider),
    readTextFrom: readEncryptedTextFrom.bind(null, provider),
    publishJsonFor: publishEncryptedJsonFor.bind(null, provider),
    readJsonFrom: readEncryptedJsonFrom.bind(null, provider),
    readPublicKeyEnvelope: readPublicKeyEncryptedEnvelope.bind(null, provider),
  };
  const lookup = {
    create: <T = unknown>(options: Parameters<typeof createKeyedLookup<T>>[1]) => createKeyedLookup<T>(provider, options),
  };
  const records = {
    create: <T = unknown>(options: Parameters<typeof createOwnerRecords<T>>[1]) => createOwnerRecords<T>(provider, options),
  };
  const commitReveal = {
    create: <T = unknown>(options: Parameters<typeof createCommitReveal<T>>[1]) => createCommitReveal<T>(provider, options),
    generateSalt: generateCommitRevealSalt,
    commitmentFor: commitRevealCommitment,
  };
  const signedDocuments = {
    sign: signDocument,
    verify: verifySignedDocument,
    assert: assertSignedDocument,
    signingBytes: signedDocumentPayloadBytes,
    publish: publishSignedDocument.bind(null, provider),
    read: readSignedDocument.bind(null, provider),
    readAndVerify: readAndVerifySignedDocument.bind(null, provider),
    generateP256KeyPair: generateP256SigningKeyPair,
    exportP256PublicKey: exportP256PublicSigningKey,
    importP256PublicKey: importP256PublicSigningKey,
    exportP256PrivateKey: exportP256PrivateSigningKey,
    importP256PrivateKey: importP256PrivateSigningKey,
    createP256Signer: createP256DocumentSigner,
    createP256Verifier: createP256DocumentVerifier,
    createEip1193PersonalSigner,
    createEip191PersonalVerifier,
    createEthereumPersonalVerifier,
  };

  return {
    provider: input,
    driver: provider,
    requestAccess: () => {
      if (!provider.requestAccess) throw new Error('Swarm driver does not support requestAccess');
      return provider.requestAccess();
    },
    getCapabilities: () => {
      if (!provider.getCapabilities) throw new Error('Swarm driver does not support getCapabilities');
      return provider.getCapabilities();
    },
    chunks,
    soc,
    epochFeed,
    objects,
    did,
    hashChain,
    multiWriterFeed,
    crypto,
    lookup,
    records,
    commitReveal,
    signedDocuments,
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
