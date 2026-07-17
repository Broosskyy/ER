# Sprint 4 — Decisions

## S4-D01 — Dual-mode organizer hook

**Decision:** `useOrganizerEvents` routes to Supabase services when `isConfigured && user`, otherwise falls back to `useEventStore` demo data.

**Rationale:** Preserves offline/demo development without breaking changes; matches Sprint 2/3 auth pattern.

## S4-D02 — Form mapper layer

**Decision:** Separate `organizerFormMapper.ts` instead of inline mapping in screens.

**Rationale:** Single source for datetime/lineup/price conversion; screens stay thin.

## S4-D03 — Admin review detail route

**Decision:** New `/admin/review/[id]` screen instead of inline actions only on queue cards.

**Rationale:** Supports audit log, moderation notes, and status timeline per mockup/Band 2 patterns.

## S4-D04 — Validation split

**Decision:** `validateOrganizerStep` for wizard navigation; `validateOrganizerForm` + domain `validateEventDraft` for submit.

**Rationale:** Better UX (early feedback) without duplicating domain rules.

## S4-D05 — Stats placeholders

**Decision:** Views/Followers stats deferred; show real counts for drafts/pending/published only.

**Rationale:** Analytics not in Sprint 4 scope; avoids dummy metrics when Supabase configured.

## S4-D06 — ESLint deferred

**Decision:** No ESLint setup in Sprint 4.

**Rationale:** No existing ESLint config; adding tooling is Sprint 5+ quality gate item.
