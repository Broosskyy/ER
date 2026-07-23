# ER-013 — Connector Framework — Completion Report

**Epic:** ER-013 Connector Framework (Parts 1–4)  
**Date:** 22 July 2026  
**Repository:** `C:/ER`

---

## Repository Analysis

ER-013 built on ER-012 Source Foundation and existing Admin CMS patterns:

- **Source domain** — metadata registry; connector assignment stored in `sourceConfig.connector`
- **Import pipeline** — unchanged; connectors sit above adapters in future epics
- **Admin CMS** — Source CMS used as template for Connectors section
- **DI** — `registry.ts` singleton exports; role-aware admin services
- **Permissions** — `sources:read` / `sources:write` reused for connector admin (no permission redesign)

---

## Architecture Validation

| Layer | Responsibility | Verified |
|-------|----------------|----------|
| Source | Metadata only | ✓ |
| Connector | Execution abstraction only | ✓ |
| Registry | Discovery only | ✓ |
| Factory | Construction only | ✓ |
| Context | Execution input only | ✓ |
| Result | Execution output only (candidates) | ✓ |
| Review | Editorial process (unchanged) | ✓ |
| Event | Published entity (unchanged) | ✓ |

No provider-specific logic. No execution engine. No circular dependencies.

---

## Framework Components

| Component | Location |
|-----------|----------|
| Connector contract | `contracts/connector.ts` |
| Context / Result | `contracts/connector-context.ts`, `connector-result.ts` |
| Lifecycle / Capabilities | `domain/connector-lifecycle.ts`, `connector-capabilities.ts` |
| Configuration | `domain/connector-config.ts` |
| Validation | `domain/connector-validation.ts` |
| Errors | `errors/connector-errors.ts` |
| Base connector | `base/base-connector.ts` |
| Registry / Factory | `registry/` |
| Framework service | `services/connector-framework-service.ts` |
| Admin service | `services/connector-admin-service.ts` |
| Config store | `admin/connector-config-store.ts` |
| Health / labels | `admin/connector-health.ts`, `connector-labels.ts` |

---

## Admin Integration

- **Routes:** `/admin/connectors`, `/admin/connectors/[key]`
- **Navigation:** AdminShell → Connectors (after Sources)
- **Permissions:** `canViewConnectors` / `canManageConnectors` → `sources:read` / `sources:write`
- **Source CMS:** Connector assignment section on `/admin/sources/[id]`
- **UX:** Clear banners — Framework Ready, Configuration Complete, Execution Not Yet Available
- **No execution controls** — no run/test/fetch buttons

---

## Configuration Management

- Global and per-connector framework settings
- AsyncStorage persistence (`app.connectorFrameworkAdminConfig`)
- Source connector assignment via `SourceService.updateConnectorAssignment()`
- Stored in `ImportSourceConfig.connector` (no new DB migration)

---

## Capability Viewer

Read-only display on connector detail screen with descriptions for all capability flags plus manual/scheduled execution status.

---

## Diagnostics

`ConnectorAdminService.getDiagnostics()` — registration verification, configuration validation, capability consistency, registry integrity. No external requests.

---

## Validation

- Framework validation integrated into admin service and CMS
- Configuration issues displayed inline on list and detail screens
- Source assignment validates connector key exists in registry

---

## Permissions

Existing `source_manager`, `admin`, `owner` roles can view and manage connectors. `viewer` can view only. No new permission types.

---

## Testing

| Suite | Tests |
|-------|-------|
| `connector-framework.test.ts` | 15 |
| `connector-admin-service.test.ts` | 7 |
| `connector-health.test.ts` | 3 |
| `admin-guard.test.ts` | +2 route cases |
| `admin-permissions.test.ts` | +connector permission cases |
| **Total** | **490** (was 480) |

---

## Regression Results

| Check | Result |
|-------|--------|
| Typecheck | PASS |
| Tests | 490/490 PASS |
| release:check | PASS |
| Migrations | PASS (21) |
| Source management | Unchanged (extended assignment) |
| Import workflow | Unchanged |
| No provider logic | ✓ |
| No execution engine | ✓ |

---

## Documentation

- `app-v2/docs/connector-framework.md` — full architecture + admin section
- `app-v2/docs/sources-domain.md` — updated deferred section
- `AI_CONTEXT.md` — ER-013 complete status

---

## AI Context Updates

- Connector Framework purpose and boundaries documented
- Extension philosophy: register in `register-connectors.ts`, no framework changes
- Deferred work listed for ER-014+

---

## Deferred Work

Website, RSS, JSON API, iCal, Ticket Platform, Social, AI connectors; authentication providers; HTTP clients; schedulers; queues; workers; execution engine; normalization; duplicate resolution; publishing; endpoint persistence; connector execution from Admin.

---

## Known Limitations

1. No production connectors registered — registry list is empty until ER-014+
2. Configuration settings are placeholders — not enforced at runtime
3. Health states reflect framework readiness only — not live provider health
4. Config persists in AsyncStorage only — no Supabase sync yet
5. `ConnectorFrameworkService.executeConnector()` exists but is not exposed in Admin

---

## Recommendations for ER-014

1. Register first provider connector (e.g. RSS or Website) in `register-connectors.ts`
2. Define Source `sourceType` → `connectorKey` resolution strategy
3. Bridge `ConnectorResult.candidates` → `import_records`
4. Introduce execution engine with job runner (separate from admin)
5. Add Supabase persistence for connector config when multi-admin sync is needed

---

## Files Changed

**Created (Parts 1–2):** `features/connectors/**` (framework)  
**Created (Part 3):**

```
app-v2/app/admin/connectors/index.tsx
app-v2/app/admin/connectors/[key].tsx
app-v2/src/features/connectors/admin/connector-config-store.ts
app-v2/src/features/connectors/admin/connector-config-validation.ts
app-v2/src/features/connectors/admin/connector-health.ts
app-v2/src/features/connectors/admin/connector-labels.ts
app-v2/src/features/connectors/domain/connector-config.ts
app-v2/src/features/connectors/services/connector-admin-service.ts
app-v2/src/features/connectors/__tests__/connector-admin-service.test.ts
app-v2/src/features/connectors/__tests__/connector-health.test.ts
```

**Modified:**

```
app-v2/src/features/admin/admin-permissions.ts
app-v2/src/features/admin/admin-route-utils.ts
app-v2/src/features/admin/components/AdminShell.tsx
app-v2/app/admin/sources/[id].tsx
app-v2/src/features/sources/services/source-service.ts
app-v2/src/features/import/models/source-config.ts
app-v2/src/data/repositories/registry.ts
app-v2/docs/connector-framework.md
AI_CONTEXT.md
```

---

## Acceptance Criteria

- ✓ Connector Framework stable and reusable
- ✓ Registry and Factory operational
- ✓ Context and Result provider-independent
- ✓ Admin integration complete
- ✓ Documentation complete
- ✓ All tests pass
- ✓ No regressions
- ✓ No provider-specific logic
- ✓ Repository ready for ER-014
