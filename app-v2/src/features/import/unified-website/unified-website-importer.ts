import {
  createPilotImportRunId,
  type UnifiedImportResult,
} from '@/features/import/contracts';

import { extractDetailPage } from './detail-extraction';
import { assembleFieldEvidence } from './evidence-assembler';
import { buildRelationshipCandidates, resolveSourceRoles } from './relationship-extraction';
import { featureFlags } from '@/core/config/feature-flags';
import { UNIFIED_WEBSITE_IMPORTER_VERSION } from './types';
import type { UnifiedWebsiteImportContext } from './types';

const IMPORTER_KEY = 'official-website';

export interface UnifiedWebsiteImportInput {
  context: UnifiedWebsiteImportContext;
  html: string;
  fetchMeta: {
    status: number;
    finalUrl: string;
    error?: string;
  };
  /** When true and publish flags allow, marks import as proposal-ready (still dry-run by default). */
  proposalMode?: boolean;
}

export function runUnifiedWebsiteImport(input: UnifiedWebsiteImportInput): UnifiedImportResult {
  const { context, html, fetchMeta } = input;
  const proposalMode = input.proposalMode === true && featureFlags.unifiedWebsitePublishEnabled;
  const detail = extractDetailPage(html, fetchMeta.finalUrl || context.websiteUrl);
  const { candidates, diagnostics } = assembleFieldEvidence(detail, context);

  if (fetchMeta.error) {
    diagnostics.push({ code: 'FETCH_ERROR', message: fetchMeta.error, surface: 'website' });
  }

  const sourceRoles = resolveSourceRoles(context.websiteUrl);

  return {
    contractVersion: 'phase481-v1',
    stagingOnly: !proposalMode,
    sourceIdentity: {
      sourceId: context.sourceId,
      sourceName: context.sourceName,
      connectorKey: 'club_website',
      importerKey: IMPORTER_KEY,
      sourceRoles,
    },
    importRunIdentity: {
      runId: createPilotImportRunId(`${IMPORTER_KEY}-${context.eventId}`),
      channel: 'automatic_source_import',
      startedAt: new Date().toISOString(),
      pilotOnly: !proposalMode,
    },
    rawEvidenceReferences: [
      {
        url: context.websiteUrl,
        fetchedAt: new Date().toISOString(),
        httpStatus: fetchMeta.status,
        finalUrl: fetchMeta.finalUrl,
        error: fetchMeta.error,
      },
    ],
    eventIdentityCandidates: [
      {
        candidateKey: `${context.eventId}-official-website`,
        externalIds: [context.websiteUrl],
        eventUrls: [fetchMeta.finalUrl || context.websiteUrl],
        title: candidates.find((c) => c.fieldName === 'title')?.normalizedValue as string | undefined,
        startAt: candidates.find((c) => c.fieldName === 'date_time')?.normalizedValue as string | undefined,
        venueName: candidates.find((c) => c.fieldName === 'venue')?.normalizedValue as string | undefined,
        signals: ['official_website_url', 'event_specific_url'],
        confidence: 0.88,
      },
    ],
    fieldEvidenceCandidates: candidates,
    lineupEvidenceEntries:
      detail.lineup?.state === 'explicit_artists' ? detail.lineup.entries : undefined,
    relationshipCandidates: buildRelationshipCandidates(context.websiteUrl, context.sourceId, detail),
    reviewFindings: [],
    extractionDiagnostics: diagnostics,
    completeness: {
      domainsPresent: candidates.map((c) => String(c.fieldName)),
      domainsMissing: [],
      completenessScore: Math.min(1, candidates.length / 12),
      blockedSurfaces: [],
    },
    confidence: 0.85,
    importerVersion: `${UNIFIED_WEBSITE_IMPORTER_VERSION}-${IMPORTER_KEY}`,
  };
}

export function buildImportContextFromRef(ref: {
  key: string;
  eventId: string;
  websiteUrl: string;
  ticketUrl?: string;
  label?: string;
}): UnifiedWebsiteImportContext {
  const adapterHost = new URL(ref.websiteUrl).hostname;
  return {
    sourceId: `pilot-official-website-${ref.key}`,
    sourceName: `${adapterHost} Official Website`,
    eventId: ref.eventId,
    websiteUrl: ref.websiteUrl,
    verifiedTicketUrl: ref.ticketUrl,
  };
}

export function buildImportContextForIntegratedShadow(input: {
  sourceId: string;
  sourceName: string;
  eventId: string;
  websiteUrl: string;
  verifiedTicketUrl?: string;
}): UnifiedWebsiteImportContext {
  return {
    sourceId: input.sourceId,
    sourceName: input.sourceName,
    eventId: input.eventId,
    websiteUrl: input.websiteUrl,
    verifiedTicketUrl: input.verifiedTicketUrl,
  };
}
