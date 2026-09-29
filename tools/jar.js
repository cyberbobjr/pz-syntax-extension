'use strict';

// Minimal read-only access to the game jar: zip central directory + class-file string constants.

const fs = require('fs');
const zlib = require('zlib');

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_HEADER_SIZE = 30;
const STORED = 0;
const DEFLATED = 8;

function readZipIndex(buffer) {
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new Error('Not a zip file: end of central directory not found');
  const count = buffer.readUInt16LE(eocd + 10);
  let p = buffer.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let i = 0; i < count; i++) {
    if (buffer.readUInt32LE(p) !== CENTRAL_SIGNATURE) throw new Error(`Corrupt central directory at ${p}`);
    const method = buffer.readUInt16LE(p + 10);
    const compressedSize = buffer.readUInt32LE(p + 20);
    const nameLength = buffer.readUInt16LE(p + 28);
    const extraLength = buffer.readUInt16LE(p + 30);
    const commentLength = buffer.readUInt16LE(p + 32);
    const localOffset = buffer.readUInt32LE(p + 42);
    const name = buffer.toString('utf8', p + 46, p + 46 + nameLength);
    entries.set(name, { method, compressedSize, localOffset });
    p += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

class Jar {
  constructor(filePath) {
    this.buffer = fs.readFileSync(filePath);
    this.entries = readZipIndex(this.buffer);
  }

  has(name) {
    return this.entries.has(name);
  }

  names() {
    return [...this.entries.keys()];
  }

  read(name) {
    const entry = this.entries.get(name);
    if (!entry) throw new Error(`${name} not found in jar`);
    const b = this.buffer;
    const start = entry.localOffset + LOCAL_HEADER_SIZE + b.readUInt16LE(entry.localOffset + 26) + b.readUInt16LE(entry.localOffset + 28);
    const data = b.subarray(start, start + entry.compressedSize);
    if (entry.method === STORED) return data;
    if (entry.method === DEFLATED) return zlib.inflateRawSync(data);
    throw new Error(`Unsupported compression ${entry.method} for ${name}`);
  }
}

/** String literals (CONSTANT_String) of a compiled class, in constant-pool order. */
function classStringLiterals(classBytes) {
  const utf8 = new Map();
  const stringRefs = [];
  let p = 8;
  const count = classBytes.readUInt16BE(p);
  p += 2;
  for (let i = 1; i < count; i++) {
    const tag = classBytes[p++];
    switch (tag) {
      case 1: {
        const length = classBytes.readUInt16BE(p);
        utf8.set(i, classBytes.toString('utf8', p + 2, p + 2 + length));
        p += 2 + length;
        break;
      }
      case 8: stringRefs.push(classBytes.readUInt16BE(p)); p += 2; break;
      case 3: case 4: p += 4; break;
      case 5: case 6: p += 8; i++; break;
      case 7: case 16: case 19: case 20: p += 2; break;
      case 9: case 10: case 11: case 12: case 17: case 18: p += 4; break;
      case 15: p += 3; break;
      default: throw new Error(`Unknown constant pool tag ${tag}`);
    }
  }
  return stringRefs.map((index) => utf8.get(index));
}

module.exports = { Jar, classStringLiterals };
