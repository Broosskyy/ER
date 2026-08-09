# Source Adapter Onboarding

Verbindliche Kurzanleitung für neue Quellen im Generic Truth Pipeline Modell.

## 1. Quelle in Registry erfassen

`admin_sources` / `SourceRegistryEntry` mit Lifecycle, Health und `publishMode`.

## 2. Source Capabilities deklarieren

Connector-Key (`ticket_platform`, `club_website`, …) und Rolle (`SourceRole` in `evidence-types.ts`).

## 3. Fetch und Parser implementieren

`SourceModule` oder Ticket-Platform-Adapter: nur Fetch + Parse. Keine Publish-Entscheidungen.

## 4. Evidence Bundle erzeugen

Implementiere `SourceEvidenceAdapter` oder mappe in `canonicalImportEventToEvidenceBundle`:

- `verifiedAt` und `observedAt` (kein `Date.now()`-Fallback in Produktion)
- getrennte URL-Rollen: `publicCtaCandidateUrl` vs `checkoutEvidenceUrl`
- `excludedProducts` für Add-ons
- `contamination` diagnostics bei Kollisionen

## 5. Fixture hinzufügen

HTML/JSON unter `connectors/.../fixtures/` — synthetische Namen bevorzugt (`example-events.test`).

## 6. Conformance Tests

- `generic-truth-pipeline/__tests__/source-adapter-conformance.test.ts`
- bestehende `phase48653-*` Regression Suites

## 7. Shadow Report prüfen

`_phase4866-generic-shadow-audit.ts` — keine unkontrollierten `wouldChange` ohne Review.

## 8. Canary-Allowlist

`EXPO_PUBLIC_GENERIC_TRUTH_PIPELINE_SOURCE_IDS` + `MODE=controlled` + niedriger Canary-Prozent.

## 9. Controlled Rollout

Nur freigegebene Source-IDs, Feldgruppen schrittweise.

## 10. Automatic Eligibility

Nur `exact`/`corroborated`, Manual Locks, Collision-Gates aktiv.

## Definition of Done

- Keine Änderung an zentraler Consumer-Logik pro Quelle
- Keine Event-ID-Ausnahme
- Identity + Freshness + URL-Rollen nachweisbar
- Conformance Suite grün
- Shadow-Lauf ohne Writes (`productionMutationsInThisRun: 0`)
