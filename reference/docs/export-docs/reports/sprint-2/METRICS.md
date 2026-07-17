# Sprint 2 — Metrics

| Metric | Value |
|--------|-------|
| Files created | 15 |
| Files modified | 13 |
| Lines added (approx.) | ~1,200 |
| New screens | 3 (`forgot-password`, `reset-password`, `verify-email`) |
| New components | 1 (`AuthGate`) |
| New hooks | 1 (`useAuthGuard`) |
| New migrations | 1 (`005_auth_roles_moderator.sql`) |
| Auth screens total | 5 |
| Role types supported | 6 (guest + 5 authenticated levels) |
| TypeScript errors | 0 |
| Breaking changes | 0 |

## Auth API surface (useAuth)

| Method | New/Updated |
|--------|-------------|
| signIn | Updated |
| signUp | Updated (needsEmailVerification) |
| signOut | Updated |
| resetPassword | **New** |
| setNewPassword | **New** |
| resendVerification | **New** |
| refreshProfile | Existing |
| clearSessionExpired | **New** |

## Role flags exposed

`isGuest`, `isAuthenticated`, `isUser`, `isOrganizer`, `isVerifiedOrganizer`, `isModerator`, `isAdmin`, `appRole`, `isEmailVerified`
