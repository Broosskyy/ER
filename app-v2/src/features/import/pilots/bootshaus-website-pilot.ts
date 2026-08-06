import {
  collectJsonLdNodes,
  extractJsonLdBlocks,
  parseJsonLdEvent,
} from '@/features/import/adapters/parsers/json-ld-parser';
import {
  createFieldEvidenceCandidate,
  createPilotImportRunId,
  type FieldEvidenceCandidate,
  type IdentityMatchSignal,
  type UnifiedImportResult,
} from '@/features/import/contracts';
import { GOLD_STANDARD_REFERENCE_EVENTS, PILOT_IMPORTER_VERSION, pilotFetchHtml } from './gold-standard-reference';

const IMPORTER_KEY = 'bootshaus-website';
const IMPORTER_VERSION = `${PILOT_IMPORTER_VERSION}-${IMPORTER_KEY}`;

function extractWebsiteMeta(html: string): Record<string, unknown> | null {
  const readMeta = (property: string): string | undefined => {
    const match =
      html.match(new RegExp(`property=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i')) ??
      html.match(new RegExp(`content=["']([^"']+)["'][^>]*property=["']${property}["']`, 'i'));
    return match?.[1]?.trim();
  };
  const title = readMeta('og:title') ?? html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
  const description = readMeta('og:description');
  const imageUrl = readMeta('og:image');
  if (!title && !description && !imageUrl) {
    return null;
  }
  return { title, description, imageUrl };
}

function pushEvidence(
  candidates: FieldEvidenceCandidate[],
  fieldName: string,
  raw: unknown,
  normalized: unknown,
  ref: { websiteUrl: string; eventId: string },
  strategy: string,
  type: FieldEvidenceCandidate['evidenceType'],
  confidence: number,
  inclusionReason: string,
): void {
  if (normalized === undefined || normalized === null || normalized === '') {
    return;
  }
  candidates.push(
    createFieldEvidenceCandidate({
      fieldName,
      rawValue: raw,
      normalizedValue: normalized,
      sourceId: 'pilot-bootshaus-website',
      sourceRole: 'official_website_source',
      originUrl: ref.websiteUrl,
      evidenceType: type,
      extractionStrategy: strategy,
      observedAt: new Date().toISOString(),
      importerVersion: IMPORTER_VERSION,
      confidence,
      reliability: confidence,
      eventIdentityMatch: ref.eventId,
      reviewState: 'not_reviewed',
      inclusionReason,
    }),
  );
}

export async function runBootshausWebsitePilotForEvent(
  eventKey: string,
): Promise<UnifiedImportResult | { error: string }> {
  const ref = GOLD_STANDARD_REFERENCE_EVENTS.find((e) => e.key === eventKey);
  if (!ref) {
    return { error: `Unknown event key: ${eventKey}` };
  }
  if (!ref.websiteUrl.includes('bootshaus.tv')) {
    return { error: `Bootshaus website pilot only supports bootshaus.tv URLs; got ${ref.websiteUrl}` };
  }

  const fetch = await pilotFetchHtml(ref.websiteUrl);
  const fieldEvidenceCandidates: FieldEvidenceCandidate[] = [];
  const diagnostics: UnifiedImportResult['extractionDiagnostics'] = [];
  const domainsPresent: string[] = [];

  if (fetch.error) {
    diagnostics.push({ code: 'FETCH_ERROR', message: fetch.error, surface: 'website' });
  }

  let jsonLdFields: Record<string, unknown> | null = null;
  if (fetch.html) {
    for (const block of extractJsonLdBlocks(fetch.html)) {
      for (const node of collectJsonLdNodes(block)) {
        jsonLdFields = parseJsonLdEvent(node, ref.websiteUrl).fields;
        break;
      }
      if (jsonLdFields) break;
    }
    const meta = extractWebsiteMeta(fetch.html) ?? {};
    const merged = { ...meta, ...jsonLdFields };

    pushEvidence(fieldEvidenceCandidates, 'title', merged.title, merged.title, ref, 'og_title_or_json_ld', 'html_text', 0.85, 'bootshaus.tv og:title');
    pushEvidence(fieldEvidenceCandidates, 'description', merged.description, merged.description, ref, 'og_description', 'html_text', 0.8, 'bootshaus.tv description');
    pushEvidence(fieldEvidenceCandidates, 'flyer', merged.imageUrl, merged.imageUrl, ref, 'og_image', 'flyer', 0.9, 'bootshaus.tv og:image');
    pushEvidence(fieldEvidenceCandidates, 'gallery', merged.imageUrl, merged.imageUrl, ref, 'og_image', 'flyer', 0.9, 'bootshaus.tv hero image');
    pushEvidence(fieldEvidenceCandidates, 'date_time', merged.startDate, merged.startDate, ref, 'json_ld_start', 'json_ld', 0.85, 'JSON-LD startDate when present');
    pushEvidence(fieldEvidenceCandidates, 'venue', merged.venueName, merged.venueName, ref, 'json_ld_venue', 'json_ld', 0.75, 'JSON-LD venue when present');
    pushEvidence(fieldEvidenceCandidates, 'location', merged.venueAddress, merged.venueAddress, ref, 'json_ld_address', 'json_ld', 0.75, 'JSON-LD address when present');
    pushEvidence(fieldEvidenceCandidates, 'ticket_destination', merged.ticketUrl, merged.ticketUrl, ref, 'json_ld_offer_url', 'json_ld', 0.7, 'Outbound ticket candidate from JSON-LD offer — not canonical CTA');

    if (merged.title) domainsPresent.push('title');
    if (merged.description) domainsPresent.push('description');
    if (merged.imageUrl) domainsPresent.push('flyer');
    if (merged.startDate) domainsPresent.push('date_time');
  }

  const identityCandidate = {
    candidateKey: `${ref.eventId}-bootshaus-website`,
    externalIds: [ref.websiteUrl],
    eventUrls: [fetch.finalUrl || ref.websiteUrl],
    title: fieldEvidenceCandidates.find((c) => c.fieldName === 'title')?.normalizedValue as string | undefined,
    startAt: fieldEvidenceCandidates.find((c) => c.fieldName === 'date_time')?.normalizedValue as string | undefined,
    venueName: fieldEvidenceCandidates.find((c) => c.fieldName === 'venue')?.normalizedValue as string | undefined,
    signals: ['official_website_url', 'event_specific_url'] satisfies IdentityMatchSignal[],
    confidence: 0.85,
  };

  return {
    contractVersion: 'phase481-v1',
    stagingOnly: true,
    sourceIdentity: {
      sourceId: 'pilot-bootshaus-website',
      sourceName: 'Bootshaus Website Pilot',
      connectorKey: 'club_website',
      importerKey: IMPORTER_KEY,
      sourceRoles: ['official_website_source', 'organizer', 'promoter'],
    },
    importRunIdentity: {
      runId: createPilotImportRunId(IMPORTER_KEY),
      channel: 'automatic_source_import',
      startedAt: new Date().toISOString(),
      pilotOnly: true,
    },
    rawEvidenceReferences: [
      {
        url: ref.websiteUrl,
        fetchedAt: new Date().toISOString(),
        httpStatus: fetch.status,
        finalUrl: fetch.finalUrl,
        error: fetch.error,
      },
    ],
    eventIdentityCandidates: [identityCandidate],
    fieldEvidenceCandidates,
    relationshipCandidates: [
      {
        relationshipType: 'organizer',
        entityLabel: 'Bootshaus',
        sourceId: 'pilot-bootshaus-website',
        evidenceUrl: ref.websiteUrl,
        confidence: 0.8,
      },
    ],
    reviewFindings: [],
    extractionDiagnostics: diagnostics,
    completeness: {
      domainsPresent,
      domainsMissing: ['lineup', 'genre', 'ticket_phases', 'price'].filter((d) => !domainsPresent.includes(d)),
      completenessScore: domainsPresent.length / 8,
      blockedSurfaces: [],
    },
    confidence: 0.8,
    importerVersion: IMPORTER_VERSION,
  };
}

export async function runBootshausWebsitePilotAll(): Promise<UnifiedImportResult[]> {
  const results: UnifiedImportResult[] = [];
  for (const ref of GOLD_STANDARD_REFERENCE_EVENTS) {
    if (!ref.websiteUrl.includes('bootshaus.tv')) {
      continue;
    }
    const result = await runBootshausWebsitePilotForEvent(ref.key);
    if ('error' in result) {
      continue;
    }
    results.push(result);
  }
  return results;
}
