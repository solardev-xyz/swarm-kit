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

// src/indexed-soc.ts
var DEFAULT_ENTRY_TAG = "entry";
var DEFAULT_LABEL = "indexed SOC stream";
var DEFAULT_MAX_APPEND_ATTEMPTS = 3;
function createIndexedSocStream(provider, options) {
  const parts = options.parts ?? [];
  const entryTag = options.entryTag ?? DEFAULT_ENTRY_TAG;
  const label = options.label ?? DEFAULT_LABEL;
  const maxAppendAttempts = options.maxAppendAttempts ?? DEFAULT_MAX_APPEND_ATTEMPTS;
  const sameEnvelope5 = options.sameEnvelope ?? defaultSameEnvelope;
  function entryIdentifier(index) {
    assertIndexedSocIndex(index, `${label} index`);
    return deriveIdentifier([options.namespace, ...parts, entryTag, index]);
  }
  async function getOwner() {
    return (await getSigningIdentity(provider)).owner;
  }
  async function readRecord(owner, index) {
    assertIndexedSocIndex(index, `${label} index`);
    const identifier = entryIdentifier(index);
    try {
      const soc = await readSocBytesByOwnerAndIdentifier(provider, owner, identifier);
      if (soc.identifier.toLowerCase() !== identifier.toLowerCase()) {
        throw new Error(`${label} identifier mismatch for ${soc.reference}`);
      }
      const envelope = options.parseEnvelope(bytesToJson(soc.bytes), {
        index,
        identifier,
        owner: soc.owner,
        reference: soc.reference
      });
      return { envelope, soc };
    } catch (error) {
      if (isSwarmReason(error, "chunk_not_found")) return null;
      throw error;
    }
  }
  async function readAt(owner, index) {
    const record = await readRecord(owner, index);
    return record ? toStreamEntry(record) : null;
  }
  async function findLatestIndex(owner, findOptions = {}) {
    return findLatestContiguousIndex(
      async (index) => await readRecord(owner, index) !== null,
      findOptions
    );
  }
  async function readLatestRecord(owner) {
    const index = await findLatestIndex(owner);
    return index < 0 ? null : readRecord(owner, index);
  }
  return {
    entryIdentifier,
    getOwner,
    append: async (createEnvelope) => {
      const owner = await getOwner();
      let lastCollision = null;
      for (let attempt = 0; attempt < maxAppendAttempts; attempt += 1) {
        const current = await readLatestRecord(owner);
        const index = current ? getRecordIndex(current) + 1 : 0;
        const previousReference = current?.soc.reference ?? null;
        const envelope = await createEnvelope({ owner, index, previousReference });
        const identifier = entryIdentifier(index);
        const entryWrite = await writeSocJson(provider, identifier, envelope);
        const stored = await readRecord(owner, index);
        if (stored && sameEnvelope5(stored.envelope, envelope)) {
          return {
            ...toStreamEntry(stored),
            entryWrite
          };
        }
        lastCollision = new SwarmKitError(`${label} append collision at index ${index}`, {
          reason: "soc_write_collision"
        });
      }
      throw lastCollision ?? new SwarmKitError(`${label} append failed`, { reason: "soc_write_collision" });
    },
    readRecord,
    readAt,
    findLatestIndex,
    readLatestRecord,
    readLatest: async (owner, readOptions = {}) => {
      const limit = readOptions.limit ?? 10;
      assertIndexedSocLimit(limit, `${label} read limit`);
      if (limit === 0) return [];
      const latestIndex = await findLatestIndex(owner);
      if (latestIndex < 0) return [];
      const start = Math.max(0, latestIndex - limit + 1);
      const entries = [];
      for (let index = latestIndex; index >= start; index -= 1) {
        const entry = await readAt(owner, index);
        if (!entry) break;
        entries.push(entry);
      }
      return entries;
    }
  };
}
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
function toStreamEntry(record) {
  return {
    owner: record.soc.owner,
    identifier: record.soc.identifier,
    reference: record.soc.reference,
    envelope: record.envelope
  };
}
function getRecordIndex(record) {
  const index = record.envelope.index;
  if (Number.isSafeInteger(index) && index >= 0) return index;
  throw new Error("Indexed SOC envelope must expose its index");
}
function defaultSameEnvelope(stored, expected) {
  return JSON.stringify(stored) === JSON.stringify(expected);
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

// src/did.ts
var DEFAULT_DID_NAMESPACE = "swarm-kit:did-document:v1";
function didDocumentIdentifier(options = {}) {
  return didDocumentRevisionIdentifier(0, options);
}
function didDocumentRevisionIdentifier(index, options = {}) {
  assertIndexedSocIndex(index, "DID document revision");
  return deriveIdentifier([options.namespace ?? DEFAULT_DID_NAMESPACE, "revision", index]);
}
function createDidDocument(provider, options = {}) {
  const stream = createDidDocumentStream(provider, options);
  async function hydrateRevision(entry) {
    const document = await readObjectJson(provider, entry.envelope.documentReference);
    return {
      ...entry.envelope,
      owner: entry.owner,
      identifier: entry.identifier,
      reference: entry.reference,
      document,
      pointer: entry.envelope
    };
  }
  async function hydrateRecord(record) {
    return hydrateRevision({
      owner: record.soc.owner,
      identifier: record.soc.identifier,
      reference: record.soc.reference,
      envelope: record.envelope
    });
  }
  return {
    revisionIdentifier: stream.entryIdentifier,
    getOwner: stream.getOwner,
    async write(document, writeOptions = {}) {
      const published = await publishObjectJson(provider, document);
      const writtenAt = new Date(writeOptions.at ?? Date.now()).toISOString();
      const appended = await stream.append(({ index, previousReference }) => ({
        version: 1,
        type: "swarm-kit:did-document-revision",
        revision: index,
        index,
        previousReference,
        documentReference: published.reference,
        documentSize: published.size,
        writtenAt
      }));
      return {
        ...appended.envelope,
        owner: appended.owner,
        identifier: appended.identifier,
        reference: appended.reference,
        document,
        pointer: appended.envelope,
        revisionWrite: appended.entryWrite,
        entryWrite: appended.entryWrite
      };
    },
    async readAt(owner, revision) {
      const entry = await stream.readAt(owner, revision);
      return entry ? hydrateRevision(entry) : null;
    },
    async readLatest(owner) {
      const record = await stream.readLatestRecord(owner);
      return record ? hydrateRecord(record) : null;
    },
    async readHistory(owner, readOptions = {}) {
      const entries = await stream.readLatest(owner, { limit: readOptions.limit ?? 10 });
      return Promise.all(entries.map(hydrateRevision));
    }
  };
}
async function writeDidDocument(provider, document, options = {}) {
  return createDidDocument(provider, options).write(document);
}
async function readDidDocument(provider, owner, options = {}) {
  const latest = await createDidDocument(provider, options).readLatest(owner);
  if (!latest) {
    throw new Error("DID document not found");
  }
  return latest;
}
function createDidDocumentStream(provider, options) {
  return createIndexedSocStream(provider, createDidDocumentStreamOptions(options));
}
function createDidDocumentStreamOptions(options) {
  const namespace = options.namespace ?? DEFAULT_DID_NAMESPACE;
  return {
    namespace,
    entryTag: "revision",
    label: "DID document",
    parseEnvelope: (value, context) => {
      validateRevisionEnvelope(value);
      if (value.index !== context.index || value.revision !== context.index) {
        throw new Error(`DID document revision index mismatch for ${context.reference}`);
      }
      return value;
    },
    sameEnvelope
  };
}
function validateRevisionEnvelope(revision) {
  if (revision.version !== 1 || revision.type !== "swarm-kit:did-document-revision" || !Number.isSafeInteger(revision.revision) || revision.revision < 0 || !Number.isSafeInteger(revision.index) || revision.index < 0 || !(typeof revision.previousReference === "string" || revision.previousReference === null) || typeof revision.documentReference !== "string" || typeof revision.documentSize !== "number" || !Number.isSafeInteger(revision.documentSize) || revision.documentSize < 0 || typeof revision.writtenAt !== "string") {
    throw new Error("Invalid DID document revision");
  }
}
function sameEnvelope(a, b) {
  return a.version === b.version && a.type === b.type && a.revision === b.revision && a.index === b.index && a.previousReference === b.previousReference && a.documentReference === b.documentReference && a.documentSize === b.documentSize && a.writtenAt === b.writtenAt;
}

// src/encryption.ts
var AES_GCM = "AES-GCM";
var ECDH = "ECDH";
var ECDH_NAMED_CURVE = "P-256";
var HKDF = "HKDF";
var AES_KEY_LENGTH = 256;
var NONCE_BYTES = 12;
var SALT_BYTES = 16;
var DEFAULT_PBKDF2_ITERATIONS = 21e4;
var DEFAULT_PBKDF2_HASH = "SHA-256";
var PUBLIC_KEY_ENCRYPTION_ALGORITHM = "ECDH-P256-HKDF-SHA-256-AES-GCM";
var PUBLIC_KEY_INFO = utf8ToBytes("swarm-kit:public-key-encryption:v1");
async function generateEncryptionKey() {
  return getSubtle().generateKey(
    { name: AES_GCM, length: AES_KEY_LENGTH },
    true,
    ["encrypt", "decrypt"]
  );
}
async function exportEncryptionKey(key) {
  return bytesToBase64(new Uint8Array(await getSubtle().exportKey("raw", key)));
}
async function importEncryptionKey(key) {
  const bytes = typeof key === "string" ? base64ToBytes(key) : normalizeBytes(key);
  if (bytes.length !== 32) {
    throw new Error("AES-GCM keys must be 32 bytes");
  }
  return getSubtle().importKey("raw", toArrayBuffer(bytes), AES_GCM, true, ["encrypt", "decrypt"]);
}
async function generateEncryptionKeyPair(options = {}) {
  return getSubtle().generateKey(
    { name: ECDH, namedCurve: ECDH_NAMED_CURVE },
    options.extractable ?? true,
    ["deriveBits"]
  );
}
async function exportPublicEncryptionKey(key) {
  return getSubtle().exportKey("jwk", key);
}
async function importPublicEncryptionKey(key) {
  return getSubtle().importKey(
    "jwk",
    key,
    { name: ECDH, namedCurve: ECDH_NAMED_CURVE },
    true,
    []
  );
}
async function exportPrivateEncryptionKey(key) {
  return getSubtle().exportKey("jwk", key);
}
async function importPrivateEncryptionKey(key, options = {}) {
  return getSubtle().importKey(
    "jwk",
    key,
    { name: ECDH, namedCurve: ECDH_NAMED_CURVE },
    options.extractable ?? true,
    ["deriveBits"]
  );
}
async function deriveEncryptionKeyFromPassword(password, options = {}) {
  const saltBytes = options.salt === void 0 ? randomBytes(SALT_BYTES) : typeof options.salt === "string" ? base64ToBytes(options.salt) : normalizeBytes(options.salt);
  const iterations = options.iterations ?? DEFAULT_PBKDF2_ITERATIONS;
  const hash = options.hash ?? DEFAULT_PBKDF2_HASH;
  if (!Number.isSafeInteger(iterations) || iterations <= 0) {
    throw new Error("PBKDF2 iterations must be a positive safe integer");
  }
  const passwordKey = await getSubtle().importKey(
    "raw",
    toArrayBuffer(utf8ToBytes(password)),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  const key = await getSubtle().deriveKey(
    {
      name: "PBKDF2",
      salt: toArrayBuffer(saltBytes),
      iterations,
      hash
    },
    passwordKey,
    { name: AES_GCM, length: AES_KEY_LENGTH },
    true,
    ["encrypt", "decrypt"]
  );
  return {
    key,
    salt: bytesToBase64(saltBytes),
    iterations,
    hash
  };
}
async function encryptBytes(bytes, key) {
  const plaintext = normalizeBytes(bytes);
  const nonce = randomBytes(NONCE_BYTES);
  const ciphertext = new Uint8Array(await getSubtle().encrypt(
    { name: AES_GCM, iv: toArrayBuffer(nonce) },
    key,
    toArrayBuffer(plaintext)
  ));
  return {
    version: 1,
    type: "swarm-kit:encrypted-bytes",
    algorithm: "AES-GCM",
    keyLength: AES_KEY_LENGTH,
    nonce: bytesToBase64(nonce),
    ciphertext: bytesToBase64(ciphertext),
    plaintextSize: plaintext.length
  };
}
async function decryptBytes(envelope, key) {
  validateEncryptedEnvelope(envelope);
  const plaintext = new Uint8Array(await getSubtle().decrypt(
    { name: AES_GCM, iv: toArrayBuffer(base64ToBytes(envelope.nonce)) },
    key,
    toArrayBuffer(base64ToBytes(envelope.ciphertext))
  ));
  if (plaintext.length !== envelope.plaintextSize) {
    throw new Error("Encrypted object plaintext size mismatch");
  }
  return plaintext;
}
async function encryptText(text, key) {
  return encryptBytes(utf8ToBytes(text), key);
}
async function decryptText(envelope, key) {
  return bytesToUtf8(await decryptBytes(envelope, key));
}
async function encryptJson(value, key) {
  return encryptBytes(jsonToBytes(value), key);
}
async function decryptJson(envelope, key) {
  return bytesToJson(await decryptBytes(envelope, key));
}
async function encryptBytesFor(bytes, recipientPublicKey) {
  const plaintext = normalizeBytes(bytes);
  const publicKey = await resolvePublicEncryptionKey(recipientPublicKey);
  const ephemeral = await generateEncryptionKeyPair({ extractable: true });
  const salt = randomBytes(SALT_BYTES);
  const nonce = randomBytes(NONCE_BYTES);
  const contentKey = await derivePublicKeyContentKey(ephemeral.privateKey, publicKey, salt);
  const ciphertext = new Uint8Array(await getSubtle().encrypt(
    { name: AES_GCM, iv: toArrayBuffer(nonce) },
    contentKey,
    toArrayBuffer(plaintext)
  ));
  return {
    version: 1,
    type: "swarm-kit:public-key-encrypted-bytes",
    algorithm: PUBLIC_KEY_ENCRYPTION_ALGORITHM,
    keyAgreement: "ECDH-P256",
    kdf: "HKDF-SHA-256",
    contentEncryption: "AES-GCM",
    ephemeralPublicKey: await exportPublicEncryptionKey(ephemeral.publicKey),
    salt: bytesToBase64(salt),
    nonce: bytesToBase64(nonce),
    ciphertext: bytesToBase64(ciphertext),
    plaintextSize: plaintext.length
  };
}
async function decryptBytesFrom(envelope, recipientPrivateKey) {
  validatePublicKeyEncryptedEnvelope(envelope);
  const privateKey = await resolvePrivateEncryptionKey(recipientPrivateKey);
  const ephemeralPublicKey = await importPublicEncryptionKey(envelope.ephemeralPublicKey);
  const contentKey = await derivePublicKeyContentKey(
    privateKey,
    ephemeralPublicKey,
    base64ToBytes(envelope.salt)
  );
  const plaintext = new Uint8Array(await getSubtle().decrypt(
    { name: AES_GCM, iv: toArrayBuffer(base64ToBytes(envelope.nonce)) },
    contentKey,
    toArrayBuffer(base64ToBytes(envelope.ciphertext))
  ));
  if (plaintext.length !== envelope.plaintextSize) {
    throw new Error("Public-key encrypted object plaintext size mismatch");
  }
  return plaintext;
}
async function encryptTextFor(text, recipientPublicKey) {
  return encryptBytesFor(utf8ToBytes(text), recipientPublicKey);
}
async function decryptTextFrom(envelope, recipientPrivateKey) {
  return bytesToUtf8(await decryptBytesFrom(envelope, recipientPrivateKey));
}
async function encryptJsonFor(value, recipientPublicKey) {
  return encryptBytesFor(jsonToBytes(value), recipientPublicKey);
}
async function decryptJsonFrom(envelope, recipientPrivateKey) {
  return bytesToJson(await decryptBytesFrom(envelope, recipientPrivateKey));
}
async function publishEncryptedBytes(provider, bytes, key, options = {}) {
  const envelope = await encryptBytes(bytes, key);
  return publishEncryptedEnvelope(provider, envelope, options);
}
async function readEncryptedBytes(provider, reference, key, options = {}) {
  return decryptBytes(await readEncryptedEnvelope(provider, reference, options), key);
}
async function publishEncryptedText(provider, text, key, options = {}) {
  const envelope = await encryptText(text, key);
  return publishEncryptedEnvelope(provider, envelope, options);
}
async function readEncryptedText(provider, reference, key, options = {}) {
  return decryptText(await readEncryptedEnvelope(provider, reference, options), key);
}
async function publishEncryptedJson(provider, value, key, options = {}) {
  const envelope = await encryptJson(value, key);
  return publishEncryptedEnvelope(provider, envelope, options);
}
async function readEncryptedJson(provider, reference, key, options = {}) {
  return decryptJson(await readEncryptedEnvelope(provider, reference, options), key);
}
async function readEncryptedEnvelope(provider, reference, options = {}) {
  const envelope = await readObjectJson(provider, reference, options);
  validateEncryptedEnvelope(envelope);
  return envelope;
}
async function publishEncryptedBytesFor(provider, bytes, recipientPublicKey, options = {}) {
  const envelope = await encryptBytesFor(bytes, recipientPublicKey);
  return publishPublicKeyEncryptedEnvelope(provider, envelope, options);
}
async function readEncryptedBytesFrom(provider, reference, recipientPrivateKey, options = {}) {
  return decryptBytesFrom(await readPublicKeyEncryptedEnvelope(provider, reference, options), recipientPrivateKey);
}
async function publishEncryptedTextFor(provider, text, recipientPublicKey, options = {}) {
  const envelope = await encryptTextFor(text, recipientPublicKey);
  return publishPublicKeyEncryptedEnvelope(provider, envelope, options);
}
async function readEncryptedTextFrom(provider, reference, recipientPrivateKey, options = {}) {
  return decryptTextFrom(await readPublicKeyEncryptedEnvelope(provider, reference, options), recipientPrivateKey);
}
async function publishEncryptedJsonFor(provider, value, recipientPublicKey, options = {}) {
  const envelope = await encryptJsonFor(value, recipientPublicKey);
  return publishPublicKeyEncryptedEnvelope(provider, envelope, options);
}
async function readEncryptedJsonFrom(provider, reference, recipientPrivateKey, options = {}) {
  return decryptJsonFrom(await readPublicKeyEncryptedEnvelope(provider, reference, options), recipientPrivateKey);
}
async function readPublicKeyEncryptedEnvelope(provider, reference, options = {}) {
  const envelope = await readObjectJson(provider, reference, options);
  validatePublicKeyEncryptedEnvelope(envelope);
  return envelope;
}
function publishEncryptedEnvelope(provider, envelope, options) {
  return publishObjectJson(provider, envelope, options).then((published) => ({
    ...published,
    plaintextSize: envelope.plaintextSize,
    ciphertextSize: base64ToBytes(envelope.ciphertext).length,
    envelope
  }));
}
function publishPublicKeyEncryptedEnvelope(provider, envelope, options) {
  return publishObjectJson(provider, envelope, options).then((published) => ({
    ...published,
    plaintextSize: envelope.plaintextSize,
    ciphertextSize: base64ToBytes(envelope.ciphertext).length,
    envelope
  }));
}
function validateEncryptedEnvelope(envelope) {
  if (envelope.version !== 1 || envelope.type !== "swarm-kit:encrypted-bytes" || envelope.algorithm !== "AES-GCM" || envelope.keyLength !== AES_KEY_LENGTH || typeof envelope.nonce !== "string" || base64ToBytes(envelope.nonce).length !== NONCE_BYTES || typeof envelope.ciphertext !== "string" || typeof envelope.plaintextSize !== "number" || !Number.isSafeInteger(envelope.plaintextSize) || envelope.plaintextSize < 0) {
    throw new Error("Invalid encrypted object envelope");
  }
}
function validatePublicKeyEncryptedEnvelope(envelope) {
  if (envelope.version !== 1 || envelope.type !== "swarm-kit:public-key-encrypted-bytes" || envelope.algorithm !== PUBLIC_KEY_ENCRYPTION_ALGORITHM || envelope.keyAgreement !== "ECDH-P256" || envelope.kdf !== "HKDF-SHA-256" || envelope.contentEncryption !== "AES-GCM" || !isP256PublicJwk(envelope.ephemeralPublicKey) || typeof envelope.salt !== "string" || base64ToBytes(envelope.salt).length !== SALT_BYTES || typeof envelope.nonce !== "string" || base64ToBytes(envelope.nonce).length !== NONCE_BYTES || typeof envelope.ciphertext !== "string" || typeof envelope.plaintextSize !== "number" || !Number.isSafeInteger(envelope.plaintextSize) || envelope.plaintextSize < 0) {
    throw new Error("Invalid public-key encrypted object envelope");
  }
}
async function derivePublicKeyContentKey(privateKey, publicKey, salt) {
  const sharedSecret = new Uint8Array(await getSubtle().deriveBits(
    { name: ECDH, public: publicKey },
    privateKey,
    AES_KEY_LENGTH
  ));
  const hkdfKey = await getSubtle().importKey(
    "raw",
    toArrayBuffer(sharedSecret),
    HKDF,
    false,
    ["deriveKey"]
  );
  return getSubtle().deriveKey(
    {
      name: HKDF,
      hash: "SHA-256",
      salt: toArrayBuffer(salt),
      info: toArrayBuffer(PUBLIC_KEY_INFO)
    },
    hkdfKey,
    { name: AES_GCM, length: AES_KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}
async function resolvePublicEncryptionKey(key) {
  return isCryptoKey(key) ? key : importPublicEncryptionKey(key);
}
async function resolvePrivateEncryptionKey(key) {
  return isCryptoKey(key) ? key : importPrivateEncryptionKey(key);
}
function isCryptoKey(key) {
  return typeof key === "object" && key !== null && "algorithm" in key && "extractable" in key && "type" in key && "usages" in key;
}
function isP256PublicJwk(key) {
  return key !== null && typeof key === "object" && key.kty === "EC" && key.crv === ECDH_NAMED_CURVE && typeof key.x === "string" && typeof key.y === "string";
}
function randomBytes(size) {
  const bytes = new Uint8Array(size);
  getCrypto().getRandomValues(bytes);
  return bytes;
}
function toArrayBuffer(bytes) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}
function getCrypto() {
  if (!globalThis.crypto) {
    throw new Error("Web Crypto is not available in this environment");
  }
  return globalThis.crypto;
}
function getSubtle() {
  const subtle = getCrypto().subtle;
  if (!subtle) {
    throw new Error("Web Crypto subtle API is not available in this environment");
  }
  return subtle;
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

// src/hash-chain.ts
var DEFAULT_HASH_CHAIN_NAMESPACE = "swarm-kit:hash-chain:v1";
function createHashChain(provider, options) {
  const namespace = options.namespace ?? DEFAULT_HASH_CHAIN_NAMESPACE;
  const stream = createIndexedSocStream(provider, {
    namespace,
    parts: [options.topic],
    entryTag: "entry",
    label: "hash chain",
    parseEnvelope: (value, context) => {
      const envelope = parseEntryEnvelope(value, options.topic);
      if (envelope.index !== context.index) {
        throw new Error(`Hash chain entry index mismatch for ${context.reference}`);
      }
      return envelope;
    },
    sameEnvelope: sameEnvelope2
  });
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
  async function readEntryByAddress(reference, owner) {
    const soc = await readSocBytesByAddress(provider, reference);
    if (soc.owner.toLowerCase() !== owner.toLowerCase()) {
      throw new Error(`Hash chain owner mismatch for ${reference}`);
    }
    const envelope = parseEntryEnvelope(bytesToJson(soc.bytes), options.topic);
    if (soc.identifier.toLowerCase() !== stream.entryIdentifier(envelope.index).toLowerCase()) {
      throw new Error(`Hash chain identifier mismatch for ${reference}`);
    }
    return hydrateEntry({ envelope, soc });
  }
  async function readAt(owner, index) {
    const record = await stream.readRecord(owner, index);
    return record ? hydrateEntry(record) : null;
  }
  async function readHead(owner) {
    const record = await stream.readLatestRecord(owner);
    return record ? hydrateEntry(record) : null;
  }
  return {
    topic: options.topic,
    entryIdentifier: stream.entryIdentifier,
    getOwner: stream.getOwner,
    async append(payload, appendOptions = {}) {
      const publishedPayload = await publishObjectJson(provider, payload);
      const writtenAt = new Date(appendOptions.at ?? Date.now()).toISOString();
      const appended = await stream.append(({ index, previousReference }) => ({
        version: 1,
        type: "swarm-kit:hash-chain-entry",
        topic: options.topic,
        index,
        previousReference,
        payloadReference: publishedPayload.reference,
        payloadSize: publishedPayload.size,
        writtenAt
      }));
      return {
        ...appended.envelope,
        owner: appended.owner,
        identifier: appended.identifier,
        reference: appended.reference,
        payload,
        entryWrite: appended.entryWrite
      };
    },
    readHead,
    readAt,
    async readLatest(owner, readOptions = {}) {
      const limit = readOptions.limit ?? 10;
      assertIndexedSocLimit(limit, "hash chain read limit");
      if (limit === 0) return [];
      const latest = await stream.readLatestRecord(owner);
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
function sameEnvelope2(a, b) {
  return a.version === b.version && a.type === b.type && a.topic === b.topic && a.index === b.index && a.previousReference === b.previousReference && a.payloadReference === b.payloadReference && a.payloadSize === b.payloadSize && a.writtenAt === b.writtenAt;
}

// src/lookup.ts
var DEFAULT_LOOKUP_LABEL = "keyed lookup";
function createKeyedLookup(provider, options) {
  const namespace = normalizeNamespace(options.namespace);
  function streamFor(key) {
    const normalizedKey = normalizeKey(key);
    return createIndexedSocStream(provider, {
      namespace,
      parts: [normalizedKey],
      entryTag: "entry",
      label: DEFAULT_LOOKUP_LABEL,
      parseEnvelope: (value, context) => {
        const envelope = parseLookupEnvelope(value, namespace, normalizedKey);
        if (envelope.index !== context.index) {
          throw new Error(`Keyed lookup entry index mismatch for ${context.reference}`);
        }
        return envelope;
      },
      sameEnvelope: sameEnvelope3
    });
  }
  async function hydrateEntry(record) {
    return hydrateStreamEntry({
      owner: record.soc.owner,
      identifier: record.soc.identifier,
      reference: record.soc.reference,
      envelope: record.envelope
    });
  }
  async function hydrateStreamEntry(entry) {
    const value = await readObjectJson(provider, entry.envelope.valueReference);
    return {
      ...entry.envelope,
      owner: entry.owner,
      identifier: entry.identifier,
      reference: entry.reference,
      value
    };
  }
  return {
    namespace,
    entryIdentifier: (key, index) => streamFor(key).entryIdentifier(index),
    getOwner: streamFor("__owner__").getOwner,
    async write(key, value, writeOptions = {}) {
      const normalizedKey = normalizeKey(key);
      const published = await publishObjectJson(provider, value);
      const writtenAt = new Date(writeOptions.at ?? Date.now()).toISOString();
      const appended = await streamFor(normalizedKey).append(({ index, previousReference }) => ({
        version: 1,
        type: "swarm-kit:keyed-lookup-entry",
        namespace,
        key: normalizedKey,
        index,
        previousReference,
        valueReference: published.reference,
        valueSize: published.size,
        writtenAt
      }));
      return {
        ...appended.envelope,
        owner: appended.owner,
        identifier: appended.identifier,
        reference: appended.reference,
        value,
        entryWrite: appended.entryWrite
      };
    },
    async readAt(owner, key, index) {
      const record = await streamFor(key).readRecord(owner, index);
      return record ? hydrateEntry(record) : null;
    },
    async readLatest(owner, key) {
      const record = await streamFor(key).readLatestRecord(owner);
      return record ? hydrateEntry(record) : null;
    },
    async readHistory(owner, key, readOptions = {}) {
      const limit = readOptions.limit ?? 10;
      assertIndexedSocLimit(limit, "keyed lookup history limit");
      const entries = await streamFor(key).readLatest(owner, { limit });
      return Promise.all(entries.map(hydrateStreamEntry));
    }
  };
}
function parseLookupEnvelope(value, namespace, key) {
  if (value.version !== 1 || value.type !== "swarm-kit:keyed-lookup-entry" || value.namespace !== namespace || value.key !== key || !Number.isSafeInteger(value.index) || value.index < 0 || !(typeof value.previousReference === "string" || value.previousReference === null) || typeof value.valueReference !== "string" || typeof value.valueSize !== "number" || !Number.isSafeInteger(value.valueSize) || value.valueSize < 0 || typeof value.writtenAt !== "string") {
    throw new Error("Invalid keyed lookup entry");
  }
  return value;
}
function sameEnvelope3(a, b) {
  return a.version === b.version && a.type === b.type && a.namespace === b.namespace && a.key === b.key && a.index === b.index && a.previousReference === b.previousReference && a.valueReference === b.valueReference && a.valueSize === b.valueSize && a.writtenAt === b.writtenAt;
}
function normalizeNamespace(namespace) {
  if (!namespace.trim()) throw new Error("Keyed lookup namespace must not be empty");
  return namespace;
}
function normalizeKey(key) {
  if (!key.trim()) throw new Error("Keyed lookup key must not be empty");
  return key;
}

// src/multi-writer-feed.ts
var DEFAULT_MULTI_WRITER_NAMESPACE = "swarm-kit:multi-writer-feed:v1";
var DEFAULT_WRITER_ID = "default";
function createMultiWriterFeed(provider, options) {
  const namespace = options.namespace ?? DEFAULT_MULTI_WRITER_NAMESPACE;
  const localWriterId = options.writerId ?? DEFAULT_WRITER_ID;
  function normalizeWriterId(writerId = localWriterId) {
    if (!writerId.trim()) throw new Error("Multi-writer feed writerId must not be empty");
    return writerId;
  }
  function streamFor(writerId = localWriterId) {
    const normalizedWriterId = normalizeWriterId(writerId);
    return createIndexedSocStream(provider, {
      namespace,
      parts: [options.topic, normalizedWriterId],
      entryTag: "entry",
      label: "multi-writer feed",
      parseEnvelope: (value, context) => {
        const envelope = parseEntryEnvelope2(value, options.topic, normalizedWriterId);
        if (envelope.index !== context.index) {
          throw new Error(`Multi-writer feed entry index mismatch for ${context.reference}`);
        }
        return envelope;
      },
      sameEnvelope: sameEnvelope4
    });
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
  async function readEntryByAddress(reference, owner, writerId) {
    const soc = await readSocBytesByAddress(provider, reference);
    if (soc.owner.toLowerCase() !== owner.toLowerCase()) {
      throw new Error(`Multi-writer feed owner mismatch for ${reference}`);
    }
    const envelope = parseEntryEnvelope2(bytesToJson(soc.bytes), options.topic, writerId);
    if (soc.identifier.toLowerCase() !== streamFor(writerId).entryIdentifier(envelope.index).toLowerCase()) {
      throw new Error(`Multi-writer feed identifier mismatch for ${reference}`);
    }
    return hydrateEntry({ envelope, soc });
  }
  async function readAt(owner, index, readOptions = {}) {
    const writerId = normalizeWriterId(readOptions.writerId);
    const record = await streamFor(writerId).readRecord(owner, index);
    return record ? hydrateEntry(record) : null;
  }
  async function readWriter(owner, readOptions = {}) {
    const writerId = normalizeWriterId(readOptions.writerId);
    const limit = readOptions.limit ?? 10;
    assertIndexedSocLimit(limit, "multi-writer feed read limit");
    if (limit === 0) return [];
    const latest = await streamFor(writerId).readLatestRecord(owner);
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
    entryIdentifier: (index, writerId = localWriterId) => streamFor(writerId).entryIdentifier(index),
    getOwner: streamFor(localWriterId).getOwner,
    async append(payload, appendOptions = {}) {
      const publishedPayload = await publishObjectJson(provider, payload);
      const writtenAt = new Date(appendOptions.at ?? Date.now()).toISOString();
      const appended = await streamFor(localWriterId).append(({ index, previousReference }) => ({
        version: 1,
        type: "swarm-kit:multi-writer-feed-entry",
        topic: options.topic,
        writerId: localWriterId,
        index,
        previousReference,
        payloadReference: publishedPayload.reference,
        payloadSize: publishedPayload.size,
        writtenAt
      }));
      return {
        ...appended.envelope,
        owner: appended.owner,
        identifier: appended.identifier,
        reference: appended.reference,
        payload,
        entryWrite: appended.entryWrite
      };
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
function sameEnvelope4(a, b) {
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

// src/signed-documents.ts
var SIGNED_DOCUMENT_PAYLOAD_TYPE = "swarm-kit:signed-document-payload";
var SIGNED_DOCUMENT_SIGNATURE_ENCODING = "base64";
var P256_SIGNATURE_SCHEME = "ECDSA-P256-SHA-256";
var EIP_191_PERSONAL_SIGN_SCHEME = "EIP-191-PERSONAL-SIGN";
var ECDSA = "ECDSA";
var P256_NAMED_CURVE = "P-256";
async function signDocument(payload, options) {
  const unsigned = createSignedDocumentPayload(payload, options);
  const bytes = signedDocumentPayloadBytes(unsigned);
  const signature = normalizeSignatureBytes(await options.signer.sign(bytes));
  const envelope = {
    ...unsigned,
    signature: {
      scheme: options.signer.scheme,
      signer: options.signer.id,
      encoding: SIGNED_DOCUMENT_SIGNATURE_ENCODING,
      value: bytesToBase64(signature)
    }
  };
  if (options.signer.publicKey !== void 0) {
    envelope.signature.publicKey = options.signer.publicKey;
  }
  validateSignedDocumentEnvelope(envelope);
  return envelope;
}
async function verifySignedDocument(envelope, verifier) {
  validateSignedDocumentEnvelope(envelope);
  return verifier.verify({
    envelope,
    bytes: signedDocumentPayloadBytes(envelope),
    signature: base64ToBytes(envelope.signature.value)
  });
}
async function assertSignedDocument(envelope, verifier) {
  if (!await verifySignedDocument(envelope, verifier)) {
    throw new Error("Signed document verification failed");
  }
  return envelope;
}
function signedDocumentPayloadBytes(payload) {
  return jsonToBytes(JSON.parse(canonicalJson(toUnsignedPayload(payload))));
}
async function publishSignedDocument(provider, payload, options) {
  const envelope = await signDocument(payload, options);
  const published = await publishObjectJson(provider, envelope, options);
  return {
    ...published,
    envelope
  };
}
async function readSignedDocument(provider, reference, options = {}) {
  const envelope = await readObjectJson(provider, reference, options);
  validateSignedDocumentEnvelope(envelope);
  return envelope;
}
async function readAndVerifySignedDocument(provider, reference, verifier, options = {}) {
  const envelope = await readSignedDocument(provider, reference, options);
  await assertSignedDocument(envelope, verifier);
  return envelope;
}
async function generateP256SigningKeyPair(extractable = true) {
  return getSubtle2().generateKey(
    { name: ECDSA, namedCurve: P256_NAMED_CURVE },
    extractable,
    ["sign", "verify"]
  );
}
async function exportP256PublicSigningKey(key) {
  return getSubtle2().exportKey("jwk", key);
}
async function importP256PublicSigningKey(key) {
  return getSubtle2().importKey(
    "jwk",
    key,
    { name: ECDSA, namedCurve: P256_NAMED_CURVE },
    true,
    ["verify"]
  );
}
async function exportP256PrivateSigningKey(key) {
  return getSubtle2().exportKey("jwk", key);
}
async function importP256PrivateSigningKey(key, extractable = true) {
  return getSubtle2().importKey(
    "jwk",
    key,
    { name: ECDSA, namedCurve: P256_NAMED_CURVE },
    extractable,
    ["sign"]
  );
}
async function createP256DocumentSigner(keyPair, options = {}) {
  const publicKey = options.publicKey ?? await exportP256PublicSigningKey(keyPair.publicKey);
  return {
    id: options.id ?? p256PublicKeyId(publicKey),
    scheme: P256_SIGNATURE_SCHEME,
    publicKey,
    sign: (bytes) => getSubtle2().sign(
      { name: ECDSA, hash: "SHA-256" },
      keyPair.privateKey,
      toArrayBuffer2(bytes)
    )
  };
}
function createP256DocumentVerifier(options = {}) {
  return {
    verify: async ({ envelope, bytes, signature }) => {
      if (envelope.signature.scheme !== P256_SIGNATURE_SCHEME) return false;
      if (options.signer !== void 0 && envelope.signature.signer !== options.signer) return false;
      const publicKey = await resolveP256PublicSigningKey(options.publicKey ?? envelope.signature.publicKey);
      if (!publicKey) return false;
      return getSubtle2().verify(
        { name: ECDSA, hash: "SHA-256" },
        publicKey,
        toArrayBuffer2(signature),
        toArrayBuffer2(bytes)
      );
    }
  };
}
function createEip1193PersonalSigner(provider, options) {
  const address = normalizeAddress(options.address);
  return {
    id: address,
    scheme: EIP_191_PERSONAL_SIGN_SCHEME,
    sign: async (bytes) => {
      const signature = await provider.request({
        method: "personal_sign",
        params: [`0x${bytesToHex(bytes)}`, address]
      });
      return hexToBytes(signature);
    }
  };
}
function createEip191PersonalVerifier(recoverAddress, expectedAddress) {
  const normalizedExpected = expectedAddress ? normalizeAddress(expectedAddress) : null;
  return {
    verify: async ({ envelope, bytes, signature }) => {
      if (envelope.signature.scheme !== EIP_191_PERSONAL_SIGN_SCHEME) return false;
      const recovered = normalizeAddress(await recoverAddress(bytes, signature));
      const signer = normalizeAddress(envelope.signature.signer);
      return recovered === signer && (normalizedExpected === null || recovered === normalizedExpected);
    }
  };
}
function createSignedDocumentPayload(payload, options) {
  return {
    version: 1,
    type: SIGNED_DOCUMENT_PAYLOAD_TYPE,
    subject: normalizeSubject(options.subject),
    signedAt: normalizeSignedAt(options.signedAt),
    payload
  };
}
function toUnsignedPayload(payload) {
  return {
    version: 1,
    type: SIGNED_DOCUMENT_PAYLOAD_TYPE,
    subject: normalizeSubject(payload.subject),
    signedAt: normalizeSignedAt(payload.signedAt),
    payload: payload.payload
  };
}
function validateSignedDocumentEnvelope(envelope) {
  if (envelope.version !== 1 || envelope.type !== SIGNED_DOCUMENT_PAYLOAD_TYPE || typeof envelope.subject !== "string" || !envelope.subject.trim() || typeof envelope.signedAt !== "string" || Number.isNaN(Date.parse(envelope.signedAt)) || envelope.signature?.encoding !== SIGNED_DOCUMENT_SIGNATURE_ENCODING || typeof envelope.signature.scheme !== "string" || !envelope.signature.scheme.trim() || typeof envelope.signature.signer !== "string" || !envelope.signature.signer.trim() || typeof envelope.signature.value !== "string") {
    throw new Error("Invalid signed document envelope");
  }
  base64ToBytes(envelope.signature.value);
}
function canonicalJson(value) {
  const normalized = JSON.stringify(value);
  if (normalized === void 0) {
    throw new Error("Signed document payload must be JSON serializable");
  }
  return stringifyCanonical(JSON.parse(normalized));
}
function stringifyCanonical(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stringifyCanonical(item)).join(",")}]`;
  }
  const record = value;
  return `{${Object.keys(record).sort().map(
    (key) => `${JSON.stringify(key)}:${stringifyCanonical(record[key])}`
  ).join(",")}}`;
}
function normalizeSignatureBytes(signature) {
  return normalizeBytes(signature);
}
async function resolveP256PublicSigningKey(key) {
  if (!key) return null;
  if (isCryptoKey2(key)) return key;
  if (!isP256PublicJwk2(key)) return null;
  return importP256PublicSigningKey(key);
}
function isCryptoKey2(key) {
  return typeof key === "object" && key !== null && "algorithm" in key && "extractable" in key && "type" in key && "usages" in key;
}
function isP256PublicJwk2(key) {
  return key !== null && typeof key === "object" && key.kty === "EC" && key.crv === P256_NAMED_CURVE && typeof key.x === "string" && typeof key.y === "string";
}
function p256PublicKeyId(publicKey) {
  return `p256:${deriveIdentifier(["swarm-kit:p256-public-signing-key", canonicalJson(publicKey)]).slice(0, 40)}`;
}
function normalizeSubject(subject) {
  const normalized = subject.trim();
  if (!normalized) throw new Error("Signed document subject must not be empty");
  return normalized;
}
function normalizeSignedAt(signedAt) {
  const normalized = signedAt === void 0 ? /* @__PURE__ */ new Date() : signedAt instanceof Date ? signedAt : new Date(signedAt);
  if (Number.isNaN(normalized.getTime())) {
    throw new Error("Signed document signedAt must be a valid date");
  }
  return normalized.toISOString();
}
function normalizeAddress(address) {
  const normalized = String(address).trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(normalized)) {
    throw new Error("Ethereum address must be 0x-prefixed with 40 hex characters");
  }
  return `0x${normalized.slice(2).toLowerCase()}`;
}
function toArrayBuffer2(bytes) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}
function getCrypto2() {
  if (!globalThis.crypto) {
    throw new Error("Web Crypto is not available in this environment");
  }
  return globalThis.crypto;
}
function getSubtle2() {
  const subtle = getCrypto2().subtle;
  if (!subtle) {
    throw new Error("Web Crypto subtle API is not available in this environment");
  }
  return subtle;
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
    revisionIdentifier: didDocumentRevisionIdentifier,
    create: (options = {}) => createDidDocument(provider, options),
    writeDocument: writeDidDocument.bind(null, provider),
    readDocument: readDidDocument.bind(null, provider)
  };
  const hashChain = {
    create: (options) => createHashChain(provider, options)
  };
  const multiWriterFeed = {
    create: (options) => createMultiWriterFeed(provider, options)
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
    readPublicKeyEnvelope: readPublicKeyEncryptedEnvelope.bind(null, provider)
  };
  const lookup = {
    create: (options) => createKeyedLookup(provider, options)
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
    createEip191PersonalVerifier
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
    crypto,
    lookup,
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
    createEpochFeed: epochFeed.create
  };
}

// src/provider-compliance.ts
var DEFAULT_OPTIONS = {
  requestAccess: true,
  includeTypeMismatchTests: true,
  includeUnsupportedOptionsTest: true
};
async function runSwarmProviderCompliance(provider, options = {}) {
  const effective = { ...DEFAULT_OPTIONS, ...options };
  const runId = options.runId ?? createRunId();
  const startedAt = (/* @__PURE__ */ new Date()).toISOString();
  const context = { runId };
  const cases = createComplianceCases(provider, context, effective);
  const results = [];
  for (const complianceCase of cases) {
    results.push(await runComplianceCase(complianceCase, context));
  }
  const finishedAt = (/* @__PURE__ */ new Date()).toISOString();
  return {
    runId,
    startedAt,
    finishedAt,
    summary: summarizeResults(results),
    results
  };
}
function createComplianceCases(provider, _context, options) {
  return [
    {
      id: "request-access",
      label: "requestAccess resolves",
      enabled: options.requestAccess,
      skipReason: "disabled by options",
      run: async () => summarizeValue(await callSwarm(provider, "swarm_requestAccess"))
    },
    {
      id: "capabilities-shape",
      label: "getCapabilities returns provider limits",
      run: async (context) => {
        const capabilities = await callSwarm(provider, "swarm_getCapabilities");
        if (typeof capabilities.canPublish !== "boolean") {
          throw new Error("getCapabilities result must include boolean canPublish");
        }
        context.capabilities = capabilities;
        return summarizeCapabilities(capabilities);
      }
    },
    {
      id: "signing-identity-shape",
      label: "getSigningIdentity returns an owner",
      run: async (context) => {
        const identity = await callSwarm(provider, "swarm_getSigningIdentity");
        assertOwner(identity.owner);
        context.identity = identity;
        return {
          owner: identity.owner,
          identityMode: identity.identityMode ?? null
        };
      }
    },
    {
      id: "cac-roundtrip",
      label: "publishChunk/readChunk byte roundtrip",
      run: async (context) => {
        const payload = utf8ToBytes(`swarm-kit provider compliance CAC ${context.runId}`);
        const published = await publishBytes(provider, payload);
        const read = await readBytes(provider, published.reference);
        assertUtf8(read.bytes, bytesToUtf8(payload), "CAC payload");
        context.cac = {
          reference: published.reference,
          payload
        };
        return {
          reference: published.reference,
          bytes: payload.length
        };
      }
    },
    {
      id: "missing-cac-error",
      label: "missing CAC returns chunk_not_found",
      run: async (context) => expectProviderReason(
        () => readBytes(provider, missingReference(context.runId, "cac")),
        "chunk_not_found"
      )
    },
    {
      id: "soc-write-read-address",
      label: "writeSingleOwnerChunk/read by address roundtrip",
      run: async (context) => {
        const payload = utf8ToBytes(`swarm-kit provider compliance SOC ${context.runId}`);
        const identifier = deriveIdentifier(["swarm-kit:provider-compliance:soc", context.runId]);
        const written = await writeSocBytes(provider, identifier, payload);
        const read = await readSocBytesByAddress(provider, written.reference);
        assertUtf8(read.bytes, bytesToUtf8(payload), "SOC payload by address");
        assertSameLower(read.reference, written.reference, "SOC reference");
        assertSameLower(read.identifier, written.identifier, "SOC identifier");
        assertSameLower(read.owner, written.owner, "SOC owner");
        context.soc = {
          reference: written.reference,
          owner: written.owner,
          identifier: written.identifier,
          payload
        };
        return {
          reference: written.reference,
          owner: written.owner,
          identifier: written.identifier,
          bytes: payload.length
        };
      }
    },
    {
      id: "soc-read-owner-identifier",
      label: "readSingleOwnerChunk by owner and identifier",
      run: async (context) => {
        const soc = requireSoc(context);
        const read = await readSocBytesByOwnerAndIdentifier(provider, soc.owner, soc.identifier);
        assertUtf8(read.bytes, bytesToUtf8(soc.payload), "SOC payload by owner and identifier");
        assertSameLower(read.reference, soc.reference, "SOC reference");
        return {
          reference: read.reference,
          owner: read.owner,
          identifier: read.identifier
        };
      }
    },
    {
      id: "missing-soc-owner-identifier-error",
      label: "missing SOC by owner and identifier returns chunk_not_found",
      run: async (context) => {
        const owner = context.soc?.owner ?? context.identity?.owner;
        if (!owner) throw new Error("No owner available for missing SOC probe");
        return expectProviderReason(
          () => readSocBytesByOwnerAndIdentifier(provider, owner, missingReference(context.runId, "soc-owner-identifier")),
          "chunk_not_found"
        );
      }
    },
    {
      id: "missing-soc-address-error",
      label: "missing SOC by address returns chunk_not_found",
      run: async (context) => expectProviderReason(
        () => readSocBytesByAddress(provider, missingReference(context.runId, "soc-address")),
        "chunk_not_found"
      )
    },
    {
      id: "cac-as-soc-type-mismatch",
      label: "CAC read as SOC returns chunk_type_mismatch",
      enabled: options.includeTypeMismatchTests,
      skipReason: "type mismatch tests disabled by options",
      run: async (context) => {
        const cac = requireCac(context);
        return expectProviderReason(
          () => readSocBytesByAddress(provider, cac.reference),
          "chunk_type_mismatch"
        );
      }
    },
    {
      id: "soc-as-cac-type-mismatch",
      label: "SOC read as CAC returns chunk_type_mismatch",
      enabled: options.includeTypeMismatchTests,
      skipReason: "type mismatch tests disabled by options",
      run: async (context) => {
        const soc = requireSoc(context);
        return expectProviderReason(
          () => readBytes(provider, soc.reference),
          "chunk_type_mismatch"
        );
      }
    },
    {
      id: "unsupported-options-error",
      label: "unsupported provider options return unsupported_option",
      enabled: options.includeUnsupportedOptionsTest,
      skipReason: "unsupported options test disabled by options",
      run: async (context) => {
        const cac = requireCac(context);
        return expectProviderReason(
          () => callSwarm(provider, "swarm_readChunk", {
            reference: cac.reference,
            options: { unsupported: true }
          }),
          "unsupported_option"
        );
      }
    }
  ];
}
async function runComplianceCase(complianceCase, context) {
  const started = now();
  if (complianceCase.enabled === false) {
    return {
      id: complianceCase.id,
      label: complianceCase.label,
      status: "skip",
      durationMs: elapsed(started),
      details: complianceCase.skipReason ?? "skipped"
    };
  }
  try {
    const details = await complianceCase.run(context);
    return {
      id: complianceCase.id,
      label: complianceCase.label,
      status: "pass",
      durationMs: elapsed(started),
      details
    };
  } catch (error) {
    return {
      id: complianceCase.id,
      label: complianceCase.label,
      status: "fail",
      durationMs: elapsed(started),
      error: serializeProviderError(error)
    };
  }
}
async function expectProviderReason(action, expectedReason) {
  try {
    const value = await action();
    throw new Error(`Expected provider error ${expectedReason}, but call resolved with ${JSON.stringify(summarizeValue(value))}`);
  } catch (error) {
    const reason = getSwarmErrorReason(error);
    if (reason !== expectedReason) {
      const serialized = serializeProviderError(error);
      throw new Error(`Expected provider reason "${expectedReason}", received "${reason ?? "none"}": ${serialized.message}`);
    }
    return serializeProviderError(error);
  }
}
function summarizeResults(results) {
  return {
    total: results.length,
    passed: results.filter((result) => result.status === "pass").length,
    failed: results.filter((result) => result.status === "fail").length,
    skipped: results.filter((result) => result.status === "skip").length
  };
}
function summarizeCapabilities(capabilities) {
  return {
    specVersion: capabilities.specVersion ?? null,
    canPublish: capabilities.canPublish,
    reason: capabilities.reason,
    limits: capabilities.limits ?? null
  };
}
function summarizeValue(value) {
  if (value === void 0 || value === null) return value;
  if (typeof value !== "object") return value;
  const record = value;
  const summarized = {};
  for (const [key, item] of Object.entries(record)) {
    summarized[key] = typeof item === "string" && item.length > 96 ? `${item.slice(0, 96)}...` : item;
  }
  return summarized;
}
function serializeProviderError(error) {
  const providerError = error;
  const serialized = {
    message: providerError?.message ?? String(error)
  };
  if (providerError?.name !== void 0) serialized.name = providerError.name;
  if (providerError?.code !== void 0) serialized.code = providerError.code;
  const reason = getSwarmErrorReason(error);
  if (reason !== void 0) serialized.reason = reason;
  if (providerError?.data !== void 0) serialized.data = providerError.data;
  return serialized;
}
function requireCac(context) {
  if (!context.cac) throw new Error("CAC roundtrip did not produce a reference");
  return context.cac;
}
function requireSoc(context) {
  if (!context.soc) throw new Error("SOC roundtrip did not produce a reference");
  return context.soc;
}
function assertUtf8(bytes, expected, label) {
  const actual = bytesToUtf8(bytes);
  if (actual !== expected) {
    throw new Error(`${label} mismatch`);
  }
}
function assertSameLower(actual, expected, label) {
  if (actual.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(`${label} mismatch: expected ${expected}, received ${actual}`);
  }
}
function assertOwner(owner) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(owner)) {
    throw new Error(`Invalid signing owner: ${owner}`);
  }
}
function missingReference(runId, tag) {
  return deriveIdentifier(["swarm-kit:provider-compliance:missing", runId, tag]);
}
function createRunId() {
  return deriveIdentifier(["swarm-kit:provider-compliance:run", randomBytes2(16)]).slice(0, 16);
}
function randomBytes2(length) {
  const cryptoObject = globalThis.crypto;
  if (!cryptoObject?.getRandomValues) {
    throw new Error("crypto.getRandomValues is required");
  }
  const bytes = new Uint8Array(length);
  cryptoObject.getRandomValues(bytes);
  return bytes;
}
function now() {
  return globalThis.performance?.now?.() ?? Date.now();
}
function elapsed(started) {
  return Math.max(0, Math.round((now() - started) * 10) / 10);
}
export {
  SwarmKitError,
  assertHex,
  assertIndexedSocIndex,
  assertIndexedSocLimit,
  assertSignedDocument,
  base64ToBytes,
  bytesToBase64,
  bytesToHex,
  bytesToJson,
  bytesToUtf8,
  callSwarm,
  concatBytes,
  createDidDocument,
  createEip1193PersonalSigner,
  createEip191PersonalVerifier,
  createEpochFeed,
  createHashChain,
  createIndexedSocStream,
  createKeyedLookup,
  createMultiWriterFeed,
  createP256DocumentSigner,
  createP256DocumentVerifier,
  createSwarmKit,
  decryptBytes,
  decryptBytesFrom,
  decryptJson,
  decryptJsonFrom,
  decryptText,
  decryptTextFrom,
  deriveEncryptionKeyFromPassword,
  deriveIdentifier,
  detectWindowSwarm,
  didDocumentIdentifier,
  didDocumentRevisionIdentifier,
  encryptBytes,
  encryptBytesFor,
  encryptJson,
  encryptJsonFor,
  encryptText,
  encryptTextFor,
  exportEncryptionKey,
  exportP256PrivateSigningKey,
  exportP256PublicSigningKey,
  exportPrivateEncryptionKey,
  exportPublicEncryptionKey,
  findLatestContiguousIndex,
  generateEncryptionKey,
  generateEncryptionKeyPair,
  generateP256SigningKeyPair,
  getSigningIdentity,
  getSwarmErrorReason,
  getWindowSwarm,
  hexToBytes,
  importEncryptionKey,
  importP256PrivateSigningKey,
  importP256PublicSigningKey,
  importPrivateEncryptionKey,
  importPublicEncryptionKey,
  isSwarmReason,
  jsonToBytes,
  keccakHex,
  normalizeBytes,
  normalizeError,
  publishBytes,
  publishEncryptedBytes,
  publishEncryptedBytesFor,
  publishEncryptedJson,
  publishEncryptedJsonFor,
  publishEncryptedText,
  publishEncryptedTextFor,
  publishJson,
  publishObjectBytes,
  publishObjectJson,
  publishObjectText,
  publishSignedDocument,
  publishText,
  readAndVerifySignedDocument,
  readBytes,
  readDidDocument,
  readEncryptedBytes,
  readEncryptedBytesFrom,
  readEncryptedEnvelope,
  readEncryptedJson,
  readEncryptedJsonFrom,
  readEncryptedText,
  readEncryptedTextFrom,
  readJson,
  readObjectBytes,
  readObjectJson,
  readObjectText,
  readPublicKeyEncryptedEnvelope,
  readSignedDocument,
  readSocBytesByAddress,
  readSocBytesByOwnerAndIdentifier,
  readSocJsonByAddress,
  readSocJsonByOwnerAndIdentifier,
  readSocTextByAddress,
  readSocTextByOwnerAndIdentifier,
  readText,
  runSwarmProviderCompliance,
  signDocument,
  signedDocumentPayloadBytes,
  utf8ToBytes,
  verifySignedDocument,
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
