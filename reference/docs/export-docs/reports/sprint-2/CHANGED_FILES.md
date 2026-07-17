# Sprint 2 — Changed Files

## Created

| File | Description |
|------|-------------|
| `app/forgot-password.tsx` | Password reset request screen |
| `app/reset-password.tsx` | New password after email link |
| `app/verify-email.tsx` | Email verification + resend |
| `app/admin/_layout.tsx` | Admin route guard layout |
| `app/organizer/_layout.tsx` | Organizer route guard layout |
| `src/components/AuthGate.tsx` | Reusable auth/role gate UI |
| `src/hooks/useAuthGuard.ts` | Auth requirement hook |
| `src/types/auth.ts` | AppRole, AuthRequirement types |
| `src/utils/authRoles.ts` | Role resolution + requirement checks |
| `src/utils/authLinking.ts` | Deep link token parsing |
| `src/services/organizers.ts` | Fetch organizer metadata |
| `supabase/migrations/005_auth_roles_moderator.sql` | Moderator role + SQL helpers |
| `docs/reports/sprint-2/*` | Sprint deliverables |

## Modified

| File | Description |
|------|-------------|
| `src/hooks/useAuth.tsx` | Full auth context: roles, reset, verify, deep links |
| `src/services/authService.ts` | Reset, update password, resend verification |
| `src/types/database.ts` | `moderator` in UserRole |
| `app/login.tsx` | Forgot password, guest, session expired |
| `app/register.tsx` | isConfigured check, verify flow, guest |
| `app/(tabs)/profile.tsx` | Role badge, verify banner, moderator link |
| `app/admin.tsx` | AuthGate when Supabase configured |
| `app/organizer.tsx` | AuthGate when Supabase configured |
| `app/_layout.tsx` | Register new auth screens |
| `src/components/FormField.tsx` | accessibilityLabel prop |
| `src/components/index.ts` | Export AuthGate |
| `docs/04.6-authentication-identity/README.md` | Ist-Stand update |
