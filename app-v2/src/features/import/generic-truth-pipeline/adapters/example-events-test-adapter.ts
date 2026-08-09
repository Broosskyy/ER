import type {
  SourceEvidenceAdapter,
  SourceEvidenceBundle,
  SourceEvidenceFetchInput,
} from '../source-evidence-contract';

/**
 * Synthetic adapter for conformance tests — no real provider or venue names.
 */
export const exampleEventsTestAdapter: SourceEvidenceAdapter = {
  adapterId: 'example-events.test',
  supportedSourceRoles: ['official_website_source', 'ticket_platform'],
  async fetchAndParse(input: SourceEvidenceFetchInput): Promise<SourceEvidenceBundle | null> {
    const observedAt = input.observedAt ?? '2026-08-06T12:00:00.000Z';
    return {
      sourceId: 'source-example-events-test',
      sourceRole: 'official_website_source',
      sourceUrl: input.sourceUrl,
      observedAt,
      verifiedAt: observedAt,
      identity: {
        pageTitle: "Synth Artist's Night — Official",
        listRowTitle: 'Synth Artist Night',
        eventDate: '2026-09-15T20:00:00.000Z',
        endDate: '2026-09-16T04:00:00.000Z',
        venueName: 'Example Hall',
        organizerName: 'Example Promoter',
        officialOutboundRelationship: 'linked',
      },
      tickets: {
        publicCtaCandidateUrl: 'https://checkout.example-events.test/admission',
        checkoutEvidenceUrl: 'https://checkout.example-events.test/admission',
        admissionProducts: [{ name: 'Standard Admission', priceCents: 1500, mandatory: true }],
        excludedProducts: ['Locker', 'Parking'],
        priceText: 'ab 15,00 €',
        phases: [
          {
            id: 'admission-1',
            name: 'Standard Admission',
            sortOrder: 0,
            kind: 'regular',
            priceAmount: 15,
            priceCurrency: 'EUR',
            priceLabel: '15,00 €',
          },
        ],
      },
      content: {
        description: 'A night of synthetic beats and uptempo energy.',
        genreLabels: ['Hard Techno', 'Uptempo'],
        minimumAge: 18,
      },
      provenance: {
        extractionStrategy: 'example_fixture',
        evidenceType: 'official_event_page',
        importerVersion: 'example-events.test',
        confidence: 0.95,
      },
      diagnostics: ['synthetic_adapter'],
      evidenceOrigin: 'example_fixture',
      identityEvidenceOrigin: 'example_fixture',
      sourceNativeEvidence: true,
      legacyFallbackUsed: false,
      criticalIdentitySelfDerived: false,
    };
  },
};
