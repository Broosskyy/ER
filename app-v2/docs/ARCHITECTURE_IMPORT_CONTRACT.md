# Architecture — Unified Import Contract

Version: `phase481-v1`

Every importer returns `UnifiedImportResult` with source identity, import run identity,
raw evidence references, identity candidates, field evidence candidates, relationships,
review findings, diagnostics, completeness, confidence, and importer version.

**Importers never write canonical data directly.**

Channels: `manual_admin_import`, `automatic_source_import`, `ai_assisted_import` (future).

See `src/features/import/contracts/unified-import-result.ts`.
