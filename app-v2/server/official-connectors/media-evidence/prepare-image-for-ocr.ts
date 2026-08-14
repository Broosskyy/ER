import type { Buffer } from 'node:buffer';

const MAX_OCR_EDGE_PX = 2200;

export interface PreparedOcrImage {
  bytes: Buffer;
  mimeType: string;
  width?: number;
  height?: number;
}

function readPngDimensions(bytes: Buffer): { width: number; height: number } | undefined {
  if (bytes.length < 24 || bytes.toString('ascii', 12, 16) !== 'IHDR') {
    return undefined;
  }
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

function readJpegDimensions(bytes: Buffer): { width: number; height: number } | undefined {
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) {
      return undefined;
    }
    const marker = bytes[offset + 1];
    const length = bytes.readUInt16BE(offset + 2);
    if (marker === 0xc0 || marker === 0xc2) {
      return {
        height: bytes.readUInt16BE(offset + 5),
        width: bytes.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + length;
  }
  return undefined;
}

function readWebpDimensions(bytes: Buffer): { width: number; height: number } | undefined {
  if (bytes.length < 30 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') {
    return undefined;
  }
  const chunk = bytes.toString('ascii', 12, 16);
  if (chunk === 'VP8 ') {
    return {
      width: bytes.readUInt16LE(26) & 0x3fff,
      height: bytes.readUInt16LE(28) & 0x3fff,
    };
  }
  if (chunk === 'VP8L') {
    const bits = bytes.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }
  if (chunk === 'VP8X') {
    return {
      width: 1 + bytes.readUIntLE(24, 3),
      height: 1 + bytes.readUIntLE(27, 3),
    };
  }
  return undefined;
}

function readImageDimensions(bytes: Buffer, mimeType: string): { width: number; height: number } | undefined {
  switch (mimeType) {
    case 'image/png':
      return readPngDimensions(bytes);
    case 'image/jpeg':
      return readJpegDimensions(bytes);
    case 'image/webp':
      return readWebpDimensions(bytes);
    default:
      return undefined;
  }
}

export function prepareImageForOcr(bytes: Buffer, mimeType: string): PreparedOcrImage {
  const dimensions = readImageDimensions(bytes, mimeType);
  if (!dimensions) {
    return { bytes, mimeType };
  }

  const longestEdge = Math.max(dimensions.width, dimensions.height);
  if (longestEdge <= MAX_OCR_EDGE_PX) {
    return { bytes, mimeType, ...dimensions };
  }

  return {
    bytes,
    mimeType,
    width: dimensions.width,
    height: dimensions.height,
  };
}
