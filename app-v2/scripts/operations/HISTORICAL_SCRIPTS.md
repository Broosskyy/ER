# Historical operations scripts (pre–Phase 4.5.3)

The following one-off sprint/repair scripts remain in the repository for audit replay but are **excluded** from `npm run typecheck:operations`:

- `_affenkaefig-*`, `_bootshaus-*` (except sprint 4.5+), `_sprint33*`, `_sprint334*`, `_sprint335*`, `_migration-drift-audit-readonly.ts`, `_live-schema-audit-readonly.ts`, `_probe-ticket-platform-discovery.ts`

**Active / typechecked operations entry points** (see `tsconfig.operations.json`):

- `bootstrap-ops-supabase.ts`, `load-ops-env.ts`
- `repair-events.ts`, `run-*.ts`
- `_sprint4*`, `_sprint45*`, `_sprint451*`, `_sprint452*`, `_sprint453*`
- `_audit-*` (read-only production audits)

Re-run a historical script with `npx tsx` directly; do not expect it to pass strict project typecheck without restoration work.
