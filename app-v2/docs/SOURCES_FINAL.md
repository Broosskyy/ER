# Sources Final

**Sprint:** ADMIN EVENT REVIEW + MODERATION + SOURCES FINAL  
**Date:** 2026-07-26  
**Status:** Complete

## Summary

Administrators can browse and manage event sources using the existing source domain. No crawlers or live import execution in this sprint.

## Route

| Route | Screen |
|-------|--------|
| `/admin/sources` | Source list |
| `/admin/sources/[id]` | Source detail (existing) |
| `/admin/sources/new` | Create source (existing, role-gated) |

## Source card fields

- Name (`displayName`)
- Typ (`sourceType` → German label)
- Status (aktiv / pausiert / Fehler / deaktiviert)
- Letzte Aktualisierung (`lastImportAt` or „Noch kein Import“)
- Aktiv/Inaktiv (`enabled`)
- Beschreibung via detail screen

## Filters

- Suche (Name, Slug, URL, Typ)
- Status: Alle / Aktiv / Inaktiv / Archiviert
- Typ (first 4 source types)
- Parser (first 4 parser types)
- Sortierung (priority, trustScore, displayName, …)

## Actions

- Konfigurieren → source detail
- Erstellen (admin/manager role only)

No „Synchronisieren“ in list view — sync is prepared on card component but not wired to crawlers.

## Components reused

- `EventSourceCard`
- `SourceStatusBadge`
- `AdminEmptyState` / `AdminLoadingState` / `AdminErrorState`

## Implementation

- Screen: `src/features/admin/components/AdminSourcesContent.tsx`
- Route: `app/admin/sources/index.tsx`
- Mapper: `mapSourceRecordToViewModel()`
- Service: `sourceService.listForAdmin()`

## Tests

- `source-foundation.test.ts` (existing)
- `er012-1-consolidation.test.ts` (existing)

## QA screenshots

See `docs/visual-qa/admin-review-final/`:

- `admin-sources-desktop-light.png`
