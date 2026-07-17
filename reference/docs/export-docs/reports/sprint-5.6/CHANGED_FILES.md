# Changed Files — Sprint 5.6

## New screens

| File | Route | Purpose |
|------|-------|---------|
| `app/splash.tsx` | `/splash` | Brand splash + progress bar + fade |
| `app/onboarding.tsx` | `/onboarding` | 4-page wizard with mockup backgrounds |
| `app/welcome.tsx` | `/welcome` | Register / Login / Guest entry |

## New components & services

| File | Purpose |
|------|---------|
| `src/components/AppLogo.tsx` | Hex logo + wordmark |
| `src/components/AuthScreenLayout.tsx` | Shared auth background layout |
| `src/components/AuthTextField.tsx` | Icon input fields (login/register) |
| `src/components/AccountRequiredDialog.tsx` | Guest restriction modal |
| `src/components/HomeScreenHeader.tsx` | Logo, location, search, bell |
| `src/constants/onboarding.ts` | Wizard slide config |
| `src/constants/placeholderAssets.ts` | Mockup placeholder images |
| `src/services/firstLaunchStorage.ts` | AsyncStorage for onboarding/welcome/guest |
| `src/hooks/useGuestMode.tsx` | Guest mode + account guards |

## New assets

| Path | Purpose |
|------|---------|
| `assets/onboarding/*.png` | Extracted mockup PNGs for wizard + placeholders |

## Modified

| File | Change |
|------|--------|
| `app/index.tsx` | Redirect to `/splash` |
| `app/_layout.tsx` | GuestModeProvider + new stack routes |
| `app/login.tsx` | Mockup-aligned DE login UI |
| `app/register.tsx` | Mockup-aligned DE register + AGB |
| `app/(tabs)/home.tsx` | HomeScreenHeader, DE sections, Top Clubs |
| `app/(tabs)/search.tsx` | Logo header, DE copy, result count |
| `app/add-event.tsx` | Guest account guard |
| `app/event/[id].tsx` | Ticket purchase guest guard |
| `src/hooks/useFavorites.tsx` | Favorite toggle guest guard |
| `src/components/EventImageFallback.tsx` | Mockup images instead of gray gradient |
| `src/components/StoryCircle.tsx` | Local image source support |
| `src/data/events.ts` | Club placeholders from mockups |
| `src/constants/theme.ts` | Default city → Berlin (mockup) |
| `src/types/event.ts` | StoryItem imageSource |
| `src/components/index.ts` | New exports |

## Reports & screenshots

| Path | Purpose |
|------|---------|
| `docs/reports/sprint-5.6/**` | Full sprint documentation |
| `docs/reports/sprint-5.6/screenshots/*.png` | 16 required screenshots |
