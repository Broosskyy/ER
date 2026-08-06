/**
 * Phase 4.8.6.5.3 — Core truth pipeline audit (read-only).
 */
import './bootstrap-ops-supabase';

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapEventRowToAdminRecord, type EventRow } from '@/data/mappers/event-mapper';
import { readCanonicalTicket } from '@/features/events/domain/canonical-ticket-read';
import {
  auditConsumerTicketPresentationForEvent,
  presentationToConsumerSlots,
} from '@/features/events/formatting/resolve-consumer-ticket-presentation';
import { localizeConsumerTicketPhaseLabel } from '@/features/events/formatting/ticket-phase-consumer-bridge';
import { assessTicketEvidencePersistence } from '@/features/import/domain/ticket-evidence-provenance';
import { evaluateEventEvidenceIdentityGate } from '@/features/import/domain/event-evidence-identity-gate';
import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'docs/real-data');
const SCREENSHOT_DIR = join(OUT, 'phase48653-screenshots');

export const REGRESSION_FIXTURE_EVENT_IDS = {
  underland: 'evt-1785389049895-4mb7dub',
  elektrokueche: 'evt-1785389055557-ux20897',
  levi: 'evt-1785339383539-0lxvjlp',
  bc173: 'evt-1785339410908-9691748',
  r3hab: 'evt-1785339421539-k3swcrl',
  sommerfest: 'evt-1785339391167-tfaixrr',
  mdma: 'evt-1785389052337-0gv1iz1',
} as const;

const ACCEPTANCE_EVENT_IDS = Object.values(REGRESSION_FIXTURE_EVENT_IDS);

let productionMutationsInThisRun = 0;

function writeJson(name: string, data: unknown): void {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, name), JSON.stringify(data, null, 2));
}

async function loadEventRow(eventId: string): Promise<EventRow | null> {
  const { data, error } = await opsClient().from('events').select('*').eq('id', eventId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as EventRow | null) ?? null;
}

export async function auditRegressionFixtures(): Promise<Record<string, unknown>> {
  const events = [];
  for (const eventId of ACCEPTANCE_EVENT_IDS) {
    const row = await loadEventRow(eventId);
    if (!row) {
      events.push({ eventId, observedAt: new Date().toISOString(), missing: true });
      continue;
    }
    const admin = mapEventRowToAdminRecord(row);
    const canonical = readCanonicalTicket({
      ticketUrl: admin.ticketUrl,
      websiteUrl: admin.websiteUrl,
      priceText: admin.priceText,
      ticketStatus: admin.ticketStatus,
      ticketPhases: admin.ticketPhases,
    });
    const presentationSource = {
      id: admin.id,
      title: admin.title,
      priceText: admin.priceText,
      ticketUrl: canonical.publicCtaUrl ?? admin.ticketUrl,
      officialEventUrl: admin.websiteUrl,
      ticketPhases: admin.ticketPhases,
      timezone: admin.timezone,
    };
    const { presentation, audit: layoutAudit } = auditConsumerTicketPresentationForEvent(
      presentationSource,
      { mode: 'external' },
    );
    const phaseLabels = (admin.ticketPhases ?? []).map((phase) => ({
      raw: phase.name,
      consumer: localizeConsumerTicketPhaseLabel(phase.name),
      observedAt: new Date().toISOString(),
    }));

    events.push({
      eventId,
      title: admin.title,
      observedAt: new Date().toISOString(),
      canonicalTicket: {
        publicCtaUrl: canonical.publicCtaUrl,
        checkoutEvidenceUrl: canonical.checkoutEvidenceUrl,
        priceText: canonical.priceText,
        destinationClass: canonical.destinationClass,
      },
      consumerPresentation: presentationToConsumerSlots(presentation),
      layoutContractPassed: layoutAudit.passed,
      phaseLabels,
      sourceTruthNote: 'Compared against live DB row; importer preview not mutated',
    });
  }

  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.5.3',
    productionMutationsInThisRun,
    rolloutActivated: false,
    events,
  };
  writeJson('_phase48653_regression_fixtures.json', result);
  return result;
}

export async function auditIdentityGateSamples(): Promise<Record<string, unknown>> {
  const samples = [
    {
      label: 'mdma_chrome_block',
      gate: evaluateEventEvidenceIdentityGate({
        event: {
          eventId: REGRESSION_FIXTURE_EVENT_IDS.mdma,
          title: 'MDMA – Musik Die Mich Antreibt 10.10.26',
          startDate: '2026-10-10T20:00:00.000Z',
          venueName: 'Bootshaus',
        },
        evidence: {
          pageTitle: 'CHROME COLOGNE',
          listRowTitle: 'CHROME COLOGNE',
          eventDate: '2026-10-10T20:00:00.000Z',
          venueName: 'Bootshaus',
        },
        evidenceUrl: 'https://bootshaus-club.ticket.io/Atz0dHLX/',
      }),
      observedAt: new Date().toISOString(),
    },
  ];

  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.5.3',
    productionMutationsInThisRun,
    samples,
  };
  writeJson('_phase48653_identity_gate.json', result);
  return result;
}

export async function auditPersistenceAssessment(): Promise<Record<string, unknown>> {
  const assessment = assessTicketEvidencePersistence();
  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.5.3',
    productionMutationsInThisRun,
    ...assessment,
    readinessBlocked: assessment.persistenceGap,
  };
  writeJson('_phase48653_persistence_assessment.json', result);
  return result;
}

export async function readiness(): Promise<Record<string, unknown>> {
  const fixtures = await auditRegressionFixtures();
  const identity = await auditIdentityGateSamples();
  const persistence = await auditPersistenceAssessment();

  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const screenshotManifest = {
    generatedAt: new Date().toISOString(),
    directory: 'docs/real-data/phase48653-screenshots',
    events: ACCEPTANCE_EVENT_IDS.map((eventId) => ({
      eventId,
      mobilePath: `docs/real-data/phase48653-screenshots/${eventId}-mobile.png`,
      webPath: `docs/real-data/phase48653-screenshots/${eventId}-web.png`,
      observedAt: new Date().toISOString(),
      browserVerified: false,
      screenshotGenerated: false,
      note: 'Screenshot paths reserved; generation requires manual browser capture',
    })),
  };
  writeJson('_phase48653_screenshot_manifest.json', screenshotManifest);

  const layoutContractPassed = (fixtures.events as Array<{ layoutContractPassed?: boolean }>).every(
    (event) => event.layoutContractPassed !== false,
  );

  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.5.3',
    productionMutationsInThisRun,
    rolloutActivated: false,
    layoutContractPassed,
    browserVerified: false,
    verificationMode: 'not_browser_verified',
    manualReviewPending: true,
    persistenceGap: persistence.persistenceGap === true,
    verdict: layoutContractPassed && !persistence.persistenceGap
      ? 'READY_FOR_MANUAL_VISUAL_REVIEW'
      : 'BLOCKED',
    sections: {
      unitTests: 'see CI vitest phase48653-* suites',
      sourceTruth: '_phase48653_regression_fixtures.json',
      identity: '_phase48653_identity_gate.json',
      layoutContract: '_phase48652_visual_verification.json',
      browserScreenshots: '_phase48653_screenshot_manifest.json',
      manualAcceptance: 'pending',
    },
    identity,
    persistence,
  };
  writeJson('_phase48653_readiness.json', result);
  return result;
}

export async function report(): Promise<void> {
  const ready = await readiness();
  console.log(
    JSON.stringify(
      {
        phase: '4.8.6.5.3',
        productionMutationsInThisRun,
        rolloutActivated: false,
        manualReviewPending: ready.manualReviewPending,
        layoutContractPassed: ready.layoutContractPassed,
        persistenceGap: ready.persistenceGap,
        verdict: ready.verdict,
      },
      null,
      2,
    ),
  );
}

const command = process.argv[2] ?? 'report';
void (async () => {
  productionMutationsInThisRun = 0;
  switch (command) {
    case 'regression-fixtures':
      console.log(JSON.stringify(await auditRegressionFixtures(), null, 2));
      break;
    case 'identity-gate':
      console.log(JSON.stringify(await auditIdentityGateSamples(), null, 2));
      break;
    case 'persistence':
      console.log(JSON.stringify(await auditPersistenceAssessment(), null, 2));
      break;
    case 'readiness':
      console.log(JSON.stringify(await readiness(), null, 2));
      break;
    case 'report':
    default:
      await report();
      break;
  }
})();
