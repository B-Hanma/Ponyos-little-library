/**
 * zip.js — just enough ZIP to write and read a .ponyolib, with nothing installed.
 *
 * ── WHY THIS FILE EXISTS ──────────────────────────────────────────
 * A backup of this library cannot be JSON. Her uploaded covers, the
 * photographs attached to a memory and any PDF she has added are real
 * binary files, and base64 inside a JSON blob would inflate them by a
 * third and make the whole thing one unstreamable string. A ZIP holds
 * text and bytes side by side, opens in Finder and in Explorer without
 * any help from us, and can still be taken apart by hand years from now
 * when this code is long gone.
 *
 * The app has no build step and no dependencies, and that is a feature
 * rather than an accident — so instead of pulling in a zip library, the
 * format is written out directly. It is well documented and stable, and
 * we only need the 1989 subset of it:
 *
 *   [local header + data] * n   [central directory] * n   [end record]
 *
 * ── WHAT IS DELIBERATELY NOT HERE ─────────────────────────────────
 * No ZIP64, no encryption, no multi-disk, no directory entries. ZIP32
 * tops out at 4 GB and `assertSize` refuses politely long before a
 * library of book covers could reach it. Compression is done by the
 * browser's own CompressionStream where it exists and simply skipped
 * where it does not — a slightly larger archive is a much better
 * outcome than a backup that could not be written at all.
 */

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;

/** Bit 11: the filename is UTF-8. Without it, accents become mojibake. */
const FLAG_UTF8 = 0x0800;

const STORE = 0;
const DEFLATE = 8;

/** ZIP32 keeps sizes and offsets in 32 bits. This is that ceiling. */
const ZIP32_MAX = 0xFFFFFFFF;

const encoder = new TextEncoder();

/* ──────────────────────────────── CRC32 ─────────────────────────── */

/**
 * The ZIP checksum. Every entry carries one and `readZip` verifies it,
 * which is what turns "the file opened" into "the bytes are intact" —
 * the only distinction that actually matters for a backup.
 */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let bit = 0; bit < 8; bit += 1) {
      c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/* ─────────────────────────── compression ────────────────────────── */

/**
 * Deflate with the browser's own stream, or return null if it cannot.
 *
 * `deflate-raw` is a fairly recent addition and a backup must never
 * depend on it: null means "store this entry uncompressed", which every
 * unzip program on earth can still read.
 */
async function deflateRaw(bytes) {
  if (typeof CompressionStream !== 'function') return null;
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    const out = new Uint8Array(await new Response(stream).arrayBuffer());
    // A tiny or incompressible entry can deflate LARGER than it started.
    return out.length < bytes.length ? out : null;
  } catch {
    return null;
  }
}

async function inflateRaw(bytes) {
  if (typeof DecompressionStream !== 'function') {
    throw new Error('This browser cannot read compressed entries in the archive.');
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/* ──────────────────────────── timestamps ────────────────────────── */

/** MS-DOS packed time. Two-second resolution, which is the format's own limit. */
function dosTime(date) {
  return ((date.getHours() & 31) << 11)
    | ((date.getMinutes() & 63) << 5)
    | ((date.getSeconds() >> 1) & 31);
}

/** MS-DOS packed date. The epoch is 1980, so anything earlier is clamped. */
function dosDate(date) {
  const year = Math.max(1980, date.getFullYear());
  return (((year - 1980) & 127) << 9)
    | (((date.getMonth() + 1) & 15) << 5)
    | (date.getDate() & 31);
}

/* ───────────────────────────── writing ──────────────────────────── */

function localHeader(name, method, crc, compSize, rawSize, time, date) {
  const buf = new Uint8Array(30 + name.length);
  const dv = new DataView(buf.buffer);
  dv.setUint32(0, SIG_LOCAL, true);
  dv.setUint16(4, 20, true);            // version needed to extract: 2.0
  dv.setUint16(6, FLAG_UTF8, true);
  dv.setUint16(8, method, true);
  dv.setUint16(10, time, true);
  dv.setUint16(12, date, true);
  dv.setUint32(14, crc, true);
  dv.setUint32(18, compSize, true);
  dv.setUint32(22, rawSize, true);
  dv.setUint16(26, name.length, true);
  dv.setUint16(28, 0, true);            // no extra field
  buf.set(name, 30);
  return buf;
}

function centralHeader(name, method, crc, compSize, rawSize, time, date, offset) {
  const buf = new Uint8Array(46 + name.length);
  const dv = new DataView(buf.buffer);
  dv.setUint32(0, SIG_CENTRAL, true);
  dv.setUint16(4, 20, true);            // version made by
  dv.setUint16(6, 20, true);            // version needed
  dv.setUint16(8, FLAG_UTF8, true);
  dv.setUint16(10, method, true);
  dv.setUint16(12, time, true);
  dv.setUint16(14, date, true);
  dv.setUint32(16, crc, true);
  dv.setUint32(20, compSize, true);
  dv.setUint32(24, rawSize, true);
  dv.setUint16(28, name.length, true);
  dv.setUint16(30, 0, true);            // extra length
  dv.setUint16(32, 0, true);            // comment length
  dv.setUint16(34, 0, true);            // disk number
  dv.setUint16(36, 0, true);            // internal attributes
  dv.setUint32(38, 0, true);            // external attributes
  dv.setUint32(42, offset, true);
  buf.set(name, 46);
  return buf;
}

function endRecord(count, size, offset) {
  const buf = new Uint8Array(22);
  const dv = new DataView(buf.buffer);
  dv.setUint32(0, SIG_EOCD, true);
  dv.setUint16(4, 0, true);
  dv.setUint16(6, 0, true);
  dv.setUint16(8, count, true);
  dv.setUint16(10, count, true);
  dv.setUint32(12, size, true);
  dv.setUint32(16, offset, true);
  dv.setUint16(20, 0, true);            // no archive comment
  return buf;
}

function assertSize(value, what) {
  if (value > ZIP32_MAX) {
    throw new Error(`This backup is too large for the archive format (${what}).`);
  }
}

/** Anything we might be handed for an entry's contents, as bytes. */
async function toBytes(data) {
  if (data instanceof Uint8Array) return data;
  if (typeof data === 'string') return encoder.encode(data);
  if (data instanceof Blob) return new Uint8Array(await data.arrayBuffer());
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  throw new Error('Unsupported entry contents.');
}

/**
 * Build a ZIP archive.
 *
 * @param {Array<{name: string, data: Uint8Array|Blob|string, compress?: boolean}>} entries
 *        `compress` defaults to true. Pass false for anything already
 *        compressed — a JPEG only gets bigger for the trouble.
 * @param {Object}   [options]
 * @param {Date}     [options.date]        the timestamp written into every entry
 * @param {string}   [options.type]        MIME type of the resulting Blob
 * @param {Function} [options.onProgress]  (done, total) => void
 * @returns {Promise<Blob>}
 */
export async function createZip(entries, { date = new Date(), type = 'application/zip', onProgress } = {}) {
  const time = dosTime(date);
  const day = dosDate(date);

  const parts = [];
  const central = [];
  let offset = 0;

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    const name = encoder.encode(entry.name);
    const raw = await toBytes(entry.data);
    const crc = crc32(raw);

    const packed = entry.compress === false ? null : await deflateRaw(raw);
    const method = packed ? DEFLATE : STORE;
    const body = packed ?? raw;

    assertSize(raw.length, entry.name);
    assertSize(body.length, entry.name);

    const header = localHeader(name, method, crc, body.length, raw.length, time, day);
    parts.push(header, body);
    central.push(centralHeader(name, method, crc, body.length, raw.length, time, day, offset));

    offset += header.length + body.length;
    assertSize(offset, 'total size');
    onProgress?.(i + 1, entries.length);
  }

  const directoryOffset = offset;
  let directorySize = 0;
  for (const record of central) {
    parts.push(record);
    directorySize += record.length;
  }
  assertSize(directoryOffset + directorySize, 'total size');

  parts.push(endRecord(central.length, directorySize, directoryOffset));
  return new Blob(parts, { type });
}

/* ───────────────────────────── reading ─────────────────────────── */

/** The end record lives at the tail, after a comment of unknown length. */
function findEndRecord(view) {
  for (let i = view.byteLength - 22; i >= 0; i -= 1) {
    if (view.getUint32(i, true) === SIG_EOCD) return i;
  }
  return -1;
}

/**
 * Open a ZIP archive.
 *
 * The central directory is the authority on what an archive contains —
 * walking local headers instead would mean trusting the very bytes we
 * are trying to verify. Entry data is read lazily, so opening a large
 * backup just to inspect its manifest stays cheap.
 *
 * @param {Blob} blob
 */
export async function readZip(blob) {
  if (!blob || typeof blob.arrayBuffer !== 'function') {
    throw new Error('That is not a file.');
  }
  if (blob.size < 22) {
    throw new Error('That file is too small to be a backup archive.');
  }

  // The end record is 22 bytes plus a comment of at most 65535.
  const tailLength = Math.min(blob.size, 22 + 0xFFFF);
  const tail = new DataView(await blob.slice(blob.size - tailLength).arrayBuffer());
  const eocd = findEndRecord(tail);
  if (eocd < 0) {
    throw new Error('That file is not a ZIP archive (no end-of-archive record).');
  }

  const count = tail.getUint16(eocd + 10, true);
  const directorySize = tail.getUint32(eocd + 12, true);
  const directoryOffset = tail.getUint32(eocd + 16, true);

  if (directoryOffset + directorySize > blob.size) {
    throw new Error('The archive is truncated or damaged.');
  }

  const directory = new DataView(
    await blob.slice(directoryOffset, directoryOffset + directorySize).arrayBuffer(),
  );
  const decoder = new TextDecoder();
  const entries = new Map();

  let cursor = 0;
  for (let i = 0; i < count; i += 1) {
    if (cursor + 46 > directory.byteLength) {
      throw new Error('The archive directory is damaged.');
    }
    if (directory.getUint32(cursor, true) !== SIG_CENTRAL) {
      throw new Error('The archive directory is damaged.');
    }
    const method = directory.getUint16(cursor + 10, true);
    const crc = directory.getUint32(cursor + 16, true);
    const compSize = directory.getUint32(cursor + 20, true);
    const rawSize = directory.getUint32(cursor + 24, true);
    const nameLength = directory.getUint16(cursor + 28, true);
    const extraLength = directory.getUint16(cursor + 30, true);
    const commentLength = directory.getUint16(cursor + 32, true);
    const localOffset = directory.getUint32(cursor + 42, true);

    const name = decoder.decode(
      new Uint8Array(directory.buffer, directory.byteOffset + cursor + 46, nameLength),
    );
    // Folders are recorded as zero-length entries ending in "/".
    if (!name.endsWith('/')) {
      entries.set(name, { name, method, crc, compSize, rawSize, localOffset });
    }
    cursor += 46 + nameLength + extraLength + commentLength;
  }

  const cache = new Map();

  async function bytes(name) {
    if (cache.has(name)) return cache.get(name);
    const entry = entries.get(name);
    if (!entry) throw new Error(`The archive is missing "${name}".`);

    // The local header repeats the name and may carry a different extra
    // field, so its length has to be read rather than assumed.
    const headBuf = await blob.slice(entry.localOffset, entry.localOffset + 30).arrayBuffer();
    if (headBuf.byteLength < 30) throw new Error(`"${name}" is truncated.`);
    const head = new DataView(headBuf);
    if (head.getUint32(0, true) !== SIG_LOCAL) {
      throw new Error(`"${name}" has a damaged header.`);
    }
    const start = entry.localOffset + 30 + head.getUint16(26, true) + head.getUint16(28, true);
    const slice = new Uint8Array(await blob.slice(start, start + entry.compSize).arrayBuffer());
    if (slice.length !== entry.compSize) throw new Error(`"${name}" is truncated.`);

    let raw;
    if (entry.method === DEFLATE) raw = await inflateRaw(slice);
    else if (entry.method === STORE) raw = slice;
    else throw new Error(`"${name}" uses an unsupported compression method.`);

    if (raw.length !== entry.rawSize) {
      throw new Error(`"${name}" is the wrong size — the archive is damaged.`);
    }
    if (crc32(raw) !== entry.crc) {
      throw new Error(`"${name}" failed its checksum — the archive is damaged.`);
    }
    cache.set(name, raw);
    return raw;
  }

  return {
    names: Array.from(entries.keys()),
    has: (name) => entries.has(name),
    entry: (name) => entries.get(name),
    sizeOf: (name) => entries.get(name)?.rawSize ?? 0,
    bytes,
    async text(name) {
      return new TextDecoder().decode(await bytes(name));
    },
    async json(name) {
      const text = new TextDecoder().decode(await bytes(name));
      try {
        return JSON.parse(text);
      } catch {
        throw new Error(`"${name}" is not readable JSON.`);
      }
    },
    async blob(name, type) {
      return new Blob([await bytes(name)], { type: type || 'application/octet-stream' });
    },
  };
}
