# Sprint 2 — Known Limitations

## Authentication

- **OAuth not implemented** — Email/password only (Google/Apple → Sprint 3+)
- **No MFA** — Documented in Band 4.6 roadmap
- **Email delivery** — Depends on Supabase project SMTP/configuration
- **Deep links** — Require Supabase Auth redirect URL whitelist

## Storage & Security

- Tokens stored via Supabase default (`AsyncStorage`) — not Expo SecureStore yet
- Rate limiting not enforced client-side (Supabase server-side only)
- No custom session revocation UI

## Roles & Access

- **Moderator role** exists in DB/types but no dedicated moderation UI
- **Organizer verification** metadata read but no application workflow
- **Admin promotion** still manual SQL
- **Demo mode** (no env): admin dashboard accessible without login for local QA

## Testing & Tooling

- No ESLint configuration
- No automated auth E2E tests
- Build not verified in this sprint environment

## Documentation

- Band 4.6 Kap. 03 OAuth section still marked future
- Architecture review Sprint 2 section pending merge
