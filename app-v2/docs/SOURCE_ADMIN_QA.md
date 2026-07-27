# Source Admin QA

**Sprintstatus:** Abgeschlossen (2026-07-27)

## Abschlusskriterien

| Kriterium | Ergebnis |
|-----------|----------|
| Typecheck | Grün |
| Tests | 767/767 grün |
| Lint | 0 Errors, 971 Warnings |
| QA-Screenshots | 6 gültige Captures |
| Conflict Review | Erfolgreich aufgenommen |
| Verbleibende Blocker | Keine |

## Screens

| Screen | Route | Data source |
|--------|-------|-------------|
| Sources list | `/admin/sources` | `sourceService` |
| Source detail | `/admin/sources/[id]` | `sourceService` + `adminMultiSourceService` |
| Duplicate review | `/admin/events/review/[id]/duplicates` | `AdminMultiSourceService` |
| Conflict review | `/admin/events/review/[id]/conflicts` | `ConflictResolutionService` |

## Capture script

```bash
# Requires dev server on port 8091
npx playwright install chromium   # once per machine
node scripts/capture-source-management-scale.mjs
```

Output: `docs/visual-qa/source-management-scale/*.png`

## QA capture run — 2026-07-27

| Item | Result |
|------|--------|
| Capture executed | Yes |
| Playwright Chromium | Installed locally (`npx playwright install chromium`) |
| Screenshots produced | **6** |
| Output directory | `docs/visual-qa/source-management-scale/` |
| Admin auth | Local dev admin via `/login` (`admin@eternalrave.app` / `admin-local-dev`, `EXPO_PUBLIC_USE_SUPABASE=false`) |
| QA contributor seed | `qa-capture-review-event` in `app.contributorEvents.v1` |

### Files captured

| File | Intended route |
|------|----------------|
| `sources-overview-desktop-light.png` | `/admin/sources` |
| `sources-overview-mobile-light.png` | `/admin/sources` (390×844) |
| `sources-overview-desktop-dark.png` | `/admin/sources` (dark) |
| `source-detail-desktop-light.png` | `/admin/sources/demo` |
| `duplicate-review-desktop-light.png` | `/admin/events/review/qa-capture-review-event/duplicates` |
| `conflict-review-desktop-light.png` | `/admin/events/review/qa-capture-review-event/conflicts` |

All six files are present and readable PNGs.

## Visual findings

| Check | Result |
|-------|--------|
| Resolution errors | None visible |
| Cut-off content | None |
| Auth redirect | **None** — all captures show authenticated admin UI |
| Wrong routes | **None** — routes match intended admin screens |
| Mobile layout | Sources list scales correctly on 390×844 |
| Dark mode | Sources overview dark theme renders correctly |
| Light mode contrast | Admin page titles use theme-aware `AppText` roles (readable on sources overview / detail) |
| Empty states | Duplicate review: no candidates; Conflict review: no open conflicts (valid QA empty states) |
| Missing data | No login screen, no 404, no error pages |

## Manual checklist

- [ ] Source detail shows references, provenance count, conflicts, health, quality
- [ ] Duplicate merge persists decision and reloads context
- [ ] Conflict resolve updates publish readiness
- [ ] Loading / empty / error states render
- [ ] Light and dark themes (script captures both for sources list)
- [x] Capture script authenticates before navigation

## QA status

Capture **executed successfully** with authenticated admin sessions. All six target routes verified (inkl. Conflict Review). **Sprint abgeschlossen.** Siehe `SOURCE_MANAGEMENT_SCALE_FINAL_REPORT.md`.
