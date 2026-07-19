# Eternal Rave v0.2.0-rc1 — Release Candidate

## Sprint 12 Import Pipeline

This release candidate includes the complete Sprint 12 import system (12A–12D):

- Import foundation (jobs, records, logs)
- Adapters (JSON-LD, RSS, Atom, iCal, CSV, API JSON)
- Normalization and validation
- Entity matching and duplicate detection
- Admin review and import operations

## Validation Status

- **Local:** 130/130 tests, TypeScript, ESLint (0 errors), Web + Android export
- **Migrations:** Applied and verified on fresh PostgreSQL
- **RLS:** Verified locally with mocked JWT (8 policy tests)
- **Remote Supabase Staging:** Pending — requires staging credentials

See `SPRINT_12_5_PRODUCTION_VALIDATION_REPORT.md` for full details.

## Deployment Prerequisites

1. Create separate Supabase staging project
2. Set environment variables per `.env.example`
3. Run `npm run validate:staging:remote`
4. Create admin test accounts with roles in `app_metadata.role`
5. Run E2E import test on staging

## Not Included

- Scheduler / automatic imports
- Auto-publish
- User accounts / CRM
- Sprint 13+ features
