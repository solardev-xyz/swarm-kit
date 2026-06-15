var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// node_modules/@noble/hashes/esm/_u64.js
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
var U32_MASK64, _32n, rotlSH, rotlSL, rotlBH, rotlBL;
var init_u64 = __esm({
  "node_modules/@noble/hashes/esm/_u64.js"() {
    U32_MASK64 = /* @__PURE__ */ BigInt(2 ** 32 - 1);
    _32n = /* @__PURE__ */ BigInt(32);
    rotlSH = (h, l, s) => h << s | l >>> 32 - s;
    rotlSL = (h, l, s) => l << s | h >>> 32 - s;
    rotlBH = (h, l, s) => l << s - 32 | h >>> 64 - s;
    rotlBL = (h, l, s) => h << s - 32 | l >>> 64 - s;
  }
});

// node_modules/@noble/hashes/esm/crypto.js
var crypto;
var init_crypto = __esm({
  "node_modules/@noble/hashes/esm/crypto.js"() {
    crypto = typeof globalThis === "object" && "crypto" in globalThis ? globalThis.crypto : void 0;
  }
});

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
function ahash(h) {
  if (typeof h !== "function" || typeof h.create !== "function")
    throw new Error("Hash should be wrapped by utils.createHasher");
  anumber(h.outputLen);
  anumber(h.blockLen);
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
function createView(arr) {
  return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
}
function rotr(word, shift) {
  return word << 32 - shift | word >>> shift;
}
function byteSwap(word) {
  return word << 24 & 4278190080 | word << 8 & 16711680 | word >>> 8 & 65280 | word >>> 24 & 255;
}
function byteSwap32(arr) {
  for (let i = 0; i < arr.length; i++) {
    arr[i] = byteSwap(arr[i]);
  }
  return arr;
}
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
function concatBytes2(...arrays) {
  let sum = 0;
  for (let i = 0; i < arrays.length; i++) {
    const a = arrays[i];
    abytes(a);
    sum += a.length;
  }
  const res = new Uint8Array(sum);
  for (let i = 0, pad2 = 0; i < arrays.length; i++) {
    const a = arrays[i];
    res.set(a, pad2);
    pad2 += a.length;
  }
  return res;
}
function createHasher(hashCons) {
  const hashC = (msg) => hashCons().update(toBytes(msg)).digest();
  const tmp = hashCons();
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.create = () => hashCons();
  return hashC;
}
function randomBytes(bytesLength = 32) {
  if (crypto && typeof crypto.getRandomValues === "function") {
    return crypto.getRandomValues(new Uint8Array(bytesLength));
  }
  if (crypto && typeof crypto.randomBytes === "function") {
    return Uint8Array.from(crypto.randomBytes(bytesLength));
  }
  throw new Error("crypto.getRandomValues must be defined");
}
var isLE, swap32IfBE, Hash;
var init_utils = __esm({
  "node_modules/@noble/hashes/esm/utils.js"() {
    init_crypto();
    isLE = /* @__PURE__ */ (() => new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68)();
    swap32IfBE = isLE ? (u) => u : byteSwap32;
    Hash = class {
    };
  }
});

// node_modules/@noble/hashes/esm/sha3.js
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
var _0n, _1n, _2n, _7n, _256n, _0x71n, SHA3_PI, SHA3_ROTL, _SHA3_IOTA, IOTAS, SHA3_IOTA_H, SHA3_IOTA_L, rotlH, rotlL, Keccak, gen, keccak_256;
var init_sha3 = __esm({
  "node_modules/@noble/hashes/esm/sha3.js"() {
    init_u64();
    init_utils();
    _0n = BigInt(0);
    _1n = BigInt(1);
    _2n = BigInt(2);
    _7n = BigInt(7);
    _256n = BigInt(256);
    _0x71n = BigInt(113);
    SHA3_PI = [];
    SHA3_ROTL = [];
    _SHA3_IOTA = [];
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
    IOTAS = split(_SHA3_IOTA, true);
    SHA3_IOTA_H = IOTAS[0];
    SHA3_IOTA_L = IOTAS[1];
    rotlH = (h, l, s) => s > 32 ? rotlBH(h, l, s) : rotlSH(h, l, s);
    rotlL = (h, l, s) => s > 32 ? rotlBL(h, l, s) : rotlSL(h, l, s);
    Keccak = class _Keccak extends Hash {
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
    gen = (suffix, blockLen, outputLen) => createHasher(() => new Keccak(blockLen, suffix, outputLen));
    keccak_256 = /* @__PURE__ */ (() => gen(1, 136, 256 / 8))();
  }
});

// node_modules/viem/_esm/utils/data/isHex.js
function isHex2(value, { strict = true } = {}) {
  if (!value)
    return false;
  if (typeof value !== "string")
    return false;
  return strict ? /^0x[0-9a-fA-F]*$/.test(value) : value.startsWith("0x");
}
var init_isHex = __esm({
  "node_modules/viem/_esm/utils/data/isHex.js"() {
  }
});

// node_modules/viem/_esm/utils/data/size.js
function size(value) {
  if (isHex2(value, { strict: false }))
    return Math.ceil((value.length - 2) / 2);
  return value.length;
}
var init_size = __esm({
  "node_modules/viem/_esm/utils/data/size.js"() {
    init_isHex();
  }
});

// node_modules/viem/_esm/errors/version.js
var version;
var init_version = __esm({
  "node_modules/viem/_esm/errors/version.js"() {
    version = "2.50.4";
  }
});

// node_modules/viem/_esm/errors/base.js
function walk(err, fn) {
  if (fn?.(err))
    return err;
  if (err && typeof err === "object" && "cause" in err && err.cause !== void 0)
    return walk(err.cause, fn);
  return fn ? null : err;
}
var errorConfig, BaseError;
var init_base = __esm({
  "node_modules/viem/_esm/errors/base.js"() {
    init_version();
    errorConfig = {
      getDocsUrl: ({ docsBaseUrl, docsPath = "", docsSlug }) => docsPath ? `${docsBaseUrl ?? "https://viem.sh"}${docsPath}${docsSlug ? `#${docsSlug}` : ""}` : void 0,
      version: `viem@${version}`
    };
    BaseError = class _BaseError extends Error {
      constructor(shortMessage, args = {}) {
        const details = (() => {
          if (args.cause instanceof _BaseError)
            return args.cause.details;
          if (args.cause?.message)
            return args.cause.message;
          return args.details;
        })();
        const docsPath = (() => {
          if (args.cause instanceof _BaseError)
            return args.cause.docsPath || args.docsPath;
          return args.docsPath;
        })();
        const docsUrl = errorConfig.getDocsUrl?.({ ...args, docsPath });
        const message = [
          shortMessage || "An error occurred.",
          "",
          ...args.metaMessages ? [...args.metaMessages, ""] : [],
          ...docsUrl ? [`Docs: ${docsUrl}`] : [],
          ...details ? [`Details: ${details}`] : [],
          ...errorConfig.version ? [`Version: ${errorConfig.version}`] : []
        ].join("\n");
        super(message, args.cause ? { cause: args.cause } : void 0);
        Object.defineProperty(this, "details", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "docsPath", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "metaMessages", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "shortMessage", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "version", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "name", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: "BaseError"
        });
        this.details = details;
        this.docsPath = docsPath;
        this.metaMessages = args.metaMessages;
        this.name = args.name ?? this.name;
        this.shortMessage = shortMessage;
        this.version = version;
      }
      walk(fn) {
        return walk(this, fn);
      }
    };
  }
});

// node_modules/viem/_esm/errors/data.js
var SizeExceedsPaddingSizeError;
var init_data = __esm({
  "node_modules/viem/_esm/errors/data.js"() {
    init_base();
    SizeExceedsPaddingSizeError = class extends BaseError {
      constructor({ size: size2, targetSize, type }) {
        super(`${type.charAt(0).toUpperCase()}${type.slice(1).toLowerCase()} size (${size2}) exceeds padding size (${targetSize}).`, { name: "SizeExceedsPaddingSizeError" });
      }
    };
  }
});

// node_modules/viem/_esm/utils/data/pad.js
function pad(hexOrBytes, { dir, size: size2 = 32 } = {}) {
  if (typeof hexOrBytes === "string")
    return padHex(hexOrBytes, { dir, size: size2 });
  return padBytes(hexOrBytes, { dir, size: size2 });
}
function padHex(hex_, { dir, size: size2 = 32 } = {}) {
  if (size2 === null)
    return hex_;
  const hex = hex_.replace("0x", "");
  if (hex.length > size2 * 2)
    throw new SizeExceedsPaddingSizeError({
      size: Math.ceil(hex.length / 2),
      targetSize: size2,
      type: "hex"
    });
  return `0x${hex[dir === "right" ? "padEnd" : "padStart"](size2 * 2, "0")}`;
}
function padBytes(bytes, { dir, size: size2 = 32 } = {}) {
  if (size2 === null)
    return bytes;
  if (bytes.length > size2)
    throw new SizeExceedsPaddingSizeError({
      size: bytes.length,
      targetSize: size2,
      type: "bytes"
    });
  const paddedBytes = new Uint8Array(size2);
  for (let i = 0; i < size2; i++) {
    const padEnd = dir === "right";
    paddedBytes[padEnd ? i : size2 - i - 1] = bytes[padEnd ? i : bytes.length - i - 1];
  }
  return paddedBytes;
}
var init_pad = __esm({
  "node_modules/viem/_esm/utils/data/pad.js"() {
    init_data();
  }
});

// node_modules/viem/_esm/errors/encoding.js
var IntegerOutOfRangeError, SizeOverflowError;
var init_encoding = __esm({
  "node_modules/viem/_esm/errors/encoding.js"() {
    init_base();
    IntegerOutOfRangeError = class extends BaseError {
      constructor({ max, min, signed, size: size2, value }) {
        super(`Number "${value}" is not in safe ${size2 ? `${size2 * 8}-bit ${signed ? "signed" : "unsigned"} ` : ""}integer range ${max ? `(${min} to ${max})` : `(above ${min})`}`, { name: "IntegerOutOfRangeError" });
      }
    };
    SizeOverflowError = class extends BaseError {
      constructor({ givenSize, maxSize }) {
        super(`Size cannot exceed ${maxSize} bytes. Given size: ${givenSize} bytes.`, { name: "SizeOverflowError" });
      }
    };
  }
});

// node_modules/viem/_esm/utils/encoding/fromHex.js
function assertSize(hexOrBytes, { size: size2 }) {
  if (size(hexOrBytes) > size2)
    throw new SizeOverflowError({
      givenSize: size(hexOrBytes),
      maxSize: size2
    });
}
function hexToBigInt(hex, opts = {}) {
  const { signed } = opts;
  if (opts.size)
    assertSize(hex, { size: opts.size });
  const value = BigInt(hex);
  if (!signed)
    return value;
  const size2 = (hex.length - 2) / 2;
  const max = (1n << BigInt(size2) * 8n - 1n) - 1n;
  if (value <= max)
    return value;
  return value - BigInt(`0x${"f".padStart(size2 * 2, "f")}`) - 1n;
}
function hexToNumber(hex, opts = {}) {
  const value = hexToBigInt(hex, opts);
  const number = Number(value);
  if (!Number.isSafeInteger(number))
    throw new IntegerOutOfRangeError({
      max: `${Number.MAX_SAFE_INTEGER}`,
      min: `${Number.MIN_SAFE_INTEGER}`,
      signed: opts.signed,
      size: opts.size,
      value: `${value}n`
    });
  return number;
}
var init_fromHex = __esm({
  "node_modules/viem/_esm/utils/encoding/fromHex.js"() {
    init_encoding();
    init_size();
  }
});

// node_modules/viem/_esm/utils/encoding/toHex.js
function toHex(value, opts = {}) {
  if (typeof value === "number" || typeof value === "bigint")
    return numberToHex(value, opts);
  if (typeof value === "string") {
    return stringToHex(value, opts);
  }
  if (typeof value === "boolean")
    return boolToHex(value, opts);
  return bytesToHex2(value, opts);
}
function boolToHex(value, opts = {}) {
  const hex = `0x${Number(value)}`;
  if (typeof opts.size === "number") {
    assertSize(hex, { size: opts.size });
    return pad(hex, { size: opts.size });
  }
  return hex;
}
function bytesToHex2(value, opts = {}) {
  let string = "";
  for (let i = 0; i < value.length; i++) {
    string += hexes[value[i]];
  }
  const hex = `0x${string}`;
  if (typeof opts.size === "number") {
    assertSize(hex, { size: opts.size });
    return pad(hex, { dir: "right", size: opts.size });
  }
  return hex;
}
function numberToHex(value_, opts = {}) {
  const { signed, size: size2 } = opts;
  const value = BigInt(value_);
  let maxValue;
  if (size2) {
    if (signed)
      maxValue = (1n << BigInt(size2) * 8n - 1n) - 1n;
    else
      maxValue = 2n ** (BigInt(size2) * 8n) - 1n;
  } else if (typeof value_ === "number") {
    maxValue = BigInt(Number.MAX_SAFE_INTEGER);
  }
  const minValue = typeof maxValue === "bigint" && signed ? -maxValue - 1n : 0;
  if (maxValue && value > maxValue || value < minValue) {
    const suffix = typeof value_ === "bigint" ? "n" : "";
    throw new IntegerOutOfRangeError({
      max: maxValue ? `${maxValue}${suffix}` : void 0,
      min: `${minValue}${suffix}`,
      signed,
      size: size2,
      value: `${value_}${suffix}`
    });
  }
  const hex = `0x${(signed && value < 0 ? (1n << BigInt(size2 * 8)) + BigInt(value) : value).toString(16)}`;
  if (size2)
    return pad(hex, { size: size2 });
  return hex;
}
function stringToHex(value_, opts = {}) {
  const value = encoder.encode(value_);
  return bytesToHex2(value, opts);
}
var hexes, encoder;
var init_toHex = __esm({
  "node_modules/viem/_esm/utils/encoding/toHex.js"() {
    init_encoding();
    init_pad();
    init_fromHex();
    hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_v, i) => i.toString(16).padStart(2, "0"));
    encoder = /* @__PURE__ */ new TextEncoder();
  }
});

// node_modules/viem/_esm/utils/encoding/toBytes.js
function toBytes2(value, opts = {}) {
  if (typeof value === "number" || typeof value === "bigint")
    return numberToBytes(value, opts);
  if (typeof value === "boolean")
    return boolToBytes(value, opts);
  if (isHex2(value))
    return hexToBytes2(value, opts);
  return stringToBytes(value, opts);
}
function boolToBytes(value, opts = {}) {
  const bytes = new Uint8Array(1);
  bytes[0] = Number(value);
  if (typeof opts.size === "number") {
    assertSize(bytes, { size: opts.size });
    return pad(bytes, { size: opts.size });
  }
  return bytes;
}
function charCodeToBase16(char) {
  if (char >= charCodeMap.zero && char <= charCodeMap.nine)
    return char - charCodeMap.zero;
  if (char >= charCodeMap.A && char <= charCodeMap.F)
    return char - (charCodeMap.A - 10);
  if (char >= charCodeMap.a && char <= charCodeMap.f)
    return char - (charCodeMap.a - 10);
  return void 0;
}
function hexToBytes2(hex_, opts = {}) {
  let hex = hex_;
  if (opts.size) {
    assertSize(hex, { size: opts.size });
    hex = pad(hex, { dir: "right", size: opts.size });
  }
  let hexString = hex.slice(2);
  if (hexString.length % 2)
    hexString = `0${hexString}`;
  const length = hexString.length / 2;
  const bytes = new Uint8Array(length);
  for (let index = 0, j = 0; index < length; index++) {
    const nibbleLeft = charCodeToBase16(hexString.charCodeAt(j++));
    const nibbleRight = charCodeToBase16(hexString.charCodeAt(j++));
    if (nibbleLeft === void 0 || nibbleRight === void 0) {
      throw new BaseError(`Invalid byte sequence ("${hexString[j - 2]}${hexString[j - 1]}" in "${hexString}").`);
    }
    bytes[index] = nibbleLeft * 16 + nibbleRight;
  }
  return bytes;
}
function numberToBytes(value, opts) {
  const hex = numberToHex(value, opts);
  return hexToBytes2(hex);
}
function stringToBytes(value, opts = {}) {
  const bytes = encoder2.encode(value);
  if (typeof opts.size === "number") {
    assertSize(bytes, { size: opts.size });
    return pad(bytes, { dir: "right", size: opts.size });
  }
  return bytes;
}
var encoder2, charCodeMap;
var init_toBytes = __esm({
  "node_modules/viem/_esm/utils/encoding/toBytes.js"() {
    init_base();
    init_isHex();
    init_pad();
    init_fromHex();
    init_toHex();
    encoder2 = /* @__PURE__ */ new TextEncoder();
    charCodeMap = {
      zero: 48,
      nine: 57,
      A: 65,
      F: 70,
      a: 97,
      f: 102
    };
  }
});

// node_modules/viem/_esm/utils/hash/keccak256.js
function keccak256(value, to_) {
  const to = to_ || "hex";
  const bytes = keccak_256(isHex2(value, { strict: false }) ? toBytes2(value) : value);
  if (to === "bytes")
    return bytes;
  return toHex(bytes);
}
var init_keccak256 = __esm({
  "node_modules/viem/_esm/utils/hash/keccak256.js"() {
    init_sha3();
    init_isHex();
    init_toBytes();
    init_toHex();
  }
});

// node_modules/viem/_esm/errors/address.js
var InvalidAddressError;
var init_address = __esm({
  "node_modules/viem/_esm/errors/address.js"() {
    init_base();
    InvalidAddressError = class extends BaseError {
      constructor({ address }) {
        super(`Address "${address}" is invalid.`, {
          metaMessages: [
            "- Address must be a hex value of 20 bytes (40 hex characters).",
            "- Address must match its checksum counterpart."
          ],
          name: "InvalidAddressError"
        });
      }
    };
  }
});

// node_modules/viem/_esm/utils/lru.js
var LruMap;
var init_lru = __esm({
  "node_modules/viem/_esm/utils/lru.js"() {
    LruMap = class extends Map {
      constructor(size2) {
        super();
        Object.defineProperty(this, "maxSize", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        this.maxSize = size2;
      }
      get(key) {
        const value = super.get(key);
        if (super.has(key)) {
          super.delete(key);
          super.set(key, value);
        }
        return value;
      }
      set(key, value) {
        if (super.has(key))
          super.delete(key);
        super.set(key, value);
        if (this.maxSize && this.size > this.maxSize) {
          const firstKey = super.keys().next().value;
          if (firstKey !== void 0)
            super.delete(firstKey);
        }
        return this;
      }
    };
  }
});

// node_modules/viem/_esm/utils/address/getAddress.js
function checksumAddress(address_, chainId) {
  if (checksumAddressCache.has(`${address_}.${chainId}`))
    return checksumAddressCache.get(`${address_}.${chainId}`);
  const hexAddress = chainId ? `${chainId}${address_.toLowerCase()}` : address_.substring(2).toLowerCase();
  const hash = keccak256(stringToBytes(hexAddress), "bytes");
  const address = (chainId ? hexAddress.substring(`${chainId}0x`.length) : hexAddress).split("");
  for (let i = 0; i < 40; i += 2) {
    if (hash[i >> 1] >> 4 >= 8 && address[i]) {
      address[i] = address[i].toUpperCase();
    }
    if ((hash[i >> 1] & 15) >= 8 && address[i + 1]) {
      address[i + 1] = address[i + 1].toUpperCase();
    }
  }
  const result = `0x${address.join("")}`;
  checksumAddressCache.set(`${address_}.${chainId}`, result);
  return result;
}
function getAddress(address, chainId) {
  if (!isAddress(address, { strict: false }))
    throw new InvalidAddressError({ address });
  return checksumAddress(address, chainId);
}
var checksumAddressCache;
var init_getAddress = __esm({
  "node_modules/viem/_esm/utils/address/getAddress.js"() {
    init_address();
    init_toBytes();
    init_keccak256();
    init_lru();
    init_isAddress();
    checksumAddressCache = /* @__PURE__ */ new LruMap(8192);
  }
});

// node_modules/viem/_esm/utils/address/isAddress.js
function isAddress(address, options) {
  const { strict = true } = options ?? {};
  const cacheKey = `${address}.${strict}`;
  if (isAddressCache.has(cacheKey))
    return isAddressCache.get(cacheKey);
  const result = (() => {
    if (!addressRegex.test(address))
      return false;
    if (address.toLowerCase() === address)
      return true;
    if (strict)
      return checksumAddress(address) === address;
    return true;
  })();
  isAddressCache.set(cacheKey, result);
  return result;
}
var addressRegex, isAddressCache;
var init_isAddress = __esm({
  "node_modules/viem/_esm/utils/address/isAddress.js"() {
    init_lru();
    init_getAddress();
    addressRegex = /^0x[a-fA-F0-9]{40}$/;
    isAddressCache = /* @__PURE__ */ new LruMap(8192);
  }
});

// node_modules/viem/_esm/utils/data/concat.js
function concat(values) {
  if (typeof values[0] === "string")
    return concatHex(values);
  return concatBytes3(values);
}
function concatBytes3(values) {
  let length = 0;
  for (const arr of values) {
    length += arr.length;
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const arr of values) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}
function concatHex(values) {
  return `0x${values.reduce((acc, x) => acc + x.replace("0x", ""), "")}`;
}
var init_concat = __esm({
  "node_modules/viem/_esm/utils/data/concat.js"() {
  }
});

// node_modules/@noble/hashes/esm/_md.js
function setBigUint64(view, byteOffset, value, isLE2) {
  if (typeof view.setBigUint64 === "function")
    return view.setBigUint64(byteOffset, value, isLE2);
  const _32n2 = BigInt(32);
  const _u32_max = BigInt(4294967295);
  const wh = Number(value >> _32n2 & _u32_max);
  const wl = Number(value & _u32_max);
  const h = isLE2 ? 4 : 0;
  const l = isLE2 ? 0 : 4;
  view.setUint32(byteOffset + h, wh, isLE2);
  view.setUint32(byteOffset + l, wl, isLE2);
}
function Chi(a, b, c) {
  return a & b ^ ~a & c;
}
function Maj(a, b, c) {
  return a & b ^ a & c ^ b & c;
}
var HashMD, SHA256_IV;
var init_md = __esm({
  "node_modules/@noble/hashes/esm/_md.js"() {
    init_utils();
    HashMD = class extends Hash {
      constructor(blockLen, outputLen, padOffset, isLE2) {
        super();
        this.finished = false;
        this.length = 0;
        this.pos = 0;
        this.destroyed = false;
        this.blockLen = blockLen;
        this.outputLen = outputLen;
        this.padOffset = padOffset;
        this.isLE = isLE2;
        this.buffer = new Uint8Array(blockLen);
        this.view = createView(this.buffer);
      }
      update(data) {
        aexists(this);
        data = toBytes(data);
        abytes(data);
        const { view, buffer, blockLen } = this;
        const len = data.length;
        for (let pos = 0; pos < len; ) {
          const take = Math.min(blockLen - this.pos, len - pos);
          if (take === blockLen) {
            const dataView = createView(data);
            for (; blockLen <= len - pos; pos += blockLen)
              this.process(dataView, pos);
            continue;
          }
          buffer.set(data.subarray(pos, pos + take), this.pos);
          this.pos += take;
          pos += take;
          if (this.pos === blockLen) {
            this.process(view, 0);
            this.pos = 0;
          }
        }
        this.length += data.length;
        this.roundClean();
        return this;
      }
      digestInto(out) {
        aexists(this);
        aoutput(out, this);
        this.finished = true;
        const { buffer, view, blockLen, isLE: isLE2 } = this;
        let { pos } = this;
        buffer[pos++] = 128;
        clean(this.buffer.subarray(pos));
        if (this.padOffset > blockLen - pos) {
          this.process(view, 0);
          pos = 0;
        }
        for (let i = pos; i < blockLen; i++)
          buffer[i] = 0;
        setBigUint64(view, blockLen - 8, BigInt(this.length * 8), isLE2);
        this.process(view, 0);
        const oview = createView(out);
        const len = this.outputLen;
        if (len % 4)
          throw new Error("_sha2: outputLen should be aligned to 32bit");
        const outLen = len / 4;
        const state = this.get();
        if (outLen > state.length)
          throw new Error("_sha2: outputLen bigger than state");
        for (let i = 0; i < outLen; i++)
          oview.setUint32(4 * i, state[i], isLE2);
      }
      digest() {
        const { buffer, outputLen } = this;
        this.digestInto(buffer);
        const res = buffer.slice(0, outputLen);
        this.destroy();
        return res;
      }
      _cloneInto(to) {
        to || (to = new this.constructor());
        to.set(...this.get());
        const { blockLen, buffer, length, finished, destroyed, pos } = this;
        to.destroyed = destroyed;
        to.finished = finished;
        to.length = length;
        to.pos = pos;
        if (length % blockLen)
          to.buffer.set(buffer);
        return to;
      }
      clone() {
        return this._cloneInto();
      }
    };
    SHA256_IV = /* @__PURE__ */ Uint32Array.from([
      1779033703,
      3144134277,
      1013904242,
      2773480762,
      1359893119,
      2600822924,
      528734635,
      1541459225
    ]);
  }
});

// node_modules/@noble/hashes/esm/sha2.js
var SHA256_K, SHA256_W, SHA256, sha256;
var init_sha2 = __esm({
  "node_modules/@noble/hashes/esm/sha2.js"() {
    init_md();
    init_utils();
    SHA256_K = /* @__PURE__ */ Uint32Array.from([
      1116352408,
      1899447441,
      3049323471,
      3921009573,
      961987163,
      1508970993,
      2453635748,
      2870763221,
      3624381080,
      310598401,
      607225278,
      1426881987,
      1925078388,
      2162078206,
      2614888103,
      3248222580,
      3835390401,
      4022224774,
      264347078,
      604807628,
      770255983,
      1249150122,
      1555081692,
      1996064986,
      2554220882,
      2821834349,
      2952996808,
      3210313671,
      3336571891,
      3584528711,
      113926993,
      338241895,
      666307205,
      773529912,
      1294757372,
      1396182291,
      1695183700,
      1986661051,
      2177026350,
      2456956037,
      2730485921,
      2820302411,
      3259730800,
      3345764771,
      3516065817,
      3600352804,
      4094571909,
      275423344,
      430227734,
      506948616,
      659060556,
      883997877,
      958139571,
      1322822218,
      1537002063,
      1747873779,
      1955562222,
      2024104815,
      2227730452,
      2361852424,
      2428436474,
      2756734187,
      3204031479,
      3329325298
    ]);
    SHA256_W = /* @__PURE__ */ new Uint32Array(64);
    SHA256 = class extends HashMD {
      constructor(outputLen = 32) {
        super(64, outputLen, 8, false);
        this.A = SHA256_IV[0] | 0;
        this.B = SHA256_IV[1] | 0;
        this.C = SHA256_IV[2] | 0;
        this.D = SHA256_IV[3] | 0;
        this.E = SHA256_IV[4] | 0;
        this.F = SHA256_IV[5] | 0;
        this.G = SHA256_IV[6] | 0;
        this.H = SHA256_IV[7] | 0;
      }
      get() {
        const { A, B, C, D, E, F, G, H } = this;
        return [A, B, C, D, E, F, G, H];
      }
      // prettier-ignore
      set(A, B, C, D, E, F, G, H) {
        this.A = A | 0;
        this.B = B | 0;
        this.C = C | 0;
        this.D = D | 0;
        this.E = E | 0;
        this.F = F | 0;
        this.G = G | 0;
        this.H = H | 0;
      }
      process(view, offset) {
        for (let i = 0; i < 16; i++, offset += 4)
          SHA256_W[i] = view.getUint32(offset, false);
        for (let i = 16; i < 64; i++) {
          const W15 = SHA256_W[i - 15];
          const W2 = SHA256_W[i - 2];
          const s0 = rotr(W15, 7) ^ rotr(W15, 18) ^ W15 >>> 3;
          const s1 = rotr(W2, 17) ^ rotr(W2, 19) ^ W2 >>> 10;
          SHA256_W[i] = s1 + SHA256_W[i - 7] + s0 + SHA256_W[i - 16] | 0;
        }
        let { A, B, C, D, E, F, G, H } = this;
        for (let i = 0; i < 64; i++) {
          const sigma1 = rotr(E, 6) ^ rotr(E, 11) ^ rotr(E, 25);
          const T1 = H + sigma1 + Chi(E, F, G) + SHA256_K[i] + SHA256_W[i] | 0;
          const sigma0 = rotr(A, 2) ^ rotr(A, 13) ^ rotr(A, 22);
          const T2 = sigma0 + Maj(A, B, C) | 0;
          H = G;
          G = F;
          F = E;
          E = D + T1 | 0;
          D = C;
          C = B;
          B = A;
          A = T1 + T2 | 0;
        }
        A = A + this.A | 0;
        B = B + this.B | 0;
        C = C + this.C | 0;
        D = D + this.D | 0;
        E = E + this.E | 0;
        F = F + this.F | 0;
        G = G + this.G | 0;
        H = H + this.H | 0;
        this.set(A, B, C, D, E, F, G, H);
      }
      roundClean() {
        clean(SHA256_W);
      }
      destroy() {
        this.set(0, 0, 0, 0, 0, 0, 0, 0);
        clean(this.buffer);
      }
    };
    sha256 = /* @__PURE__ */ createHasher(() => new SHA256());
  }
});

// node_modules/@noble/hashes/esm/hmac.js
var HMAC, hmac;
var init_hmac = __esm({
  "node_modules/@noble/hashes/esm/hmac.js"() {
    init_utils();
    HMAC = class extends Hash {
      constructor(hash, _key) {
        super();
        this.finished = false;
        this.destroyed = false;
        ahash(hash);
        const key = toBytes(_key);
        this.iHash = hash.create();
        if (typeof this.iHash.update !== "function")
          throw new Error("Expected instance of class which extends utils.Hash");
        this.blockLen = this.iHash.blockLen;
        this.outputLen = this.iHash.outputLen;
        const blockLen = this.blockLen;
        const pad2 = new Uint8Array(blockLen);
        pad2.set(key.length > blockLen ? hash.create().update(key).digest() : key);
        for (let i = 0; i < pad2.length; i++)
          pad2[i] ^= 54;
        this.iHash.update(pad2);
        this.oHash = hash.create();
        for (let i = 0; i < pad2.length; i++)
          pad2[i] ^= 54 ^ 92;
        this.oHash.update(pad2);
        clean(pad2);
      }
      update(buf) {
        aexists(this);
        this.iHash.update(buf);
        return this;
      }
      digestInto(out) {
        aexists(this);
        abytes(out, this.outputLen);
        this.finished = true;
        this.iHash.digestInto(out);
        this.oHash.update(out);
        this.oHash.digestInto(out);
        this.destroy();
      }
      digest() {
        const out = new Uint8Array(this.oHash.outputLen);
        this.digestInto(out);
        return out;
      }
      _cloneInto(to) {
        to || (to = Object.create(Object.getPrototypeOf(this), {}));
        const { oHash, iHash, finished, destroyed, blockLen, outputLen } = this;
        to = to;
        to.finished = finished;
        to.destroyed = destroyed;
        to.blockLen = blockLen;
        to.outputLen = outputLen;
        to.oHash = oHash._cloneInto(to.oHash);
        to.iHash = iHash._cloneInto(to.iHash);
        return to;
      }
      clone() {
        return this._cloneInto();
      }
      destroy() {
        this.destroyed = true;
        this.oHash.destroy();
        this.iHash.destroy();
      }
    };
    hmac = (hash, key, message) => new HMAC(hash, key).update(message).digest();
    hmac.create = (hash, key) => new HMAC(hash, key);
  }
});

// node_modules/@noble/curves/esm/abstract/utils.js
function isBytes2(a) {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array";
}
function abytes2(item) {
  if (!isBytes2(item))
    throw new Error("Uint8Array expected");
}
function abool(title, value) {
  if (typeof value !== "boolean")
    throw new Error(title + " boolean expected, got " + value);
}
function numberToHexUnpadded(num2) {
  const hex = num2.toString(16);
  return hex.length & 1 ? "0" + hex : hex;
}
function hexToNumber2(hex) {
  if (typeof hex !== "string")
    throw new Error("hex string expected, got " + typeof hex);
  return hex === "" ? _0n2 : BigInt("0x" + hex);
}
function bytesToHex3(bytes) {
  abytes2(bytes);
  if (hasHexBuiltin)
    return bytes.toHex();
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += hexes2[bytes[i]];
  }
  return hex;
}
function asciiToBase16(ch) {
  if (ch >= asciis._0 && ch <= asciis._9)
    return ch - asciis._0;
  if (ch >= asciis.A && ch <= asciis.F)
    return ch - (asciis.A - 10);
  if (ch >= asciis.a && ch <= asciis.f)
    return ch - (asciis.a - 10);
  return;
}
function hexToBytes3(hex) {
  if (typeof hex !== "string")
    throw new Error("hex string expected, got " + typeof hex);
  if (hasHexBuiltin)
    return Uint8Array.fromHex(hex);
  const hl = hex.length;
  const al = hl / 2;
  if (hl % 2)
    throw new Error("hex string expected, got unpadded hex of length " + hl);
  const array = new Uint8Array(al);
  for (let ai = 0, hi = 0; ai < al; ai++, hi += 2) {
    const n1 = asciiToBase16(hex.charCodeAt(hi));
    const n2 = asciiToBase16(hex.charCodeAt(hi + 1));
    if (n1 === void 0 || n2 === void 0) {
      const char = hex[hi] + hex[hi + 1];
      throw new Error('hex string expected, got non-hex character "' + char + '" at index ' + hi);
    }
    array[ai] = n1 * 16 + n2;
  }
  return array;
}
function bytesToNumberBE(bytes) {
  return hexToNumber2(bytesToHex3(bytes));
}
function bytesToNumberLE(bytes) {
  abytes2(bytes);
  return hexToNumber2(bytesToHex3(Uint8Array.from(bytes).reverse()));
}
function numberToBytesBE(n, len) {
  return hexToBytes3(n.toString(16).padStart(len * 2, "0"));
}
function numberToBytesLE(n, len) {
  return numberToBytesBE(n, len).reverse();
}
function ensureBytes(title, hex, expectedLength) {
  let res;
  if (typeof hex === "string") {
    try {
      res = hexToBytes3(hex);
    } catch (e) {
      throw new Error(title + " must be hex string or Uint8Array, cause: " + e);
    }
  } else if (isBytes2(hex)) {
    res = Uint8Array.from(hex);
  } else {
    throw new Error(title + " must be hex string or Uint8Array");
  }
  const len = res.length;
  if (typeof expectedLength === "number" && len !== expectedLength)
    throw new Error(title + " of length " + expectedLength + " expected, got " + len);
  return res;
}
function concatBytes4(...arrays) {
  let sum = 0;
  for (let i = 0; i < arrays.length; i++) {
    const a = arrays[i];
    abytes2(a);
    sum += a.length;
  }
  const res = new Uint8Array(sum);
  for (let i = 0, pad2 = 0; i < arrays.length; i++) {
    const a = arrays[i];
    res.set(a, pad2);
    pad2 += a.length;
  }
  return res;
}
function utf8ToBytes3(str) {
  if (typeof str !== "string")
    throw new Error("string expected");
  return new Uint8Array(new TextEncoder().encode(str));
}
function inRange(n, min, max) {
  return isPosBig(n) && isPosBig(min) && isPosBig(max) && min <= n && n < max;
}
function aInRange(title, n, min, max) {
  if (!inRange(n, min, max))
    throw new Error("expected valid " + title + ": " + min + " <= n < " + max + ", got " + n);
}
function bitLen(n) {
  let len;
  for (len = 0; n > _0n2; n >>= _1n2, len += 1)
    ;
  return len;
}
function createHmacDrbg(hashLen, qByteLen, hmacFn) {
  if (typeof hashLen !== "number" || hashLen < 2)
    throw new Error("hashLen must be a number");
  if (typeof qByteLen !== "number" || qByteLen < 2)
    throw new Error("qByteLen must be a number");
  if (typeof hmacFn !== "function")
    throw new Error("hmacFn must be a function");
  let v = u8n(hashLen);
  let k = u8n(hashLen);
  let i = 0;
  const reset = () => {
    v.fill(1);
    k.fill(0);
    i = 0;
  };
  const h = (...b) => hmacFn(k, v, ...b);
  const reseed = (seed = u8n(0)) => {
    k = h(u8fr([0]), seed);
    v = h();
    if (seed.length === 0)
      return;
    k = h(u8fr([1]), seed);
    v = h();
  };
  const gen2 = () => {
    if (i++ >= 1e3)
      throw new Error("drbg: tried 1000 values");
    let len = 0;
    const out = [];
    while (len < qByteLen) {
      v = h();
      const sl = v.slice();
      out.push(sl);
      len += v.length;
    }
    return concatBytes4(...out);
  };
  const genUntil = (seed, pred) => {
    reset();
    reseed(seed);
    let res = void 0;
    while (!(res = pred(gen2())))
      reseed();
    reset();
    return res;
  };
  return genUntil;
}
function validateObject(object, validators, optValidators = {}) {
  const checkField = (fieldName, type, isOptional) => {
    const checkVal = validatorFns[type];
    if (typeof checkVal !== "function")
      throw new Error("invalid validator function");
    const val = object[fieldName];
    if (isOptional && val === void 0)
      return;
    if (!checkVal(val, object)) {
      throw new Error("param " + String(fieldName) + " is invalid. Expected " + type + ", got " + val);
    }
  };
  for (const [fieldName, type] of Object.entries(validators))
    checkField(fieldName, type, false);
  for (const [fieldName, type] of Object.entries(optValidators))
    checkField(fieldName, type, true);
  return object;
}
function memoized(fn) {
  const map = /* @__PURE__ */ new WeakMap();
  return (arg, ...args) => {
    const val = map.get(arg);
    if (val !== void 0)
      return val;
    const computed = fn(arg, ...args);
    map.set(arg, computed);
    return computed;
  };
}
var _0n2, _1n2, hasHexBuiltin, hexes2, asciis, isPosBig, bitMask, u8n, u8fr, validatorFns;
var init_utils2 = __esm({
  "node_modules/@noble/curves/esm/abstract/utils.js"() {
    _0n2 = /* @__PURE__ */ BigInt(0);
    _1n2 = /* @__PURE__ */ BigInt(1);
    hasHexBuiltin = // @ts-ignore
    typeof Uint8Array.from([]).toHex === "function" && typeof Uint8Array.fromHex === "function";
    hexes2 = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));
    asciis = { _0: 48, _9: 57, A: 65, F: 70, a: 97, f: 102 };
    isPosBig = (n) => typeof n === "bigint" && _0n2 <= n;
    bitMask = (n) => (_1n2 << BigInt(n)) - _1n2;
    u8n = (len) => new Uint8Array(len);
    u8fr = (arr) => Uint8Array.from(arr);
    validatorFns = {
      bigint: (val) => typeof val === "bigint",
      function: (val) => typeof val === "function",
      boolean: (val) => typeof val === "boolean",
      string: (val) => typeof val === "string",
      stringOrUint8Array: (val) => typeof val === "string" || isBytes2(val),
      isSafeInteger: (val) => Number.isSafeInteger(val),
      array: (val) => Array.isArray(val),
      field: (val, object) => object.Fp.isValid(val),
      hash: (val) => typeof val === "function" && Number.isSafeInteger(val.outputLen)
    };
  }
});

// node_modules/@noble/curves/esm/abstract/modular.js
function mod(a, b) {
  const result = a % b;
  return result >= _0n3 ? result : b + result;
}
function pow2(x, power, modulo) {
  let res = x;
  while (power-- > _0n3) {
    res *= res;
    res %= modulo;
  }
  return res;
}
function invert(number, modulo) {
  if (number === _0n3)
    throw new Error("invert: expected non-zero number");
  if (modulo <= _0n3)
    throw new Error("invert: expected positive modulus, got " + modulo);
  let a = mod(number, modulo);
  let b = modulo;
  let x = _0n3, y = _1n3, u = _1n3, v = _0n3;
  while (a !== _0n3) {
    const q = b / a;
    const r = b % a;
    const m = x - u * q;
    const n = y - v * q;
    b = a, a = r, x = u, y = v, u = m, v = n;
  }
  const gcd = b;
  if (gcd !== _1n3)
    throw new Error("invert: does not exist");
  return mod(x, modulo);
}
function sqrt3mod4(Fp, n) {
  const p1div4 = (Fp.ORDER + _1n3) / _4n;
  const root = Fp.pow(n, p1div4);
  if (!Fp.eql(Fp.sqr(root), n))
    throw new Error("Cannot find square root");
  return root;
}
function sqrt5mod8(Fp, n) {
  const p5div8 = (Fp.ORDER - _5n) / _8n;
  const n2 = Fp.mul(n, _2n2);
  const v = Fp.pow(n2, p5div8);
  const nv = Fp.mul(n, v);
  const i = Fp.mul(Fp.mul(nv, _2n2), v);
  const root = Fp.mul(nv, Fp.sub(i, Fp.ONE));
  if (!Fp.eql(Fp.sqr(root), n))
    throw new Error("Cannot find square root");
  return root;
}
function tonelliShanks(P) {
  if (P < BigInt(3))
    throw new Error("sqrt is not defined for small field");
  let Q = P - _1n3;
  let S = 0;
  while (Q % _2n2 === _0n3) {
    Q /= _2n2;
    S++;
  }
  let Z = _2n2;
  const _Fp = Field(P);
  while (FpLegendre(_Fp, Z) === 1) {
    if (Z++ > 1e3)
      throw new Error("Cannot find square root: probably non-prime P");
  }
  if (S === 1)
    return sqrt3mod4;
  let cc = _Fp.pow(Z, Q);
  const Q1div2 = (Q + _1n3) / _2n2;
  return function tonelliSlow(Fp, n) {
    if (Fp.is0(n))
      return n;
    if (FpLegendre(Fp, n) !== 1)
      throw new Error("Cannot find square root");
    let M = S;
    let c = Fp.mul(Fp.ONE, cc);
    let t = Fp.pow(n, Q);
    let R = Fp.pow(n, Q1div2);
    while (!Fp.eql(t, Fp.ONE)) {
      if (Fp.is0(t))
        return Fp.ZERO;
      let i = 1;
      let t_tmp = Fp.sqr(t);
      while (!Fp.eql(t_tmp, Fp.ONE)) {
        i++;
        t_tmp = Fp.sqr(t_tmp);
        if (i === M)
          throw new Error("Cannot find square root");
      }
      const exponent = _1n3 << BigInt(M - i - 1);
      const b = Fp.pow(c, exponent);
      M = i;
      c = Fp.sqr(b);
      t = Fp.mul(t, c);
      R = Fp.mul(R, b);
    }
    return R;
  };
}
function FpSqrt(P) {
  if (P % _4n === _3n)
    return sqrt3mod4;
  if (P % _8n === _5n)
    return sqrt5mod8;
  return tonelliShanks(P);
}
function validateField(field) {
  const initial = {
    ORDER: "bigint",
    MASK: "bigint",
    BYTES: "isSafeInteger",
    BITS: "isSafeInteger"
  };
  const opts = FIELD_FIELDS.reduce((map, val) => {
    map[val] = "function";
    return map;
  }, initial);
  return validateObject(field, opts);
}
function FpPow(Fp, num2, power) {
  if (power < _0n3)
    throw new Error("invalid exponent, negatives unsupported");
  if (power === _0n3)
    return Fp.ONE;
  if (power === _1n3)
    return num2;
  let p = Fp.ONE;
  let d = num2;
  while (power > _0n3) {
    if (power & _1n3)
      p = Fp.mul(p, d);
    d = Fp.sqr(d);
    power >>= _1n3;
  }
  return p;
}
function FpInvertBatch(Fp, nums, passZero = false) {
  const inverted = new Array(nums.length).fill(passZero ? Fp.ZERO : void 0);
  const multipliedAcc = nums.reduce((acc, num2, i) => {
    if (Fp.is0(num2))
      return acc;
    inverted[i] = acc;
    return Fp.mul(acc, num2);
  }, Fp.ONE);
  const invertedAcc = Fp.inv(multipliedAcc);
  nums.reduceRight((acc, num2, i) => {
    if (Fp.is0(num2))
      return acc;
    inverted[i] = Fp.mul(acc, inverted[i]);
    return Fp.mul(acc, num2);
  }, invertedAcc);
  return inverted;
}
function FpLegendre(Fp, n) {
  const p1mod2 = (Fp.ORDER - _1n3) / _2n2;
  const powered = Fp.pow(n, p1mod2);
  const yes = Fp.eql(powered, Fp.ONE);
  const zero = Fp.eql(powered, Fp.ZERO);
  const no = Fp.eql(powered, Fp.neg(Fp.ONE));
  if (!yes && !zero && !no)
    throw new Error("invalid Legendre symbol result");
  return yes ? 1 : zero ? 0 : -1;
}
function nLength(n, nBitLength) {
  if (nBitLength !== void 0)
    anumber(nBitLength);
  const _nBitLength = nBitLength !== void 0 ? nBitLength : n.toString(2).length;
  const nByteLength = Math.ceil(_nBitLength / 8);
  return { nBitLength: _nBitLength, nByteLength };
}
function Field(ORDER, bitLen2, isLE2 = false, redef = {}) {
  if (ORDER <= _0n3)
    throw new Error("invalid field: expected ORDER > 0, got " + ORDER);
  const { nBitLength: BITS, nByteLength: BYTES } = nLength(ORDER, bitLen2);
  if (BYTES > 2048)
    throw new Error("invalid field: expected ORDER of <= 2048 bytes");
  let sqrtP;
  const f = Object.freeze({
    ORDER,
    isLE: isLE2,
    BITS,
    BYTES,
    MASK: bitMask(BITS),
    ZERO: _0n3,
    ONE: _1n3,
    create: (num2) => mod(num2, ORDER),
    isValid: (num2) => {
      if (typeof num2 !== "bigint")
        throw new Error("invalid field element: expected bigint, got " + typeof num2);
      return _0n3 <= num2 && num2 < ORDER;
    },
    is0: (num2) => num2 === _0n3,
    isOdd: (num2) => (num2 & _1n3) === _1n3,
    neg: (num2) => mod(-num2, ORDER),
    eql: (lhs, rhs) => lhs === rhs,
    sqr: (num2) => mod(num2 * num2, ORDER),
    add: (lhs, rhs) => mod(lhs + rhs, ORDER),
    sub: (lhs, rhs) => mod(lhs - rhs, ORDER),
    mul: (lhs, rhs) => mod(lhs * rhs, ORDER),
    pow: (num2, power) => FpPow(f, num2, power),
    div: (lhs, rhs) => mod(lhs * invert(rhs, ORDER), ORDER),
    // Same as above, but doesn't normalize
    sqrN: (num2) => num2 * num2,
    addN: (lhs, rhs) => lhs + rhs,
    subN: (lhs, rhs) => lhs - rhs,
    mulN: (lhs, rhs) => lhs * rhs,
    inv: (num2) => invert(num2, ORDER),
    sqrt: redef.sqrt || ((n) => {
      if (!sqrtP)
        sqrtP = FpSqrt(ORDER);
      return sqrtP(f, n);
    }),
    toBytes: (num2) => isLE2 ? numberToBytesLE(num2, BYTES) : numberToBytesBE(num2, BYTES),
    fromBytes: (bytes) => {
      if (bytes.length !== BYTES)
        throw new Error("Field.fromBytes: expected " + BYTES + " bytes, got " + bytes.length);
      return isLE2 ? bytesToNumberLE(bytes) : bytesToNumberBE(bytes);
    },
    // TODO: we don't need it here, move out to separate fn
    invertBatch: (lst) => FpInvertBatch(f, lst),
    // We can't move this out because Fp6, Fp12 implement it
    // and it's unclear what to return in there.
    cmov: (a, b, c) => c ? b : a
  });
  return Object.freeze(f);
}
function getFieldBytesLength(fieldOrder) {
  if (typeof fieldOrder !== "bigint")
    throw new Error("field order must be bigint");
  const bitLength = fieldOrder.toString(2).length;
  return Math.ceil(bitLength / 8);
}
function getMinHashLength(fieldOrder) {
  const length = getFieldBytesLength(fieldOrder);
  return length + Math.ceil(length / 2);
}
function mapHashToField(key, fieldOrder, isLE2 = false) {
  const len = key.length;
  const fieldLen = getFieldBytesLength(fieldOrder);
  const minLen = getMinHashLength(fieldOrder);
  if (len < 16 || len < minLen || len > 1024)
    throw new Error("expected " + minLen + "-1024 bytes of input, got " + len);
  const num2 = isLE2 ? bytesToNumberLE(key) : bytesToNumberBE(key);
  const reduced = mod(num2, fieldOrder - _1n3) + _1n3;
  return isLE2 ? numberToBytesLE(reduced, fieldLen) : numberToBytesBE(reduced, fieldLen);
}
var _0n3, _1n3, _2n2, _3n, _4n, _5n, _8n, FIELD_FIELDS;
var init_modular = __esm({
  "node_modules/@noble/curves/esm/abstract/modular.js"() {
    init_utils();
    init_utils2();
    _0n3 = BigInt(0);
    _1n3 = BigInt(1);
    _2n2 = /* @__PURE__ */ BigInt(2);
    _3n = /* @__PURE__ */ BigInt(3);
    _4n = /* @__PURE__ */ BigInt(4);
    _5n = /* @__PURE__ */ BigInt(5);
    _8n = /* @__PURE__ */ BigInt(8);
    FIELD_FIELDS = [
      "create",
      "isValid",
      "is0",
      "neg",
      "inv",
      "sqrt",
      "sqr",
      "eql",
      "add",
      "sub",
      "mul",
      "pow",
      "div",
      "addN",
      "subN",
      "mulN",
      "sqrN"
    ];
  }
});

// node_modules/@noble/curves/esm/abstract/curve.js
function constTimeNegate(condition, item) {
  const neg = item.negate();
  return condition ? neg : item;
}
function validateW(W, bits) {
  if (!Number.isSafeInteger(W) || W <= 0 || W > bits)
    throw new Error("invalid window size, expected [1.." + bits + "], got W=" + W);
}
function calcWOpts(W, scalarBits) {
  validateW(W, scalarBits);
  const windows = Math.ceil(scalarBits / W) + 1;
  const windowSize = 2 ** (W - 1);
  const maxNumber = 2 ** W;
  const mask = bitMask(W);
  const shiftBy = BigInt(W);
  return { windows, windowSize, mask, maxNumber, shiftBy };
}
function calcOffsets(n, window, wOpts) {
  const { windowSize, mask, maxNumber, shiftBy } = wOpts;
  let wbits = Number(n & mask);
  let nextN = n >> shiftBy;
  if (wbits > windowSize) {
    wbits -= maxNumber;
    nextN += _1n4;
  }
  const offsetStart = window * windowSize;
  const offset = offsetStart + Math.abs(wbits) - 1;
  const isZero = wbits === 0;
  const isNeg = wbits < 0;
  const isNegF = window % 2 !== 0;
  const offsetF = offsetStart;
  return { nextN, offset, isZero, isNeg, isNegF, offsetF };
}
function validateMSMPoints(points, c) {
  if (!Array.isArray(points))
    throw new Error("array expected");
  points.forEach((p, i) => {
    if (!(p instanceof c))
      throw new Error("invalid point at index " + i);
  });
}
function validateMSMScalars(scalars, field) {
  if (!Array.isArray(scalars))
    throw new Error("array of scalars expected");
  scalars.forEach((s, i) => {
    if (!field.isValid(s))
      throw new Error("invalid scalar at index " + i);
  });
}
function getW(P) {
  return pointWindowSizes.get(P) || 1;
}
function wNAF(c, bits) {
  return {
    constTimeNegate,
    hasPrecomputes(elm) {
      return getW(elm) !== 1;
    },
    // non-const time multiplication ladder
    unsafeLadder(elm, n, p = c.ZERO) {
      let d = elm;
      while (n > _0n4) {
        if (n & _1n4)
          p = p.add(d);
        d = d.double();
        n >>= _1n4;
      }
      return p;
    },
    /**
     * Creates a wNAF precomputation window. Used for caching.
     * Default window size is set by `utils.precompute()` and is equal to 8.
     * Number of precomputed points depends on the curve size:
     * 2^(𝑊−1) * (Math.ceil(𝑛 / 𝑊) + 1), where:
     * - 𝑊 is the window size
     * - 𝑛 is the bitlength of the curve order.
     * For a 256-bit curve and window size 8, the number of precomputed points is 128 * 33 = 4224.
     * @param elm Point instance
     * @param W window size
     * @returns precomputed point tables flattened to a single array
     */
    precomputeWindow(elm, W) {
      const { windows, windowSize } = calcWOpts(W, bits);
      const points = [];
      let p = elm;
      let base = p;
      for (let window = 0; window < windows; window++) {
        base = p;
        points.push(base);
        for (let i = 1; i < windowSize; i++) {
          base = base.add(p);
          points.push(base);
        }
        p = base.double();
      }
      return points;
    },
    /**
     * Implements ec multiplication using precomputed tables and w-ary non-adjacent form.
     * @param W window size
     * @param precomputes precomputed tables
     * @param n scalar (we don't check here, but should be less than curve order)
     * @returns real and fake (for const-time) points
     */
    wNAF(W, precomputes, n) {
      let p = c.ZERO;
      let f = c.BASE;
      const wo = calcWOpts(W, bits);
      for (let window = 0; window < wo.windows; window++) {
        const { nextN, offset, isZero, isNeg, isNegF, offsetF } = calcOffsets(n, window, wo);
        n = nextN;
        if (isZero) {
          f = f.add(constTimeNegate(isNegF, precomputes[offsetF]));
        } else {
          p = p.add(constTimeNegate(isNeg, precomputes[offset]));
        }
      }
      return { p, f };
    },
    /**
     * Implements ec unsafe (non const-time) multiplication using precomputed tables and w-ary non-adjacent form.
     * @param W window size
     * @param precomputes precomputed tables
     * @param n scalar (we don't check here, but should be less than curve order)
     * @param acc accumulator point to add result of multiplication
     * @returns point
     */
    wNAFUnsafe(W, precomputes, n, acc = c.ZERO) {
      const wo = calcWOpts(W, bits);
      for (let window = 0; window < wo.windows; window++) {
        if (n === _0n4)
          break;
        const { nextN, offset, isZero, isNeg } = calcOffsets(n, window, wo);
        n = nextN;
        if (isZero) {
          continue;
        } else {
          const item = precomputes[offset];
          acc = acc.add(isNeg ? item.negate() : item);
        }
      }
      return acc;
    },
    getPrecomputes(W, P, transform) {
      let comp = pointPrecomputes.get(P);
      if (!comp) {
        comp = this.precomputeWindow(P, W);
        if (W !== 1)
          pointPrecomputes.set(P, transform(comp));
      }
      return comp;
    },
    wNAFCached(P, n, transform) {
      const W = getW(P);
      return this.wNAF(W, this.getPrecomputes(W, P, transform), n);
    },
    wNAFCachedUnsafe(P, n, transform, prev) {
      const W = getW(P);
      if (W === 1)
        return this.unsafeLadder(P, n, prev);
      return this.wNAFUnsafe(W, this.getPrecomputes(W, P, transform), n, prev);
    },
    // We calculate precomputes for elliptic curve point multiplication
    // using windowed method. This specifies window size and
    // stores precomputed values. Usually only base point would be precomputed.
    setWindowSize(P, W) {
      validateW(W, bits);
      pointWindowSizes.set(P, W);
      pointPrecomputes.delete(P);
    }
  };
}
function pippenger(c, fieldN, points, scalars) {
  validateMSMPoints(points, c);
  validateMSMScalars(scalars, fieldN);
  const plength = points.length;
  const slength = scalars.length;
  if (plength !== slength)
    throw new Error("arrays of points and scalars must have equal length");
  const zero = c.ZERO;
  const wbits = bitLen(BigInt(plength));
  let windowSize = 1;
  if (wbits > 12)
    windowSize = wbits - 3;
  else if (wbits > 4)
    windowSize = wbits - 2;
  else if (wbits > 0)
    windowSize = 2;
  const MASK = bitMask(windowSize);
  const buckets = new Array(Number(MASK) + 1).fill(zero);
  const lastBits = Math.floor((fieldN.BITS - 1) / windowSize) * windowSize;
  let sum = zero;
  for (let i = lastBits; i >= 0; i -= windowSize) {
    buckets.fill(zero);
    for (let j = 0; j < slength; j++) {
      const scalar = scalars[j];
      const wbits2 = Number(scalar >> BigInt(i) & MASK);
      buckets[wbits2] = buckets[wbits2].add(points[j]);
    }
    let resI = zero;
    for (let j = buckets.length - 1, sumI = zero; j > 0; j--) {
      sumI = sumI.add(buckets[j]);
      resI = resI.add(sumI);
    }
    sum = sum.add(resI);
    if (i !== 0)
      for (let j = 0; j < windowSize; j++)
        sum = sum.double();
  }
  return sum;
}
function validateBasic(curve) {
  validateField(curve.Fp);
  validateObject(curve, {
    n: "bigint",
    h: "bigint",
    Gx: "field",
    Gy: "field"
  }, {
    nBitLength: "isSafeInteger",
    nByteLength: "isSafeInteger"
  });
  return Object.freeze({
    ...nLength(curve.n, curve.nBitLength),
    ...curve,
    ...{ p: curve.Fp.ORDER }
  });
}
var _0n4, _1n4, pointPrecomputes, pointWindowSizes;
var init_curve = __esm({
  "node_modules/@noble/curves/esm/abstract/curve.js"() {
    init_modular();
    init_utils2();
    _0n4 = BigInt(0);
    _1n4 = BigInt(1);
    pointPrecomputes = /* @__PURE__ */ new WeakMap();
    pointWindowSizes = /* @__PURE__ */ new WeakMap();
  }
});

// node_modules/@noble/curves/esm/abstract/weierstrass.js
function validateSigVerOpts(opts) {
  if (opts.lowS !== void 0)
    abool("lowS", opts.lowS);
  if (opts.prehash !== void 0)
    abool("prehash", opts.prehash);
}
function validatePointOpts(curve) {
  const opts = validateBasic(curve);
  validateObject(opts, {
    a: "field",
    b: "field"
  }, {
    allowInfinityPoint: "boolean",
    allowedPrivateKeyLengths: "array",
    clearCofactor: "function",
    fromBytes: "function",
    isTorsionFree: "function",
    toBytes: "function",
    wrapPrivateKey: "boolean"
  });
  const { endo, Fp, a } = opts;
  if (endo) {
    if (!Fp.eql(a, Fp.ZERO)) {
      throw new Error("invalid endo: CURVE.a must be 0");
    }
    if (typeof endo !== "object" || typeof endo.beta !== "bigint" || typeof endo.splitScalar !== "function") {
      throw new Error('invalid endo: expected "beta": bigint and "splitScalar": function');
    }
  }
  return Object.freeze({ ...opts });
}
function numToSizedHex(num2, size2) {
  return bytesToHex3(numberToBytesBE(num2, size2));
}
function weierstrassPoints(opts) {
  const CURVE = validatePointOpts(opts);
  const { Fp } = CURVE;
  const Fn = Field(CURVE.n, CURVE.nBitLength);
  const toBytes3 = CURVE.toBytes || ((_c, point, _isCompressed) => {
    const a = point.toAffine();
    return concatBytes4(Uint8Array.from([4]), Fp.toBytes(a.x), Fp.toBytes(a.y));
  });
  const fromBytes = CURVE.fromBytes || ((bytes) => {
    const tail = bytes.subarray(1);
    const x = Fp.fromBytes(tail.subarray(0, Fp.BYTES));
    const y = Fp.fromBytes(tail.subarray(Fp.BYTES, 2 * Fp.BYTES));
    return { x, y };
  });
  function weierstrassEquation(x) {
    const { a, b } = CURVE;
    const x2 = Fp.sqr(x);
    const x3 = Fp.mul(x2, x);
    return Fp.add(Fp.add(x3, Fp.mul(x, a)), b);
  }
  function isValidXY(x, y) {
    const left = Fp.sqr(y);
    const right = weierstrassEquation(x);
    return Fp.eql(left, right);
  }
  if (!isValidXY(CURVE.Gx, CURVE.Gy))
    throw new Error("bad curve params: generator point");
  const _4a3 = Fp.mul(Fp.pow(CURVE.a, _3n2), _4n2);
  const _27b2 = Fp.mul(Fp.sqr(CURVE.b), BigInt(27));
  if (Fp.is0(Fp.add(_4a3, _27b2)))
    throw new Error("bad curve params: a or b");
  function isWithinCurveOrder(num2) {
    return inRange(num2, _1n5, CURVE.n);
  }
  function normPrivateKeyToScalar(key) {
    const { allowedPrivateKeyLengths: lengths, nByteLength, wrapPrivateKey, n: N } = CURVE;
    if (lengths && typeof key !== "bigint") {
      if (isBytes2(key))
        key = bytesToHex3(key);
      if (typeof key !== "string" || !lengths.includes(key.length))
        throw new Error("invalid private key");
      key = key.padStart(nByteLength * 2, "0");
    }
    let num2;
    try {
      num2 = typeof key === "bigint" ? key : bytesToNumberBE(ensureBytes("private key", key, nByteLength));
    } catch (error) {
      throw new Error("invalid private key, expected hex or " + nByteLength + " bytes, got " + typeof key);
    }
    if (wrapPrivateKey)
      num2 = mod(num2, N);
    aInRange("private key", num2, _1n5, N);
    return num2;
  }
  function aprjpoint(other) {
    if (!(other instanceof Point2))
      throw new Error("ProjectivePoint expected");
  }
  const toAffineMemo = memoized((p, iz) => {
    const { px: x, py: y, pz: z } = p;
    if (Fp.eql(z, Fp.ONE))
      return { x, y };
    const is0 = p.is0();
    if (iz == null)
      iz = is0 ? Fp.ONE : Fp.inv(z);
    const ax = Fp.mul(x, iz);
    const ay = Fp.mul(y, iz);
    const zz = Fp.mul(z, iz);
    if (is0)
      return { x: Fp.ZERO, y: Fp.ZERO };
    if (!Fp.eql(zz, Fp.ONE))
      throw new Error("invZ was invalid");
    return { x: ax, y: ay };
  });
  const assertValidMemo = memoized((p) => {
    if (p.is0()) {
      if (CURVE.allowInfinityPoint && !Fp.is0(p.py))
        return;
      throw new Error("bad point: ZERO");
    }
    const { x, y } = p.toAffine();
    if (!Fp.isValid(x) || !Fp.isValid(y))
      throw new Error("bad point: x or y not FE");
    if (!isValidXY(x, y))
      throw new Error("bad point: equation left != right");
    if (!p.isTorsionFree())
      throw new Error("bad point: not in prime-order subgroup");
    return true;
  });
  class Point2 {
    constructor(px, py, pz) {
      if (px == null || !Fp.isValid(px))
        throw new Error("x required");
      if (py == null || !Fp.isValid(py) || Fp.is0(py))
        throw new Error("y required");
      if (pz == null || !Fp.isValid(pz))
        throw new Error("z required");
      this.px = px;
      this.py = py;
      this.pz = pz;
      Object.freeze(this);
    }
    // Does not validate if the point is on-curve.
    // Use fromHex instead, or call assertValidity() later.
    static fromAffine(p) {
      const { x, y } = p || {};
      if (!p || !Fp.isValid(x) || !Fp.isValid(y))
        throw new Error("invalid affine point");
      if (p instanceof Point2)
        throw new Error("projective point not allowed");
      const is0 = (i) => Fp.eql(i, Fp.ZERO);
      if (is0(x) && is0(y))
        return Point2.ZERO;
      return new Point2(x, y, Fp.ONE);
    }
    get x() {
      return this.toAffine().x;
    }
    get y() {
      return this.toAffine().y;
    }
    /**
     * Takes a bunch of Projective Points but executes only one
     * inversion on all of them. Inversion is very slow operation,
     * so this improves performance massively.
     * Optimization: converts a list of projective points to a list of identical points with Z=1.
     */
    static normalizeZ(points) {
      const toInv = FpInvertBatch(Fp, points.map((p) => p.pz));
      return points.map((p, i) => p.toAffine(toInv[i])).map(Point2.fromAffine);
    }
    /**
     * Converts hash string or Uint8Array to Point.
     * @param hex short/long ECDSA hex
     */
    static fromHex(hex) {
      const P = Point2.fromAffine(fromBytes(ensureBytes("pointHex", hex)));
      P.assertValidity();
      return P;
    }
    // Multiplies generator point by privateKey.
    static fromPrivateKey(privateKey) {
      return Point2.BASE.multiply(normPrivateKeyToScalar(privateKey));
    }
    // Multiscalar Multiplication
    static msm(points, scalars) {
      return pippenger(Point2, Fn, points, scalars);
    }
    // "Private method", don't use it directly
    _setWindowSize(windowSize) {
      wnaf.setWindowSize(this, windowSize);
    }
    // A point on curve is valid if it conforms to equation.
    assertValidity() {
      assertValidMemo(this);
    }
    hasEvenY() {
      const { y } = this.toAffine();
      if (Fp.isOdd)
        return !Fp.isOdd(y);
      throw new Error("Field doesn't support isOdd");
    }
    /**
     * Compare one point to another.
     */
    equals(other) {
      aprjpoint(other);
      const { px: X1, py: Y1, pz: Z1 } = this;
      const { px: X2, py: Y2, pz: Z2 } = other;
      const U1 = Fp.eql(Fp.mul(X1, Z2), Fp.mul(X2, Z1));
      const U2 = Fp.eql(Fp.mul(Y1, Z2), Fp.mul(Y2, Z1));
      return U1 && U2;
    }
    /**
     * Flips point to one corresponding to (x, -y) in Affine coordinates.
     */
    negate() {
      return new Point2(this.px, Fp.neg(this.py), this.pz);
    }
    // Renes-Costello-Batina exception-free doubling formula.
    // There is 30% faster Jacobian formula, but it is not complete.
    // https://eprint.iacr.org/2015/1060, algorithm 3
    // Cost: 8M + 3S + 3*a + 2*b3 + 15add.
    double() {
      const { a, b } = CURVE;
      const b3 = Fp.mul(b, _3n2);
      const { px: X1, py: Y1, pz: Z1 } = this;
      let X3 = Fp.ZERO, Y3 = Fp.ZERO, Z3 = Fp.ZERO;
      let t0 = Fp.mul(X1, X1);
      let t1 = Fp.mul(Y1, Y1);
      let t2 = Fp.mul(Z1, Z1);
      let t3 = Fp.mul(X1, Y1);
      t3 = Fp.add(t3, t3);
      Z3 = Fp.mul(X1, Z1);
      Z3 = Fp.add(Z3, Z3);
      X3 = Fp.mul(a, Z3);
      Y3 = Fp.mul(b3, t2);
      Y3 = Fp.add(X3, Y3);
      X3 = Fp.sub(t1, Y3);
      Y3 = Fp.add(t1, Y3);
      Y3 = Fp.mul(X3, Y3);
      X3 = Fp.mul(t3, X3);
      Z3 = Fp.mul(b3, Z3);
      t2 = Fp.mul(a, t2);
      t3 = Fp.sub(t0, t2);
      t3 = Fp.mul(a, t3);
      t3 = Fp.add(t3, Z3);
      Z3 = Fp.add(t0, t0);
      t0 = Fp.add(Z3, t0);
      t0 = Fp.add(t0, t2);
      t0 = Fp.mul(t0, t3);
      Y3 = Fp.add(Y3, t0);
      t2 = Fp.mul(Y1, Z1);
      t2 = Fp.add(t2, t2);
      t0 = Fp.mul(t2, t3);
      X3 = Fp.sub(X3, t0);
      Z3 = Fp.mul(t2, t1);
      Z3 = Fp.add(Z3, Z3);
      Z3 = Fp.add(Z3, Z3);
      return new Point2(X3, Y3, Z3);
    }
    // Renes-Costello-Batina exception-free addition formula.
    // There is 30% faster Jacobian formula, but it is not complete.
    // https://eprint.iacr.org/2015/1060, algorithm 1
    // Cost: 12M + 0S + 3*a + 3*b3 + 23add.
    add(other) {
      aprjpoint(other);
      const { px: X1, py: Y1, pz: Z1 } = this;
      const { px: X2, py: Y2, pz: Z2 } = other;
      let X3 = Fp.ZERO, Y3 = Fp.ZERO, Z3 = Fp.ZERO;
      const a = CURVE.a;
      const b3 = Fp.mul(CURVE.b, _3n2);
      let t0 = Fp.mul(X1, X2);
      let t1 = Fp.mul(Y1, Y2);
      let t2 = Fp.mul(Z1, Z2);
      let t3 = Fp.add(X1, Y1);
      let t4 = Fp.add(X2, Y2);
      t3 = Fp.mul(t3, t4);
      t4 = Fp.add(t0, t1);
      t3 = Fp.sub(t3, t4);
      t4 = Fp.add(X1, Z1);
      let t5 = Fp.add(X2, Z2);
      t4 = Fp.mul(t4, t5);
      t5 = Fp.add(t0, t2);
      t4 = Fp.sub(t4, t5);
      t5 = Fp.add(Y1, Z1);
      X3 = Fp.add(Y2, Z2);
      t5 = Fp.mul(t5, X3);
      X3 = Fp.add(t1, t2);
      t5 = Fp.sub(t5, X3);
      Z3 = Fp.mul(a, t4);
      X3 = Fp.mul(b3, t2);
      Z3 = Fp.add(X3, Z3);
      X3 = Fp.sub(t1, Z3);
      Z3 = Fp.add(t1, Z3);
      Y3 = Fp.mul(X3, Z3);
      t1 = Fp.add(t0, t0);
      t1 = Fp.add(t1, t0);
      t2 = Fp.mul(a, t2);
      t4 = Fp.mul(b3, t4);
      t1 = Fp.add(t1, t2);
      t2 = Fp.sub(t0, t2);
      t2 = Fp.mul(a, t2);
      t4 = Fp.add(t4, t2);
      t0 = Fp.mul(t1, t4);
      Y3 = Fp.add(Y3, t0);
      t0 = Fp.mul(t5, t4);
      X3 = Fp.mul(t3, X3);
      X3 = Fp.sub(X3, t0);
      t0 = Fp.mul(t3, t1);
      Z3 = Fp.mul(t5, Z3);
      Z3 = Fp.add(Z3, t0);
      return new Point2(X3, Y3, Z3);
    }
    subtract(other) {
      return this.add(other.negate());
    }
    is0() {
      return this.equals(Point2.ZERO);
    }
    wNAF(n) {
      return wnaf.wNAFCached(this, n, Point2.normalizeZ);
    }
    /**
     * Non-constant-time multiplication. Uses double-and-add algorithm.
     * It's faster, but should only be used when you don't care about
     * an exposed private key e.g. sig verification, which works over *public* keys.
     */
    multiplyUnsafe(sc) {
      const { endo: endo2, n: N } = CURVE;
      aInRange("scalar", sc, _0n5, N);
      const I = Point2.ZERO;
      if (sc === _0n5)
        return I;
      if (this.is0() || sc === _1n5)
        return this;
      if (!endo2 || wnaf.hasPrecomputes(this))
        return wnaf.wNAFCachedUnsafe(this, sc, Point2.normalizeZ);
      let { k1neg, k1, k2neg, k2 } = endo2.splitScalar(sc);
      let k1p = I;
      let k2p = I;
      let d = this;
      while (k1 > _0n5 || k2 > _0n5) {
        if (k1 & _1n5)
          k1p = k1p.add(d);
        if (k2 & _1n5)
          k2p = k2p.add(d);
        d = d.double();
        k1 >>= _1n5;
        k2 >>= _1n5;
      }
      if (k1neg)
        k1p = k1p.negate();
      if (k2neg)
        k2p = k2p.negate();
      k2p = new Point2(Fp.mul(k2p.px, endo2.beta), k2p.py, k2p.pz);
      return k1p.add(k2p);
    }
    /**
     * Constant time multiplication.
     * Uses wNAF method. Windowed method may be 10% faster,
     * but takes 2x longer to generate and consumes 2x memory.
     * Uses precomputes when available.
     * Uses endomorphism for Koblitz curves.
     * @param scalar by which the point would be multiplied
     * @returns New point
     */
    multiply(scalar) {
      const { endo: endo2, n: N } = CURVE;
      aInRange("scalar", scalar, _1n5, N);
      let point, fake;
      if (endo2) {
        const { k1neg, k1, k2neg, k2 } = endo2.splitScalar(scalar);
        let { p: k1p, f: f1p } = this.wNAF(k1);
        let { p: k2p, f: f2p } = this.wNAF(k2);
        k1p = wnaf.constTimeNegate(k1neg, k1p);
        k2p = wnaf.constTimeNegate(k2neg, k2p);
        k2p = new Point2(Fp.mul(k2p.px, endo2.beta), k2p.py, k2p.pz);
        point = k1p.add(k2p);
        fake = f1p.add(f2p);
      } else {
        const { p, f } = this.wNAF(scalar);
        point = p;
        fake = f;
      }
      return Point2.normalizeZ([point, fake])[0];
    }
    /**
     * Efficiently calculate `aP + bQ`. Unsafe, can expose private key, if used incorrectly.
     * Not using Strauss-Shamir trick: precomputation tables are faster.
     * The trick could be useful if both P and Q are not G (not in our case).
     * @returns non-zero affine point
     */
    multiplyAndAddUnsafe(Q, a, b) {
      const G = Point2.BASE;
      const mul = (P, a2) => a2 === _0n5 || a2 === _1n5 || !P.equals(G) ? P.multiplyUnsafe(a2) : P.multiply(a2);
      const sum = mul(this, a).add(mul(Q, b));
      return sum.is0() ? void 0 : sum;
    }
    // Converts Projective point to affine (x, y) coordinates.
    // Can accept precomputed Z^-1 - for example, from invertBatch.
    // (x, y, z) ∋ (x=x/z, y=y/z)
    toAffine(iz) {
      return toAffineMemo(this, iz);
    }
    isTorsionFree() {
      const { h: cofactor, isTorsionFree } = CURVE;
      if (cofactor === _1n5)
        return true;
      if (isTorsionFree)
        return isTorsionFree(Point2, this);
      throw new Error("isTorsionFree() has not been declared for the elliptic curve");
    }
    clearCofactor() {
      const { h: cofactor, clearCofactor } = CURVE;
      if (cofactor === _1n5)
        return this;
      if (clearCofactor)
        return clearCofactor(Point2, this);
      return this.multiplyUnsafe(CURVE.h);
    }
    toRawBytes(isCompressed = true) {
      abool("isCompressed", isCompressed);
      this.assertValidity();
      return toBytes3(Point2, this, isCompressed);
    }
    toHex(isCompressed = true) {
      abool("isCompressed", isCompressed);
      return bytesToHex3(this.toRawBytes(isCompressed));
    }
  }
  Point2.BASE = new Point2(CURVE.Gx, CURVE.Gy, Fp.ONE);
  Point2.ZERO = new Point2(Fp.ZERO, Fp.ONE, Fp.ZERO);
  const { endo, nBitLength } = CURVE;
  const wnaf = wNAF(Point2, endo ? Math.ceil(nBitLength / 2) : nBitLength);
  return {
    CURVE,
    ProjectivePoint: Point2,
    normPrivateKeyToScalar,
    weierstrassEquation,
    isWithinCurveOrder
  };
}
function validateOpts(curve) {
  const opts = validateBasic(curve);
  validateObject(opts, {
    hash: "hash",
    hmac: "function",
    randomBytes: "function"
  }, {
    bits2int: "function",
    bits2int_modN: "function",
    lowS: "boolean"
  });
  return Object.freeze({ lowS: true, ...opts });
}
function weierstrass(curveDef) {
  const CURVE = validateOpts(curveDef);
  const { Fp, n: CURVE_ORDER, nByteLength, nBitLength } = CURVE;
  const compressedLen = Fp.BYTES + 1;
  const uncompressedLen = 2 * Fp.BYTES + 1;
  function modN2(a) {
    return mod(a, CURVE_ORDER);
  }
  function invN(a) {
    return invert(a, CURVE_ORDER);
  }
  const { ProjectivePoint: Point2, normPrivateKeyToScalar, weierstrassEquation, isWithinCurveOrder } = weierstrassPoints({
    ...CURVE,
    toBytes(_c, point, isCompressed) {
      const a = point.toAffine();
      const x = Fp.toBytes(a.x);
      const cat = concatBytes4;
      abool("isCompressed", isCompressed);
      if (isCompressed) {
        return cat(Uint8Array.from([point.hasEvenY() ? 2 : 3]), x);
      } else {
        return cat(Uint8Array.from([4]), x, Fp.toBytes(a.y));
      }
    },
    fromBytes(bytes) {
      const len = bytes.length;
      const head = bytes[0];
      const tail = bytes.subarray(1);
      if (len === compressedLen && (head === 2 || head === 3)) {
        const x = bytesToNumberBE(tail);
        if (!inRange(x, _1n5, Fp.ORDER))
          throw new Error("Point is not on curve");
        const y2 = weierstrassEquation(x);
        let y;
        try {
          y = Fp.sqrt(y2);
        } catch (sqrtError) {
          const suffix = sqrtError instanceof Error ? ": " + sqrtError.message : "";
          throw new Error("Point is not on curve" + suffix);
        }
        const isYOdd = (y & _1n5) === _1n5;
        const isHeadOdd = (head & 1) === 1;
        if (isHeadOdd !== isYOdd)
          y = Fp.neg(y);
        return { x, y };
      } else if (len === uncompressedLen && head === 4) {
        const x = Fp.fromBytes(tail.subarray(0, Fp.BYTES));
        const y = Fp.fromBytes(tail.subarray(Fp.BYTES, 2 * Fp.BYTES));
        return { x, y };
      } else {
        const cl = compressedLen;
        const ul = uncompressedLen;
        throw new Error("invalid Point, expected length of " + cl + ", or uncompressed " + ul + ", got " + len);
      }
    }
  });
  function isBiggerThanHalfOrder(number) {
    const HALF = CURVE_ORDER >> _1n5;
    return number > HALF;
  }
  function normalizeS(s) {
    return isBiggerThanHalfOrder(s) ? modN2(-s) : s;
  }
  const slcNum = (b, from, to) => bytesToNumberBE(b.slice(from, to));
  class Signature {
    constructor(r, s, recovery) {
      aInRange("r", r, _1n5, CURVE_ORDER);
      aInRange("s", s, _1n5, CURVE_ORDER);
      this.r = r;
      this.s = s;
      if (recovery != null)
        this.recovery = recovery;
      Object.freeze(this);
    }
    // pair (bytes of r, bytes of s)
    static fromCompact(hex) {
      const l = nByteLength;
      hex = ensureBytes("compactSignature", hex, l * 2);
      return new Signature(slcNum(hex, 0, l), slcNum(hex, l, 2 * l));
    }
    // DER encoded ECDSA signature
    // https://bitcoin.stackexchange.com/questions/57644/what-are-the-parts-of-a-bitcoin-transaction-input-script
    static fromDER(hex) {
      const { r, s } = DER.toSig(ensureBytes("DER", hex));
      return new Signature(r, s);
    }
    /**
     * @todo remove
     * @deprecated
     */
    assertValidity() {
    }
    addRecoveryBit(recovery) {
      return new Signature(this.r, this.s, recovery);
    }
    recoverPublicKey(msgHash) {
      const { r, s, recovery: rec } = this;
      const h = bits2int_modN(ensureBytes("msgHash", msgHash));
      if (rec == null || ![0, 1, 2, 3].includes(rec))
        throw new Error("recovery id invalid");
      const radj = rec === 2 || rec === 3 ? r + CURVE.n : r;
      if (radj >= Fp.ORDER)
        throw new Error("recovery id 2 or 3 invalid");
      const prefix = (rec & 1) === 0 ? "02" : "03";
      const R = Point2.fromHex(prefix + numToSizedHex(radj, Fp.BYTES));
      const ir = invN(radj);
      const u1 = modN2(-h * ir);
      const u2 = modN2(s * ir);
      const Q = Point2.BASE.multiplyAndAddUnsafe(R, u1, u2);
      if (!Q)
        throw new Error("point at infinify");
      Q.assertValidity();
      return Q;
    }
    // Signatures should be low-s, to prevent malleability.
    hasHighS() {
      return isBiggerThanHalfOrder(this.s);
    }
    normalizeS() {
      return this.hasHighS() ? new Signature(this.r, modN2(-this.s), this.recovery) : this;
    }
    // DER-encoded
    toDERRawBytes() {
      return hexToBytes3(this.toDERHex());
    }
    toDERHex() {
      return DER.hexFromSig(this);
    }
    // padded bytes of r, then padded bytes of s
    toCompactRawBytes() {
      return hexToBytes3(this.toCompactHex());
    }
    toCompactHex() {
      const l = nByteLength;
      return numToSizedHex(this.r, l) + numToSizedHex(this.s, l);
    }
  }
  const utils = {
    isValidPrivateKey(privateKey) {
      try {
        normPrivateKeyToScalar(privateKey);
        return true;
      } catch (error) {
        return false;
      }
    },
    normPrivateKeyToScalar,
    /**
     * Produces cryptographically secure private key from random of size
     * (groupLen + ceil(groupLen / 2)) with modulo bias being negligible.
     */
    randomPrivateKey: () => {
      const length = getMinHashLength(CURVE.n);
      return mapHashToField(CURVE.randomBytes(length), CURVE.n);
    },
    /**
     * Creates precompute table for an arbitrary EC point. Makes point "cached".
     * Allows to massively speed-up `point.multiply(scalar)`.
     * @returns cached point
     * @example
     * const fast = utils.precompute(8, ProjectivePoint.fromHex(someonesPubKey));
     * fast.multiply(privKey); // much faster ECDH now
     */
    precompute(windowSize = 8, point = Point2.BASE) {
      point._setWindowSize(windowSize);
      point.multiply(BigInt(3));
      return point;
    }
  };
  function getPublicKey(privateKey, isCompressed = true) {
    return Point2.fromPrivateKey(privateKey).toRawBytes(isCompressed);
  }
  function isProbPub(item) {
    if (typeof item === "bigint")
      return false;
    if (item instanceof Point2)
      return true;
    const arr = ensureBytes("key", item);
    const len = arr.length;
    const fpl = Fp.BYTES;
    const compLen = fpl + 1;
    const uncompLen = 2 * fpl + 1;
    if (CURVE.allowedPrivateKeyLengths || nByteLength === compLen) {
      return void 0;
    } else {
      return len === compLen || len === uncompLen;
    }
  }
  function getSharedSecret(privateA, publicB, isCompressed = true) {
    if (isProbPub(privateA) === true)
      throw new Error("first arg must be private key");
    if (isProbPub(publicB) === false)
      throw new Error("second arg must be public key");
    const b = Point2.fromHex(publicB);
    return b.multiply(normPrivateKeyToScalar(privateA)).toRawBytes(isCompressed);
  }
  const bits2int = CURVE.bits2int || function(bytes) {
    if (bytes.length > 8192)
      throw new Error("input is too large");
    const num2 = bytesToNumberBE(bytes);
    const delta = bytes.length * 8 - nBitLength;
    return delta > 0 ? num2 >> BigInt(delta) : num2;
  };
  const bits2int_modN = CURVE.bits2int_modN || function(bytes) {
    return modN2(bits2int(bytes));
  };
  const ORDER_MASK = bitMask(nBitLength);
  function int2octets(num2) {
    aInRange("num < 2^" + nBitLength, num2, _0n5, ORDER_MASK);
    return numberToBytesBE(num2, nByteLength);
  }
  function prepSig(msgHash, privateKey, opts = defaultSigOpts) {
    if (["recovered", "canonical"].some((k) => k in opts))
      throw new Error("sign() legacy options not supported");
    const { hash, randomBytes: randomBytes5 } = CURVE;
    let { lowS, prehash, extraEntropy: ent } = opts;
    if (lowS == null)
      lowS = true;
    msgHash = ensureBytes("msgHash", msgHash);
    validateSigVerOpts(opts);
    if (prehash)
      msgHash = ensureBytes("prehashed msgHash", hash(msgHash));
    const h1int = bits2int_modN(msgHash);
    const d = normPrivateKeyToScalar(privateKey);
    const seedArgs = [int2octets(d), int2octets(h1int)];
    if (ent != null && ent !== false) {
      const e = ent === true ? randomBytes5(Fp.BYTES) : ent;
      seedArgs.push(ensureBytes("extraEntropy", e));
    }
    const seed = concatBytes4(...seedArgs);
    const m = h1int;
    function k2sig(kBytes) {
      const k = bits2int(kBytes);
      if (!isWithinCurveOrder(k))
        return;
      const ik = invN(k);
      const q = Point2.BASE.multiply(k).toAffine();
      const r = modN2(q.x);
      if (r === _0n5)
        return;
      const s = modN2(ik * modN2(m + r * d));
      if (s === _0n5)
        return;
      let recovery = (q.x === r ? 0 : 2) | Number(q.y & _1n5);
      let normS = s;
      if (lowS && isBiggerThanHalfOrder(s)) {
        normS = normalizeS(s);
        recovery ^= 1;
      }
      return new Signature(r, normS, recovery);
    }
    return { seed, k2sig };
  }
  const defaultSigOpts = { lowS: CURVE.lowS, prehash: false };
  const defaultVerOpts = { lowS: CURVE.lowS, prehash: false };
  function sign(msgHash, privKey, opts = defaultSigOpts) {
    const { seed, k2sig } = prepSig(msgHash, privKey, opts);
    const C = CURVE;
    const drbg = createHmacDrbg(C.hash.outputLen, C.nByteLength, C.hmac);
    return drbg(seed, k2sig);
  }
  Point2.BASE._setWindowSize(8);
  function verify(signature, msgHash, publicKey, opts = defaultVerOpts) {
    const sg = signature;
    msgHash = ensureBytes("msgHash", msgHash);
    publicKey = ensureBytes("publicKey", publicKey);
    const { lowS, prehash, format } = opts;
    validateSigVerOpts(opts);
    if ("strict" in opts)
      throw new Error("options.strict was renamed to lowS");
    if (format !== void 0 && format !== "compact" && format !== "der")
      throw new Error("format must be compact or der");
    const isHex3 = typeof sg === "string" || isBytes2(sg);
    const isObj = !isHex3 && !format && typeof sg === "object" && sg !== null && typeof sg.r === "bigint" && typeof sg.s === "bigint";
    if (!isHex3 && !isObj)
      throw new Error("invalid signature, expected Uint8Array, hex string or Signature instance");
    let _sig = void 0;
    let P;
    try {
      if (isObj)
        _sig = new Signature(sg.r, sg.s);
      if (isHex3) {
        try {
          if (format !== "compact")
            _sig = Signature.fromDER(sg);
        } catch (derError) {
          if (!(derError instanceof DER.Err))
            throw derError;
        }
        if (!_sig && format !== "der")
          _sig = Signature.fromCompact(sg);
      }
      P = Point2.fromHex(publicKey);
    } catch (error) {
      return false;
    }
    if (!_sig)
      return false;
    if (lowS && _sig.hasHighS())
      return false;
    if (prehash)
      msgHash = CURVE.hash(msgHash);
    const { r, s } = _sig;
    const h = bits2int_modN(msgHash);
    const is = invN(s);
    const u1 = modN2(h * is);
    const u2 = modN2(r * is);
    const R = Point2.BASE.multiplyAndAddUnsafe(P, u1, u2)?.toAffine();
    if (!R)
      return false;
    const v = modN2(R.x);
    return v === r;
  }
  return {
    CURVE,
    getPublicKey,
    getSharedSecret,
    sign,
    verify,
    ProjectivePoint: Point2,
    Signature,
    utils
  };
}
function SWUFpSqrtRatio(Fp, Z) {
  const q = Fp.ORDER;
  let l = _0n5;
  for (let o = q - _1n5; o % _2n3 === _0n5; o /= _2n3)
    l += _1n5;
  const c1 = l;
  const _2n_pow_c1_1 = _2n3 << c1 - _1n5 - _1n5;
  const _2n_pow_c1 = _2n_pow_c1_1 * _2n3;
  const c2 = (q - _1n5) / _2n_pow_c1;
  const c3 = (c2 - _1n5) / _2n3;
  const c4 = _2n_pow_c1 - _1n5;
  const c5 = _2n_pow_c1_1;
  const c6 = Fp.pow(Z, c2);
  const c7 = Fp.pow(Z, (c2 + _1n5) / _2n3);
  let sqrtRatio = (u, v) => {
    let tv1 = c6;
    let tv2 = Fp.pow(v, c4);
    let tv3 = Fp.sqr(tv2);
    tv3 = Fp.mul(tv3, v);
    let tv5 = Fp.mul(u, tv3);
    tv5 = Fp.pow(tv5, c3);
    tv5 = Fp.mul(tv5, tv2);
    tv2 = Fp.mul(tv5, v);
    tv3 = Fp.mul(tv5, u);
    let tv4 = Fp.mul(tv3, tv2);
    tv5 = Fp.pow(tv4, c5);
    let isQR = Fp.eql(tv5, Fp.ONE);
    tv2 = Fp.mul(tv3, c7);
    tv5 = Fp.mul(tv4, tv1);
    tv3 = Fp.cmov(tv2, tv3, isQR);
    tv4 = Fp.cmov(tv5, tv4, isQR);
    for (let i = c1; i > _1n5; i--) {
      let tv52 = i - _2n3;
      tv52 = _2n3 << tv52 - _1n5;
      let tvv5 = Fp.pow(tv4, tv52);
      const e1 = Fp.eql(tvv5, Fp.ONE);
      tv2 = Fp.mul(tv3, tv1);
      tv1 = Fp.mul(tv1, tv1);
      tvv5 = Fp.mul(tv4, tv1);
      tv3 = Fp.cmov(tv2, tv3, e1);
      tv4 = Fp.cmov(tvv5, tv4, e1);
    }
    return { isValid: isQR, value: tv3 };
  };
  if (Fp.ORDER % _4n2 === _3n2) {
    const c12 = (Fp.ORDER - _3n2) / _4n2;
    const c22 = Fp.sqrt(Fp.neg(Z));
    sqrtRatio = (u, v) => {
      let tv1 = Fp.sqr(v);
      const tv2 = Fp.mul(u, v);
      tv1 = Fp.mul(tv1, tv2);
      let y1 = Fp.pow(tv1, c12);
      y1 = Fp.mul(y1, tv2);
      const y2 = Fp.mul(y1, c22);
      const tv3 = Fp.mul(Fp.sqr(y1), v);
      const isQR = Fp.eql(tv3, u);
      let y = Fp.cmov(y2, y1, isQR);
      return { isValid: isQR, value: y };
    };
  }
  return sqrtRatio;
}
function mapToCurveSimpleSWU(Fp, opts) {
  validateField(Fp);
  if (!Fp.isValid(opts.A) || !Fp.isValid(opts.B) || !Fp.isValid(opts.Z))
    throw new Error("mapToCurveSimpleSWU: invalid opts");
  const sqrtRatio = SWUFpSqrtRatio(Fp, opts.Z);
  if (!Fp.isOdd)
    throw new Error("Fp.isOdd is not implemented!");
  return (u) => {
    let tv1, tv2, tv3, tv4, tv5, tv6, x, y;
    tv1 = Fp.sqr(u);
    tv1 = Fp.mul(tv1, opts.Z);
    tv2 = Fp.sqr(tv1);
    tv2 = Fp.add(tv2, tv1);
    tv3 = Fp.add(tv2, Fp.ONE);
    tv3 = Fp.mul(tv3, opts.B);
    tv4 = Fp.cmov(opts.Z, Fp.neg(tv2), !Fp.eql(tv2, Fp.ZERO));
    tv4 = Fp.mul(tv4, opts.A);
    tv2 = Fp.sqr(tv3);
    tv6 = Fp.sqr(tv4);
    tv5 = Fp.mul(tv6, opts.A);
    tv2 = Fp.add(tv2, tv5);
    tv2 = Fp.mul(tv2, tv3);
    tv6 = Fp.mul(tv6, tv4);
    tv5 = Fp.mul(tv6, opts.B);
    tv2 = Fp.add(tv2, tv5);
    x = Fp.mul(tv1, tv3);
    const { isValid, value } = sqrtRatio(tv2, tv6);
    y = Fp.mul(tv1, u);
    y = Fp.mul(y, value);
    x = Fp.cmov(x, tv3, isValid);
    y = Fp.cmov(y, value, isValid);
    const e1 = Fp.isOdd(u) === Fp.isOdd(y);
    y = Fp.cmov(Fp.neg(y), y, e1);
    const tv4_inv = FpInvertBatch(Fp, [tv4], true)[0];
    x = Fp.mul(x, tv4_inv);
    return { x, y };
  };
}
var DERErr, DER, _0n5, _1n5, _2n3, _3n2, _4n2;
var init_weierstrass = __esm({
  "node_modules/@noble/curves/esm/abstract/weierstrass.js"() {
    init_curve();
    init_modular();
    init_utils2();
    DERErr = class extends Error {
      constructor(m = "") {
        super(m);
      }
    };
    DER = {
      // asn.1 DER encoding utils
      Err: DERErr,
      // Basic building block is TLV (Tag-Length-Value)
      _tlv: {
        encode: (tag, data) => {
          const { Err: E } = DER;
          if (tag < 0 || tag > 256)
            throw new E("tlv.encode: wrong tag");
          if (data.length & 1)
            throw new E("tlv.encode: unpadded data");
          const dataLen = data.length / 2;
          const len = numberToHexUnpadded(dataLen);
          if (len.length / 2 & 128)
            throw new E("tlv.encode: long form length too big");
          const lenLen = dataLen > 127 ? numberToHexUnpadded(len.length / 2 | 128) : "";
          const t = numberToHexUnpadded(tag);
          return t + lenLen + len + data;
        },
        // v - value, l - left bytes (unparsed)
        decode(tag, data) {
          const { Err: E } = DER;
          let pos = 0;
          if (tag < 0 || tag > 256)
            throw new E("tlv.encode: wrong tag");
          if (data.length < 2 || data[pos++] !== tag)
            throw new E("tlv.decode: wrong tlv");
          const first = data[pos++];
          const isLong = !!(first & 128);
          let length = 0;
          if (!isLong)
            length = first;
          else {
            const lenLen = first & 127;
            if (!lenLen)
              throw new E("tlv.decode(long): indefinite length not supported");
            if (lenLen > 4)
              throw new E("tlv.decode(long): byte length is too big");
            const lengthBytes = data.subarray(pos, pos + lenLen);
            if (lengthBytes.length !== lenLen)
              throw new E("tlv.decode: length bytes not complete");
            if (lengthBytes[0] === 0)
              throw new E("tlv.decode(long): zero leftmost byte");
            for (const b of lengthBytes)
              length = length << 8 | b;
            pos += lenLen;
            if (length < 128)
              throw new E("tlv.decode(long): not minimal encoding");
          }
          const v = data.subarray(pos, pos + length);
          if (v.length !== length)
            throw new E("tlv.decode: wrong value length");
          return { v, l: data.subarray(pos + length) };
        }
      },
      // https://crypto.stackexchange.com/a/57734 Leftmost bit of first byte is 'negative' flag,
      // since we always use positive integers here. It must always be empty:
      // - add zero byte if exists
      // - if next byte doesn't have a flag, leading zero is not allowed (minimal encoding)
      _int: {
        encode(num2) {
          const { Err: E } = DER;
          if (num2 < _0n5)
            throw new E("integer: negative integers are not allowed");
          let hex = numberToHexUnpadded(num2);
          if (Number.parseInt(hex[0], 16) & 8)
            hex = "00" + hex;
          if (hex.length & 1)
            throw new E("unexpected DER parsing assertion: unpadded hex");
          return hex;
        },
        decode(data) {
          const { Err: E } = DER;
          if (data[0] & 128)
            throw new E("invalid signature integer: negative");
          if (data[0] === 0 && !(data[1] & 128))
            throw new E("invalid signature integer: unnecessary leading zero");
          return bytesToNumberBE(data);
        }
      },
      toSig(hex) {
        const { Err: E, _int: int, _tlv: tlv } = DER;
        const data = ensureBytes("signature", hex);
        const { v: seqBytes, l: seqLeftBytes } = tlv.decode(48, data);
        if (seqLeftBytes.length)
          throw new E("invalid signature: left bytes after parsing");
        const { v: rBytes, l: rLeftBytes } = tlv.decode(2, seqBytes);
        const { v: sBytes, l: sLeftBytes } = tlv.decode(2, rLeftBytes);
        if (sLeftBytes.length)
          throw new E("invalid signature: left bytes after parsing");
        return { r: int.decode(rBytes), s: int.decode(sBytes) };
      },
      hexFromSig(sig) {
        const { _tlv: tlv, _int: int } = DER;
        const rs = tlv.encode(2, int.encode(sig.r));
        const ss = tlv.encode(2, int.encode(sig.s));
        const seq = rs + ss;
        return tlv.encode(48, seq);
      }
    };
    _0n5 = BigInt(0);
    _1n5 = BigInt(1);
    _2n3 = BigInt(2);
    _3n2 = BigInt(3);
    _4n2 = BigInt(4);
  }
});

// node_modules/@noble/curves/esm/_shortw_utils.js
function getHash(hash) {
  return {
    hash,
    hmac: (key, ...msgs) => hmac(hash, key, concatBytes2(...msgs)),
    randomBytes
  };
}
function createCurve(curveDef, defHash) {
  const create = (hash) => weierstrass({ ...curveDef, ...getHash(hash) });
  return { ...create(defHash), create };
}
var init_shortw_utils = __esm({
  "node_modules/@noble/curves/esm/_shortw_utils.js"() {
    init_hmac();
    init_utils();
    init_weierstrass();
  }
});

// node_modules/@noble/curves/esm/abstract/hash-to-curve.js
function i2osp(value, length) {
  anum(value);
  anum(length);
  if (value < 0 || value >= 1 << 8 * length)
    throw new Error("invalid I2OSP input: " + value);
  const res = Array.from({ length }).fill(0);
  for (let i = length - 1; i >= 0; i--) {
    res[i] = value & 255;
    value >>>= 8;
  }
  return new Uint8Array(res);
}
function strxor(a, b) {
  const arr = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) {
    arr[i] = a[i] ^ b[i];
  }
  return arr;
}
function anum(item) {
  if (!Number.isSafeInteger(item))
    throw new Error("number expected");
}
function expand_message_xmd(msg, DST, lenInBytes, H) {
  abytes2(msg);
  abytes2(DST);
  anum(lenInBytes);
  if (DST.length > 255)
    DST = H(concatBytes4(utf8ToBytes3("H2C-OVERSIZE-DST-"), DST));
  const { outputLen: b_in_bytes, blockLen: r_in_bytes } = H;
  const ell = Math.ceil(lenInBytes / b_in_bytes);
  if (lenInBytes > 65535 || ell > 255)
    throw new Error("expand_message_xmd: invalid lenInBytes");
  const DST_prime = concatBytes4(DST, i2osp(DST.length, 1));
  const Z_pad = i2osp(0, r_in_bytes);
  const l_i_b_str = i2osp(lenInBytes, 2);
  const b = new Array(ell);
  const b_0 = H(concatBytes4(Z_pad, msg, l_i_b_str, i2osp(0, 1), DST_prime));
  b[0] = H(concatBytes4(b_0, i2osp(1, 1), DST_prime));
  for (let i = 1; i <= ell; i++) {
    const args = [strxor(b_0, b[i - 1]), i2osp(i + 1, 1), DST_prime];
    b[i] = H(concatBytes4(...args));
  }
  const pseudo_random_bytes = concatBytes4(...b);
  return pseudo_random_bytes.slice(0, lenInBytes);
}
function expand_message_xof(msg, DST, lenInBytes, k, H) {
  abytes2(msg);
  abytes2(DST);
  anum(lenInBytes);
  if (DST.length > 255) {
    const dkLen = Math.ceil(2 * k / 8);
    DST = H.create({ dkLen }).update(utf8ToBytes3("H2C-OVERSIZE-DST-")).update(DST).digest();
  }
  if (lenInBytes > 65535 || DST.length > 255)
    throw new Error("expand_message_xof: invalid lenInBytes");
  return H.create({ dkLen: lenInBytes }).update(msg).update(i2osp(lenInBytes, 2)).update(DST).update(i2osp(DST.length, 1)).digest();
}
function hash_to_field(msg, count, options) {
  validateObject(options, {
    DST: "stringOrUint8Array",
    p: "bigint",
    m: "isSafeInteger",
    k: "isSafeInteger",
    hash: "hash"
  });
  const { p, k, m, hash, expand, DST: _DST } = options;
  abytes2(msg);
  anum(count);
  const DST = typeof _DST === "string" ? utf8ToBytes3(_DST) : _DST;
  const log2p = p.toString(2).length;
  const L = Math.ceil((log2p + k) / 8);
  const len_in_bytes = count * m * L;
  let prb;
  if (expand === "xmd") {
    prb = expand_message_xmd(msg, DST, len_in_bytes, hash);
  } else if (expand === "xof") {
    prb = expand_message_xof(msg, DST, len_in_bytes, k, hash);
  } else if (expand === "_internal_pass") {
    prb = msg;
  } else {
    throw new Error('expand must be "xmd" or "xof"');
  }
  const u = new Array(count);
  for (let i = 0; i < count; i++) {
    const e = new Array(m);
    for (let j = 0; j < m; j++) {
      const elm_offset = L * (j + i * m);
      const tv = prb.subarray(elm_offset, elm_offset + L);
      e[j] = mod(os2ip(tv), p);
    }
    u[i] = e;
  }
  return u;
}
function isogenyMap(field, map) {
  const coeff = map.map((i) => Array.from(i).reverse());
  return (x, y) => {
    const [xn, xd, yn, yd] = coeff.map((val) => val.reduce((acc, i) => field.add(field.mul(acc, x), i)));
    const [xd_inv, yd_inv] = FpInvertBatch(field, [xd, yd], true);
    x = field.mul(xn, xd_inv);
    y = field.mul(y, field.mul(yn, yd_inv));
    return { x, y };
  };
}
function createHasher2(Point2, mapToCurve, defaults) {
  if (typeof mapToCurve !== "function")
    throw new Error("mapToCurve() must be defined");
  function map(num2) {
    return Point2.fromAffine(mapToCurve(num2));
  }
  function clear(initial) {
    const P = initial.clearCofactor();
    if (P.equals(Point2.ZERO))
      return Point2.ZERO;
    P.assertValidity();
    return P;
  }
  return {
    defaults,
    // Encodes byte string to elliptic curve.
    // hash_to_curve from https://www.rfc-editor.org/rfc/rfc9380#section-3
    hashToCurve(msg, options) {
      const u = hash_to_field(msg, 2, { ...defaults, DST: defaults.DST, ...options });
      const u0 = map(u[0]);
      const u1 = map(u[1]);
      return clear(u0.add(u1));
    },
    // Encodes byte string to elliptic curve.
    // encode_to_curve from https://www.rfc-editor.org/rfc/rfc9380#section-3
    encodeToCurve(msg, options) {
      const u = hash_to_field(msg, 1, { ...defaults, DST: defaults.encodeDST, ...options });
      return clear(map(u[0]));
    },
    // Same as encodeToCurve, but without hash
    mapToCurve(scalars) {
      if (!Array.isArray(scalars))
        throw new Error("expected array of bigints");
      for (const i of scalars)
        if (typeof i !== "bigint")
          throw new Error("expected array of bigints");
      return clear(map(scalars));
    }
  };
}
var os2ip;
var init_hash_to_curve = __esm({
  "node_modules/@noble/curves/esm/abstract/hash-to-curve.js"() {
    init_modular();
    init_utils2();
    os2ip = bytesToNumberBE;
  }
});

// node_modules/@noble/curves/esm/secp256k1.js
var secp256k1_exports = {};
__export(secp256k1_exports, {
  encodeToCurve: () => encodeToCurve,
  hashToCurve: () => hashToCurve,
  schnorr: () => schnorr,
  secp256k1: () => secp256k1,
  secp256k1_hasher: () => secp256k1_hasher
});
function sqrtMod(y) {
  const P = secp256k1P;
  const _3n3 = BigInt(3), _6n = BigInt(6), _11n = BigInt(11), _22n = BigInt(22);
  const _23n = BigInt(23), _44n = BigInt(44), _88n = BigInt(88);
  const b2 = y * y * y % P;
  const b3 = b2 * b2 * y % P;
  const b6 = pow2(b3, _3n3, P) * b3 % P;
  const b9 = pow2(b6, _3n3, P) * b3 % P;
  const b11 = pow2(b9, _2n4, P) * b2 % P;
  const b22 = pow2(b11, _11n, P) * b11 % P;
  const b44 = pow2(b22, _22n, P) * b22 % P;
  const b88 = pow2(b44, _44n, P) * b44 % P;
  const b176 = pow2(b88, _88n, P) * b88 % P;
  const b220 = pow2(b176, _44n, P) * b44 % P;
  const b223 = pow2(b220, _3n3, P) * b3 % P;
  const t1 = pow2(b223, _23n, P) * b22 % P;
  const t2 = pow2(t1, _6n, P) * b2 % P;
  const root = pow2(t2, _2n4, P);
  if (!Fpk1.eql(Fpk1.sqr(root), y))
    throw new Error("Cannot find square root");
  return root;
}
function taggedHash(tag, ...messages) {
  let tagP = TAGGED_HASH_PREFIXES[tag];
  if (tagP === void 0) {
    const tagH = sha256(Uint8Array.from(tag, (c) => c.charCodeAt(0)));
    tagP = concatBytes4(tagH, tagH);
    TAGGED_HASH_PREFIXES[tag] = tagP;
  }
  return sha256(concatBytes4(tagP, ...messages));
}
function schnorrGetExtPubKey(priv) {
  let d_ = secp256k1.utils.normPrivateKeyToScalar(priv);
  let p = Point.fromPrivateKey(d_);
  const scalar = p.hasEvenY() ? d_ : modN(-d_);
  return { scalar, bytes: pointToBytes(p) };
}
function lift_x(x) {
  aInRange("x", x, _1n6, secp256k1P);
  const xx = modP(x * x);
  const c = modP(xx * x + BigInt(7));
  let y = sqrtMod(c);
  if (y % _2n4 !== _0n6)
    y = modP(-y);
  const p = new Point(x, y, _1n6);
  p.assertValidity();
  return p;
}
function challenge(...args) {
  return modN(num(taggedHash("BIP0340/challenge", ...args)));
}
function schnorrGetPublicKey(privateKey) {
  return schnorrGetExtPubKey(privateKey).bytes;
}
function schnorrSign(message, privateKey, auxRand = randomBytes(32)) {
  const m = ensureBytes("message", message);
  const { bytes: px, scalar: d } = schnorrGetExtPubKey(privateKey);
  const a = ensureBytes("auxRand", auxRand, 32);
  const t = numTo32b(d ^ num(taggedHash("BIP0340/aux", a)));
  const rand = taggedHash("BIP0340/nonce", t, px, m);
  const k_ = modN(num(rand));
  if (k_ === _0n6)
    throw new Error("sign failed: k is zero");
  const { bytes: rx, scalar: k } = schnorrGetExtPubKey(k_);
  const e = challenge(rx, px, m);
  const sig = new Uint8Array(64);
  sig.set(rx, 0);
  sig.set(numTo32b(modN(k + e * d)), 32);
  if (!schnorrVerify(sig, m, px))
    throw new Error("sign: Invalid signature produced");
  return sig;
}
function schnorrVerify(signature, message, publicKey) {
  const sig = ensureBytes("signature", signature, 64);
  const m = ensureBytes("message", message);
  const pub = ensureBytes("publicKey", publicKey, 32);
  try {
    const P = lift_x(num(pub));
    const r = num(sig.subarray(0, 32));
    if (!inRange(r, _1n6, secp256k1P))
      return false;
    const s = num(sig.subarray(32, 64));
    if (!inRange(s, _1n6, secp256k1N))
      return false;
    const e = challenge(numTo32b(r), pointToBytes(P), m);
    const R = GmulAdd(P, s, modN(-e));
    if (!R || !R.hasEvenY() || R.toAffine().x !== r)
      return false;
    return true;
  } catch (error) {
    return false;
  }
}
var secp256k1P, secp256k1N, _0n6, _1n6, _2n4, divNearest, Fpk1, secp256k1, TAGGED_HASH_PREFIXES, pointToBytes, numTo32b, modP, modN, Point, GmulAdd, num, schnorr, isoMap, mapSWU, secp256k1_hasher, hashToCurve, encodeToCurve;
var init_secp256k1 = __esm({
  "node_modules/@noble/curves/esm/secp256k1.js"() {
    init_sha2();
    init_utils();
    init_shortw_utils();
    init_hash_to_curve();
    init_modular();
    init_utils2();
    init_weierstrass();
    secp256k1P = BigInt("0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f");
    secp256k1N = BigInt("0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141");
    _0n6 = BigInt(0);
    _1n6 = BigInt(1);
    _2n4 = BigInt(2);
    divNearest = (a, b) => (a + b / _2n4) / b;
    Fpk1 = Field(secp256k1P, void 0, void 0, { sqrt: sqrtMod });
    secp256k1 = createCurve({
      a: _0n6,
      b: BigInt(7),
      Fp: Fpk1,
      n: secp256k1N,
      Gx: BigInt("55066263022277343669578718895168534326250603453777594175500187360389116729240"),
      Gy: BigInt("32670510020758816978083085130507043184471273380659243275938904335757337482424"),
      h: BigInt(1),
      lowS: true,
      // Allow only low-S signatures by default in sign() and verify()
      endo: {
        // Endomorphism, see above
        beta: BigInt("0x7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee"),
        splitScalar: (k) => {
          const n = secp256k1N;
          const a1 = BigInt("0x3086d221a7d46bcde86c90e49284eb15");
          const b1 = -_1n6 * BigInt("0xe4437ed6010e88286f547fa90abfe4c3");
          const a2 = BigInt("0x114ca50f7a8e2f3f657c1108d9d44cfd8");
          const b2 = a1;
          const POW_2_128 = BigInt("0x100000000000000000000000000000000");
          const c1 = divNearest(b2 * k, n);
          const c2 = divNearest(-b1 * k, n);
          let k1 = mod(k - c1 * a1 - c2 * a2, n);
          let k2 = mod(-c1 * b1 - c2 * b2, n);
          const k1neg = k1 > POW_2_128;
          const k2neg = k2 > POW_2_128;
          if (k1neg)
            k1 = n - k1;
          if (k2neg)
            k2 = n - k2;
          if (k1 > POW_2_128 || k2 > POW_2_128) {
            throw new Error("splitScalar: Endomorphism failed, k=" + k);
          }
          return { k1neg, k1, k2neg, k2 };
        }
      }
    }, sha256);
    TAGGED_HASH_PREFIXES = {};
    pointToBytes = (point) => point.toRawBytes(true).slice(1);
    numTo32b = (n) => numberToBytesBE(n, 32);
    modP = (x) => mod(x, secp256k1P);
    modN = (x) => mod(x, secp256k1N);
    Point = /* @__PURE__ */ (() => secp256k1.ProjectivePoint)();
    GmulAdd = (Q, a, b) => Point.BASE.multiplyAndAddUnsafe(Q, a, b);
    num = bytesToNumberBE;
    schnorr = /* @__PURE__ */ (() => ({
      getPublicKey: schnorrGetPublicKey,
      sign: schnorrSign,
      verify: schnorrVerify,
      utils: {
        randomPrivateKey: secp256k1.utils.randomPrivateKey,
        lift_x,
        pointToBytes,
        numberToBytesBE,
        bytesToNumberBE,
        taggedHash,
        mod
      }
    }))();
    isoMap = /* @__PURE__ */ (() => isogenyMap(Fpk1, [
      // xNum
      [
        "0x8e38e38e38e38e38e38e38e38e38e38e38e38e38e38e38e38e38e38daaaaa8c7",
        "0x7d3d4c80bc321d5b9f315cea7fd44c5d595d2fc0bf63b92dfff1044f17c6581",
        "0x534c328d23f234e6e2a413deca25caece4506144037c40314ecbd0b53d9dd262",
        "0x8e38e38e38e38e38e38e38e38e38e38e38e38e38e38e38e38e38e38daaaaa88c"
      ],
      // xDen
      [
        "0xd35771193d94918a9ca34ccbb7b640dd86cd409542f8487d9fe6b745781eb49b",
        "0xedadc6f64383dc1df7c4b2d51b54225406d36b641f5e41bbc52a56612a8c6d14",
        "0x0000000000000000000000000000000000000000000000000000000000000001"
        // LAST 1
      ],
      // yNum
      [
        "0x4bda12f684bda12f684bda12f684bda12f684bda12f684bda12f684b8e38e23c",
        "0xc75e0c32d5cb7c0fa9d0a54b12a0a6d5647ab046d686da6fdffc90fc201d71a3",
        "0x29a6194691f91a73715209ef6512e576722830a201be2018a765e85a9ecee931",
        "0x2f684bda12f684bda12f684bda12f684bda12f684bda12f684bda12f38e38d84"
      ],
      // yDen
      [
        "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffff93b",
        "0x7a06534bb8bdb49fd5e9e6632722c2989467c1bfc8e8d978dfb425d2685c2573",
        "0x6484aa716545ca2cf3a70c3fa8fe337e0a3d21162f0d6299a7bf8192bfd2a76f",
        "0x0000000000000000000000000000000000000000000000000000000000000001"
        // LAST 1
      ]
    ].map((i) => i.map((j) => BigInt(j)))))();
    mapSWU = /* @__PURE__ */ (() => mapToCurveSimpleSWU(Fpk1, {
      A: BigInt("0x3f8731abdd661adca08a5558f0f5d272e953d363cb6f0e5d405447c01a444533"),
      B: BigInt("1771"),
      Z: Fpk1.create(BigInt("-11"))
    }))();
    secp256k1_hasher = /* @__PURE__ */ (() => createHasher2(secp256k1.ProjectivePoint, (scalars) => {
      const { x, y } = mapSWU(Fpk1.create(scalars[0]));
      return isoMap(x, y);
    }, {
      DST: "secp256k1_XMD:SHA-256_SSWU_RO_",
      encodeDST: "secp256k1_XMD:SHA-256_SSWU_NU_",
      p: Fpk1.ORDER,
      m: 1,
      k: 128,
      expand: "xmd",
      hash: sha256
    }))();
    hashToCurve = /* @__PURE__ */ (() => secp256k1_hasher.hashToCurve)();
    encodeToCurve = /* @__PURE__ */ (() => secp256k1_hasher.encodeToCurve)();
  }
});

// node_modules/viem/_esm/utils/address/isAddressEqual.js
function isAddressEqual(a, b) {
  if (!isAddress(a, { strict: false }))
    throw new InvalidAddressError({ address: a });
  if (!isAddress(b, { strict: false }))
    throw new InvalidAddressError({ address: b });
  return a.toLowerCase() === b.toLowerCase();
}
var init_isAddressEqual = __esm({
  "node_modules/viem/_esm/utils/address/isAddressEqual.js"() {
    init_address();
    init_isAddress();
  }
});

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

// src/canonical.ts
function canonicalJson(value, label = "value") {
  const normalized = JSON.stringify(value);
  if (normalized === void 0) {
    throw new Error(`${label} must be JSON serializable`);
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
    case "swarm_createFeed":
      return "createFeed";
    case "swarm_updateFeed":
      return "updateFeed";
    case "swarm_writeFeedEntry":
      return "writeFeedEntry";
    case "swarm_readFeedEntry":
      return "readFeedEntry";
    case "swarm_listFeeds":
      return "listFeeds";
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

// src/driver.ts
function createWindowSwarmDriver(provider) {
  const driver = {
    isSwarmKitDriver: true,
    async publishChunk(params) {
      return callSwarm(provider, "swarm_publishChunk", {
        data: normalizeBytes(params.data),
        ...params.span !== void 0 ? { span: params.span } : {}
      });
    },
    async readChunk(params) {
      const result = await callSwarm(provider, "swarm_readChunk", {
        reference: params.reference
      });
      return decodeChunkRead(result);
    },
    async writeSingleOwnerChunk(params) {
      return callSwarm(provider, "swarm_writeSingleOwnerChunk", {
        identifier: params.identifier,
        data: normalizeBytes(params.data),
        ...params.span !== void 0 ? { span: params.span } : {}
      });
    },
    async readSingleOwnerChunk(params) {
      const result = await callSwarm(
        provider,
        "swarm_readSingleOwnerChunk",
        "address" in params ? { address: params.address } : { owner: params.owner, identifier: params.identifier }
      );
      return decodeSocRead(result);
    }
  };
  if (provider.getSigningIdentity || provider.request) {
    driver.getSigningIdentity = () => callSwarm(provider, "swarm_getSigningIdentity");
  }
  if (provider.getCapabilities || provider.request) {
    driver.getCapabilities = () => callSwarm(provider, "swarm_getCapabilities");
  }
  if (provider.requestAccess || provider.request) {
    driver.requestAccess = () => callSwarm(provider, "swarm_requestAccess");
  }
  return driver;
}
function toSwarmKitDriver(input) {
  return isSwarmKitDriver(input) ? input : createWindowSwarmDriver(input);
}
function isSwarmKitDriver(input) {
  return input.isSwarmKitDriver === true;
}
function decodeChunkRead(result) {
  return {
    data: base64ToBytes(result.data),
    span: result.span
  };
}
function decodeSocRead(result) {
  const decoded = {
    data: base64ToBytes(result.data),
    span: result.span,
    reference: result.reference,
    owner: result.owner,
    identifier: result.identifier
  };
  if (result.signature !== void 0) decoded.signature = result.signature;
  return decoded;
}
function normalizeDriverBytes(value) {
  return normalizeBytes(value);
}

// src/chunks.ts
async function publishBytes(provider, data, options = {}) {
  return toSwarmKitDriver(provider).publishChunk({
    data: normalizeDriverBytes(data),
    ...options.span !== void 0 ? { span: options.span } : {}
  });
}
async function readBytes(provider, reference) {
  const result = await toSwarmKitDriver(provider).readChunk({ reference });
  return {
    bytes: result.data,
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

// src/identifiers.ts
init_sha3();
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
async function publishNode(provider, children, size2) {
  if (children.length <= MAX_CHILDREN_PER_NODE) {
    const manifest = createNode(children, size2);
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
  const root = await publishNode(provider, nodeChildren, size2);
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
function createNode(children, size2) {
  return {
    version: 1,
    type: "swarm-kit:chunk-graph",
    size: size2,
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
  const driver = toSwarmKitDriver(provider);
  if (!driver.getSigningIdentity) {
    throw new Error("Swarm driver does not support getSigningIdentity");
  }
  return driver.getSigningIdentity();
}
async function writeSocBytes(provider, identifier, data, options = {}) {
  return toSwarmKitDriver(provider).writeSingleOwnerChunk({
    identifier,
    data: normalizeDriverBytes(data),
    ...options.span !== void 0 ? { span: options.span } : {}
  });
}
async function readSocBytesByAddress(provider, address) {
  return decodeSocRead2(await toSwarmKitDriver(provider).readSingleOwnerChunk({ address }));
}
async function readSocBytesByOwnerAndIdentifier(provider, owner, identifier) {
  return decodeSocRead2(await toSwarmKitDriver(provider).readSingleOwnerChunk({ owner, identifier }));
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
function decodeSocRead2(result) {
  const decoded = {
    bytes: result.data,
    span: result.span,
    reference: result.reference,
    owner: result.owner,
    identifier: result.identifier
  };
  if (result.signature !== void 0) decoded.signature = result.signature;
  return decoded;
}

// src/commit-reveal.ts
var DEFAULT_COMMIT_REVEAL_NAMESPACE = "swarm-kit:commit-reveal:v1";
var COMMIT_ENVELOPE_TYPE = "swarm-kit:commit-reveal-commit";
var REVEAL_ENVELOPE_TYPE = "swarm-kit:commit-reveal-reveal";
var COMMITMENT_ALGORITHM = "keccak256-length-tagged-canonical-json-owner-salt-v1";
var DEFAULT_SALT_BYTES = 32;
var MIN_SALT_BYTES = 16;
var MAX_SALT_BYTES = 64;
function createCommitReveal(provider, options) {
  const normalized = normalizeCommitRevealOptions(options);
  function commitIdentifier() {
    return commitRevealCommitIdentifier(normalized);
  }
  function revealIdentifier() {
    return commitRevealRevealIdentifier(normalized);
  }
  async function getOwner() {
    return (await getSigningIdentity(provider)).owner;
  }
  function commitmentFor(owner, value, salt) {
    return commitRevealCommitment({ ...normalized, owner, value, salt });
  }
  async function readCommit(owner) {
    try {
      const soc = await readSocBytesByOwnerAndIdentifier(provider, owner, commitIdentifier());
      const envelope = parseCommitEnvelope(bytesToJson(soc.bytes), normalized);
      return commitFromSoc(envelope, soc);
    } catch (error) {
      if (isSwarmReason(error, "chunk_not_found")) return null;
      throw error;
    }
  }
  async function readReveal(owner) {
    let soc;
    try {
      soc = await readSocBytesByOwnerAndIdentifier(provider, owner, revealIdentifier());
    } catch (error) {
      if (isSwarmReason(error, "chunk_not_found")) return null;
      throw error;
    }
    const envelope = parseRevealEnvelope(bytesToJson(soc.bytes), normalized);
    const value = await readObjectJson(provider, envelope.valueReference);
    return revealFromSoc(envelope, soc, value);
  }
  function verify(commit, reveal) {
    if (commit.type !== COMMIT_ENVELOPE_TYPE || reveal.type !== REVEAL_ENVELOPE_TYPE) return false;
    if (!sameCommitRevealCoordinates(commit, normalized)) return false;
    if (!sameCommitRevealCoordinates(reveal, normalized)) return false;
    if (commit.algorithm !== COMMITMENT_ALGORITHM || reveal.algorithm !== COMMITMENT_ALGORITHM) return false;
    if (commit.identifier.toLowerCase() !== commitIdentifier().toLowerCase()) return false;
    if (reveal.identifier.toLowerCase() !== revealIdentifier().toLowerCase()) return false;
    if (commit.owner.toLowerCase() !== reveal.owner.toLowerCase()) return false;
    if (commit.commitment !== reveal.commitment) return false;
    return commitmentFor(reveal.owner, reveal.value, reveal.salt) === commit.commitment;
  }
  return {
    namespace: normalized.namespace,
    topic: normalized.topic,
    round: normalized.round,
    commitIdentifier,
    revealIdentifier,
    getOwner,
    generateSalt: generateCommitRevealSalt,
    commitmentFor,
    async commit(value, commitOptions = {}) {
      const owner = await getOwner();
      const salt = normalizeCommitRevealSalt(commitOptions.salt ?? generateCommitRevealSalt());
      const envelope = {
        version: 1,
        type: COMMIT_ENVELOPE_TYPE,
        namespace: normalized.namespace,
        topic: normalized.topic,
        round: normalized.round,
        algorithm: COMMITMENT_ALGORITHM,
        commitment: commitmentFor(owner, value, salt),
        committedAt: normalizeTimestamp(commitOptions.at, "commit timestamp")
      };
      const commitWrite = await writeSocJson(provider, commitIdentifier(), envelope);
      const stored = await readCommit(owner);
      if (stored && sameCommitEnvelope(stored, envelope)) {
        return { ...stored, salt, commitWrite };
      }
      throw new SwarmKitError("Commit SOC write collision", { reason: "soc_write_collision" });
    },
    async reveal(value, saltInput, revealOptions = {}) {
      const owner = await getOwner();
      const salt = normalizeCommitRevealSalt(saltInput);
      const commitment = commitmentFor(owner, value, salt);
      const commit = await readCommit(owner);
      if (!commit) {
        throw new SwarmKitError("Cannot reveal before writing a commit", { reason: "commit_not_found" });
      }
      if (commit.commitment !== commitment) {
        throw new SwarmKitError("Reveal does not match commit", { reason: "commitment_mismatch" });
      }
      const publishedValue = await publishObjectJson(provider, value);
      const envelope = {
        version: 1,
        type: REVEAL_ENVELOPE_TYPE,
        namespace: normalized.namespace,
        topic: normalized.topic,
        round: normalized.round,
        algorithm: COMMITMENT_ALGORITHM,
        commitment,
        salt,
        valueReference: publishedValue.reference,
        valueSize: publishedValue.size,
        revealedAt: normalizeTimestamp(revealOptions.at, "reveal timestamp")
      };
      const revealWrite = await writeSocJson(provider, revealIdentifier(), envelope);
      const stored = await readReveal(owner);
      if (stored && sameRevealEnvelope(stored, envelope)) {
        return { ...stored, revealWrite };
      }
      throw new SwarmKitError("Reveal SOC write collision", { reason: "soc_write_collision" });
    },
    readCommit,
    readReveal,
    async readPair(owner) {
      const [commit, reveal] = await Promise.all([readCommit(owner), readReveal(owner)]);
      return {
        commit,
        reveal,
        verified: commit && reveal ? verify(commit, reveal) : null
      };
    },
    verify
  };
}
function commitRevealCommitIdentifier(options) {
  const normalized = normalizeCommitRevealOptions(options);
  return deriveIdentifier([normalized.namespace, normalized.topic, normalized.round, "commit"]);
}
function commitRevealRevealIdentifier(options) {
  const normalized = normalizeCommitRevealOptions(options);
  return deriveIdentifier([normalized.namespace, normalized.topic, normalized.round, "reveal"]);
}
function commitRevealCommitment(input) {
  const normalized = normalizeCommitRevealOptions(input);
  return deriveIdentifier([
    "swarm-kit:commit-reveal:commitment:v1",
    normalized.namespace,
    normalized.topic,
    normalized.round,
    normalizeOwner(input.owner),
    canonicalJson(input.value, "commit-reveal value"),
    normalizeCommitRevealSalt(input.salt)
  ]);
}
function generateCommitRevealSalt(bytes = DEFAULT_SALT_BYTES) {
  if (!Number.isSafeInteger(bytes) || bytes < MIN_SALT_BYTES || bytes > MAX_SALT_BYTES) {
    throw new Error(`Commit-reveal salt byte length must be between ${MIN_SALT_BYTES} and ${MAX_SALT_BYTES}`);
  }
  const salt = new Uint8Array(bytes);
  getCrypto().getRandomValues(salt);
  return bytesToHex(salt);
}
function commitFromSoc(envelope, soc) {
  return {
    ...envelope,
    owner: soc.owner,
    identifier: soc.identifier,
    reference: soc.reference
  };
}
function revealFromSoc(envelope, soc, value) {
  return {
    ...envelope,
    owner: soc.owner,
    identifier: soc.identifier,
    reference: soc.reference,
    value
  };
}
function parseCommitEnvelope(value, options) {
  if (value.version !== 1 || value.type !== COMMIT_ENVELOPE_TYPE || value.namespace !== options.namespace || value.topic !== options.topic || value.round !== options.round || value.algorithm !== COMMITMENT_ALGORITHM || !isHex(value.commitment, 32) || typeof value.committedAt !== "string" || Number.isNaN(Date.parse(value.committedAt))) {
    throw new Error("Invalid commit-reveal commit envelope");
  }
  return value;
}
function parseRevealEnvelope(value, options) {
  if (value.version !== 1 || value.type !== REVEAL_ENVELOPE_TYPE || value.namespace !== options.namespace || value.topic !== options.topic || value.round !== options.round || value.algorithm !== COMMITMENT_ALGORITHM || !isHex(value.commitment, 32) || !isValidSaltHex(value.salt) || typeof value.valueReference !== "string" || !value.valueReference.trim() || !Number.isSafeInteger(value.valueSize) || value.valueSize < 0 || typeof value.revealedAt !== "string" || Number.isNaN(Date.parse(value.revealedAt))) {
    throw new Error("Invalid commit-reveal reveal envelope");
  }
  return value;
}
function sameCommitRevealCoordinates(value, options) {
  return value.namespace === options.namespace && value.topic === options.topic && value.round === options.round;
}
function sameCommitEnvelope(a, b) {
  return a.version === b.version && a.type === b.type && a.namespace === b.namespace && a.topic === b.topic && a.round === b.round && a.algorithm === b.algorithm && a.commitment === b.commitment && a.committedAt === b.committedAt;
}
function sameRevealEnvelope(a, b) {
  return a.version === b.version && a.type === b.type && a.namespace === b.namespace && a.topic === b.topic && a.round === b.round && a.algorithm === b.algorithm && a.commitment === b.commitment && a.salt === b.salt && a.valueReference === b.valueReference && a.valueSize === b.valueSize && a.revealedAt === b.revealedAt;
}
function normalizeCommitRevealOptions(options) {
  return {
    namespace: normalizeNonEmpty(options.namespace ?? DEFAULT_COMMIT_REVEAL_NAMESPACE, "commit-reveal namespace"),
    topic: normalizeNonEmpty(options.topic, "commit-reveal topic"),
    round: normalizeNonEmpty(options.round, "commit-reveal round")
  };
}
function normalizeCommitRevealSalt(salt) {
  const hex = typeof salt === "string" ? salt.replace(/^0x/, "") : bytesToHex(normalizeBytes(salt));
  if (!isValidSaltHex(hex)) {
    throw new Error(`Commit-reveal salt must be a hex string between ${MIN_SALT_BYTES} and ${MAX_SALT_BYTES} bytes`);
  }
  return hex.toLowerCase();
}
function normalizeTimestamp(value, label) {
  const date = value === void 0 ? /* @__PURE__ */ new Date() : value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Commit-reveal ${label} must be a valid date`);
  }
  return date.toISOString();
}
function normalizeOwner(owner) {
  const normalized = owner.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(normalized)) {
    throw new Error("Commit-reveal owner must be a 0x-prefixed Ethereum address");
  }
  return `0x${normalized.slice(2).toLowerCase()}`;
}
function normalizeNonEmpty(value, label) {
  const normalized = String(value).trim();
  if (!normalized) throw new Error(`${label} must not be empty`);
  return normalized;
}
function isHex(value, bytes) {
  return value.length === bytes * 2 && /^[0-9a-fA-F]+$/.test(value);
}
function isValidSaltHex(value) {
  return value.length % 2 === 0 && value.length >= MIN_SALT_BYTES * 2 && value.length <= MAX_SALT_BYTES * 2 && /^[0-9a-fA-F]+$/.test(value);
}
function getCrypto() {
  if (!globalThis.crypto) {
    throw new Error("Web Crypto is not available in this environment");
  }
  return globalThis.crypto;
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
  const sameEnvelope6 = options.sameEnvelope ?? defaultSameEnvelope;
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
        if (stored && sameEnvelope6(stored.envelope, envelope)) {
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
  const saltBytes = options.salt === void 0 ? randomBytes2(SALT_BYTES) : typeof options.salt === "string" ? base64ToBytes(options.salt) : normalizeBytes(options.salt);
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
  const nonce = randomBytes2(NONCE_BYTES);
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
  const salt = randomBytes2(SALT_BYTES);
  const nonce = randomBytes2(NONCE_BYTES);
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
function randomBytes2(size2) {
  const bytes = new Uint8Array(size2);
  getCrypto2().getRandomValues(bytes);
  return bytes;
}
function toArrayBuffer(bytes) {
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
function getSubtle() {
  const subtle = getCrypto2().subtle;
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

// src/records.ts
var DEFAULT_RECORDS_LABEL = "owner records";
function createOwnerRecords(provider, options) {
  const namespace = normalizeNamespace2(options.namespace);
  function streamFor(key) {
    const normalizedKey = normalizeKey2(key);
    return createIndexedSocStream(provider, {
      namespace,
      parts: [normalizedKey],
      entryTag: "revision",
      label: DEFAULT_RECORDS_LABEL,
      parseEnvelope: (value, context) => {
        const envelope = parseRecordEnvelope(value, namespace, normalizedKey);
        if (envelope.index !== context.index) {
          throw new Error(`Owner record revision mismatch for ${context.reference}`);
        }
        return envelope;
      },
      sameEnvelope: sameEnvelope5
    });
  }
  async function assertExpectedOwner(stream, expectedOwner) {
    if (expectedOwner === void 0) return;
    const actualOwner = await stream.getOwner();
    if (!sameOwner(actualOwner, expectedOwner)) {
      throw new SwarmKitError(`Provider is signing as ${actualOwner}, expected ${expectedOwner}`, {
        reason: "owner_mismatch"
      });
    }
  }
  async function hydrateRecord(record, expectedOwner) {
    if (!sameOwner(record.soc.owner, expectedOwner)) {
      throw new SwarmKitError(`Owner record resolved to ${record.soc.owner}, expected ${expectedOwner}`, {
        reason: "owner_mismatch"
      });
    }
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
      ...toPublicEnvelope(entry.envelope),
      owner: entry.owner,
      identifier: entry.identifier,
      reference: entry.reference,
      value
    };
  }
  return {
    namespace,
    revisionIdentifier: (key, revision) => streamFor(key).entryIdentifier(revision),
    getOwner: streamFor("__owner__").getOwner,
    async write(key, value, writeOptions = {}) {
      const normalizedKey = normalizeKey2(key);
      const stream = streamFor(normalizedKey);
      await assertExpectedOwner(stream, writeOptions.expectedOwner);
      const published = await publishObjectJson(provider, value);
      const writtenAt = new Date(writeOptions.at ?? Date.now()).toISOString();
      const appended = await stream.append(({ index, previousReference }) => ({
        version: 1,
        type: "swarm-kit:owner-record",
        namespace,
        key: normalizedKey,
        index,
        previousReference,
        valueReference: published.reference,
        valueSize: published.size,
        writtenAt
      }));
      return {
        ...toPublicEnvelope(appended.envelope),
        owner: appended.owner,
        identifier: appended.identifier,
        reference: appended.reference,
        value,
        entryWrite: appended.entryWrite
      };
    },
    async readAt(owner, key, revision) {
      const record = await streamFor(key).readRecord(owner, revision);
      return record ? hydrateRecord(record, owner) : null;
    },
    async readLatest(owner, key) {
      const record = await streamFor(key).readLatestRecord(owner);
      return record ? hydrateRecord(record, owner) : null;
    },
    async readHistory(owner, key, readOptions = {}) {
      const limit = readOptions.limit ?? 10;
      assertIndexedSocLimit(limit, "owner record history limit");
      const entries = await streamFor(key).readLatest(owner, { limit });
      return Promise.all(entries.map((entry) => {
        if (!sameOwner(entry.owner, owner)) {
          throw new SwarmKitError(`Owner record resolved to ${entry.owner}, expected ${owner}`, {
            reason: "owner_mismatch"
          });
        }
        return hydrateStreamEntry(entry);
      }));
    }
  };
}
function parseRecordEnvelope(value, namespace, key) {
  if (value.version !== 1 || value.type !== "swarm-kit:owner-record" || value.namespace !== namespace || value.key !== key || !Number.isSafeInteger(value.index) || value.index < 0 || !(typeof value.previousReference === "string" || value.previousReference === null) || typeof value.valueReference !== "string" || typeof value.valueSize !== "number" || !Number.isSafeInteger(value.valueSize) || value.valueSize < 0 || typeof value.writtenAt !== "string") {
    throw new Error("Invalid owner record");
  }
  return value;
}
function sameEnvelope5(a, b) {
  return a.version === b.version && a.type === b.type && a.namespace === b.namespace && a.key === b.key && a.index === b.index && a.previousReference === b.previousReference && a.valueReference === b.valueReference && a.valueSize === b.valueSize && a.writtenAt === b.writtenAt;
}
function toPublicEnvelope(envelope) {
  return {
    version: envelope.version,
    type: envelope.type,
    namespace: envelope.namespace,
    key: envelope.key,
    revision: envelope.index,
    previousReference: envelope.previousReference,
    valueReference: envelope.valueReference,
    valueSize: envelope.valueSize,
    writtenAt: envelope.writtenAt
  };
}
function normalizeNamespace2(namespace) {
  if (!namespace.trim()) throw new Error("Owner records namespace must not be empty");
  return namespace;
}
function normalizeKey2(key) {
  if (!key.trim()) throw new Error("Owner record key must not be empty");
  return key;
}
function sameOwner(a, b) {
  return a.toLowerCase() === b.toLowerCase();
}

// node_modules/viem/_esm/accounts/utils/publicKeyToAddress.js
init_getAddress();
init_keccak256();
function publicKeyToAddress(publicKey) {
  const address = keccak256(`0x${publicKey.substring(4)}`).substring(26);
  return checksumAddress(`0x${address}`);
}

// node_modules/viem/_esm/utils/signature/recoverPublicKey.js
init_isHex();
init_size();
init_fromHex();
init_toHex();
async function recoverPublicKey({ hash, signature }) {
  const hashHex = isHex2(hash) ? hash : toHex(hash);
  const { secp256k1: secp256k12 } = await Promise.resolve().then(() => (init_secp256k1(), secp256k1_exports));
  const signature_ = (() => {
    if (typeof signature === "object" && "r" in signature && "s" in signature) {
      const { r, s, v, yParity } = signature;
      const yParityOrV2 = Number(yParity ?? v);
      const recoveryBit2 = toRecoveryBit(yParityOrV2);
      return new secp256k12.Signature(hexToBigInt(r), hexToBigInt(s)).addRecoveryBit(recoveryBit2);
    }
    const signatureHex = isHex2(signature) ? signature : toHex(signature);
    if (size(signatureHex) !== 65)
      throw new Error("invalid signature length");
    const yParityOrV = hexToNumber(`0x${signatureHex.slice(130)}`);
    const recoveryBit = toRecoveryBit(yParityOrV);
    return secp256k12.Signature.fromCompact(signatureHex.substring(2, 130)).addRecoveryBit(recoveryBit);
  })();
  const publicKey = signature_.recoverPublicKey(hashHex.substring(2)).toHex(false);
  return `0x${publicKey}`;
}
function toRecoveryBit(yParityOrV) {
  if (yParityOrV === 0 || yParityOrV === 1)
    return yParityOrV;
  if (yParityOrV === 27)
    return 0;
  if (yParityOrV === 28)
    return 1;
  throw new Error("Invalid yParityOrV value");
}

// node_modules/viem/_esm/utils/signature/recoverAddress.js
async function recoverAddress({ hash, signature }) {
  return publicKeyToAddress(await recoverPublicKey({ hash, signature }));
}

// node_modules/viem/_esm/utils/signature/hashMessage.js
init_keccak256();

// node_modules/viem/_esm/constants/strings.js
var presignMessagePrefix = "Ethereum Signed Message:\n";

// node_modules/viem/_esm/utils/signature/toPrefixedMessage.js
init_concat();
init_size();
init_toHex();
function toPrefixedMessage(message_) {
  const message = (() => {
    if (typeof message_ === "string")
      return stringToHex(message_);
    if (typeof message_.raw === "string")
      return message_.raw;
    return bytesToHex2(message_.raw);
  })();
  const prefix = stringToHex(`${presignMessagePrefix}${size(message)}`);
  return concat([prefix, message]);
}

// node_modules/viem/_esm/utils/signature/hashMessage.js
function hashMessage(message, to_) {
  return keccak256(toPrefixedMessage(message), to_);
}

// node_modules/viem/_esm/utils/signature/recoverMessageAddress.js
async function recoverMessageAddress({ message, signature }) {
  return recoverAddress({ hash: hashMessage(message), signature });
}

// node_modules/viem/_esm/utils/signature/verifyMessage.js
init_getAddress();
init_isAddressEqual();
async function verifyMessage({ address, message, signature }) {
  return isAddressEqual(getAddress(address), await recoverMessageAddress({ message, signature }));
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
function createEip191PersonalVerifier(recoverAddress2, expectedAddress) {
  const normalizedExpected = expectedAddress ? normalizeAddress(expectedAddress) : null;
  return {
    verify: async ({ envelope, bytes, signature }) => {
      if (envelope.signature.scheme !== EIP_191_PERSONAL_SIGN_SCHEME) return false;
      const recovered = normalizeAddress(await recoverAddress2(bytes, signature));
      const signer = normalizeAddress(envelope.signature.signer);
      return recovered === signer && (normalizedExpected === null || recovered === normalizedExpected);
    }
  };
}
function createEthereumPersonalVerifier(options = {}) {
  const expected = options.address ? normalizeAddress(options.address) : null;
  return {
    verify: async ({ envelope, bytes, signature }) => {
      if (envelope.signature.scheme !== EIP_191_PERSONAL_SIGN_SCHEME) return false;
      const signer = normalizeAddress(envelope.signature.signer);
      if (expected !== null && signer !== expected) return false;
      return verifyMessage({
        address: signer,
        message: { raw: bytes },
        signature: `0x${bytesToHex(signature)}`
      });
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
function getCrypto3() {
  if (!globalThis.crypto) {
    throw new Error("Web Crypto is not available in this environment");
  }
  return globalThis.crypto;
}
function getSubtle2() {
  const subtle = getCrypto3().subtle;
  if (!subtle) {
    throw new Error("Web Crypto subtle API is not available in this environment");
  }
  return subtle;
}

// src/client.ts
function createSwarmKit(input = getWindowSwarm()) {
  const provider = toSwarmKitDriver(input);
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
  const crypto2 = {
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
  const records = {
    create: (options) => createOwnerRecords(provider, options)
  };
  const commitReveal = {
    create: (options) => createCommitReveal(provider, options),
    generateSalt: generateCommitRevealSalt,
    commitmentFor: commitRevealCommitment
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
    createEthereumPersonalVerifier
  };
  return {
    provider: input,
    driver: provider,
    requestAccess: () => {
      if (!provider.requestAccess) throw new Error("Swarm driver does not support requestAccess");
      return provider.requestAccess();
    },
    getCapabilities: () => {
      if (!provider.getCapabilities) throw new Error("Swarm driver does not support getCapabilities");
      return provider.getCapabilities();
    },
    chunks,
    soc,
    epochFeed,
    objects,
    did,
    hashChain,
    multiWriterFeed,
    crypto: crypto2,
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
  return deriveIdentifier(["swarm-kit:provider-compliance:run", randomBytes3(16)]).slice(0, 16);
}
function randomBytes3(length) {
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

// src/provider-test-center.ts
var DEFAULT_SUITES = [
  "bootstrap",
  "cac",
  "soc",
  "feed",
  "indexed-soc",
  "primitives",
  "diagnostics"
];
var DEFAULT_OPTIONS2 = {
  requestAccess: true,
  stress: {
    socWrites: 5,
    feedWrites: 5
  }
};
async function runSwarmProviderTestCenter(provider, options = {}) {
  const runId = options.runId ?? createRunId2();
  const selectedSuites = Array.from(new Set(options.suites ?? DEFAULT_SUITES));
  const effective = {
    requestAccess: options.requestAccess ?? DEFAULT_OPTIONS2.requestAccess,
    stress: {
      socWrites: options.stress?.socWrites ?? DEFAULT_OPTIONS2.stress.socWrites,
      feedWrites: options.stress?.feedWrites ?? DEFAULT_OPTIONS2.stress.feedWrites
    }
  };
  const startedAt = (/* @__PURE__ */ new Date()).toISOString();
  const context = {
    provider,
    kit: createSwarmKit(provider),
    runId
  };
  const results = [];
  for (const testCase of createTestCases(effective)) {
    if (!selectedSuites.includes(testCase.suite)) continue;
    results.push(await runTestCase(testCase, context));
  }
  const finishedAt = (/* @__PURE__ */ new Date()).toISOString();
  return {
    runId,
    startedAt,
    finishedAt,
    selectedSuites,
    summary: summarizeResults2(results),
    results
  };
}
function createTestCases(options) {
  return [
    {
      id: "bootstrap-request-access",
      suite: "bootstrap",
      label: "requestAccess resolves",
      enabled: options.requestAccess,
      skipReason: "disabled by options",
      run: async (context) => summarizeValue2(await callSwarm(context.provider, "swarm_requestAccess"))
    },
    {
      id: "bootstrap-capabilities",
      suite: "bootstrap",
      label: "getCapabilities exposes limits",
      run: async (context) => {
        const capabilities = await callSwarm(context.provider, "swarm_getCapabilities");
        assertCondition(typeof capabilities.canPublish === "boolean", "capabilities.canPublish must be boolean");
        context.capabilities = capabilities;
        return {
          specVersion: capabilities.specVersion ?? null,
          canPublish: capabilities.canPublish,
          reason: capabilities.reason,
          limits: capabilities.limits ?? null
        };
      }
    },
    {
      id: "bootstrap-signing-identity",
      suite: "bootstrap",
      label: "getSigningIdentity returns stable owner",
      run: async (context) => {
        const first = await callSwarm(context.provider, "swarm_getSigningIdentity");
        const second = await callSwarm(context.provider, "swarm_getSigningIdentity");
        assertOwner2(first.owner);
        assertSameLower2(second.owner, first.owner, "signing owner");
        context.identity = first;
        return {
          owner: first.owner,
          identityMode: first.identityMode ?? null
        };
      }
    },
    {
      id: "cac-small-roundtrip",
      suite: "cac",
      label: "CAC small byte roundtrip",
      run: async (context) => {
        const text = `swarm-kit test center CAC ${context.runId}`;
        const published = await context.kit.chunks.publishText(text);
        const read = await context.kit.chunks.readText(published.reference);
        assertEqual(read, text, "CAC text");
        context.cac = { reference: published.reference, text };
        return {
          reference: published.reference,
          bytes: utf8ToBytes(text).length
        };
      }
    },
    {
      id: "cac-4096-roundtrip",
      suite: "cac",
      label: "CAC 4096-byte roundtrip",
      run: async (context) => {
        const text = "x".repeat(4096);
        const published = await context.kit.chunks.publishText(text);
        const read = await context.kit.chunks.readText(published.reference);
        assertEqual(read.length, text.length, "CAC 4096-byte length");
        assertEqual(read, text, "CAC 4096-byte payload");
        return {
          reference: published.reference,
          bytes: text.length
        };
      }
    },
    {
      id: "cac-missing",
      suite: "cac",
      label: "Missing CAC returns chunk_not_found",
      run: async (context) => expectProviderReason2(
        () => context.kit.chunks.readBytes(missingReference2(context.runId, "cac")),
        "chunk_not_found"
      )
    },
    {
      id: "soc-roundtrip-address",
      suite: "soc",
      label: "SOC write/read by address",
      run: async (context) => {
        const text = `swarm-kit test center SOC ${context.runId}`;
        const identifier = deriveIdentifier(["swarm-kit:test-center:soc", context.runId, "roundtrip"]);
        const written = await context.kit.soc.writeText(identifier, text);
        const read = await context.kit.soc.readTextByAddress(written.reference);
        assertEqual(read, text, "SOC text by address");
        context.soc = {
          reference: written.reference,
          owner: written.owner,
          identifier,
          text
        };
        return {
          reference: written.reference,
          owner: written.owner,
          identifier
        };
      }
    },
    {
      id: "soc-roundtrip-owner-identifier",
      suite: "soc",
      label: "SOC read by owner and identifier",
      run: async (context) => {
        const soc = requireSoc2(context);
        const read = await context.kit.soc.readTextByOwnerAndIdentifier(soc.owner, soc.identifier);
        assertEqual(read, soc.text, "SOC text by owner+identifier");
        return {
          reference: soc.reference,
          owner: soc.owner,
          identifier: soc.identifier
        };
      }
    },
    {
      id: "soc-missing-owner-identifier",
      suite: "soc",
      label: "Missing SOC by owner+identifier returns chunk_not_found",
      run: async (context) => {
        const owner = context.soc?.owner ?? context.identity?.owner;
        if (!owner) throw new Error("No owner available for missing SOC probe");
        return expectProviderReason2(
          () => context.kit.soc.readBytesByOwnerAndIdentifier(owner, missingReference2(context.runId, "soc-owner-identifier")),
          "chunk_not_found"
        );
      }
    },
    {
      id: "soc-missing-address",
      suite: "soc",
      label: "Missing SOC by address returns chunk_not_found",
      run: async (context) => expectProviderReason2(
        () => context.kit.soc.readBytesByAddress(missingReference2(context.runId, "soc-address")),
        "chunk_not_found"
      )
    },
    {
      id: "soc-cac-type-mismatch",
      suite: "soc",
      label: "CAC read as SOC returns chunk_type_mismatch",
      run: async (context) => {
        const cac = requireCac2(context);
        return expectProviderReason2(
          () => context.kit.soc.readBytesByAddress(cac.reference),
          "chunk_type_mismatch"
        );
      }
    },
    {
      id: "soc-as-cac-type-mismatch",
      suite: "soc",
      label: "SOC read as CAC returns chunk_type_mismatch",
      run: async (context) => {
        const soc = requireSoc2(context);
        return expectProviderReason2(
          () => context.kit.chunks.readBytes(soc.reference),
          "chunk_type_mismatch"
        );
      }
    },
    {
      id: "feed-create",
      suite: "feed",
      label: "createFeed returns feed coordinates",
      run: async (context) => {
        const name = feedName(context.runId, "journal");
        const feed = await callSwarm(context.provider, "swarm_createFeed", { name });
        assertEqual(feed.feedId, name, "feedId");
        assertOwner2(feed.owner);
        assertHex2(feed.topic, 32, "feed topic");
        context.feed = {
          name,
          owner: feed.owner,
          topic: feed.topic,
          writes: []
        };
        return summarizeFeed(feed);
      }
    },
    {
      id: "feed-auto-index-0",
      suite: "feed",
      label: "writeFeedEntry auto-writes index 0",
      run: async (context) => {
        const feed = requireFeed(context);
        const text = feedPayload(context.runId, "auto-0");
        const write = await writeFeedEntry(context.provider, { name: feed.name, data: text });
        assertEqual(write.index, 0, "first feed index");
        feed.writes.push({ index: write.index, text });
        return {
          name: feed.name,
          index: write.index,
          bytes: utf8ToBytes(text).length
        };
      }
    },
    {
      id: "feed-read-index-0-name",
      suite: "feed",
      label: "readFeedEntry reads exact index 0 by name",
      run: async (context) => {
        const feed = requireFeed(context);
        const expected = requireFeedWrite(feed, 0);
        const read = await readFeedEntry(context.provider, { name: feed.name, index: 0 });
        assertEqual(read.index, 0, "read feed index");
        assertEqual(decodeFeedText(read), expected.text, "feed index 0 payload");
        return summarizeFeedRead(feed, read);
      }
    },
    {
      id: "feed-auto-index-1-latest",
      suite: "feed",
      label: "readFeedEntry latest returns highest index and nextIndex",
      run: async (context) => {
        const feed = requireFeed(context);
        const text = feedPayload(context.runId, "auto-1");
        const write = await writeFeedEntry(context.provider, { name: feed.name, data: text });
        assertEqual(write.index, 1, "second feed index");
        feed.writes.push({ index: write.index, text });
        const latest = await readFeedEntry(context.provider, { name: feed.name });
        assertEqual(latest.index, 1, "latest feed index");
        assertEqual(latest.nextIndex, 2, "latest nextIndex");
        assertEqual(decodeFeedText(latest), text, "latest feed payload");
        return summarizeFeedRead(feed, latest);
      }
    },
    {
      id: "feed-sparse-index-write-read",
      suite: "feed",
      label: "Sparse explicit feed index uses exact-match semantics",
      run: async (context) => {
        const feed = requireFeed(context);
        const text = feedPayload(context.runId, "sparse-5");
        const write = await writeFeedEntry(context.provider, { name: feed.name, data: text, index: 5 });
        assertEqual(write.index, 5, "sparse feed index");
        feed.writes.push({ index: write.index, text });
        const read = await readFeedEntry(context.provider, { name: feed.name, index: 5 });
        assertEqual(read.index, 5, "sparse read index");
        assertEqual(decodeFeedText(read), text, "sparse feed payload");
        return summarizeFeedRead(feed, read);
      }
    },
    {
      id: "feed-missing-index-exact",
      suite: "feed",
      label: "Missing explicit feed index returns entry_not_found",
      run: async (context) => {
        const feed = requireFeed(context);
        return expectProviderReason2(
          () => readFeedEntry(context.provider, { name: feed.name, index: 4 }),
          "entry_not_found"
        );
      }
    },
    {
      id: "feed-overwrite-protection",
      suite: "feed",
      label: "Occupied explicit feed index returns index_already_exists",
      run: async (context) => {
        const feed = requireFeed(context);
        return expectProviderReason2(
          () => writeFeedEntry(context.provider, {
            name: feed.name,
            data: feedPayload(context.runId, "duplicate-5"),
            index: 5
          }),
          "index_already_exists"
        );
      }
    },
    {
      id: "feed-read-topic-owner",
      suite: "feed",
      label: "readFeedEntry reads by raw topic and owner",
      run: async (context) => {
        const feed = requireFeed(context);
        const expected = requireFeedWrite(feed, 0);
        const read = await readFeedEntry(context.provider, { topic: feed.topic, owner: feed.owner, index: 0 });
        assertEqual(read.index, 0, "topic+owner read index");
        assertEqual(decodeFeedText(read), expected.text, "topic+owner feed payload");
        return summarizeFeedRead(feed, read);
      }
    },
    {
      id: "feed-list-includes-created-feed",
      suite: "feed",
      label: "listFeeds includes created feed",
      run: async (context) => {
        const feed = requireFeed(context);
        const feeds = await callSwarm(context.provider, "swarm_listFeeds");
        const match = feeds.find((item) => item.name === feed.name);
        assertCondition(Boolean(match), `listFeeds did not include ${feed.name}`);
        return {
          count: feeds.length,
          match
        };
      }
    },
    {
      id: "indexed-soc-append-read",
      suite: "indexed-soc",
      label: "Indexed SOC stream appends and discovers latest",
      run: async (context) => {
        const stream = createTestIndexedStream(context);
        const first = await stream.append(({ index, previousReference }) => ({
          version: 1,
          type: "swarm-kit:test-center:indexed-soc-entry",
          index,
          previousReference,
          value: "first"
        }));
        const second = await stream.append(({ index, previousReference }) => ({
          version: 1,
          type: "swarm-kit:test-center:indexed-soc-entry",
          index,
          previousReference,
          value: "second"
        }));
        const third = await stream.append(({ index, previousReference }) => ({
          version: 1,
          type: "swarm-kit:test-center:indexed-soc-entry",
          index,
          previousReference,
          value: "third"
        }));
        assertEqual(first.envelope.index, 0, "first indexed SOC index");
        assertEqual(second.envelope.index, 1, "second indexed SOC index");
        assertEqual(third.envelope.index, 2, "third indexed SOC index");
        assertSameLower2(second.envelope.previousReference ?? "", first.reference, "second previous reference");
        assertSameLower2(third.envelope.previousReference ?? "", second.reference, "third previous reference");
        const latestIndex = await stream.findLatestIndex(third.owner);
        const latest = await stream.readLatest(third.owner, { limit: 3 });
        assertEqual(latestIndex, 2, "latest indexed SOC index");
        assertEqual(latest.map((entry) => entry.envelope.value).join(","), "third,second,first", "indexed SOC latest order");
        return {
          owner: third.owner,
          latestIndex,
          references: latest.map((entry) => entry.reference)
        };
      }
    },
    {
      id: "indexed-soc-missing-next",
      suite: "indexed-soc",
      label: "Indexed SOC missing next index returns null",
      run: async (context) => {
        const stream = createTestIndexedStream(context);
        const owner = await stream.getOwner();
        const missing = await stream.readAt(owner, 3);
        assertEqual(missing, null, "missing indexed SOC entry");
        return { owner, missingIndex: 3 };
      }
    },
    {
      id: "primitive-object-graph",
      suite: "primitives",
      label: "Object graph stores payload above one raw chunk",
      run: async (context) => {
        const text = `swarm-kit test center object ${context.runId}
${"payload-".repeat(800)}`;
        const published = await context.kit.objects.publishText(text);
        const read = await context.kit.objects.readText(published.reference);
        assertEqual(read, text, "object graph text");
        return {
          reference: published.reference,
          size: published.size,
          chunkCount: published.chunkCount,
          nodeCount: published.nodeCount
        };
      }
    },
    {
      id: "primitive-epoch-feed",
      suite: "primitives",
      label: "Epoch feed write/readLatest",
      run: async (context) => {
        const feed = context.kit.epochFeed.create({
          topic: `swarm-kit-test-center-epoch-${context.runId}`,
          period: "minute"
        });
        const at = Date.now();
        const owner = await feed.getOwner();
        const written = await feed.write({ status: "ok" }, { at });
        const read = await feed.readLatest(owner, { from: at, lookback: 3 });
        assertCondition(Boolean(read), "epoch feed readLatest returned null");
        assertEqual(read?.value.status, "ok", "epoch feed value");
        return {
          owner,
          reference: written.reference,
          identifier: written.identifier,
          epochStartMs: written.epochStartMs
        };
      }
    },
    {
      id: "primitive-hash-chain",
      suite: "primitives",
      label: "Hash chain appends and walks previous references",
      run: async (context) => {
        const chain = context.kit.hashChain.create({
          topic: `swarm-kit-test-center-chain-${context.runId}`
        });
        const first = await chain.append({ step: 1 });
        const second = await chain.append({ step: 2 });
        const latest = await chain.readLatest(second.owner, { limit: 2 });
        assertEqual(first.index, 0, "first hash chain index");
        assertEqual(second.index, 1, "second hash chain index");
        assertEqual(latest.length, 2, "hash chain latest count");
        assertEqual(latest[0]?.index, 1, "hash chain latest index");
        assertEqual(latest[1]?.index, 0, "hash chain previous index");
        assertEqual(latest[0]?.payload.step, 2, "hash chain latest payload");
        assertSameLower2(second.previousReference ?? "", first.reference, "hash chain previous reference");
        return {
          owner: second.owner,
          latest: latest.map((entry) => ({ index: entry.index, reference: entry.reference }))
        };
      }
    },
    {
      id: "primitive-multi-writer-feed",
      suite: "primitives",
      label: "Multi-writer feed single-writer stream works",
      run: async (context) => {
        const feed = context.kit.multiWriterFeed.create({
          topic: `swarm-kit-test-center-multi-${context.runId}`,
          writerId: "local"
        });
        const first = await feed.append({ step: 1 });
        const second = await feed.append({ step: 2 });
        const entries = await feed.readWriter(second.owner, { writerId: "local", limit: 2 });
        assertEqual(first.index, 0, "first multi-writer index");
        assertEqual(second.index, 1, "second multi-writer index");
        assertEqual(entries.length, 2, "multi-writer entry count");
        assertEqual(entries[0]?.index, 1, "multi-writer latest index");
        assertEqual(entries[1]?.index, 0, "multi-writer previous index");
        assertEqual(entries[0]?.payload.step, 2, "multi-writer latest payload");
        assertSameLower2(second.previousReference ?? "", first.reference, "multi-writer previous reference");
        return {
          owner: second.owner,
          entries: entries.map((entry) => ({ index: entry.index, reference: entry.reference }))
        };
      }
    },
    {
      id: "primitive-keyed-lookup",
      suite: "primitives",
      label: "Keyed lookup writes and reads latest value",
      run: async (context) => {
        const lookup = context.kit.lookup.create({
          namespace: `swarm-kit-test-center-lookup-${context.runId}`
        });
        const first = await lookup.write("key", { value: "first" });
        const second = await lookup.write("key", { value: "second" });
        const latest = await lookup.readLatest(second.owner, "key");
        assertEqual(first.index, 0, "first keyed lookup index");
        assertEqual(second.index, 1, "second keyed lookup index");
        assertEqual(latest?.index, 1, "keyed lookup latest index");
        assertEqual(latest?.value.value, "second", "keyed lookup latest value");
        assertSameLower2(second.previousReference ?? "", first.reference, "keyed lookup previous reference");
        return {
          owner: second.owner,
          latest: latest ? { index: latest.index, reference: latest.reference } : null
        };
      }
    },
    {
      id: "primitive-commit-reveal",
      suite: "primitives",
      label: "Commit-reveal commit/read/reveal/readPair",
      run: async (context) => {
        const protocol = context.kit.commitReveal.create({
          topic: `swarm-kit-test-center-commit-${context.runId}`,
          round: "round-1"
        });
        const salt = context.kit.commitReveal.generateSalt();
        const commit = await protocol.commit({ vote: "yes" }, { salt });
        const reveal = await protocol.reveal({ vote: "yes" }, salt);
        const pair = await protocol.readPair(commit.owner);
        assertEqual(pair.verified, true, "commit-reveal verification");
        return {
          owner: commit.owner,
          commitReference: commit.reference,
          revealReference: reveal.reference,
          verified: pair.verified
        };
      }
    },
    {
      id: "diagnostics-cac-size-matrix",
      suite: "diagnostics",
      label: "Diagnostics: CAC size matrix immediate read-after-write",
      run: async (context) => {
        const sizes = [1, 31, 32, 33, 42, 100, 1e3, 4095, 4096, 4097, 8192];
        const steps = [];
        for (const size2 of sizes) {
          steps.push(await captureStep(`cac-size-${size2}`, async () => {
            const text = payloadOfSize(size2, `cac:${context.runId}:${size2}`);
            if (size2 > 4096) {
              const error = await expectProviderReason2(
                () => context.kit.chunks.publishText(text),
                "payload_too_large"
              );
              return {
                size: size2,
                expectedRejection: true,
                error
              };
            }
            const published = await context.kit.chunks.publishText(text);
            const read = await context.kit.chunks.readText(published.reference);
            assertEqual(read.length, text.length, `CAC size ${size2} read length`);
            assertEqual(read, text, `CAC size ${size2} payload`);
            return {
              size: size2,
              reference: published.reference
            };
          }));
        }
        assertDiagnosticSteps(steps, "CAC size matrix failed");
        return { sizes, steps };
      }
    },
    {
      id: "diagnostics-cac-delayed-small-read",
      suite: "diagnostics",
      label: "Diagnostics: CAC small chunk delayed read-after-write",
      run: async (context) => {
        const size2 = 42;
        const text = payloadOfSize(size2, `cac-delayed:${context.runId}`);
        const published = await context.kit.chunks.publishText(text);
        const delays = [0, 250, 1e3, 3e3];
        const steps = [];
        for (const delayMs of delays) {
          steps.push(await captureStep(`read-after-${delayMs}ms`, async () => {
            if (delayMs > 0) await sleep2(delayMs);
            const read = await context.kit.chunks.readText(published.reference);
            assertEqual(read, text, `CAC delayed read after ${delayMs}ms`);
            return {
              delayMs,
              reference: published.reference,
              size: size2
            };
          }));
        }
        assertDiagnosticSteps(steps, "CAC delayed read failed");
        return {
          size: size2,
          reference: published.reference,
          steps
        };
      }
    },
    {
      id: "diagnostics-cac-uniform-4096-read",
      suite: "diagnostics",
      label: "Diagnostics: CAC uniform 4096-byte delayed read-after-write",
      run: async (context) => {
        const size2 = 4096;
        const text = "x".repeat(size2);
        const published = await context.kit.chunks.publishText(text);
        const delays = [0, 250, 1e3, 3e3];
        const steps = [];
        for (const delayMs of delays) {
          steps.push(await captureStep(`read-after-${delayMs}ms`, async () => {
            if (delayMs > 0) await sleep2(delayMs);
            const read = await context.kit.chunks.readText(published.reference);
            assertEqual(read.length, text.length, `CAC uniform 4096 read length after ${delayMs}ms`);
            assertEqual(read, text, `CAC uniform 4096 payload after ${delayMs}ms`);
            return {
              delayMs,
              reference: published.reference,
              size: size2,
              payload: "x.repeat(4096)"
            };
          }));
        }
        assertDiagnosticSteps(steps, "CAC uniform 4096 delayed read failed");
        return {
          size: size2,
          payload: "x.repeat(4096)",
          reference: published.reference,
          steps
        };
      }
    },
    {
      id: "diagnostics-soc-address-owner-timeline",
      suite: "diagnostics",
      label: "Diagnostics: SOC read by address versus owner+identifier",
      run: async (context) => {
        const identifier = deriveIdentifier(["swarm-kit:test-center:diagnostics:soc-address", context.runId]);
        const text = `swarm-kit diagnostics SOC address ${context.runId}`;
        let written = null;
        const steps = [];
        steps.push(await captureStep("write-soc", async () => {
          written = await context.kit.soc.writeText(identifier, text);
          assertSameLower2(written.identifier, identifier, "diagnostic SOC identifier");
          return written;
        }));
        for (const delayMs of [0, 250, 1e3, 3e3]) {
          steps.push(await captureStep(`read-address-after-${delayMs}ms`, async () => {
            if (!written) throw new Error("SOC write did not produce coordinates");
            if (delayMs > 0) await sleep2(delayMs);
            const read = await context.kit.soc.readTextByAddress(written.reference);
            assertEqual(read, text, `SOC address read after ${delayMs}ms`);
            return {
              delayMs,
              reference: written.reference,
              owner: written.owner,
              identifier: written.identifier,
              text: read
            };
          }));
        }
        for (const delayMs of [0, 250, 1e3, 3e3]) {
          steps.push(await captureStep(`read-owner-identifier-after-${delayMs}ms`, async () => {
            if (!written) throw new Error("SOC write did not produce coordinates");
            if (delayMs > 0) await sleep2(delayMs);
            const read = await context.kit.soc.readTextByOwnerAndIdentifier(written.owner, written.identifier);
            assertEqual(read, text, `SOC owner+identifier read after ${delayMs}ms`);
            return {
              delayMs,
              reference: written.reference,
              owner: written.owner,
              identifier: written.identifier,
              text: read
            };
          }));
        }
        assertDiagnosticSteps(steps, "SOC address versus owner+identifier timeline failed");
        return {
          coordinates: written,
          steps
        };
      }
    },
    {
      id: "diagnostics-feed-auto-timeline",
      suite: "diagnostics",
      label: "Diagnostics: native feed auto-index timeline",
      run: async (context) => {
        const name = feedName(context.runId, "diag-auto");
        let feed = null;
        const payload0 = feedPayload(context.runId, "diag-auto-0");
        const payload1 = feedPayload(context.runId, "diag-auto-1");
        const steps = [];
        steps.push(await captureStep("create-feed", async () => {
          feed = await callSwarm(context.provider, "swarm_createFeed", { name });
          return summarizeFeed(feed);
        }));
        steps.push(await captureStep("write-auto-0", async () => {
          const write = await writeFeedEntry(context.provider, { name, data: payload0 });
          assertEqual(write.index, 0, "first auto feed index");
          return write;
        }));
        steps.push(await captureStep("read-latest-after-0", async () => {
          const read = await readFeedEntry(context.provider, { name });
          assertEqual(read.index, 0, "latest index after first feed write");
          assertEqual(decodeFeedText(read), payload0, "latest payload after first feed write");
          return summarizeDiagnosticFeedRead(read);
        }));
        steps.push(await captureStep("read-index-0", async () => {
          const read = await readFeedEntry(context.provider, { name, index: 0 });
          assertEqual(read.index, 0, "explicit feed index 0");
          assertEqual(decodeFeedText(read), payload0, "explicit feed payload 0");
          return summarizeDiagnosticFeedRead(read);
        }));
        steps.push(await captureStep("write-auto-1", async () => {
          const write = await writeFeedEntry(context.provider, { name, data: payload1 });
          assertEqual(write.index, 1, "second auto feed index");
          return write;
        }));
        steps.push(await captureStep("read-latest-after-1", async () => {
          const read = await readFeedEntry(context.provider, { name });
          assertEqual(read.index, 1, "latest index after second feed write");
          assertEqual(decodeFeedText(read), payload1, "latest payload after second feed write");
          return summarizeDiagnosticFeedRead(read);
        }));
        steps.push(await captureStep("read-index-1", async () => {
          const read = await readFeedEntry(context.provider, { name, index: 1 });
          assertEqual(read.index, 1, "explicit feed index 1");
          assertEqual(decodeFeedText(read), payload1, "explicit feed payload 1");
          return summarizeDiagnosticFeedRead(read);
        }));
        assertDiagnosticSteps(steps, "Native feed auto-index timeline failed");
        return {
          name,
          feed: feed ? summarizeFeed(feed) : null,
          steps
        };
      }
    },
    {
      id: "diagnostics-feed-sparse-timeline",
      suite: "diagnostics",
      label: "Diagnostics: native feed sparse explicit-index timeline",
      run: async (context) => {
        const name = feedName(context.runId, "diag-sparse");
        let feed = null;
        const payload0 = feedPayload(context.runId, "diag-sparse-0");
        const payload5 = feedPayload(context.runId, "diag-sparse-5");
        const duplicatePayload5 = feedPayload(context.runId, "diag-sparse-5-duplicate");
        const steps = [];
        steps.push(await captureStep("create-feed", async () => {
          feed = await callSwarm(context.provider, "swarm_createFeed", { name });
          return summarizeFeed(feed);
        }));
        steps.push(await captureStep("write-index-0", async () => {
          const write = await writeFeedEntry(context.provider, { name, data: payload0, index: 0 });
          assertEqual(write.index, 0, "explicit feed write index 0");
          return write;
        }));
        steps.push(await captureStep("write-index-5", async () => {
          const write = await writeFeedEntry(context.provider, { name, data: payload5, index: 5 });
          assertEqual(write.index, 5, "explicit feed write index 5");
          return write;
        }));
        steps.push(await captureStep("read-index-0", async () => {
          const read = await readFeedEntry(context.provider, { name, index: 0 });
          assertEqual(read.index, 0, "explicit feed read index 0");
          assertEqual(decodeFeedText(read), payload0, "explicit feed payload 0");
          return summarizeDiagnosticFeedRead(read);
        }));
        steps.push(await captureStep("read-index-5", async () => {
          const read = await readFeedEntry(context.provider, { name, index: 5 });
          assertEqual(read.index, 5, "explicit feed read index 5");
          assertEqual(decodeFeedText(read), payload5, "explicit feed payload 5");
          return summarizeDiagnosticFeedRead(read);
        }));
        steps.push(await captureExpectedReasonStep("duplicate-index-5", async () => writeFeedEntry(context.provider, {
          name,
          data: duplicatePayload5,
          index: 5
        }), "index_already_exists"));
        assertDiagnosticSteps(steps, "Native feed sparse timeline failed");
        return {
          name,
          feed: feed ? summarizeFeed(feed) : null,
          steps
        };
      }
    },
    {
      id: "diagnostics-indexed-soc-timeline",
      suite: "diagnostics",
      label: "Diagnostics: indexed SOC stream append/read timeline",
      run: async (context) => {
        const stream = createDiagnosticIndexedStream(context);
        const owner = await stream.getOwner();
        const steps = [];
        steps.push(await captureStep("append-0", async () => {
          const appended = await stream.append(({ index, previousReference }) => ({
            version: 1,
            type: "swarm-kit:test-center:indexed-soc-entry",
            index,
            previousReference,
            value: "diag-first"
          }));
          assertEqual(appended.envelope.index, 0, "diagnostic append index 0");
          return summarizeIndexedSocEntry(appended);
        }));
        steps.push(await captureStep("read-0", async () => {
          const entry = await stream.readAt(owner, 0);
          assertCondition(entry !== null, "diagnostic indexed SOC read index 0 returned null");
          assertEqual(entry.envelope.value, "diag-first", "diagnostic indexed SOC value 0");
          return summarizeIndexedSocEntry(entry);
        }));
        steps.push(await captureStep("append-1", async () => {
          const appended = await stream.append(({ index, previousReference }) => ({
            version: 1,
            type: "swarm-kit:test-center:indexed-soc-entry",
            index,
            previousReference,
            value: "diag-second"
          }));
          assertEqual(appended.envelope.index, 1, "diagnostic append index 1");
          return summarizeIndexedSocEntry(appended);
        }));
        steps.push(await captureStep("read-1", async () => {
          const entry = await stream.readAt(owner, 1);
          assertCondition(entry !== null, "diagnostic indexed SOC read index 1 returned null");
          assertEqual(entry.envelope.value, "diag-second", "diagnostic indexed SOC value 1");
          return summarizeIndexedSocEntry(entry);
        }));
        steps.push(await captureStep("append-2", async () => {
          const appended = await stream.append(({ index, previousReference }) => ({
            version: 1,
            type: "swarm-kit:test-center:indexed-soc-entry",
            index,
            previousReference,
            value: "diag-third"
          }));
          assertEqual(appended.envelope.index, 2, "diagnostic append index 2");
          return summarizeIndexedSocEntry(appended);
        }));
        steps.push(await captureStep("read-2", async () => {
          const entry = await stream.readAt(owner, 2);
          assertCondition(entry !== null, "diagnostic indexed SOC read index 2 returned null");
          assertEqual(entry.envelope.value, "diag-third", "diagnostic indexed SOC value 2");
          return summarizeIndexedSocEntry(entry);
        }));
        steps.push(await captureStep("read-latest", async () => {
          const latest = await stream.readLatest(owner, { limit: 3 });
          assertEqual(latest.map((entry) => entry.envelope.value).join(","), "diag-third,diag-second,diag-first", "diagnostic indexed SOC latest order");
          return latest.map(summarizeIndexedSocEntry);
        }));
        assertDiagnosticSteps(steps, "Indexed SOC timeline failed");
        return {
          owner,
          identifiers: [0, 1, 2].map((index) => ({
            index,
            identifier: stream.entryIdentifier(index)
          })),
          steps
        };
      }
    },
    {
      id: "stress-soc-sequential",
      suite: "stress",
      label: "Stress: sequential SOC write/read batch",
      run: async (context) => {
        const count = options.stress.socWrites;
        const writes = [];
        for (let index = 0; index < count; index += 1) {
          const identifier = deriveIdentifier(["swarm-kit:test-center:stress:soc", context.runId, index]);
          const text = `stress soc ${context.runId} ${index}`;
          const written = await context.kit.soc.writeText(identifier, text);
          const read = await context.kit.soc.readTextByOwnerAndIdentifier(written.owner, identifier);
          assertEqual(read, text, `stress SOC ${index}`);
          writes.push({ index, owner: written.owner, identifier, reference: written.reference });
        }
        return { count, writes };
      }
    },
    {
      id: "stress-feed-concurrent-auto-writes",
      suite: "stress",
      label: "Stress: concurrent feed auto-writes get unique indices",
      run: async (context) => {
        const name = feedName(context.runId, "stress");
        const feed = await callSwarm(context.provider, "swarm_createFeed", { name });
        const count = options.stress.feedWrites;
        const writes = await Promise.all(Array.from(
          { length: count },
          (_, index) => writeFeedEntry(context.provider, {
            name,
            data: feedPayload(context.runId, `stress-${index}`)
          })
        ));
        const indices = writes.map((write) => write.index).sort((a, b) => a - b);
        assertEqual(new Set(indices).size, count, "unique concurrent feed indices");
        assertEqual(indices[0], 0, "first concurrent feed index");
        assertEqual(indices[indices.length - 1], count - 1, "last concurrent feed index");
        const reads = await Promise.all(indices.map((index) => readFeedEntry(context.provider, { name, index })));
        assertEqual(reads.length, count, "concurrent feed read count");
        return {
          name,
          owner: feed.owner,
          topic: feed.topic,
          indices
        };
      }
    }
  ];
}
async function runTestCase(testCase, context) {
  const started = now2();
  if (testCase.enabled === false) {
    return {
      id: testCase.id,
      suite: testCase.suite,
      label: testCase.label,
      status: "skip",
      durationMs: elapsed2(started),
      details: testCase.skipReason ?? "skipped"
    };
  }
  try {
    const details = await testCase.run(context);
    if (isWarning(details)) {
      return {
        id: testCase.id,
        suite: testCase.suite,
        label: testCase.label,
        status: "warn",
        durationMs: elapsed2(started),
        details: details.details
      };
    }
    return {
      id: testCase.id,
      suite: testCase.suite,
      label: testCase.label,
      status: "pass",
      durationMs: elapsed2(started),
      details
    };
  } catch (error) {
    return {
      id: testCase.id,
      suite: testCase.suite,
      label: testCase.label,
      status: "fail",
      durationMs: elapsed2(started),
      error: serializeProviderTestError(error)
    };
  }
}
async function writeFeedEntry(provider, params) {
  return callSwarm(provider, "swarm_writeFeedEntry", params);
}
async function readFeedEntry(provider, params) {
  const result = await callSwarm(provider, "swarm_readFeedEntry", params);
  assertEqual(result.encoding, "base64", "feed entry encoding");
  assertCondition(Number.isSafeInteger(result.index) && result.index >= 0, "feed entry index must be a non-negative safe integer");
  assertCondition(
    result.nextIndex === null || Number.isSafeInteger(result.nextIndex) && result.nextIndex >= 0,
    "feed entry nextIndex must be null or a non-negative safe integer"
  );
  return result;
}
async function expectProviderReason2(action, expectedReason) {
  try {
    const value = await action();
    throw new Error(`Expected provider error ${expectedReason}, but call resolved with ${JSON.stringify(summarizeValue2(value))}`);
  } catch (error) {
    const reason = getSwarmErrorReason(error);
    if (reason !== expectedReason) {
      const serialized = serializeProviderTestError(error);
      throw new Error(`Expected provider reason "${expectedReason}", received "${reason ?? "none"}": ${serialized.message}`);
    }
    return serializeProviderTestError(error);
  }
}
function createTestIndexedStream(context) {
  return createIndexedSocStream(context.provider, {
    namespace: "swarm-kit:test-center:indexed-soc:v1",
    parts: [context.runId],
    parseEnvelope: (value, readContext) => {
      if (value.version !== 1 || value.type !== "swarm-kit:test-center:indexed-soc-entry" || value.index !== readContext.index || !(typeof value.previousReference === "string" || value.previousReference === null) || typeof value.value !== "string") {
        throw new Error("Invalid test-center indexed SOC envelope");
      }
      return value;
    }
  });
}
function createDiagnosticIndexedStream(context) {
  return createIndexedSocStream(context.provider, {
    namespace: "swarm-kit:test-center:indexed-soc:v1",
    parts: [context.runId, "diagnostics"],
    parseEnvelope: (value, readContext) => {
      if (value.version !== 1 || value.type !== "swarm-kit:test-center:indexed-soc-entry" || value.index !== readContext.index || !(typeof value.previousReference === "string" || value.previousReference === null) || typeof value.value !== "string") {
        throw new Error("Invalid diagnostic indexed SOC envelope");
      }
      return value;
    }
  });
}
async function captureStep(name, action) {
  const started = now2();
  try {
    const value = await action();
    return {
      name,
      status: "pass",
      durationMs: elapsed2(started),
      value
    };
  } catch (error) {
    return {
      name,
      status: "fail",
      durationMs: elapsed2(started),
      error: serializeProviderTestError(error)
    };
  }
}
async function captureExpectedReasonStep(name, action, expectedReason) {
  return captureStep(name, async () => expectProviderReason2(action, expectedReason));
}
function assertDiagnosticSteps(steps, message) {
  const failed = steps.filter((step) => step.status === "fail");
  if (failed.length > 0) {
    throw diagnosticFailure(message, {
      failed,
      steps
    });
  }
}
function diagnosticFailure(message, details) {
  const error = new Error(message);
  error.name = "ProviderDiagnosticError";
  error.details = details;
  return error;
}
function summarizeResults2(results) {
  return {
    total: results.length,
    passed: results.filter((result) => result.status === "pass").length,
    failed: results.filter((result) => result.status === "fail").length,
    skipped: results.filter((result) => result.status === "skip").length,
    warned: results.filter((result) => result.status === "warn").length
  };
}
function summarizeFeed(feed) {
  return {
    feedId: feed.feedId,
    owner: feed.owner,
    topic: feed.topic,
    manifestReference: feed.manifestReference,
    identityMode: feed.identityMode ?? null
  };
}
function summarizeFeedRead(feed, read) {
  return {
    name: feed.name,
    owner: feed.owner,
    topic: feed.topic,
    index: read.index,
    nextIndex: read.nextIndex,
    text: decodeFeedText(read)
  };
}
function summarizeDiagnosticFeedRead(read) {
  return {
    index: read.index,
    nextIndex: read.nextIndex,
    text: decodeFeedText(read)
  };
}
function summarizeIndexedSocEntry(entry) {
  return {
    owner: entry.owner,
    identifier: entry.identifier,
    reference: entry.reference,
    envelope: entry.envelope
  };
}
function summarizeValue2(value) {
  if (value === void 0 || value === null) return value;
  if (typeof value !== "object") return value;
  const summarized = {};
  for (const [key, item] of Object.entries(value)) {
    summarized[key] = typeof item === "string" && item.length > 96 ? `${item.slice(0, 96)}...` : item;
  }
  return summarized;
}
function serializeProviderTestError(error) {
  const providerError = error;
  const serialized = {
    message: providerError?.message ?? String(error)
  };
  if (providerError?.name !== void 0) serialized.name = providerError.name;
  if (providerError?.code !== void 0) serialized.code = providerError.code;
  const reason = getSwarmErrorReason(error);
  if (reason !== void 0) serialized.reason = reason;
  if (providerError?.data !== void 0) serialized.data = providerError.data;
  const details = error?.details;
  if (details !== void 0) serialized.details = details;
  return serialized;
}
function requireCac2(context) {
  if (!context.cac) throw new Error("CAC suite did not produce a reference");
  return context.cac;
}
function requireSoc2(context) {
  if (!context.soc) throw new Error("SOC suite did not produce a reference");
  return context.soc;
}
function requireFeed(context) {
  if (!context.feed) throw new Error("Feed suite did not create a feed");
  return context.feed;
}
function requireFeedWrite(feed, index) {
  const write = feed.writes.find((item) => item.index === index);
  if (!write) throw new Error(`Feed write at index ${index} is not available`);
  return write;
}
function decodeFeedText(read) {
  return bytesToUtf8(base64ToBytes(read.data));
}
function payloadOfSize(size2, seed) {
  if (!Number.isSafeInteger(size2) || size2 < 0) {
    throw new Error(`Payload size must be a non-negative safe integer: ${size2}`);
  }
  if (size2 === 0) return "";
  const pattern = `${seed}|`;
  return pattern.repeat(Math.ceil(size2 / pattern.length)).slice(0, size2);
}
function feedPayload(runId, label) {
  return JSON.stringify({
    type: "swarm-kit:test-center:feed-payload",
    runId,
    label
  });
}
function feedName(runId, label) {
  return `sk-test-${label}-${runId}`.slice(0, 64);
}
function missingReference2(runId, tag) {
  return deriveIdentifier(["swarm-kit:test-center:missing", runId, tag]);
}
function createRunId2() {
  return deriveIdentifier(["swarm-kit:test-center:run", randomBytes4(16)]).slice(0, 16);
}
function randomBytes4(length) {
  const cryptoObject = globalThis.crypto;
  if (!cryptoObject?.getRandomValues) {
    throw new Error("crypto.getRandomValues is required");
  }
  const bytes = new Uint8Array(length);
  cryptoObject.getRandomValues(bytes);
  return bytes;
}
function assertOwner2(owner) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(owner)) {
    throw new Error(`Invalid owner: ${owner}`);
  }
}
function assertHex2(value, bytes, label) {
  const normalized = value.replace(/^0x/, "");
  if (normalized.length !== bytes * 2 || !/^[0-9a-fA-F]+$/.test(normalized)) {
    throw new Error(`${label} must be ${bytes * 2} hex characters`);
  }
}
function assertSameLower2(actual, expected, label) {
  if (actual.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(`${label} mismatch: expected ${expected}, received ${actual}`);
  }
}
function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} mismatch: expected ${String(expected)}, received ${String(actual)}`);
  }
}
function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}
function isWarning(value) {
  return Boolean(value && typeof value === "object" && value.warning === true);
}
function now2() {
  return globalThis.performance?.now?.() ?? Date.now();
}
function elapsed2(started) {
  return Math.max(0, Math.round((now2() - started) * 10) / 10);
}
function sleep2(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  canonicalJson,
  commitRevealCommitIdentifier,
  commitRevealCommitment,
  commitRevealRevealIdentifier,
  concatBytes,
  createCommitReveal,
  createDidDocument,
  createEip1193PersonalSigner,
  createEip191PersonalVerifier,
  createEpochFeed,
  createEthereumPersonalVerifier,
  createHashChain,
  createIndexedSocStream,
  createKeyedLookup,
  createMultiWriterFeed,
  createOwnerRecords,
  createP256DocumentSigner,
  createP256DocumentVerifier,
  createSwarmKit,
  createWindowSwarmDriver,
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
  generateCommitRevealSalt,
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
  isSwarmKitDriver,
  isSwarmReason,
  jsonToBytes,
  keccakHex,
  normalizeBytes,
  normalizeDriverBytes,
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
  runSwarmProviderTestCenter,
  signDocument,
  signedDocumentPayloadBytes,
  toSwarmKitDriver,
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

@noble/curves/esm/abstract/utils.js:
@noble/curves/esm/abstract/modular.js:
@noble/curves/esm/abstract/curve.js:
@noble/curves/esm/abstract/weierstrass.js:
@noble/curves/esm/_shortw_utils.js:
@noble/curves/esm/secp256k1.js:
  (*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) *)
*/
