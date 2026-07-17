# Sprint 2 — Decisions

## AD-S2-01: Supabase Auth as sole identity provider

**Decision:** All authentication via `@supabase/supabase-js` — no custom JWT generation.  
**Rationale:** Band 4.6, existing ADR-003, RLS integration.  
**Impact:** Password reset and verify flows use Supabase email + deep links.

## AD-S2-02: AuthGate over global middleware

**Decision:** Screen/layout-level `AuthGate` + `useAuthGuard` instead of Expo Router middleware.  
**Rationale:** Incremental, no navigation rewrite; works with existing flat + group routes.  
**Impact:** Each protected area explicitly declares requirements.

## AD-S2-03: Role ladder in client + DB

**Decision:** `profiles.role` (DB enum) + `organizers.verification_status` for verified organizer.  
**Rationale:** Band 4.6 role matrix; separates role from verification state.  
**Impact:** `resolveAuthRoleState()` computes `AppRole` including `verified_organizer`.

## AD-S2-04: Moderator as DB enum value

**Decision:** Add `moderator` to `user_role` enum via migration 005.  
**Rationale:** Documented in Band 4.6; enables future RLS without schema break later.  
**Impact:** Manual role assignment via SQL until admin UI exists.

## AD-S2-05: Demo mode preserved

**Decision:** Without Supabase env vars, app runs guest/demo — no mock authenticated user.  
**Rationale:** Sprint 1 pattern; local QA without backend. Admin demo link retained when offline.  
**Impact:** Production requires env vars; role gates activate only when `isConfigured`.

## AD-S2-06: Deep link scheme

**Decision:** Use existing `eternalrave://` scheme from `app.json` for auth redirects.  
**Rationale:** Expo Linking native support; no extra dependency.  
**Impact:** Must configure matching URLs in Supabase Auth settings.
