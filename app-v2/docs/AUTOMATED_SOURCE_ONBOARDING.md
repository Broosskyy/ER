# Automated Source Onboarding

## Goal

Administrators submit a URL; the system probes the site, detects platform/strategy, generates a **declarative source configuration**, runs a **dry-run**, and routes to review or ready.

## Flow

```
URL submitted → normalize + SSRF check → onboarding job
  → probing → discovered → config_generated → dry_run
  → review_required | ready → (manual) enabled | rejected
```

## Components

| Component | Path |
|-----------|------|
| Domain types | `src/features/source-onboarding/domain/types.ts` |
| URL security | `src/features/source-onboarding/security/url-normalizer.ts` |
| Discovery engine | `src/features/source-onboarding/discovery/source-discovery-engine.ts` |
| Config generator | `src/features/source-onboarding/config/config-generator.ts` |
| Dry-run | `src/features/source-onboarding/dry-run/source-onboarding-dry-run.ts` |
| Service | `src/features/source-onboarding/services/source-onboarding-service.ts` |
| Admin wizard | `src/features/source-onboarding/admin/SourceOnboardingWizard.tsx` |

## Admin entry point

`/admin/sources/new` — Source Discovery wizard (calls `sourceOnboardingService.discoverFromUrl`).

## Persistence

`source_onboarding_jobs` table (migration `20260765000000`). Production runtime uses `SupabaseSourceOnboardingRepository` when `VITEST !== 'true'`; in-memory only in unit tests. Apply migration `20260766000000` for RLS policies and service-role grants.

## Limits

Automatic discovery does **not** guarantee every website works without adjustment. Known technical patterns (JSON-LD, WordPress/Tribe) should need only configuration. New or protected platforms may require a small platform adapter.
