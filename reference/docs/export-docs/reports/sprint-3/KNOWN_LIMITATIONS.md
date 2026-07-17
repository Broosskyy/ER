# Sprint 3 — Known Limitations

- **No UI changes** — existing screens use useEventStore; new hooks available but not wired to all forms
- **God store** — useEventStore (~1050 LOC) not decomposed
- **No pagination in feed** — repository supports limit/offset; feed still loads all published
- **Organizer dashboard** — deferred; permissions prepared only
- **Automation** — fields exist; no RSS/Crawler/AI
- **Duplicate detection** — prep only; existing client logic unchanged
- **ESLint / tests** — not configured
- **Migration required** — new columns default null until 006 applied
