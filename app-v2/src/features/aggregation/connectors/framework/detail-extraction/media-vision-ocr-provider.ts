/**
 * Configurable vision/OCR providers for official event flyer media extraction.
 * Priority: OpenAI vision (when configured) → local Tesseract (when available).
 */

import type { FlyerOcrInput, FlyerOcrProvider, FlyerOcrResult } from './flyer-ocr-provider';

const VISION_EXTRACTION_PROMPT = `You extract structured evidence from an event flyer image.
Return JSON only with this shape:
{
  "rawText": "full visible text transcription",
  "lineup": [{ "displayName": "billing name", "evidenceRole": "headliner|artist|compound_act" }],
  "explicitGenres": [{ "rawLabel": "genre label explicitly printed on the flyer" }]
}
Rules:
- lineup: only billed artist/DJ names visible on the flyer; preserve compound acts like "2 ENGEL & CHARLIE" as one entry with evidenceRole compound_act
- do not split on &, x, b2b, vs. when the flyer shows one billing unit
- preserve billing order
- explicitGenres: only genre words explicitly printed (e.g. TECHNO, HOUSE); never infer from visuals or artist names
- omit venue, date, ticket, URL, floor labels, and marketing boilerplate from lineup
- if unreadable, return empty arrays and rawText as best effort`;

interface VisionStructuredPayload {
  rawText?: string;
  lineup?: Array<{ displayName?: string; evidenceRole?: string }>;
  explicitGenres?: Array<{ rawLabel?: string }>;
}

export interface MediaVisionOcrResult extends FlyerOcrResult {
  structuredLineup?: Array<{ displayName: string; evidenceRole: string }>;
  structuredGenres?: string[];
}

export class OpenAiVisionFlyerOcrProvider implements FlyerOcrProvider {
  readonly id = 'openai_vision_v1';
  readonly version = '1.0.0';

  isConfigured(): boolean {
    return Boolean(process.env.OPENAI_API_KEY?.trim());
  }

  async extract(input: FlyerOcrInput & { imageBytes?: Buffer; mimeType?: string }): Promise<MediaVisionOcrResult> {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey || !input.imageBytes?.length || !input.mimeType?.trim()) {
      return {
        providerId: this.id,
        providerVersion: this.version,
        status: 'pending_external',
        source: 'external_ocr',
        confidence: 0,
        reason: 'openai_vision_not_configured_or_missing_image_bytes',
      };
    }

    const model = process.env.MEDIA_EVIDENCE_OPENAI_MODEL?.trim() || 'gpt-4o-mini';
    const base64 = input.imageBytes.toString('base64');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: VISION_EXTRACTION_PROMPT },
              {
                type: 'image_url',
                image_url: { url: `data:${input.mimeType};base64,${base64}` },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      return {
        providerId: this.id,
        providerVersion: this.version,
        status: 'pending_external',
        source: 'external_ocr',
        confidence: 0,
        reason: `openai_vision_http_${response.status}`,
      };
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return {
        providerId: this.id,
        providerVersion: this.version,
        status: 'no_text',
        source: 'external_ocr',
        confidence: 0,
        reason: 'openai_vision_empty_response',
      };
    }

    let parsed: VisionStructuredPayload;
    try {
      parsed = JSON.parse(content) as VisionStructuredPayload;
    } catch {
      return {
        providerId: this.id,
        providerVersion: this.version,
        status: 'no_text',
        source: 'external_ocr',
        confidence: 0,
        reason: 'openai_vision_invalid_json',
        rawText: content,
      };
    }

    const structuredLineup = (parsed.lineup ?? [])
      .map((entry) => ({
        displayName: entry.displayName?.trim() ?? '',
        evidenceRole: entry.evidenceRole?.trim() || 'artist',
      }))
      .filter((entry) => entry.displayName.length > 1);

    const structuredGenres = (parsed.explicitGenres ?? [])
      .map((entry) => entry.rawLabel?.trim() ?? '')
      .filter((label) => label.length > 1);

    const rawText = parsed.rawText?.trim() || structuredLineup.map((entry) => entry.displayName).join('\n');
    if (!rawText) {
      return {
        providerId: this.id,
        providerVersion: this.version,
        status: 'no_text',
        source: 'external_ocr',
        confidence: 0,
        reason: 'openai_vision_no_extractable_text',
        structuredLineup,
        structuredGenres,
      };
    }

    return {
      providerId: this.id,
      providerVersion: this.version,
      status: 'text_extracted',
      source: 'external_ocr',
      rawText,
      confidence: structuredLineup.length > 0 ? 0.92 : 0.7,
      reason: 'openai_vision_structured_extraction',
      structuredLineup,
      structuredGenres,
    };
  }
}

type TesseractModule = {
  recognize: (
    image: Buffer,
    lang?: string,
    options?: Record<string, string | number>,
  ) => Promise<{ data: { text: string } }>;
};

export class TesseractFlyerOcrProvider implements FlyerOcrProvider {
  readonly id = 'tesseract_local_v1';
  readonly version = '1.0.0';

  async extract(input: FlyerOcrInput & { imageBytes?: Buffer }): Promise<FlyerOcrResult> {
    if (!input.imageBytes?.length) {
      return {
        providerId: this.id,
        providerVersion: this.version,
        status: 'no_text',
        source: 'none',
        confidence: 0,
        reason: 'missing_image_bytes',
      };
    }

    try {
      const tesseract = (await import('tesseract.js')) as TesseractModule;
      const result = await tesseract.recognize(input.imageBytes, 'eng+deu');
      const rawText = result.data.text?.trim();
      if (!rawText) {
        return {
          providerId: this.id,
          providerVersion: this.version,
          status: 'no_text',
          source: 'external_ocr',
          confidence: 0,
          reason: 'tesseract_no_text',
        };
      }
      return {
        providerId: this.id,
        providerVersion: this.version,
        status: 'text_extracted',
        source: 'external_ocr',
        rawText,
        confidence: 0.55,
        reason: 'tesseract_raw_ocr',
      };
    } catch {
      return {
        providerId: this.id,
        providerVersion: this.version,
        status: 'pending_external',
        source: 'external_ocr',
        confidence: 0,
        reason: 'tesseract_unavailable',
      };
    }
  }
}

export function resolveConfiguredMediaOcrProviders(): FlyerOcrProvider[] {
  const providers: FlyerOcrProvider[] = [];
  const openAi = new OpenAiVisionFlyerOcrProvider();
  if (openAi.isConfigured()) {
    providers.push(openAi);
  }
  providers.push(new TesseractFlyerOcrProvider());
  return providers;
}

export function isMediaEvidenceProviderConfigured(): boolean {
  if (process.env.OPENAI_API_KEY?.trim()) {
    return true;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require.resolve('tesseract.js');
    return true;
  } catch {
    return false;
  }
}

export function resolveActiveMediaExtractionProviderId(): string {
  if (process.env.OPENAI_API_KEY?.trim()) {
    return 'openai_vision_v1';
  }
  return 'tesseract_local_v1';
}
