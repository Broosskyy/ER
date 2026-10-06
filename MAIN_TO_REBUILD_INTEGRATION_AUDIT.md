# Main → Rebuild Integration Audit

Date: 2026-10-06

Authoritative branch: `rebuild/event-core-clean`  
Rebuild checkpoint audited: `8883de8c3fbc1cac540e32ed785750182809f96e`  
Legacy main checkpoint: `bbc248bfa9ac7e1a7c34b44b32259703a279737b`  
Merge base: `c0b5dd839d30daf0df744b012b7ba0ad5777b19b`

## Decision

`rebuild/event-core-clean` is the current Eternal Rave source of truth.

The 10 commits that exist only on legacy `main` must not be merged wholesale. The clean rebuild has either superseded their behavior, intentionally removed their old architecture, or already descends from the relevant source-acquisition work.

## Commit-by-commit audit

| Commit | Legacy intent | Decision | Reason |
| --- | --- | --- | --- |
| `07b012a` | Profile scrolling + admin navigation | **Do not cherry-pick** | Rebuild profile already has a correct scroll container. The old admin link targets an admin route tree that no longer exists in the clean rebuild. |
| `9e33617` | Merge PR #46 | **Do not cherry-pick** | Merge wrapper for `07b012a`; no independent value. |
| `66157af` | ER-010 organizer domain + admin CMS | **Do not cherry-pick** | Belongs to the pre-clean app/data/admin architecture. Rebuild intentionally removed those runtime admin routes while preserving/rebuilding organizer UI foundations and references separately. |
| `d0ef8b8` | ER-011 closed-beta hardening | **Do not cherry-pick** | Pre-clean architecture. Current rebuild already has its own release checks, Event Core, ingestion guards and newer runtime boundaries. |
| `67b9453` | Upload enterprise/design DOCX files | **Do not reintroduce** | Large binary/reference payloads are not runtime code and the rebuild intentionally moved toward curated reference material instead of restoring old binary baggage. |
| `7b6b760` | Merge ER-012 source acquisition foundation | **Already inherited / superseded** | The rebuild line descends from the source-acquisition side of this history and has since advanced through the current Event Core / M9.4D pipeline. |
| `dfab4da` | Commit `app-v2/.env` | **Never import** | Environment config must remain external to the promoted branch. The committed variables are client/public-style config names, but committing environment files is still bad repository hygiene. |
| `53f378a` | Sprint 2A Phase 0 ThemeProvider | **Superseded** | Rebuild has a newer theme architecture with persisted theme preference, dedicated resolver/storage, newer semantic roles and newer screen composition. |
| `9b6ab9b` | Old Phase 0 theme screenshots | **Do not import** | Screenshots describe the superseded Phase 0 implementation and would be misleading against the current rebuild. |
| `bbc248b` | Merge PR #50 Theme Foundation | **Do not cherry-pick** | Merge wrapper for the superseded Phase 0 theme work. |

## Specific verification

### Profile

Legacy `main` fixed profile scrolling with a `ScrollView`.

Current rebuild already has:

- `ScrollView` with `flex: 1`,
- `contentContainerStyle` with `flexGrow: 1`,
- bottom inset handling,
- the newer `ProfileScreenContent` composition.

The legacy admin shortcut is not carried because the clean rebuild currently has no `app-v2/app/admin/*` runtime routes.

### Theme

Legacy main Phase 0 uses the original `ThemeProvider` and Phase 0 palette utilities.

Current rebuild has a newer theme system including:

- `theme-storage.ts` for persisted theme preference,
- `resolve.ts` for theme/navigation resolution,
- the newer `ThemeProvider`,
- newer semantic token structure,
- newer application layout wiring.

Taking legacy Phase 0 files would be a regression.

### Organizer/Admin

The old ER-010 runtime admin routes are absent by design in the clean rebuild.

Rebuild still contains newer organizer component foundations, including dashboard, submission, team, verification, integration and statistics UI components, plus reference documentation. The old admin-domain implementation should not be resurrected by branch merge.

### Environment file

Legacy `app-v2/.env` contains only client/public-style configuration variable names (including Expo public Supabase/Maps configuration), not an identified Supabase service-role variable. Values are intentionally not reproduced here.

Regardless, `.env` is not carried into the promoted line.

## Promotion rule

The safe branch promotion must:

1. preserve legacy `main` history,
2. preserve current rebuild history,
3. produce a merge commit with the **rebuild tree as canonical content**,
4. avoid force-pushing `main`,
5. keep the archived legacy-main branch,
6. run validation after promotion,
7. only then treat scheduler workflows on the default branch as operational candidates.

Legacy main archive:

`archive/main-before-rebuild-promotion-2026-10-06`
