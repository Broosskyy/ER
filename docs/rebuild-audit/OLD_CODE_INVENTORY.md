# Old Code Inventory — Eternal Rave

**Stand:** 17. Juli 2026  
**Wichtig:** Der Export enthält **keinen UI-Code**. Nur Backend-Logik, Types, Daten und Konfiguration.

---

## Übersicht

| Bereich | Vorhanden | Fehlend |
|---------|-----------|---------|
| Screens (`app/`) | ❌ | Expo Router Screens komplett |
| UI-Komponenten (`src/components/`) | ❌ | Alle Komponenten |
| Hooks (`src/hooks/`) | ❌ | Auth, Favorites, EventStore |
| Utils (`src/utils/`) | ❌ | Formatierung, Filter |
| Services (`src/services/`) | ✅ | 22 Service-Dateien |
| Types (`src/types/`) | ✅ | 5 Type-Dateien |
| Domain (`src/domain/`) | ✅ | Event-Domain-Logik |
| Data (`src/data/`) | ✅ | Seed-/Dummy-Daten |
| Constants (`src/constants/`) | ✅ | Theme, Navigation, Onboarding |
| Validation (`src/validation/`) | ✅ | Event-Validierung |
| Repositories (`src/repositories/`) | ✅ | Event-Repository |
| Lib (`src/lib/`) | ✅ | Supabase-Client |
| Supabase SQL | ✅ | 6 Migrationen + Seeds |
| Konfiguration | ✅ | Expo, Babel, Metro, Tailwind |

---

## Verwendete Technologien (alter Stack)

| Technologie | Version (package.json) | Verwendung |
|-------------|------------------------|------------|
| **Expo** | SDK 56 (~56.0.12) | Mobile Framework |
| **React Native** | 0.85.3 | UI-Runtime |
| **React** | 19.2.3 | UI-Library |
| **TypeScript** | ~6.0.3 | Typsicherheit |
| **Expo Router** | ~56.2.11 | File-based Navigation |
| **NativeWind** | ^4.2.6 | Tailwind-Styling |
| **Supabase** | ^2.108.2 | Auth + Postgres |
| **AsyncStorage** | ^3.1.1 | Lokale Persistenz |
| **Reanimated** | 4.3.1 | Animationen |
| **Gesture Handler** | ~2.31.1 | Touch-Gesten |

**Dokumentiert, aber nicht in package.json:** Zustand, TanStack Query (in `docs/03-development/01_Tech_Stack.md` erwähnt).

---

## Service-Layer (22 Dateien)

### Auth & Profile

| Datei | Funktion |
|-------|----------|
| `authService.ts` | Login, Register, Session |
| `profiles.ts` | Profil-CRUD |
| `firstLaunchStorage.ts` | Erststart-Flag (AsyncStorage) |

### Events (Kern)

| Datei | Funktion |
|-------|----------|
| `eventService.ts` | Event-CRUD |
| `events.ts` | Event-Abfragen |
| `eventLifecycleService.ts` | Status-Übergänge (draft → published) |
| `eventDraftService.ts` | Entwürfe |
| `eventSubmissionService.ts` | User-Einreichungen |
| `submissionService.ts` | Submission-Handling |
| `submissions.ts` | Submission-Queries |
| `eventReviewService.ts` | Admin-Review |
| `publicFeedService.ts` | Öffentlicher Event-Feed |
| `favoriteService.ts` | Favoriten |
| `favorites.ts` | Favoriten-Queries |

### Admin & Import

| Datei | Funktion |
|-------|----------|
| `adminService.ts` | Admin-Operationen |
| `importService.ts` | Event-Import |
| `imports.ts` | Import-Queries |
| `sourceImport.ts` | Quellen-Import |
| `eventSources.ts` | Event-Quellen-Verwaltung |
| `organizers.ts` | Organizer-Verwaltung |

### Sonstige

| Datei | Funktion |
|-------|----------|
| `index.ts` | Service-Exports |
| `types.ts` | ServiceResult-Typ |

---

## Domain-Logik

```
src/domain/event/
├── index.ts
├── permissions.ts    # Rollenbasierte Berechtigungen
├── status.ts         # Lifecycle-Status-Maschine, ReviewAction
└── types.ts          # Domain-Typen
```

**Wiederverwendbare Logik:**
- `assertValidTransition()` — Status-Übergangsvalidierung
- `ReviewAction`-Mapping
- Rollen-Permissions (user, organizer, moderator, admin)

---

## TypeScript-Types

| Datei | Inhalt |
|-------|--------|
| `types/event.ts` | `Event`, `Organizer`, `Artist`, Filter-Types |
| `types/database.ts` | Supabase Row-Types, Enums, DB-Lifecycle |
| `types/auth.ts` | Auth-relevante Types |
| `types/lifecycle.ts` | `EventLifecycleStatus`, Import-Drafts |
| `types/eventSource.ts` | Event-Quellen-Types |

---

## Datenmodell (Kern-Entitäten)

```
Profile → Organizer (1:n)
Organizer → Events (1:n)
Event → EventArtist (1:n)
Event → EventReviewAudit (1:n)
Event → EventSubmissionHistory (1:n)
EventSource → ImportJobs
User → Favorites (n:m mit Events)
```

### Lifecycle-Status (Events)

```
draft → pending_review → approved → published
                      → rejected
                      → duplicate
imported_draft → needs_review → ...
archived, deleted (Sprint 3 Erweiterung)
```

---

## Supabase-Schema (6 Migrationen)

| Migration | Inhalt |
|-----------|--------|
| `001_initial_schema.sql` | Profiles, Organizers, Venues, Events, Favorites, RLS |
| `002_event_sources.sql` | Event-Quellen-Tabelle |
| `003_user_submission_rls.sql` | User-Submission Policies |
| `004_duplicate_warning_events.sql` | Duplikat-Erkennung |
| `005_auth_roles_moderator.sql` | Moderator-Rolle |
| `006_event_foundation.sql` | Audit-Log, Submission-History, erweiterte Felder |

**Seeds:** `seed.sql`, `seed_event_sources.sql`, `seed_published_events.sql`

---

## Beispieldaten

| Datei | Inhalt |
|-------|--------|
| `src/data/events.ts` | ~20 Dummy-Events (Hamburg/Berlin), Unsplash-URLs |
| `src/data/seedEventSources.ts` | Event-Quellen (Sisyphos, Berghain, RA, etc.) |
| `src/data/seedSubmissions.ts` | Beispiel-Einreichungen |

---

## Konfiguration (Referenz, nicht kopieren)

| Datei | Zweck |
|-------|-------|
| `package.json` | Abhängigkeiten — **nicht als Bootstrap-Basis** |
| `app.json` | Expo-Konfiguration |
| `eas.json` | EAS Build |
| `babel.config.js` | Babel + NativeWind |
| `metro.config.js` | Metro Bundler |
| `tailwind.config.js` | Design-Tokens — **Tokens übernehmen** |
| `tsconfig.json` | TypeScript-Config |
| `.env.example` | Supabase URL/Key Platzhalter |

---

## Wiederverwendbare Logik (als Referenz)

| Bereich | Datei(en) | Nutzen für Neubau |
|---------|-----------|-------------------|
| Design-Tokens | `theme.ts`, `tailwind.config.js` | Direkt übernehmen |
| Event-Lifecycle | `domain/event/status.ts` | Geschäftslogik-Referenz |
| Status-Validierung | `validation/eventValidation.ts` | Regeln übernehmen |
| DB-Schema | `supabase/migrations/` | Schema als Ausgangspunkt |
| Type-Definitionen | `src/types/` | Datenmodell-Referenz |
| Seed-Daten-Struktur | `src/data/` | Beispieldaten-Format |
| Filter-Konstanten | `theme.ts` (GenreFilters, CityFilters) | UX-Referenz |

---

## Explizit NICHT kopieren

| Bereich | Grund |
|---------|-------|
| Gesamter Service-Layer | An alte Architektur gebunden, `@/`-Imports, fehlende UI-Integration |
| `placeholderAssets.ts` | Verwendet Mockup-PNGs als App-Bilder — Anti-Pattern |
| `onboarding.ts` | Bindet Mockup-Bilder direkt ein |
| Alte `package.json` | Veraltete Versionen, fehlende dokumentierte Tools |
| Sprint-Reports | Historisch, nicht implementierungsrelevant |
| CI-Workflow | `auto-close-obsolete-prs.yml` — projektspezifisch |
| Unsplash-URLs in Seed-Daten | Externe Abhängigkeit |

---

## Architektur-Muster (alter Code)

```
Screens (app/) → Hooks → Services → Repository → Supabase
                              ↓
                         Domain/Validation
```

- **ServiceResult<T>** Pattern für einheitliche Fehlerbehandlung
- **Offline-Fallback:** App läuft ohne Supabase-Env in Demo-Modus
- **RLS-basierte Sicherheit** in Supabase
- **Feature-First** Ordnerstruktur (dokumentiert, im Export nicht vollständig)

---

## Fazit

Der Code-Export ist ein **partielles Backend-/Domain-Fragment** ohne UI-Schicht. Für den Neubau dienen Types, Domain-Logik, DB-Schema und Design-Tokens als **Referenz**, nicht als Copy-Paste-Basis. Die Service-Implementierungen zeigen bewährte Patterns (Lifecycle, Audit-Log, RLS), müssen aber neu geschrieben werden.
