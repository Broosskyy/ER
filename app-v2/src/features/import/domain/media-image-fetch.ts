import { createHash } from 'node:crypto';

import { importConfig } from '@/features/import/config/import-config';
import { ImportExecutionError } from '@/features/import/errors/import-errors';
import { assertSafeImportUrl } from '@/features/import/services/import-fetch-service';

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export interface FetchedEventImage {
  sourceUrl: string;
  fingerprint: string;
  mimeType: string;
  bytes: Buffer;
  bytesRead: number;
}

async function readLimitedBinaryBody(
  response: Response,
  maxBytes: number,
): Promise<{ bytes: Buffer; bytesRead: number }> {
  const reader = response.body?.getReader();
  if (!reader) {
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > maxBytes) {
      throw new ImportExecutionError('Image exceeds maximum allowed size.', 'IMPORT_EXECUTION_FAILED');
    }
    return { bytes: Buffer.from(arrayBuffer), bytesRead: arrayBuffer.byteLength };
  }

  const chunks: Buffer[] = [];
  let bytesRead = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    bytesRead += value.byteLength;
    if (bytesRead > maxBytes) {
      throw new ImportExecutionError('Image exceeds maximum allowed size.', 'IMPORT_EXECUTION_FAILED');
    }
    chunks.push(Buffer.from(value));
  }

  return { bytes: Buffer.concat(chunks), bytesRead };
}

function normalizeMimeType(contentType: string): string {
  return contentType.split(';')[0]?.trim().toLowerCase() ?? 'application/octet-stream';
}

export function fingerprintImageBytes(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export async function fetchOfficialEventImage(
  imageUrl: string,
  options?: { maxBytes?: number; signal?: AbortSignal },
): Promise<FetchedEventImage> {
  const parsed = assertSafeImportUrl(imageUrl);
  if (parsed.protocol !== 'https:') {
    throw new ImportExecutionError('Only HTTPS image URLs are allowed.', 'IMPORT_EXECUTION_FAILED');
  }

  const maxBytes = options?.maxBytes ?? importConfig.maxResponseBytes;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), importConfig.timeoutMs);
  if (options?.signal) {
    options.signal.addEventListener('abort', () => controller.abort());
  }

  try {
    const response = await fetch(imageUrl, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
    });
    if (!response.ok) {
      throw new ImportExecutionError(`HTTP ${response.status} for image ${imageUrl}`, 'IMPORT_EXECUTION_FAILED');
    }

    const mimeType = normalizeMimeType(response.headers.get('content-type') ?? '');
    if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
      throw new ImportExecutionError(`Unsupported image MIME type: ${mimeType}`, 'IMPORT_EXECUTION_FAILED');
    }

    const { bytes, bytesRead } = await readLimitedBinaryBody(response, maxBytes);
    return {
      sourceUrl: response.url || imageUrl,
      fingerprint: fingerprintImageBytes(bytes),
      mimeType,
      bytes,
      bytesRead,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
