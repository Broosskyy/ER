# Decisions — Sprint 5.8

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Auth screens use **push** not **modal** | Eliminates visible previous screen under fade overlay |
| D2 | **Solid gradient** auth backgrounds | Removes onboarding/welcome bleed-through |
| D3 | `setWelcomeComplete()` only on **guest/login/register success** | Welcome reappears if user backs out of auth |
| D4 | **AuthGate always** for admin/organizer | Demo mode no longer exposes admin tools |
| D5 | Demo role guard: block **admin/organizer**, allow **authenticated/user** paths | QA tabs work; privileged routes closed |
| D6 | Onboarding **invisible CTA** over mockup button | Avoid duplicate „Weiter“ buttons in PNG mockups |
| D7 | `onboarding?slide=N` deeplink | QA-only; no user-facing feature |
| D8 | Runtime screenshots: **native where possible**, web for auth/admin when emulator ANR | Deliver 15 files; document limitation |
