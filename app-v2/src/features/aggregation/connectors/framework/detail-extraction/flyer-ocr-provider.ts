/**
 * Phase 4.7.5 — Flyer OCR provider abstraction.
 * External OCR engines plug in here; explicit textual sources are used when no engine is configured.
 */

import { extractLineupNamesFromDescriptionText } from '@/features/aggregation/domain/lineup-text-parser';

export type FlyerOcrSource =
  | 'explicit_description'
  | 'explicit_import_lineup'
  | 'explicit_import_metadata'
  | 'external_ocr'
  | 'none';

export type FlyerOcrStatus = 'text_extracted' | 'pending_external' | 'no_text';

export interface FlyerOcrInput {
  eventId: string;
  title: string;
  imageUrl: string;
  description?: string;
  importArtistNames?: string[];
  importLineupText?: string;
  imageBytes?: Buffer;
  mimeType?: string;
}

export interface FlyerOcrResult {
  providerId: string;
  providerVersion: string;
  status: FlyerOcrStatus;
  source: FlyerOcrSource;
  rawText?: string;
  confidence: number;
  reason: string;
}

export interface FlyerOcrProvider {
  readonly id: string;
  readonly version: string;
  extract(input: FlyerOcrInput): Promise<FlyerOcrResult>;
}

const LINEUP_HEADER_PATTERN = /(?:^|\n)\s*(?:line\s*up|lineup|artists?|dj[s]?)\s*[:\-]/i;

function buildLineupTextFromDescription(description: string): string | undefined {
  const trimmed = description.trim();
  if (!trimmed) {
    return undefined;
  }
  const fromParser = extractLineupNamesFromDescriptionText(trimmed);
  if (fromParser && fromParser.length > 0) {
    return fromParser.join('\n');
  }
  const headerMatch = trimmed.match(LINEUP_HEADER_PATTERN);
  if (!headerMatch || headerMatch.index === undefined) {
    return undefined;
  }
  const tail = trimmed.slice(headerMatch.index + headerMatch[0].length).trim();
  const lines = tail
    .split(/\n+/)
    .map((line) => line.replace(/^[\s•\-*]+/, '').trim())
    .filter((line) => line.length > 1 && line.length < 120);
  if (lines.length === 0) {
    return undefined;
  }
  return lines.join('\n');
}

function buildLineupTextFromImportNames(names: string[]): string | undefined {
  const cleaned = names.map((name) => name.trim()).filter((name) => name.length > 1);
  if (cleaned.length === 0) {
    return undefined;
  }
  return cleaned.join('\n');
}

/** Uses only explicit textual evidence already present in import/description layers. */
export class ExplicitTextFlyerOcrProvider implements FlyerOcrProvider {
  readonly id = 'explicit_text_v1';
  readonly version = '1.0.0';

  async extract(input: FlyerOcrInput): Promise<FlyerOcrResult> {
    if (input.importLineupText?.trim()) {
      return {
        providerId: this.id,
        providerVersion: this.version,
        status: 'text_extracted',
        source: 'explicit_import_metadata',
        rawText: input.importLineupText.trim(),
        confidence: 0.9,
        reason: 'import_metadata_lineup_text',
      };
    }

    if (input.importArtistNames && input.importArtistNames.length > 0) {
      const rawText = buildLineupTextFromImportNames(input.importArtistNames);
      if (rawText) {
        const hasBilling = /\b(?:b2b|f2f|vs\.?|live)\b/i.test(rawText);
        return {
          providerId: this.id,
          providerVersion: this.version,
          status: 'text_extracted',
          source: 'explicit_import_lineup',
          rawText,
          confidence: hasBilling ? 0.88 : 0.82,
          reason: 'import_artist_names_explicit',
        };
      }
    }

    if (input.description?.trim()) {
      const rawText = buildLineupTextFromDescription(input.description);
      if (rawText) {
        const hasBilling = /\b(?:b2b|f2f|vs\.?|live)\b/i.test(rawText);
        return {
          providerId: this.id,
          providerVersion: this.version,
          status: 'text_extracted',
          source: 'explicit_description',
          rawText,
          confidence: hasBilling ? 0.86 : 0.78,
          reason: 'description_lineup_section',
        };
      }
    }

    if (input.imageUrl?.trim()) {
      return {
        providerId: this.id,
        providerVersion: this.version,
        status: 'pending_external',
        source: 'none',
        confidence: 0,
        reason: 'artwork_present_no_explicit_text_awaiting_ocr_provider',
      };
    }

    return {
      providerId: this.id,
      providerVersion: this.version,
      status: 'no_text',
      source: 'none',
      confidence: 0,
      reason: 'no_artwork_or_textual_evidence',
    };
  }
}

/** Placeholder for a future paid/local OCR engine — never fabricates text. */
export class PendingExternalFlyerOcrProvider implements FlyerOcrProvider {
  readonly id = 'external_ocr_pending';
  readonly version = '0.0.0';

  async extract(input: FlyerOcrInput): Promise<FlyerOcrResult> {
    if (!input.imageUrl?.trim()) {
      return {
        providerId: this.id,
        providerVersion: this.version,
        status: 'no_text',
        source: 'none',
        confidence: 0,
        reason: 'no_artwork_url',
      };
    }
    return {
      providerId: this.id,
      providerVersion: this.version,
      status: 'pending_external',
      source: 'external_ocr',
      confidence: 0,
      reason: 'external_ocr_provider_not_configured',
    };
  }
}

export function createDefaultFlyerOcrProviderChain(): FlyerOcrProvider[] {
  return [new ExplicitTextFlyerOcrProvider(), new PendingExternalFlyerOcrProvider()];
}

export async function extractFlyerTextWithProviders(
  input: FlyerOcrInput,
  providers: FlyerOcrProvider[] = createDefaultFlyerOcrProviderChain(),
): Promise<FlyerOcrResult> {
  for (const provider of providers) {
    const result = await provider.extract(input);
    if (result.status === 'text_extracted' && result.rawText?.trim()) {
      return result;
    }
  }
  const last = providers[providers.length - 1];
  if (last) {
    return last.extract(input);
  }
  return {
    providerId: 'none',
    providerVersion: '0',
    status: 'no_text',
    source: 'none',
    confidence: 0,
    reason: 'no_providers_configured',
  };
}
