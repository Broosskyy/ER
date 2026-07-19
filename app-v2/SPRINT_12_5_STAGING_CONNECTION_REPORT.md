# Sprint 12.5 — Staging-Verbindungsbericht

**Datum:** 2026-07-19  
**Branch:** `cursor/sprint-12-5-production-validation-6b06`

## Verbindung erfolgreich?

**Nein** — die Staging-Credentials waren in der Agent-Umgebung nicht verfügbar. Die `.env` wurde angelegt, der Verbindungstest schlägt erwartungsgemäß fehl, solange Platzhalterwerte gesetzt sind.

```
❌ EXPO_PUBLIC_SUPABASE_URL is missing or still a placeholder
```

## Benötigte ENV-Variablen

| Variable | Zweck | Client? |
|----------|-------|---------|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase Projekt-URL | Ja |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Anon/Public Key | Ja |
| `EXPO_PUBLIC_USE_SUPABASE` | `true` für Supabase-Backend | Ja |
| `SUPABASE_SERVICE_ROLE_KEY` | Nur serverseitig (optional) | **Nein** — niemals `EXPO_PUBLIC_` |

Optional (nicht für Basis-Verbindung):
- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` — Maps auf Android
- `STAGING_*_JWT` — nur für erweiterte RLS-Tests

## Secret im Client gefunden?

**Nein** — kein `service_role`, kein `EXPO_PUBLIC_*SERVICE*`, keine hardcodierten JWTs in `src/` oder `app/`.

Bekannt und akzeptiert (nur Mock-Modus, `EXPO_PUBLIC_USE_SUPABASE=false`):
- `admin-local-dev` in `auth-service.ts` und `app/admin/login.tsx`

## Nächster Schritt

Credentials setzen (eine Option):

```bash
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co \
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key> \
bash app-v2/scripts/staging/setup-env.sh
```

Dann Verbindung prüfen (keine Migrationen):

```bash
cd app-v2 && npm run test:staging:connection
```

## Migrationen

Wie angefordert: **nicht ausgeführt**.
