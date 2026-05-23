// src/bytes.ts
var textEncoder = new TextEncoder();
var textDecoder = new TextDecoder();
function utf8ToBytes(value) {
  return textEncoder.encode(value);
}
function bytesToUtf8(bytes) {
  return textDecoder.decode(bytes);
}
function normalizeBytes(value) {
  if (typeof value === "string") return utf8ToBytes(value);
  if (value instanceof Uint8Array) return value;
  return new Uint8Array(value);
}
function jsonToBytes(value) {
  return utf8ToBytes(JSON.stringify(value));
}
function bytesToJson(bytes) {
  return JSON.parse(bytesToUtf8(bytes));
}
function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 32768) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  }
  return btoa(binary);
}
function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function hexToBytes(hex) {
  const normalized = hex.replace(/^0x/, "");
  if (normalized.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(normalized)) {
    throw new Error("Invalid hex string");
  }
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}
function assertHex(value, bytes, label = "hex") {
  const normalized = value.replace(/^0x/, "");
  if (normalized.length !== bytes * 2 || !/^[0-9a-fA-F]+$/.test(normalized)) {
    throw new Error(`${label} must be a ${bytes * 2}-character hex string`);
  }
  return normalized.toLowerCase();
}

// src/provider.ts
function getWindowSwarm() {
  const swarm = detectWindowSwarm();
  if (!swarm) {
    throw new Error("window.swarm provider is not available");
  }
  return swarm;
}
function detectWindowSwarm(options = {}) {
  const swarm = globalThis.window?.swarm ?? globalThis.swarm;
  if (!swarm) return null;
  if (options.requireFreedomBrowser && !swarm.isFreedomBrowser) return null;
  return swarm;
}
async function waitForSwarm(options = {}) {
  const timeoutMs = options.timeoutMs ?? 5e3;
  const pollIntervalMs = options.pollIntervalMs ?? 50;
  const deadline = Date.now() + timeoutMs;
  do {
    const swarm = detectWindowSwarm(options);
    if (swarm) return swarm;
    await sleep(Math.max(1, pollIntervalMs));
  } while (Date.now() <= deadline);
  throw new Error("window.swarm provider is not available");
}
async function callSwarm(provider, method, params) {
  const directName = directMethodName(method);
  const direct = directName ? provider[directName] : void 0;
  if (typeof direct === "function") {
    return direct.call(provider, params);
  }
  if (provider.request) {
    return provider.request({ method, params });
  }
  throw new Error(`Provider does not support ${method}`);
}
function directMethodName(method) {
  switch (method) {
    case "swarm_requestAccess":
      return "requestAccess";
    case "swarm_getCapabilities":
      return "getCapabilities";
    case "swarm_publishChunk":
      return "publishChunk";
    case "swarm_readChunk":
      return "readChunk";
    case "swarm_writeSingleOwnerChunk":
      return "writeSingleOwnerChunk";
    case "swarm_readSingleOwnerChunk":
      return "readSingleOwnerChunk";
    case "swarm_getSigningIdentity":
      return "getSigningIdentity";
    default:
      return null;
  }
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// src/chunks.ts
async function publishBytes(provider, data, options = {}) {
  return callSwarm(provider, "swarm_publishChunk", {
    data: normalizeBytes(data),
    span: options.span
  });
}
async function readBytes(provider, reference) {
  const result = await callSwarm(provider, "swarm_readChunk", { reference });
  return {
    bytes: base64ToBytes(result.data),
    span: result.span
  };
}
async function publishText(provider, text, options = {}) {
  return publishBytes(provider, utf8ToBytes(text), options);
}
async function readText(provider, reference) {
  return bytesToUtf8((await readBytes(provider, reference)).bytes);
}
async function publishJson(provider, value, options = {}) {
  return publishBytes(provider, jsonToBytes(value), options);
}
async function readJson(provider, reference) {
  return bytesToJson((await readBytes(provider, reference)).bytes);
}

// node_modules/@noble/hashes/esm/_u64.js
var U32_MASK64 = /* @__PURE__ */ BigInt(2 ** 32 - 1);
var _32n = /* @__PURE__ */ BigInt(32);
function fromBig(n, le = false) {
  if (le)
    return { h: Number(n & U32_MASK64), l: Number(n >> _32n & U32_MASK64) };
  return { h: Number(n >> _32n & U32_MASK64) | 0, l: Number(n & U32_MASK64) | 0 };
}
function split(lst, le = false) {
  const len = lst.length;
  let Ah = new Uint32Array(len);
  let Al = new Uint32Array(len);
  for (let i = 0; i < len; i++) {
    const { h, l } = fromBig(lst[i], le);
    [Ah[i], Al[i]] = [h, l];
  }
  return [Ah, Al];
}
var rotlSH = (h, l, s) => h << s | l >>> 32 - s;
var rotlSL = (h, l, s) => l << s | h >>> 32 - s;
var rotlBH = (h, l, s) => l << s - 32 | h >>> 64 - s;
var rotlBL = (h, l, s) => h << s - 32 | l >>> 64 - s;

// node_modules/@noble/hashes/esm/utils.js
function isBytes(a) {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array";
}
function anumber(n) {
  if (!Number.isSafeInteger(n) || n < 0)
    throw new Error("positive integer expected, got " + n);
}
function abytes(b, ...lengths) {
  if (!isBytes(b))
    throw new Error("Uint8Array expected");
  if (lengths.length > 0 && !lengths.includes(b.length))
    throw new Error("Uint8Array expected of length " + lengths + ", got length=" + b.length);
}
function aexists(instance, checkFinished = true) {
  if (instance.destroyed)
    throw new Error("Hash instance has been destroyed");
  if (checkFinished && instance.finished)
    throw new Error("Hash#digest() has already been called");
}
function aoutput(out, instance) {
  abytes(out);
  const min = instance.outputLen;
  if (out.length < min) {
    throw new Error("digestInto() expects output buffer of length at least " + min);
  }
}
function u32(arr) {
  return new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
}
function clean(...arrays) {
  for (let i = 0; i < arrays.length; i++) {
    arrays[i].fill(0);
  }
}
var isLE = /* @__PURE__ */ (() => new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68)();
function byteSwap(word) {
  return word << 24 & 4278190080 | word << 8 & 16711680 | word >>> 8 & 65280 | word >>> 24 & 255;
}
function byteSwap32(arr) {
  for (let i = 0; i < arr.length; i++) {
    arr[i] = byteSwap(arr[i]);
  }
  return arr;
}
var swap32IfBE = isLE ? (u) => u : byteSwap32;
function utf8ToBytes2(str) {
  if (typeof str !== "string")
    throw new Error("string expected");
  return new Uint8Array(new TextEncoder().encode(str));
}
function toBytes(data) {
  if (typeof data === "string")
    data = utf8ToBytes2(data);
  abytes(data);
  return data;
}
var Hash = class {
};
function createHasher(hashCons) {
  const hashC = (msg) => hashCons().update(toBytes(msg)).digest();
  const tmp = hashCons();
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.create = () => hashCons();
  return hashC;
}

// node_modules/@noble/hashes/esm/sha3.js
var _0n = BigInt(0);
var _1n = BigInt(1);
var _2n = BigInt(2);
var _7n = BigInt(7);
var _256n = BigInt(256);
var _0x71n = BigInt(113);
var SHA3_PI = [];
var SHA3_ROTL = [];
var _SHA3_IOTA = [];
for (let round = 0, R = _1n, x = 1, y = 0; round < 24; round++) {
  [x, y] = [y, (2 * x + 3 * y) % 5];
  SHA3_PI.push(2 * (5 * y + x));
  SHA3_ROTL.push((round + 1) * (round + 2) / 2 % 64);
  let t = _0n;
  for (let j = 0; j < 7; j++) {
    R = (R << _1n ^ (R >> _7n) * _0x71n) % _256n;
    if (R & _2n)
      t ^= _1n << (_1n << /* @__PURE__ */ BigInt(j)) - _1n;
  }
  _SHA3_IOTA.push(t);
}
var IOTAS = split(_SHA3_IOTA, true);
var SHA3_IOTA_H = IOTAS[0];
var SHA3_IOTA_L = IOTAS[1];
var rotlH = (h, l, s) => s > 32 ? rotlBH(h, l, s) : rotlSH(h, l, s);
var rotlL = (h, l, s) => s > 32 ? rotlBL(h, l, s) : rotlSL(h, l, s);
function keccakP(s, rounds = 24) {
  const B = new Uint32Array(5 * 2);
  for (let round = 24 - rounds; round < 24; round++) {
    for (let x = 0; x < 10; x++)
      B[x] = s[x] ^ s[x + 10] ^ s[x + 20] ^ s[x + 30] ^ s[x + 40];
    for (let x = 0; x < 10; x += 2) {
      const idx1 = (x + 8) % 10;
      const idx0 = (x + 2) % 10;
      const B0 = B[idx0];
      const B1 = B[idx0 + 1];
      const Th = rotlH(B0, B1, 1) ^ B[idx1];
      const Tl = rotlL(B0, B1, 1) ^ B[idx1 + 1];
      for (let y = 0; y < 50; y += 10) {
        s[x + y] ^= Th;
        s[x + y + 1] ^= Tl;
      }
    }
    let curH = s[2];
    let curL = s[3];
    for (let t = 0; t < 24; t++) {
      const shift = SHA3_ROTL[t];
      const Th = rotlH(curH, curL, shift);
      const Tl = rotlL(curH, curL, shift);
      const PI = SHA3_PI[t];
      curH = s[PI];
      curL = s[PI + 1];
      s[PI] = Th;
      s[PI + 1] = Tl;
    }
    for (let y = 0; y < 50; y += 10) {
      for (let x = 0; x < 10; x++)
        B[x] = s[y + x];
      for (let x = 0; x < 10; x++)
        s[y + x] ^= ~B[(x + 2) % 10] & B[(x + 4) % 10];
    }
    s[0] ^= SHA3_IOTA_H[round];
    s[1] ^= SHA3_IOTA_L[round];
  }
  clean(B);
}
var Keccak = class _Keccak extends Hash {
  // NOTE: we accept arguments in bytes instead of bits here.
  constructor(blockLen, suffix, outputLen, enableXOF = false, rounds = 24) {
    super();
    this.pos = 0;
    this.posOut = 0;
    this.finished = false;
    this.destroyed = false;
    this.enableXOF = false;
    this.blockLen = blockLen;
    this.suffix = suffix;
    this.outputLen = outputLen;
    this.enableXOF = enableXOF;
    this.rounds = rounds;
    anumber(outputLen);
    if (!(0 < blockLen && blockLen < 200))
      throw new Error("only keccak-f1600 function is supported");
    this.state = new Uint8Array(200);
    this.state32 = u32(this.state);
  }
  clone() {
    return this._cloneInto();
  }
  keccak() {
    swap32IfBE(this.state32);
    keccakP(this.state32, this.rounds);
    swap32IfBE(this.state32);
    this.posOut = 0;
    this.pos = 0;
  }
  update(data) {
    aexists(this);
    data = toBytes(data);
    abytes(data);
    const { blockLen, state } = this;
    const len = data.length;
    for (let pos = 0; pos < len; ) {
      const take = Math.min(blockLen - this.pos, len - pos);
      for (let i = 0; i < take; i++)
        state[this.pos++] ^= data[pos++];
      if (this.pos === blockLen)
        this.keccak();
    }
    return this;
  }
  finish() {
    if (this.finished)
      return;
    this.finished = true;
    const { state, suffix, pos, blockLen } = this;
    state[pos] ^= suffix;
    if ((suffix & 128) !== 0 && pos === blockLen - 1)
      this.keccak();
    state[blockLen - 1] ^= 128;
    this.keccak();
  }
  writeInto(out) {
    aexists(this, false);
    abytes(out);
    this.finish();
    const bufferOut = this.state;
    const { blockLen } = this;
    for (let pos = 0, len = out.length; pos < len; ) {
      if (this.posOut >= blockLen)
        this.keccak();
      const take = Math.min(blockLen - this.posOut, len - pos);
      out.set(bufferOut.subarray(this.posOut, this.posOut + take), pos);
      this.posOut += take;
      pos += take;
    }
    return out;
  }
  xofInto(out) {
    if (!this.enableXOF)
      throw new Error("XOF is not possible for this instance");
    return this.writeInto(out);
  }
  xof(bytes) {
    anumber(bytes);
    return this.xofInto(new Uint8Array(bytes));
  }
  digestInto(out) {
    aoutput(out, this);
    if (this.finished)
      throw new Error("digest() was already called");
    this.writeInto(out);
    this.destroy();
    return out;
  }
  digest() {
    return this.digestInto(new Uint8Array(this.outputLen));
  }
  destroy() {
    this.destroyed = true;
    clean(this.state);
  }
  _cloneInto(to) {
    const { blockLen, suffix, outputLen, rounds, enableXOF } = this;
    to || (to = new _Keccak(blockLen, suffix, outputLen, enableXOF, rounds));
    to.state32.set(this.state32);
    to.pos = this.pos;
    to.posOut = this.posOut;
    to.finished = this.finished;
    to.rounds = rounds;
    to.suffix = suffix;
    to.outputLen = outputLen;
    to.enableXOF = enableXOF;
    to.destroyed = this.destroyed;
    return to;
  }
};
var gen = (suffix, blockLen, outputLen) => createHasher(() => new Keccak(blockLen, suffix, outputLen));
var keccak_256 = /* @__PURE__ */ (() => gen(1, 136, 256 / 8))();

// src/identifiers.ts
function keccakHex(bytes) {
  return bytesToHex(keccak_256(bytes));
}
function deriveIdentifier(parts) {
  const encoded = parts.map(encodePart);
  return keccakHex(concatBytes(encoded));
}
function encodePart(part) {
  if (typeof part === "number") {
    if (!Number.isSafeInteger(part) || part < 0) {
      throw new Error("Identifier number parts must be non-negative safe integers");
    }
    return encodeTagged("number", uint64be(BigInt(part)));
  }
  if (typeof part === "bigint") {
    if (part < 0n) throw new Error("Identifier bigint parts must be non-negative");
    return encodeTagged("bigint", uint64be(part));
  }
  if (part instanceof Date) {
    return encodeTagged("date", uint64be(BigInt(part.getTime())));
  }
  if (typeof part === "string") {
    return encodeTagged("string", utf8ToBytes(part));
  }
  return encodeTagged("bytes", normalizeBytes(part));
}
function encodeTagged(tag, bytes) {
  return concatBytes([
    uint32be(tag.length),
    utf8ToBytes(tag),
    uint32be(bytes.length),
    bytes
  ]);
}
function uint32be(value) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, false);
  return bytes;
}
function uint64be(value) {
  if (value > 0xffffffffffffffffn) {
    throw new Error("Identifier integer parts must fit into uint64");
  }
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, value, false);
  return bytes;
}

// src/objects.ts
var DEFAULT_CHUNK_SIZE = 4096;
var MAX_CHILDREN_PER_NODE = 32;
var DEFAULT_MAX_DEPTH = 16;
async function publishObjectBytes(provider, data, options = {}) {
  const bytes = normalizeBytes(data);
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  if (!Number.isSafeInteger(chunkSize) || chunkSize <= 0 || chunkSize > DEFAULT_CHUNK_SIZE) {
    throw new Error(`Object chunk size must be an integer between 1 and ${DEFAULT_CHUNK_SIZE}`);
  }
  const leaves = [];
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunkBytes = bytes.slice(offset, offset + chunkSize);
    const published = await publishBytes(provider, chunkBytes);
    leaves.push({
      type: "chunk",
      reference: published.reference,
      size: chunkBytes.length
    });
  }
  const root = await publishNode(provider, leaves, bytes.length);
  return {
    reference: root.reference,
    size: bytes.length,
    chunkCount: leaves.length,
    nodeCount: root.nodeCount
  };
}
async function readObjectBytes(provider, reference, options = {}) {
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  if (!Number.isSafeInteger(maxDepth) || maxDepth < 0) {
    throw new Error("Object read maxDepth must be a non-negative safe integer");
  }
  const result = await readNode(provider, reference, 0, maxDepth);
  return result.bytes;
}
function publishObjectText(provider, text, options = {}) {
  return publishObjectBytes(provider, utf8ToBytes(text), options);
}
async function readObjectText(provider, reference, options = {}) {
  return bytesToUtf8(await readObjectBytes(provider, reference, options));
}
function publishObjectJson(provider, value, options = {}) {
  return publishObjectBytes(provider, jsonToBytes(value), options);
}
async function readObjectJson(provider, reference, options = {}) {
  return bytesToJson(await readObjectBytes(provider, reference, options));
}
async function publishNode(provider, children, size) {
  if (children.length <= MAX_CHILDREN_PER_NODE) {
    const manifest = createNode(children, size);
    const published = await publishBytes(provider, jsonToBytes(manifest));
    return { reference: published.reference, nodeCount: 1 };
  }
  const nodeChildren = [];
  let nodeCount = 0;
  for (let offset = 0; offset < children.length; offset += MAX_CHILDREN_PER_NODE) {
    const group = children.slice(offset, offset + MAX_CHILDREN_PER_NODE);
    const groupSize = sumChildren(group);
    const published = await publishNode(provider, group, groupSize);
    nodeChildren.push({
      type: "node",
      reference: published.reference,
      size: groupSize
    });
    nodeCount += published.nodeCount;
  }
  const root = await publishNode(provider, nodeChildren, size);
  return {
    reference: root.reference,
    nodeCount: nodeCount + root.nodeCount
  };
}
async function readNode(provider, reference, depth, maxDepth) {
  if (depth > maxDepth) {
    throw new Error("Object graph exceeds maxDepth");
  }
  const node = parseNode(await readBytes(provider, reference).then((result) => result.bytes));
  const parts = await Promise.all(node.children.map(async (child) => {
    if (child.type === "chunk") {
      const chunk = await readBytes(provider, child.reference);
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
function createNode(children, size) {
  return {
    version: 1,
    type: "swarm-kit:chunk-graph",
    size,
    children
  };
}
function parseNode(bytes) {
  const value = bytesToJson(bytes);
  if (value.version !== 1 || value.type !== "swarm-kit:chunk-graph" || typeof value.size !== "number" || !Number.isSafeInteger(value.size) || value.size < 0 || !Array.isArray(value.children)) {
    throw new Error("Invalid object graph node");
  }
  for (const child of value.children) {
    if (!isChild(child)) {
      throw new Error("Invalid object graph child");
    }
  }
  return value;
}
function isChild(value) {
  if (!value || typeof value !== "object") return false;
  const child = value;
  return (child.type === "chunk" || child.type === "node") && typeof child.reference === "string" && typeof child.size === "number" && Number.isSafeInteger(child.size) && child.size >= 0;
}
function sumChildren(children) {
  return children.reduce((sum, child) => sum + child.size, 0);
}

// src/soc.ts
async function getSigningIdentity(provider) {
  return callSwarm(provider, "swarm_getSigningIdentity");
}
async function writeSocBytes(provider, identifier, data, options = {}) {
  return callSwarm(provider, "swarm_writeSingleOwnerChunk", {
    identifier,
    data: normalizeBytes(data),
    span: options.span
  });
}
async function readSocBytesByAddress(provider, address) {
  return decodeSocRead(await callSwarm(provider, "swarm_readSingleOwnerChunk", { address }));
}
async function readSocBytesByOwnerAndIdentifier(provider, owner, identifier) {
  return decodeSocRead(await callSwarm(provider, "swarm_readSingleOwnerChunk", { owner, identifier }));
}
async function writeSocText(provider, identifier, text, options = {}) {
  return writeSocBytes(provider, identifier, utf8ToBytes(text), options);
}
async function readSocTextByAddress(provider, address) {
  return bytesToUtf8((await readSocBytesByAddress(provider, address)).bytes);
}
async function readSocTextByOwnerAndIdentifier(provider, owner, identifier) {
  return bytesToUtf8((await readSocBytesByOwnerAndIdentifier(provider, owner, identifier)).bytes);
}
async function writeSocJson(provider, identifier, value, options = {}) {
  return writeSocBytes(provider, identifier, jsonToBytes(value), options);
}
async function readSocJsonByAddress(provider, address) {
  return bytesToJson((await readSocBytesByAddress(provider, address)).bytes);
}
async function readSocJsonByOwnerAndIdentifier(provider, owner, identifier) {
  return bytesToJson((await readSocBytesByOwnerAndIdentifier(provider, owner, identifier)).bytes);
}
function decodeSocRead(result) {
  const decoded = {
    bytes: base64ToBytes(result.data),
    span: result.span,
    reference: result.reference,
    owner: result.owner,
    identifier: result.identifier
  };
  if (result.signature !== void 0) decoded.signature = result.signature;
  return decoded;
}

// src/did.ts
var DEFAULT_DID_NAMESPACE = "swarm-kit:did-document:v1";
function didDocumentIdentifier(options = {}) {
  return deriveIdentifier([options.namespace ?? DEFAULT_DID_NAMESPACE]);
}
async function writeDidDocument(provider, document, options = {}) {
  const identifier = didDocumentIdentifier(options);
  const published = await publishObjectJson(provider, document);
  const pointer = {
    version: 1,
    type: "swarm-kit:did-document-pointer",
    documentReference: published.reference,
    documentSize: published.size,
    writtenAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  const result = await writeSocJson(provider, identifier, pointer);
  return {
    ...result,
    document,
    documentReference: published.reference,
    pointer
  };
}
async function readDidDocument(provider, owner, options = {}) {
  const identifier = didDocumentIdentifier(options);
  const pointer = await readSocJsonByOwnerAndIdentifier(provider, owner, identifier);
  validatePointer(pointer);
  const document = await readObjectJson(provider, pointer.documentReference);
  return {
    owner,
    identifier,
    reference: pointer.documentReference,
    document,
    pointer
  };
}
function validatePointer(pointer) {
  if (pointer.version !== 1 || pointer.type !== "swarm-kit:did-document-pointer" || typeof pointer.documentReference !== "string" || typeof pointer.documentSize !== "number" || !Number.isSafeInteger(pointer.documentSize) || pointer.documentSize < 0 || typeof pointer.writtenAt !== "string") {
    throw new Error("Invalid DID document pointer");
  }
}

// src/errors.ts
var SwarmKitError = class extends Error {
  code;
  reason;
  cause;
  constructor(message, options = {}) {
    super(message);
    this.name = "SwarmKitError";
    this.code = options.code;
    this.reason = options.reason;
    this.cause = options.cause;
  }
};
function getSwarmErrorReason(error) {
  return error?.data?.reason ?? error?.reason;
}
function isSwarmReason(error, reason) {
  return getSwarmErrorReason(error) === reason;
}
function normalizeError(error) {
  if (error instanceof SwarmKitError) return error;
  const providerError = error;
  return new SwarmKitError(providerError?.message || String(error), buildErrorOptions(providerError, error));
}
function buildErrorOptions(providerError, cause) {
  const options = { cause };
  if (providerError.code !== void 0) options.code = providerError.code;
  if (providerError.data?.reason !== void 0) options.reason = providerError.data.reason;
  return options;
}

// src/epoch-feed.ts
var DEFAULT_NAMESPACE = "swarm-kit:epoch-feed:v1";
function createEpochFeed(provider, options) {
  const periodMs = periodToMs(options.period);
  const namespace = options.namespace ?? DEFAULT_NAMESPACE;
  function epochStartFor(date) {
    const time = typeof date === "number" ? date : date.getTime();
    return Math.floor(time / periodMs) * periodMs;
  }
  function identifierFor(date) {
    return deriveIdentifier([
      namespace,
      options.topic,
      periodMs,
      epochStartFor(date)
    ]);
  }
  async function readAt(owner, date) {
    const epochStartMs = epochStartFor(date);
    const identifier = identifierFor(epochStartMs);
    try {
      const envelope = await readSocJsonByOwnerAndIdentifier(provider, owner, identifier);
      return {
        owner,
        identifier,
        epochStartMs,
        value: envelope.value,
        envelope
      };
    } catch (error) {
      if (isSwarmReason(error, "chunk_not_found")) return null;
      throw error;
    }
  }
  return {
    topic: options.topic,
    periodMs,
    identifierFor,
    epochStartFor,
    async getOwner() {
      return (await getSigningIdentity(provider)).owner;
    },
    async write(value, writeOptions = {}) {
      const at = writeOptions.at ?? Date.now();
      const epochStartMs = epochStartFor(at);
      const identifier = identifierFor(epochStartMs);
      const envelope = {
        version: 1,
        topic: options.topic,
        periodMs,
        epochStartMs,
        writtenAt: (/* @__PURE__ */ new Date()).toISOString(),
        value
      };
      const result = await writeSocJson(provider, identifier, envelope);
      return {
        ...result,
        epochStartMs,
        envelope
      };
    },
    readAt,
    readCurrent(owner) {
      return readAt(owner, Date.now());
    },
    async readLatest(owner, readOptions = {}) {
      const lookback = readOptions.lookback ?? 24;
      const from = readOptions.from ?? Date.now();
      const start = epochStartFor(from);
      for (let i = 0; i < lookback; i++) {
        const result = await readAt(owner, start - i * periodMs);
        if (result) return result;
      }
      return null;
    }
  };
}
function periodToMs(period) {
  if (period === "minute") return 6e4;
  if (period === "hour") return 36e5;
  if (period === "day") return 864e5;
  if (!Number.isSafeInteger(period.seconds) || period.seconds <= 0) {
    throw new Error("Custom epoch period must be a positive integer number of seconds");
  }
  return period.seconds * 1e3;
}

// src/indexed-soc.ts
async function findLatestContiguousIndex(existsAt, options = {}) {
  const maxIndex = options.maxIndex ?? Number.MAX_SAFE_INTEGER;
  assertIndexedSocIndex(maxIndex, "maxIndex");
  if (!await existsAt(0)) return -1;
  let low = 0;
  let high = 1;
  while (high <= maxIndex && await existsAt(high)) {
    low = high;
    if (high === maxIndex) return high;
    high = Math.min(high * 2, maxIndex);
  }
  let left = low + 1;
  let right = Math.min(high - 1, maxIndex);
  while (left <= right) {
    const mid = left + Math.floor((right - left) / 2);
    if (await existsAt(mid)) {
      low = mid;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  return low;
}
function assertIndexedSocIndex(index, label = "index") {
  if (!Number.isSafeInteger(index) || index < 0) {
    throw new Error(`Indexed SOC ${label} must be a non-negative safe integer`);
  }
}
function assertIndexedSocLimit(limit, label = "limit") {
  if (!Number.isSafeInteger(limit) || limit < 0) {
    throw new Error(`Indexed SOC ${label} must be a non-negative safe integer`);
  }
}

// src/hash-chain.ts
var DEFAULT_HASH_CHAIN_NAMESPACE = "swarm-kit:hash-chain:v1";
var MAX_APPEND_ATTEMPTS = 3;
function createHashChain(provider, options) {
  const namespace = options.namespace ?? DEFAULT_HASH_CHAIN_NAMESPACE;
  async function getOwner() {
    return (await getSigningIdentity(provider)).owner;
  }
  function entryIdentifier(index) {
    assertIndexedSocIndex(index, "hash chain index");
    return deriveIdentifier([namespace, options.topic, "entry", index]);
  }
  async function hydrateEntry(record) {
    const payload = await readObjectJson(provider, record.envelope.payloadReference);
    return {
      ...record.envelope,
      owner: record.soc.owner,
      identifier: record.soc.identifier,
      reference: record.soc.reference,
      payload
    };
  }
  async function readEntryRecord(owner, index) {
    assertIndexedSocIndex(index, "hash chain index");
    try {
      const identifier = entryIdentifier(index);
      const soc = await readSocBytesByOwnerAndIdentifier(provider, owner, identifier);
      const envelope = parseEntryEnvelope(bytesToJson(soc.bytes), options.topic);
      if (envelope.index !== index) {
        throw new Error(`Hash chain entry index mismatch for ${soc.reference}`);
      }
      if (soc.identifier.toLowerCase() !== identifier.toLowerCase()) {
        throw new Error(`Hash chain identifier mismatch for ${soc.reference}`);
      }
      return { envelope, soc };
    } catch (error) {
      if (isSwarmReason(error, "chunk_not_found")) return null;
      throw error;
    }
  }
  async function readEntryByAddress(reference, owner) {
    const soc = await readSocBytesByAddress(provider, reference);
    if (soc.owner.toLowerCase() !== owner.toLowerCase()) {
      throw new Error(`Hash chain owner mismatch for ${reference}`);
    }
    const envelope = parseEntryEnvelope(bytesToJson(soc.bytes), options.topic);
    if (soc.identifier.toLowerCase() !== entryIdentifier(envelope.index).toLowerCase()) {
      throw new Error(`Hash chain identifier mismatch for ${reference}`);
    }
    return hydrateEntry({ envelope, soc });
  }
  async function readAt(owner, index) {
    const record = await readEntryRecord(owner, index);
    return record ? hydrateEntry(record) : null;
  }
  async function findLatestIndex(owner) {
    return findLatestContiguousIndex(async (index) => await readEntryRecord(owner, index) !== null);
  }
  async function readLatestRecord(owner) {
    const index = await findLatestIndex(owner);
    return index < 0 ? null : readEntryRecord(owner, index);
  }
  async function readHead(owner) {
    const record = await readLatestRecord(owner);
    return record ? hydrateEntry(record) : null;
  }
  return {
    topic: options.topic,
    entryIdentifier,
    getOwner,
    async append(payload, appendOptions = {}) {
      const owner = await getOwner();
      const publishedPayload = await publishObjectJson(provider, payload);
      const writtenAt = new Date(appendOptions.at ?? Date.now()).toISOString();
      let lastCollision = null;
      for (let attempt = 0; attempt < MAX_APPEND_ATTEMPTS; attempt += 1) {
        const current = await readLatestRecord(owner);
        const index = current ? current.envelope.index + 1 : 0;
        const previousReference = current?.soc.reference ?? null;
        const envelope = {
          version: 1,
          type: "swarm-kit:hash-chain-entry",
          topic: options.topic,
          index,
          previousReference,
          payloadReference: publishedPayload.reference,
          payloadSize: publishedPayload.size,
          writtenAt
        };
        const identifier = entryIdentifier(index);
        const entryWrite = await writeSocJson(provider, identifier, envelope);
        const stored = await readEntryRecord(owner, index);
        if (stored && sameEntryEnvelope(stored.envelope, envelope)) {
          return {
            ...envelope,
            owner: entryWrite.owner,
            identifier: entryWrite.identifier,
            reference: entryWrite.reference,
            payload,
            entryWrite
          };
        }
        lastCollision = new SwarmKitError(`Hash chain append collision at index ${index}`, {
          reason: "soc_write_collision"
        });
      }
      throw lastCollision ?? new SwarmKitError("Hash chain append failed", { reason: "soc_write_collision" });
    },
    readHead,
    readAt,
    async readLatest(owner, readOptions = {}) {
      const limit = readOptions.limit ?? 10;
      assertIndexedSocLimit(limit, "hash chain read limit");
      if (limit === 0) return [];
      const latest = await readLatestRecord(owner);
      if (!latest) return [];
      const entries = [];
      let current = await hydrateEntry(latest);
      while (current && entries.length < limit) {
        entries.push(current);
        current = current.previousReference ? await readEntryByAddress(current.previousReference, owner) : null;
      }
      return entries;
    }
  };
}
function parseEntryEnvelope(value, topic) {
  if (value.version !== 1 || value.type !== "swarm-kit:hash-chain-entry" || value.topic !== topic || !Number.isSafeInteger(value.index) || value.index < 0 || !(typeof value.previousReference === "string" || value.previousReference === null) || typeof value.payloadReference !== "string" || typeof value.payloadSize !== "number" || !Number.isSafeInteger(value.payloadSize) || value.payloadSize < 0 || typeof value.writtenAt !== "string") {
    throw new Error("Invalid hash chain entry");
  }
  return value;
}
function sameEntryEnvelope(a, b) {
  return a.version === b.version && a.type === b.type && a.topic === b.topic && a.index === b.index && a.previousReference === b.previousReference && a.payloadReference === b.payloadReference && a.payloadSize === b.payloadSize && a.writtenAt === b.writtenAt;
}

// src/multi-writer-feed.ts
var DEFAULT_MULTI_WRITER_NAMESPACE = "swarm-kit:multi-writer-feed:v1";
var DEFAULT_WRITER_ID = "default";
var MAX_APPEND_ATTEMPTS2 = 3;
function createMultiWriterFeed(provider, options) {
  const namespace = options.namespace ?? DEFAULT_MULTI_WRITER_NAMESPACE;
  const localWriterId = options.writerId ?? DEFAULT_WRITER_ID;
  function normalizeWriterId(writerId = localWriterId) {
    if (!writerId.trim()) throw new Error("Multi-writer feed writerId must not be empty");
    return writerId;
  }
  function entryIdentifier(index, writerId = localWriterId) {
    assertIndexedSocIndex(index, "multi-writer feed index");
    return deriveIdentifier([namespace, options.topic, normalizeWriterId(writerId), "entry", index]);
  }
  async function getOwner() {
    return (await getSigningIdentity(provider)).owner;
  }
  async function hydrateEntry(record) {
    const payload = await readObjectJson(provider, record.envelope.payloadReference);
    return {
      ...record.envelope,
      owner: record.soc.owner,
      identifier: record.soc.identifier,
      reference: record.soc.reference,
      payload
    };
  }
  async function readEntryRecord(owner, index, writerId) {
    assertIndexedSocIndex(index, "multi-writer feed index");
    try {
      const identifier = entryIdentifier(index, writerId);
      const soc = await readSocBytesByOwnerAndIdentifier(provider, owner, identifier);
      const envelope = parseEntryEnvelope2(bytesToJson(soc.bytes), options.topic, writerId);
      if (envelope.index !== index) {
        throw new Error(`Multi-writer feed entry index mismatch for ${soc.reference}`);
      }
      if (soc.identifier.toLowerCase() !== identifier.toLowerCase()) {
        throw new Error(`Multi-writer feed identifier mismatch for ${soc.reference}`);
      }
      return { envelope, soc };
    } catch (error) {
      if (isSwarmReason(error, "chunk_not_found")) return null;
      throw error;
    }
  }
  async function readEntryByAddress(reference, owner, writerId) {
    const soc = await readSocBytesByAddress(provider, reference);
    if (soc.owner.toLowerCase() !== owner.toLowerCase()) {
      throw new Error(`Multi-writer feed owner mismatch for ${reference}`);
    }
    const envelope = parseEntryEnvelope2(bytesToJson(soc.bytes), options.topic, writerId);
    if (soc.identifier.toLowerCase() !== entryIdentifier(envelope.index, writerId).toLowerCase()) {
      throw new Error(`Multi-writer feed identifier mismatch for ${reference}`);
    }
    return hydrateEntry({ envelope, soc });
  }
  async function readAt(owner, index, readOptions = {}) {
    const writerId = normalizeWriterId(readOptions.writerId);
    const record = await readEntryRecord(owner, index, writerId);
    return record ? hydrateEntry(record) : null;
  }
  async function findLatestIndex(owner, writerId) {
    return findLatestContiguousIndex(async (index) => await readEntryRecord(owner, index, writerId) !== null);
  }
  async function readLatestRecord(owner, writerId) {
    const index = await findLatestIndex(owner, writerId);
    return index < 0 ? null : readEntryRecord(owner, index, writerId);
  }
  async function readWriter(owner, readOptions = {}) {
    const writerId = normalizeWriterId(readOptions.writerId);
    const limit = readOptions.limit ?? 10;
    assertIndexedSocLimit(limit, "multi-writer feed read limit");
    if (limit === 0) return [];
    const latest = await readLatestRecord(owner, writerId);
    if (!latest) return [];
    const entries = [];
    let current = await hydrateEntry(latest);
    while (current && entries.length < limit) {
      entries.push(current);
      current = current.previousReference ? await readEntryByAddress(current.previousReference, owner, writerId) : null;
    }
    return entries;
  }
  return {
    topic: options.topic,
    writerId: localWriterId,
    entryIdentifier,
    getOwner,
    async append(payload, appendOptions = {}) {
      const owner = await getOwner();
      const publishedPayload = await publishObjectJson(provider, payload);
      const writtenAt = new Date(appendOptions.at ?? Date.now()).toISOString();
      let lastCollision = null;
      for (let attempt = 0; attempt < MAX_APPEND_ATTEMPTS2; attempt += 1) {
        const current = await readLatestRecord(owner, localWriterId);
        const index = current ? current.envelope.index + 1 : 0;
        const previousReference = current?.soc.reference ?? null;
        const envelope = {
          version: 1,
          type: "swarm-kit:multi-writer-feed-entry",
          topic: options.topic,
          writerId: localWriterId,
          index,
          previousReference,
          payloadReference: publishedPayload.reference,
          payloadSize: publishedPayload.size,
          writtenAt
        };
        const entryWrite = await writeSocJson(provider, entryIdentifier(index), envelope);
        const stored = await readEntryRecord(owner, index, localWriterId);
        if (stored && sameEntryEnvelope2(stored.envelope, envelope)) {
          return {
            ...envelope,
            owner: entryWrite.owner,
            identifier: entryWrite.identifier,
            reference: entryWrite.reference,
            payload,
            entryWrite
          };
        }
        lastCollision = new SwarmKitError(`Multi-writer feed append collision at index ${index}`, {
          reason: "soc_write_collision"
        });
      }
      throw lastCollision ?? new SwarmKitError("Multi-writer feed append failed", { reason: "soc_write_collision" });
    },
    readAt,
    readWriter,
    async readLatest(writers, readOptions = {}) {
      const limitPerWriter = readOptions.limitPerWriter ?? 10;
      assertIndexedSocLimit(limitPerWriter, "multi-writer feed limitPerWriter");
      if (readOptions.limit !== void 0 && (!Number.isSafeInteger(readOptions.limit) || readOptions.limit < 0)) {
        throw new Error("Multi-writer feed limit must be a non-negative safe integer");
      }
      const results = await Promise.all(writers.map(
        (writer) => readWriter(writer.owner, {
          writerId: writer.writerId ?? localWriterId,
          limit: limitPerWriter
        })
      ));
      const merged = results.flat().sort(compareEntriesNewestFirst);
      return readOptions.limit === void 0 ? merged : merged.slice(0, readOptions.limit);
    }
  };
}
function parseEntryEnvelope2(value, topic, writerId) {
  if (value.version !== 1 || value.type !== "swarm-kit:multi-writer-feed-entry" || value.topic !== topic || value.writerId !== writerId || !Number.isSafeInteger(value.index) || value.index < 0 || !(typeof value.previousReference === "string" || value.previousReference === null) || typeof value.payloadReference !== "string" || typeof value.payloadSize !== "number" || !Number.isSafeInteger(value.payloadSize) || value.payloadSize < 0 || typeof value.writtenAt !== "string") {
    throw new Error("Invalid multi-writer feed entry");
  }
  return value;
}
function sameEntryEnvelope2(a, b) {
  return a.version === b.version && a.type === b.type && a.topic === b.topic && a.writerId === b.writerId && a.index === b.index && a.previousReference === b.previousReference && a.payloadReference === b.payloadReference && a.payloadSize === b.payloadSize && a.writtenAt === b.writtenAt;
}
function compareEntriesNewestFirst(a, b) {
  const time = Date.parse(b.writtenAt) - Date.parse(a.writtenAt);
  if (time !== 0) return time;
  const index = b.index - a.index;
  if (index !== 0) return index;
  const owner = a.owner.localeCompare(b.owner);
  if (owner !== 0) return owner;
  return a.writerId.localeCompare(b.writerId);
}

// src/client.ts
function createSwarmKit(provider = getWindowSwarm()) {
  const chunks = {
    publishBytes: publishBytes.bind(null, provider),
    readBytes: readBytes.bind(null, provider),
    publishText: publishText.bind(null, provider),
    readText: readText.bind(null, provider),
    publishJson: publishJson.bind(null, provider),
    readJson: readJson.bind(null, provider)
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
    readJsonByOwnerAndIdentifier: readSocJsonByOwnerAndIdentifier.bind(null, provider)
  };
  const epochFeed = {
    create: (options) => createEpochFeed(provider, options)
  };
  const objects = {
    publishBytes: publishObjectBytes.bind(null, provider),
    readBytes: readObjectBytes.bind(null, provider),
    publishText: publishObjectText.bind(null, provider),
    readText: readObjectText.bind(null, provider),
    publishJson: publishObjectJson.bind(null, provider),
    readJson: readObjectJson.bind(null, provider)
  };
  const did = {
    documentIdentifier: didDocumentIdentifier,
    writeDocument: writeDidDocument.bind(null, provider),
    readDocument: readDidDocument.bind(null, provider)
  };
  const hashChain = {
    create: (options) => createHashChain(provider, options)
  };
  const multiWriterFeed = {
    create: (options) => createMultiWriterFeed(provider, options)
  };
  return {
    provider,
    requestAccess: () => callSwarm(provider, "swarm_requestAccess"),
    getCapabilities: () => callSwarm(provider, "swarm_getCapabilities"),
    chunks,
    soc,
    epochFeed,
    objects,
    did,
    hashChain,
    multiWriterFeed,
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
    createEpochFeed: epochFeed.create
  };
}
export {
  SwarmKitError,
  assertHex,
  base64ToBytes,
  bytesToBase64,
  bytesToHex,
  bytesToJson,
  bytesToUtf8,
  callSwarm,
  concatBytes,
  createEpochFeed,
  createHashChain,
  createMultiWriterFeed,
  createSwarmKit,
  deriveIdentifier,
  detectWindowSwarm,
  didDocumentIdentifier,
  getSigningIdentity,
  getSwarmErrorReason,
  getWindowSwarm,
  hexToBytes,
  isSwarmReason,
  jsonToBytes,
  keccakHex,
  normalizeBytes,
  normalizeError,
  publishBytes,
  publishJson,
  publishObjectBytes,
  publishObjectJson,
  publishObjectText,
  publishText,
  readBytes,
  readDidDocument,
  readJson,
  readObjectBytes,
  readObjectJson,
  readObjectText,
  readSocBytesByAddress,
  readSocBytesByOwnerAndIdentifier,
  readSocJsonByAddress,
  readSocJsonByOwnerAndIdentifier,
  readSocTextByAddress,
  readSocTextByOwnerAndIdentifier,
  readText,
  utf8ToBytes,
  waitForSwarm,
  writeDidDocument,
  writeSocBytes,
  writeSocJson,
  writeSocText
};
/*! Bundled license information:

@noble/hashes/esm/utils.js:
  (*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) *)
*/
