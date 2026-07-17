# ADR-003: Supabase

**Status:** Accepted  
**Datum:** Juni 2026 · Sprint 0

## Kontext

Backend für Auth, Postgres, RLS, zukünftig Storage, Realtime, Edge Functions. Band 4 definiert Supabase als BaaS.

## Entscheidung

**Supabase** (Auth + PostgreSQL + RLS) als Backend. Dual-Mode: Live mit Env-Vars, Demo ohne.

## Begründung

- Schnelles MVP mit SQL, Migrations, RLS
- JavaScript Client passt zu RN/Expo
- Auth + Profiles + Events in einem System
- Skalierbar für Startup-Phase
- Migrationen 001–004 bereits implementiert

## Architektur

```
App (services/) → Supabase JS Client → Postgres + RLS
                 ↘ Demo: src/data/ (offline)
```

## Konsequenzen

- Env: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Nur `anon` key im Client — keine Service Role im App-Bundle
- Lifecycle: nur `published` Events im Public Feed
- Nie auto-publish bei Imports

## Bekannte Gaps (Sprint 0, nicht ändern)

- `database.ts` nicht vollständig synchron mit Migration 002
- Legacy `event_submissions` Tabelle vs. aktiver `events`-Pfad

## Referenzen

- `supabase/README.md`, `src/lib/supabase/`
- Band 4 README
