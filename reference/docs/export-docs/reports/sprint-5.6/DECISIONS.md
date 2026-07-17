# Decisions — Sprint 5.6

| Decision | Rationale |
|----------|-----------|
| Onboarding uses full mockup PNGs as backgrounds | User rule: use mockup images exclusively; fastest mockup fidelity |
| Welcome screen after onboarding, not Home | Explicit sprint requirement |
| AsyncStorage for first-launch state | Lightweight; no new dependencies |
| Guest mode persisted separately from auth | Distinguish explicit guest choice vs unauthenticated |
| Demo mode bypasses Supabase auth on login/register | Existing pattern; login/register proceed to home without env |
| Berlin as default city | Matches Home mockup (09_Home.png) |
| Placeholder event images from mockup assets | User rule: no gray placeholders |
| Google auth as Alert placeholder | Backend not active; mockup shows button |
