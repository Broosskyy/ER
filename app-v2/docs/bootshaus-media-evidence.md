# Bootshaus Golden Path — Media Evidence

Generic media-evidence step for verified official event flyers.

## Pipeline

`Official Connector → Official Text/Metadata Evidence → Official Event Image → MediaEvidenceExtractor → verified media evidence → Golden Builder → Content Quality Gate → Consumer Preview → Noop Persistence`

## Contract

`EventMediaEvidence` (`media-evidence-types.ts`) stores:

- `sourceImageUrl`, `imageFingerprint`, `observedAt`, `extractionObservedAt`
- `extractionProvider`, `rawText`
- `lineupCandidates`, `genreCandidates`, `rejectedCandidates`, `confidence`, `status`

## Providers

Configured via existing flyer OCR abstraction:

1. `openai_vision_v1` when `OPENAI_API_KEY` is set (`MEDIA_EVIDENCE_OPENAI_MODEL` optional, default `gpt-4o-mini`)
2. `tesseract_local_v1` fallback (`tesseract.js` dev dependency) — poor on stylized club flyers

Stylized Bootshaus flyers require vision (`OPENAI_API_KEY`). Tesseract alone is insufficient for Loonyland acceptance.

## Merge rules

Line-up priority:

1. structured official evidence
2. verified official media evidence (`inclusionReason: official_media`)
3. official lineup text blocks
4. title inference

Genres: structured official → explicit media genres (normalized) → official text. Never inferred from artists, venue, or organizer.

## Offline replay

Uses `app-v2/.tmp/bootshaus-live-capture.json` only. One HTTPS image fetch per unique URL, cached under `app-v2/.tmp/media-cache/`.
