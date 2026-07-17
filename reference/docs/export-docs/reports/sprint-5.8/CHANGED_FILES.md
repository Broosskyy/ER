# Changed Files — Sprint 5.8

## App / Navigation

| File | Change |
|------|--------|
| `app/_layout.tsx` | Auth screens: modal → push transition |
| `app/welcome.tsx` | Solid auth layout; no premature `setWelcomeComplete` |
| `app/login.tsx` | Solid layout, DE title, showBack |
| `app/register.tsx` | Solid layout, DE title |
| `app/onboarding.tsx` | Invisible CTA tap zone; Android back; `?slide=` QA param |
| `app/(tabs)/home.tsx` | Carousel/chip padding |
| `app/(tabs)/search.tsx` | Filter chip padding |
| `app/(tabs)/profile.tsx` | Guest guards; admin demo removed |
| `app/admin/_layout.tsx` | Always AuthGate (admin) |
| `app/organizer/_layout.tsx` | Always AuthGate (organizer) |

## Components

| File | Change |
|------|--------|
| `src/components/AuthScreenLayout.tsx` | Solid gradient, KeyboardAvoidingView, no ImageBackground bleed |
| `src/components/AccountRequiredDialog.tsx` | Visual polish, guest dismiss copy |
| `src/components/MapPlaceholder.tsx` | DE coming-soon state, no dev text |
| `src/components/FilterChip.tsx` | Border/active styling |
| `src/components/FeaturedEventCard.tsx` | Width/spacing tweak |

## Logic

| File | Change |
|------|--------|
| `src/utils/authRoles.ts` | Demo mode: block admin/organizer paths |
| `src/hooks/useAuthGuard.ts` | Demo mode role labels for AuthGate |

## Config / Scripts

| File | Change |
|------|--------|
| `tailwind.config.js` | `darkMode: 'class'` for web QA |
| `scripts/capture-runtime-screenshots-5.8.sh` | Sprint 5.8 adb capture |
| `scripts/capture-runtime-web-fallback-5.8.mjs` | Web fallback for auth/admin |

## Reports (new)

`docs/reports/sprint-5.8/*`
