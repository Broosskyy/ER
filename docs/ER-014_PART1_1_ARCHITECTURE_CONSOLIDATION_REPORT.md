# ER-014 Part 1.1 — Architecture Consolidation Patch Report

**Epic:** ER-014 Website Connector (Part 1.1)  
**Date:** 22 July 2026  
**Repository:** `C:/ER`

---

## connectorKey Resolution

**Rule established:** Runtime connector resolution MUST use `Endpoint.connectorKey` only.

### Changes

- `resolveConnectorKeyForEndpoint()` — reads `connectorKey` only; throws `EndpointConnectorResolutionError` if missing
- Removed runtime fallback to `ENDPOINT_TYPE_CONNECTOR_KEYS` via `endpointType`
- Added `applyDefaultConnectorKeyForEndpoint()` — for creation/migration only
- `suggestConnectorKeyForEndpointType()` — developer convenience only
- `EndpointConnectorResolution.resolvedFrom` removed — no ambiguity

### `ENDPOINT_TYPE_CONNECTOR_KEYS` usage (non-runtime only)

- Default creation
- Migrations
- Validation hints
- Developer convenience

---

## ConnectorContext Immutability

`ConnectorContext` and nested types updated to `readonly` fields:

- `readonly source: Readonly<SourceRecord>`
- `readonly endpoint?: Readonly<ConnectorEndpointRef>`
- `readonly execution`, `runtime`, `authentication`, `rateLimit` — all readonly
- `log` callback remains the only side-effect channel

Connectors receive immutable input and must not mutate context fields.

---

## Connector Developer Contract

Documented in `connector-framework.md`:

**MUST:** stateless connectors or fresh Factory instances; return candidates only; read-only context; use HttpClient for transport.

**MUST NOT:** mutate Source/Endpoint/Context; write DB; create Events; normalize; resolve duplicates; publish; bypass framework or HttpClient.

**Responsibility boundary:** Endpoint → Transport → Raw acquisition → AcquisitionCandidate.

Architecture frozen for ER-014 through ER-020.

---

## Documentation

Updated:

- `app-v2/docs/connector-framework.md` — immutable context, developer contract, architecture freeze
- `app-v2/docs/endpoints-domain.md` — connectorKey runtime rule, freeze notice
- `AI_CONTEXT.md` — ER-014 endpoint domain, architecture freeze

---

## Validation

| Check | Result |
|-------|--------|
| Runtime resolves from `connectorKey` only | ✓ |
| `endpointType` not used at runtime | ✓ |
| `ConnectorContext` read-only | ✓ |
| Typecheck | PASS |
| Tests | PASS |
| release:check | PASS |
| No functional behaviour change | ✓ |
| No HTTP / execution added | ✓ |

---

## Files Changed

**Modified:**

```
app-v2/src/features/endpoints/domain/endpoint-connector-resolution.ts
app-v2/src/features/endpoints/domain/endpoint-types.ts
app-v2/src/features/endpoints/index.ts
app-v2/src/features/endpoints/__tests__/endpoint-architecture.test.ts
app-v2/src/features/connectors/contracts/connector-context.ts
app-v2/docs/connector-framework.md
app-v2/docs/endpoints-domain.md
AI_CONTEXT.md
docs/ER-014_PART1_1_ARCHITECTURE_CONSOLIDATION_REPORT.md
```

**Not modified:** Connector framework services, Source domain, Import pipeline, Admin CMS, HTTP contracts (interfaces only unchanged).

---

## Acceptance Criteria

- ✓ `connectorKey` is the single runtime source of truth
- ✓ `ConnectorContext` is immutable
- ✓ Connector responsibilities explicitly documented
- ✓ No behaviour changes introduced
- ✓ Architecture frozen for ER-014 through ER-020
