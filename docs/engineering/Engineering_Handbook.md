# Eternal Rave Engineering Handbook

> **Dokumenttyp:** Langfristige technische Referenz (Engineering Handbook, Edition 6.8)  
> **Tagesaktuelle Informationen** (Entwicklungsstand, Backlog, Releases, KI-Einstieg): siehe `PROJECT_STATE.md`, `BACKLOG.md`, `RELEASE_PLAN.md`, `AI_CONTEXT.md` im Repository-Root.  
> **Produktvision:** siehe `docs/master/Master_Handbook.md`.

### Master Edition 3.0

Technische Referenz für Architektur, Backend, Frontend, Datenbank, Infrastruktur und Engineering.

# Vorwort

Dieses Dokument ersetzt nicht das Master Handbook 2.4, sondern ergänzt es. Während das Master Handbook die Produktvision und fachliche Plattform beschreibt, definiert das Engineering Handbook die technische Umsetzung und dient als Referenz für Entwickler, Architekten und KI-gestützte Coding-Tools.

# Leitprinzipien

- API-First
- Domain Driven Design (DDD)
- Clean Architecture
- Cloud Native
- Security by Design
- Observability by Default
- Automation First
- Infrastructure as Code

# Struktur des Engineering Handbook

Band

Inhalt

1

Software Architecture

2

Domain & Database

3

Backend & APIs

4

Frontend & UX Engineering

5

Infrastructure & DevOps

6

Security & Compliance

7

Quality Engineering & Testing

8

Operations & Monitoring

9

Anhänge, ADRs und Referenzen

# Kapitel 1 – Zielarchitektur

Eternal Rave wird als modular aufgebaute Plattform mit klar abgegrenzten Domänen entwickelt. Alle Services kommunizieren über definierte APIs oder asynchrone Events. Jede Domäne besitzt ihre eigene Datenverantwortung und kann unabhängig entwickelt, getestet und skaliert werden.

# Kapitel 2 – Technische Ziele

- Skalierbarkeit für Millionen von Nutzern
- Hohe Wartbarkeit
- Klare Modulgrenzen
- Automatisierte Deployments
- Hohe Testabdeckung
- Nachvollziehbare Architekturentscheidungen

# Roadmap Version 3.x

Version 3.1: Domain-Driven Design. Version 3.2: Datenbank & SQL-DDLs. Version 3.3: REST/OpenAPI. Version 3.4: Frontend. Version 3.5: Infrastruktur. Version 3.6: Security. Version 3.7: DevOps & Betrieb

# Kapitel 3 – Domain-Driven Design (DDD)

Die Plattform wird in klar voneinander getrennte fachliche Domänen (Bounded Contexts) aufgeteilt. Jede Domäne besitzt ihre eigenen Modelle, Services und Daten und kann unabhängig entwickelt werden.

Bounded Context

Verantwortung

Identity

Benutzer, Authentifizierung, Rollen

Events

Events und Event-Lifecycle

Artists

Künstlerprofile

Venues

Locations und Clubs

Festivals

Festivalverwaltung

Community

Posts, Kommentare, Likes

Discovery

Suche und Empfehlungen

Trust

Moderation, Verifizierung, Meldungen

# Kapitel 4 – Architekturprinzipien

- Single Responsibility Principle
- Loose Coupling
- High Cohesion
- Dependency Injection
- API-First
- Event-driven Communication
- Backward Compatibility
- Stateless Services

# Kapitel 5 – Microservice-Landschaft

Die Plattform kann zunächst als modularer Monolith starten. Mit wachsender Last können Domänen schrittweise in eigenständige Microservices überführt werden.

- API Gateway
- Identity Service
- Event Service
- Artist Service
- Venue Service
- Festival Service
- Community Service
- Search Service
- Notification Service
- Media Service

# Kapitel 6 – Technologiestack

Bereich

Empfohlene Technologien

Backend

Java / Spring Boot

Frontend

React + TypeScript

Mobile

Flutter

Datenbank

PostgreSQL

Cache

Redis

Suche

OpenSearch

Messaging

Kafka oder RabbitMQ

Container

Docker

Orchestrierung

Kubernetes

CI/CD

GitHub Actions


### Referenzimplementierung im Repository (app-v2)

Die folgende Tabelle beschreibt den **aktuell im Repository implementierten** Stack. Sie ergänzt die empfohlenen Technologien oben und widerspricht der Zielarchitektur nicht.

| Bereich | Implementiert (app-v2) |
|---------|------------------------|
| Client | React Native + Expo SDK 57, TypeScript, Expo Router |
| Web | React Native Web (statischer Export) |
| Backend | Supabase (PostgreSQL, Auth, Storage) |
| Mobile | Android- und iOS-native Projekte via Expo (kein Flutter im Repository) |
| Datenbank | PostgreSQL via Supabase |
| CI/Qualität | `npm run release:check`, Vitest, ESLint, TypeScript strict |

Details und Tabellenstand: Anhang am Ende dieses Handbuchs sowie `PROJECT_STATE.md`.

# Kapitel 7 – Domänenmodell

Alle Kernobjekte der Plattform werden als eigenständige Aggregate modelliert. Beziehungen erfolgen über stabile IDs und klar definierte Schnittstellen.

Entität

Primärschlüssel

Beziehungen

User

user_id

Events, Posts, Tickets

Artist

artist_id

Events

Venue

venue_id

Events

Festival

festival_id

Events

Organizer

organizer_id

Events

Event

event_id

Venue, Artists, Festival

Creator

creator_id

Content

Ticket

ticket_id

User, Event

# Kapitel 8 – Datenbankrichtlinien

- UUIDs als Primärschlüssel
- Zeitstempel für Erstellung und Änderungen
- Soft Deletes für fachlich relevante Daten
- Optimistische Sperrung mittels Versionsfeld
- Indizes für häufige Suchfelder
- Referenzielle Integrität über Foreign Keys

# Kapitel 9 – API-Konventionen

- REST-konforme Ressourcen
- JSON als Standardformat
- Versionierung über /api/v1/
- OpenAPI 3.1 als Referenz
- Standardisierte Fehlerobjekte
- JWT-basierte Authentifizierung

# Kapitel 10 – Qualitätsziele

Jede Funktion der Plattform soll nachvollziehbar testbar, wartbar und skalierbar sein.

- Unit-Tests für Business-Logik
- Integrations-Tests für APIs
- End-to-End-Tests für Kernprozesse
- Automatische Codeanalyse
- Security-Scans in der CI/CD-Pipeline
- Code Reviews als Pflichtbestandteil jedes Pull Requests

# Kapitel 11 – Entity-Spezifikation: User

Der User ist das zentrale Aggregate der Plattform. Er besitzt Identität, Profileinstellungen, Rollen und Beziehungen zu allen sozialen und transaktionalen Domänen.

Feld

Typ

Beschreibung

user_id

UUID

Primärschlüssel

username

VARCHAR(50)

Eindeutiger Benutzername

display_name

VARCHAR(120)

Anzeigename

email

VARCHAR(255)

Verifizierte E-Mail

status

ENUM

ACTIVE, SUSPENDED, DELETED

created_at

TIMESTAMP

Erstellt am

updated_at

TIMESTAMP

Zuletzt geändert

# Kapitel 12 – Entity-Spezifikation: Event

Ein Event bildet das Herzstück der Plattform und verbindet Venue, Artists, Organizer sowie Tickets.

- Statusmodell: Draft → Published → Running → Finished → Archived
- Unterstützung für wiederkehrende Events
- Zeit- und Zeitzonenverwaltung
- Mehrere Artists pro Event
- Verknüpfung mit Festival und Venue

# Kapitel 13 – API-Designrichtlinien

- Pluralisierte Ressourcen (/events, /artists, /venues)
- HTTP-Methoden gemäß REST
- Idempotente PUT-Operationen
- PATCH für Teilaktualisierungen
- Cursor-basierte Pagination
- Filter, Sortierung und Volltextsuche

# Kapitel 14 – Sicherheitsarchitektur

- OAuth2/OpenID Connect
- JWT Access- und Refresh-Tokens
- Rollen- und Rechteverwaltung (RBAC)
- Rate Limiting
- Audit Logging
- Verschlüsselung sensibler Daten im Ruhezustand und bei der Übertragung

# Kapitel 15 – Architekturentscheidungen (ADR)

Alle wesentlichen Architekturentscheidungen werden als Architecture Decision Records dokumentiert.

ADR

Thema

Status

ADR-001

PostgreSQL als Primärdatenbank

Accepted

ADR-002

REST API als Primärschnittstelle

Accepted

ADR-003

Modularer Monolith als Startarchitektur

Accepted

ADR-004

Kubernetes als Zielplattform

Proposed

# Kapitel 16 – SQL-DDL-Konventionen

Alle Datenbankschemata folgen einheitlichen Konventionen, um Konsistenz und Wartbarkeit sicherzustellen.

- snake_case für Tabellen- und Spaltennamen
- UUID als Primärschlüssel
- NOT NULL standardmäßig für Pflichtfelder
- CHECK-Constraints für Statuswerte
- Foreign Keys mit referenzieller Integrität
- Indizes für Such- und Join-Spalten

# Kapitel 17 – OpenAPI-Standards

- OpenAPI 3.1 als verbindliche Spezifikation
- Jeder Endpoint dokumentiert Request, Response und Fehlercodes
- Schema-Wiederverwendung über Components
- Versionierung über /api/v1
- OAuth2 Security Schemes

# Kapitel 18 – Sequenzdiagramme (fachliche Beschreibung)

Für alle geschäftskritischen Abläufe werden Sequenzdiagramme gepflegt.

Prozess

Beteiligte

Benutzerregistrierung

Client → Identity → Datenbank → Mail

Event erstellen

Client → Event API → Event Service → Datenbank

Ticketkauf

Client → Ticket Service → Payment → Datenbank

Eventsuche

Client → Search API → OpenSearch

# Kapitel 19 – Logging & Observability

- Strukturiertes JSON-Logging
- Korrelations-IDs über alle Services
- OpenTelemetry Tracing
- Prometheus-Metriken
- Grafana-Dashboards
- Alarmierung über definierte SLOs

# Kapitel 20 – Ausblick

Die folgenden Versionen erweitern dieses Handbuch um vollständige SQL-DDLs, UML- und ER-Diagramme, OpenAPI-Spezifikationen, Infrastrukturdiagramme, Deployment-Blueprints sowie detaillierte Implementierungsrichtlinien für alle Kernmodule der Eternal-Rave-Plattform.

# Kapitel 21 – SQL-DDL: users

CREATE TABLE users (  user_id UUID PRIMARY KEY,  username VARCHAR(50) UNIQUE NOT NULL,  email VARCHAR(255) UNIQUE NOT NULL,  display_name VARCHAR(120),  status VARCHAR(20) NOT NULL,  created_at TIMESTAMP NOT NULL,  updated_at TIMESTAMP NOT NULL,  version INTEGER NOT NULL DEFAULT 1);

# Kapitel 22 – SQL-DDL: events

CREATE TABLE events (  event_id UUID PRIMARY KEY,  venue_id UUID NOT NULL,  organizer_id UUID,  title VARCHAR(255) NOT NULL,  starts_at TIMESTAMP NOT NULL,  ends_at TIMESTAMP NOT NULL,  status VARCHAR(20) NOT NULL,  created_at TIMESTAMP NOT NULL);

# Kapitel 23 – OpenAPI-Beispiel

GET /api/v1/events/{eventId}

- 200 OK → Event
- 400 Bad Request
- 401 Unauthorized
- 404 Not Found
- 500 Internal Server Error

# Kapitel 24 – JSON-Schema-Richtlinien

- camelCase für JSON-Felder
- UUID als String
- ISO-8601 für Datum/Uhrzeit
- RFC7807 für Fehlerobjekte
- Nullable Felder explizit kennzeichnen

# Kapitel 25 – PlantUML-Standards

@startumlUser --> EventEvent --> VenueEvent --> Artist@enduml

# Kapitel 26 – C4-Modell

- Level 1: System Context
- Level 2: Container
- Level 3: Component
- Level 4: Code (optional)

# Kapitel 27 – Performance Engineering

- Antwortzeit Ziel <200 ms (API)
- Redis für häufig gelesene Daten
- OpenSearch für Volltextsuche
- Asynchrone Verarbeitung über Message Broker
- Horizontal skalierbare Services

# Kapitel 28 – Nächste Ausbaustufe

Ab Version 3.6 werden alle Kernmodule (User, Artist, Venue, Festival, Organizer, Ticket, Community, Discovery und Trust) vollständig mit Datenmodell, SQL-DDL, OpenAPI, Zustandsmodell, Sequenzdiagrammen und Implementierungsrichtlinien beschrieben.

# Kapitel 29 – Modulreferenz: User

Dieses Kapitel definiert das User-Modul als technische Referenzimplementierung für weitere Domänen.

## 29.1 Verantwortlichkeiten

- Registrierung und Anmeldung
- Profilverwaltung
- Rollen und Berechtigungen
- Datenschutzeinstellungen
- Verknüpfung mit Events, Tickets und Community

## 29.2 REST-Endpunkte

Methode

Pfad

Beschreibung

GET

/api/v1/users/{id}

Benutzer abrufen

POST

/api/v1/users

Benutzer anlegen

PATCH

/api/v1/users/{id}

Benutzer aktualisieren

DELETE

/api/v1/users/{id}

Benutzer deaktivieren

## 29.3 Zustandsmodell

- REGISTERED
- EMAIL_VERIFIED
- ACTIVE
- SUSPENDED
- DELETED

# Kapitel 30 – Modulreferenz: Event

Das Event-Modul bildet den Kern der Plattform und orchestriert Artists, Venues, Festivals und Organizer.

- Event anlegen
- Event veröffentlichen
- Event aktualisieren
- Event absagen
- Event archivieren

# Kapitel 31 – Fehlerbehandlung

- RFC 7807 Problem Details
- Eindeutige Fehlercodes
- Korrelation über Request-ID
- Keine sensiblen Informationen in Fehlermeldungen

# Kapitel 32 – Teststrategie

- Unit-Tests für Services
- Repository-Tests
- API-Integrationstests
- Contract-Tests
- End-to-End-Tests
- Lasttests vor Releases

# Kapitel 33 – Standardstruktur für Domänenmodule

Alle fachlichen Module werden nach derselben Struktur dokumentiert. Dadurch bleiben Implementierung, Wartung und Erweiterung konsistent.

- 1. Fachliche Verantwortung
- 2. Aggregate und Entities
- 3. Datenbankmodell
- 4. SQL-DDLs
- 5. REST-Endpunkte
- 6. OpenAPI-Spezifikation
- 7. JSON-Schemas
- 8. Zustandsmodell
- 9. Sequenzdiagramme
- 10. Sicherheitsregeln
- 11. Testfälle
- 12. Architekturentscheidungen (ADR)

# Kapitel 34 – Modulreferenz: Artist

Verwaltet Künstlerprofile, Genres, Social Links und Verknüpfungen zu Events.

## Verantwortlichkeiten

- Eigene Datenhoheit innerhalb des Bounded Contexts
- REST-API und Domain-Services
- Domänenspezifische Validierungen
- Publizieren von Domain Events

## Technische Artefakte

- SQL-DDL
- OpenAPI 3.1
- JSON-Schema
- PlantUML-Klassendiagramm
- Sequenzdiagramme
- Testfälle

# Kapitel 35 – Modulreferenz: Venue

Verwaltet Veranstaltungsorte inklusive Kapazitäten, Adresse und Ausstattung.

## Verantwortlichkeiten

- Eigene Datenhoheit innerhalb des Bounded Contexts
- REST-API und Domain-Services
- Domänenspezifische Validierungen
- Publizieren von Domain Events

## Technische Artefakte

- SQL-DDL
- OpenAPI 3.1
- JSON-Schema
- PlantUML-Klassendiagramm
- Sequenzdiagramme
- Testfälle

# Kapitel 36 – Modulreferenz: Festival

Bündelt mehrere Events unter einem Festival.

## Verantwortlichkeiten

- Eigene Datenhoheit innerhalb des Bounded Contexts
- REST-API und Domain-Services
- Domänenspezifische Validierungen
- Publizieren von Domain Events

## Technische Artefakte

- SQL-DDL
- OpenAPI 3.1
- JSON-Schema
- PlantUML-Klassendiagramm
- Sequenzdiagramme
- Testfälle

# Kapitel 37 – Modulreferenz: Organizer

Verantwortlich für Planung und Verwaltung von Veranstaltungen.

## Verantwortlichkeiten

- Eigene Datenhoheit innerhalb des Bounded Contexts
- REST-API und Domain-Services
- Domänenspezifische Validierungen
- Publizieren von Domain Events

## Technische Artefakte

- SQL-DDL
- OpenAPI 3.1
- JSON-Schema
- PlantUML-Klassendiagramm
- Sequenzdiagramme
- Testfälle

# Kapitel 38 – Modulreferenz: Ticket

Reservierung, Kauf, Validierung und Rückerstattung von Tickets.

## Verantwortlichkeiten

- Eigene Datenhoheit innerhalb des Bounded Contexts
- REST-API und Domain-Services
- Domänenspezifische Validierungen
- Publizieren von Domain Events

## Technische Artefakte

- SQL-DDL
- OpenAPI 3.1
- JSON-Schema
- PlantUML-Klassendiagramm
- Sequenzdiagramme
- Testfälle

# Kapitel 39 – Modulreferenz: Community

Beiträge, Kommentare, Likes, Follows und Benachrichtigungen.

## Verantwortlichkeiten

- Eigene Datenhoheit innerhalb des Bounded Contexts
- REST-API und Domain-Services
- Domänenspezifische Validierungen
- Publizieren von Domain Events

## Technische Artefakte

- SQL-DDL
- OpenAPI 3.1
- JSON-Schema
- PlantUML-Klassendiagramm
- Sequenzdiagramme
- Testfälle

# Kapitel 40 – Modulreferenz: Discovery

Suche, Empfehlungen, Trends und personalisierte Feeds.

## Verantwortlichkeiten

- Eigene Datenhoheit innerhalb des Bounded Contexts
- REST-API und Domain-Services
- Domänenspezifische Validierungen
- Publizieren von Domain Events

## Technische Artefakte

- SQL-DDL
- OpenAPI 3.1
- JSON-Schema
- PlantUML-Klassendiagramm
- Sequenzdiagramme
- Testfälle

# Kapitel 41 – Implementierungsfahrplan

Die folgenden Versionen des Engineering Handbook vertiefen jedes Modul vollständig. Ziel ist eine vollständige Referenzdokumentation, aus der Backend-, Frontend- und Infrastrukturkomponenten unmittelbar umgesetzt werden können.

# Kapitel 42 – User-Modul: Aggregate und Domänenmodell

Das User-Modul bildet die Identitäts- und Profilverwaltung der Plattform.

Aggregate

Entities

Value Objects

User

UserProfile, UserRole

Email, Username

Privacy

PrivacySettings

Visibility

Authentication

Credential

PasswordPolicy

Preferences

NotificationSettings

Locale, Timezone

# Kapitel 43 – User-Modul: Validierungsregeln

- Benutzername weltweit eindeutig
- E-Mail eindeutig und verifiziert
- Passwort gemäß definierter Sicherheitsrichtlinie
- Display Name darf Sonderzeichen nur eingeschränkt enthalten
- Soft Delete statt physischer Löschung

# Kapitel 44 – User-Modul: Rollenmodell (RBAC)

Rolle

Berechtigungen

Guest

Öffentliche Inhalte lesen

User

Events, Community, Tickets

Creator

Zusätzliche Creator-Funktionen

Organizer

Events verwalten

Moderator

Moderation

Administrator

Vollzugriff

# Kapitel 45 – User-Modul: Beispiel-OpenAPI

GET /api/v1/users/{userId}Response:{  "userId":"uuid",  "username":"raver01",  "displayName":"Raver",  "status":"ACTIVE"}

# Kapitel 46 – User-Modul: Testfälle

- Registrierung mit gültigen Daten
- Registrierung mit doppelter E-Mail
- Login mit ungültigem Passwort
- Änderung des Anzeigenamens
- Sperrung und Reaktivierung
- Berechtigungsprüfung pro Rolle

# Kapitel 47 – Event-Modul: Aggregate und Domänenmodell

Das Event-Modul verwaltet den vollständigen Lebenszyklus von Veranstaltungen und koordiniert Beziehungen zu Venues, Artists, Festivals, Organizern und Tickets.

Aggregate

Entities

Value Objects

Event

Event, EventSchedule

TimeRange

Lineup

ArtistAssignment

PerformanceSlot

Venue

VenueReference

Address

Ticketing

TicketCategory

Price

# Kapitel 48 – Event-Modul: SQL-DDL (Beispiel)

CREATE TABLE events (  event_id UUID PRIMARY KEY,  venue_id UUID NOT NULL,  organizer_id UUID NOT NULL,  title VARCHAR(255) NOT NULL,  description TEXT,  starts_at TIMESTAMP NOT NULL,  ends_at TIMESTAMP NOT NULL,  status VARCHAR(20) NOT NULL,  created_at TIMESTAMP NOT NULL,  updated_at TIMESTAMP NOT NULL);

# Kapitel 49 – Event-Modul: REST/OpenAPI

Methode

Pfad

Zweck

GET

/api/v1/events

Events suchen

GET

/api/v1/events/{id}

Event lesen

POST

/api/v1/events

Event erstellen

PATCH

/api/v1/events/{id}

Event aktualisieren

POST

/api/v1/events/{id}/publish

Event veröffentlichen

POST

/api/v1/events/{id}/cancel

Event absagen

# Kapitel 50 – Event-Zustandsmodell

- Draft → Published
- Published → Running
- Running → Finished
- Published → Cancelled
- Finished → Archived

# Kapitel 51 – Event-Validierungsregeln

- Titel ist Pflichtfeld
- Endzeit muss nach der Startzeit liegen
- Venue muss vorhanden sein
- Mindestens ein Organizer
- Keine Veröffentlichung ohne Pflichtdaten

# Kapitel 52 – Event-Testfälle

- Event erfolgreich erstellen
- Veröffentlichung ohne Venue verhindern
- Zeitkonflikte erkennen
- Event absagen
- Archivierung nach Abschluss
- Suche nach Datum, Artist und Venue

> **Hinweis:** Die Modulreferenzen in Kapitel 34–41 sind Kurzfassungen. Kapitel 53–59 vertiefen dieselben Module; vollständige Spezifikationen folgen ab Kapitel 62 ff.

# Kapitel 53 – Modulreferenz: Artist

Technische Spezifikation des Moduls 'Artist'. Dieses Modul besitzt einen eigenen Bounded Context und eine klar definierte API.

## Verantwortlichkeiten

- Künstlerprofil verwalten
- Genres & Tags
- Social Links
- Verknüpfung zu Events

## Standardartefakte

- Domänenmodell
- SQL-DDL
- REST-/OpenAPI-Spezifikation
- JSON-Schemas
- PlantUML-Klassen- und Sequenzdiagramme
- Validierungsregeln
- Testfälle

# Kapitel 54 – Modulreferenz: Venue

Technische Spezifikation des Moduls 'Venue'. Dieses Modul besitzt einen eigenen Bounded Context und eine klar definierte API.

## Verantwortlichkeiten

- Standort
- Kapazität
- Ausstattung
- Öffnungszeiten

## Standardartefakte

- Domänenmodell
- SQL-DDL
- REST-/OpenAPI-Spezifikation
- JSON-Schemas
- PlantUML-Klassen- und Sequenzdiagramme
- Validierungsregeln
- Testfälle

# Kapitel 55 – Modulreferenz: Festival

Technische Spezifikation des Moduls 'Festival'. Dieses Modul besitzt einen eigenen Bounded Context und eine klar definierte API.

## Verantwortlichkeiten

- Mehrtägige Veranstaltungen
- Event-Zuordnung
- Stages
- Line-ups

## Standardartefakte

- Domänenmodell
- SQL-DDL
- REST-/OpenAPI-Spezifikation
- JSON-Schemas
- PlantUML-Klassen- und Sequenzdiagramme
- Validierungsregeln
- Testfälle

# Kapitel 56 – Modulreferenz: Organizer

Technische Spezifikation des Moduls 'Organizer'. Dieses Modul besitzt einen eigenen Bounded Context und eine klar definierte API.

## Verantwortlichkeiten

- Veranstaltungen planen
- Teams verwalten
- Freigaben
- Abrechnung

## Standardartefakte

- Domänenmodell
- SQL-DDL
- REST-/OpenAPI-Spezifikation
- JSON-Schemas
- PlantUML-Klassen- und Sequenzdiagramme
- Validierungsregeln
- Testfälle

# Kapitel 57 – Modulreferenz: Ticket

Technische Spezifikation des Moduls 'Ticket'. Dieses Modul besitzt einen eigenen Bounded Context und eine klar definierte API.

## Verantwortlichkeiten

- Ticketkategorien
- Kontingente
- Validierung
- Refunds

## Standardartefakte

- Domänenmodell
- SQL-DDL
- REST-/OpenAPI-Spezifikation
- JSON-Schemas
- PlantUML-Klassen- und Sequenzdiagramme
- Validierungsregeln
- Testfälle

# Kapitel 58 – Modulreferenz: Community

Technische Spezifikation des Moduls 'Community'. Dieses Modul besitzt einen eigenen Bounded Context und eine klar definierte API.

## Verantwortlichkeiten

- Posts
- Kommentare
- Likes
- Moderation

## Standardartefakte

- Domänenmodell
- SQL-DDL
- REST-/OpenAPI-Spezifikation
- JSON-Schemas
- PlantUML-Klassen- und Sequenzdiagramme
- Validierungsregeln
- Testfälle

# Kapitel 59 – Modulreferenz: Discovery

Technische Spezifikation des Moduls 'Discovery'. Dieses Modul besitzt einen eigenen Bounded Context und eine klar definierte API.

## Verantwortlichkeiten

- Suche
- Empfehlungen
- Trends
- Personalisierung

## Standardartefakte

- Domänenmodell
- SQL-DDL
- REST-/OpenAPI-Spezifikation
- JSON-Schemas
- PlantUML-Klassen- und Sequenzdiagramme
- Validierungsregeln
- Testfälle

# Kapitel 60 – Modulübergreifende Architektur

- API Gateway als Einstiegspunkt
- JWT-basierte Authentifizierung
- Asynchrone Kommunikation über Event Bus
- OpenTelemetry für Tracing
- Zentrale Observability
- Lose Kopplung zwischen Domänen

# Kapitel 61 – Weiteres Vorgehen

Die folgenden Ausgaben vertiefen jedes Modul mit vollständigen SQL-DDLs, OpenAPI-3.1-Spezifikationen, JSON-Schemas, PlantUML-Diagrammen, Architekturentscheidungen und Implementierungsbeispielen. Ziel ist eine vollständige Engineering-Referenz für die Umsetzung der Eternal-Rave-Plattform.

# Kapitel 62 – Ticket-Modul: Vollständige Spezifikation

Dieses Kapitel dient als Referenz dafür, wie alle weiteren Module detailliert dokumentiert werden.

## 62.1 Relationales Datenmodell

Feld

Typ

Beschreibung

ticket_id

UUID

Primärschlüssel

event_id

UUID

Referenz auf Event

user_id

UUID

Ticketinhaber

category

VARCHAR(50)

Ticketkategorie

status

VARCHAR(20)

RESERVED/PAID/CANCELLED/CHECKED_IN

price

DECIMAL(10,2)

Verkaufspreis

created_at

TIMESTAMP

Erstellt am

## 62.2 SQL-Indizes

- PRIMARY KEY(ticket_id)
- INDEX(event_id)
- INDEX(user_id)
- INDEX(status)
- UNIQUE(event_id, user_id, category) sofern fachlich erforderlich

## 62.3 REST-Endpunkte

Methode

Pfad

Zweck

POST

/api/v1/tickets

Ticket reservieren

POST

/api/v1/tickets/{id}/pay

Ticket bezahlen

POST

/api/v1/tickets/{id}/check-in

Check-in

POST

/api/v1/tickets/{id}/refund

Rückerstattung

GET

/api/v1/events/{id}/tickets

Tickets eines Events

## 62.4 Zustandsmaschine

- RESERVED → PAID
- PAID → CHECKED_IN
- PAID → REFUNDED
- RESERVED → CANCELLED

## 62.5 Sicherheitsregeln

- Nur Besitzer oder berechtigte Organisatoren dürfen Tickets lesen.
- Check-in nur für berechtigte Rollen.
- Jeder Statuswechsel wird auditierbar protokolliert.

## 62.6 Testfälle

- Reservierung erfolgreich
- Doppelte Reservierung verhindern
- Check-in nur einmal zulassen
- Refund nach Veranstaltungsregeln
- Ungültige Statuswechsel ablehnen

# Kapitel 63 – Ausbauplan

Die gleiche Detailtiefe wird in den folgenden Versionen für Artist, Venue, Festival, Organizer, Community und Discovery übernommen. So entsteht schrittweise eine vollständige technische Referenz mit implementierungsnahen Spezifikationen für jede Domäne.

# Kapitel 64 – Artist-Modul: Vollständige Spezifikation

Dieses Kapitel beschreibt das Artist-Modul als implementierungsnahe Referenz.

## Datenmodell

Feld

Typ

Beschreibung

artist_id

UUID

Primärschlüssel

name

VARCHAR(200)

Künstlername

genre

VARCHAR(100)

Hauptgenre

verified

BOOLEAN

Verifizierter Artist

country

VARCHAR(100)

Herkunftsland

## REST-Endpunkte

Methode

Pfad

Zweck

GET

/api/v1/artists

Artists suchen

GET

/api/v1/artists/{id}

Artist abrufen

POST

/api/v1/artists

Artist anlegen

PATCH

/api/v1/artists/{id}

Artist aktualisieren

## Zustände

- DRAFT → VERIFIED
- VERIFIED → ARCHIVED

## Technische Anforderungen

- Optimistic Locking
- Audit Logging
- Domain Events
- OpenAPI 3.1
- JSON Schema
- PlantUML-Diagramme
- Unit-, Integrations- und E2E-Tests

# Kapitel 65 – Venue-Modul: Vollständige Spezifikation

Dieses Kapitel beschreibt das Venue-Modul als implementierungsnahe Referenz.

## Datenmodell

Feld

Typ

Beschreibung

venue_id

UUID

Primärschlüssel

name

VARCHAR(255)

Location

capacity

INTEGER

Kapazität

city

VARCHAR(120)

Ort

country

VARCHAR(120)

Land

## REST-Endpunkte

Methode

Pfad

Zweck

GET

/api/v1/venues

Venues suchen

POST

/api/v1/venues

Venue anlegen

PATCH

/api/v1/venues/{id}

Venue aktualisieren

## Zustände

- ACTIVE
- RENOVATION
- CLOSED
- ARCHIVED

## Technische Anforderungen

- Optimistic Locking
- Audit Logging
- Domain Events
- OpenAPI 3.1
- JSON Schema
- PlantUML-Diagramme
- Unit-, Integrations- und E2E-Tests

# Kapitel 66 – Nächste Ausbaustufen

Als Nächstes folgen Festival-, Organizer-, Community- und Discovery-Module im gleichen Detailgrad. Anschließend werden bereichsübergreifende Themen wie Event Bus, Berechtigungsmodell, Caching, Messaging, Kubernetes, Observability, CI/CD und Disaster Recovery vollständig spezifiziert.

# Kapitel 67 – Festival-Modul: Vollständige Spezifikation

Implementierungsreferenz für das Modul Festival.

## Relationales Datenmodell

Feld

Typ

Beschreibung

festival_id

UUID

Primärschlüssel

name

VARCHAR(255)

Festivalname

start_date

DATE

Beginn

end_date

DATE

Ende

status

VARCHAR(20)

Status

## REST-Endpunkte

Methode

Pfad

Beschreibung

GET

/api/v1/festivals

Festivals suchen

POST

/api/v1/festivals

Festival erstellen

PATCH

/api/v1/festivals/{id}

Festival aktualisieren

## Zustandsmodell

- PLANNED
- PUBLISHED
- RUNNING
- FINISHED
- ARCHIVED

## Qualitätsanforderungen

- OpenAPI 3.1 vollständig dokumentiert
- JSON-Schema für Requests und Responses
- PlantUML Klassen- und Sequenzdiagramme
- Audit Logging
- Domain Events
- Unit-, Integrations- und E2E-Tests

# Kapitel 68 – Organizer-Modul: Vollständige Spezifikation

Implementierungsreferenz für das Modul Organizer.

## Relationales Datenmodell

Feld

Typ

Beschreibung

organizer_id

UUID

Primärschlüssel

name

VARCHAR(255)

Organisation

verified

BOOLEAN

Verifiziert

country

VARCHAR(120)

Land

## REST-Endpunkte

Methode

Pfad

Beschreibung

GET

/api/v1/organizers

Organizer suchen

POST

/api/v1/organizers

Organizer erstellen

PATCH

/api/v1/organizers/{id}

Organizer aktualisieren

## Zustandsmodell

- NEW
- VERIFIED
- SUSPENDED
- ARCHIVED

## Qualitätsanforderungen

- OpenAPI 3.1 vollständig dokumentiert
- JSON-Schema für Requests und Responses
- PlantUML Klassen- und Sequenzdiagramme
- Audit Logging
- Domain Events
- Unit-, Integrations- und E2E-Tests

# Kapitel 69 – Plattformweite Architekturbausteine

- API Gateway
- Identity Provider
- Event Bus
- Caching mit Redis
- OpenSearch
- Object Storage für Medien
- Kubernetes als Zielplattform
- CI/CD mit automatisierten Deployments
- OpenTelemetry, Prometheus und Grafana

# Kapitel 70 – Ausblick

Als Nächstes folgen Community- und Discovery-Module sowie bereichsübergreifende Spezifikationen für Messaging, Benachrichtigungen, Berechtigungen, Integrationen, Backup, Disaster Recovery und Betriebsprozesse.

# Kapitel 71 – Community-Modul: Vollständige Spezifikation

Das Community-Modul bildet die soziale Interaktion innerhalb der Plattform.

## Kernfunktionen

- Posts
- Kommentare
- Likes
- Folgen
- Meldungen
- Moderation

## REST-Endpunkte

- GET /api/v1/posts
- POST /api/v1/posts
- POST /api/v1/posts/{id}/like
- POST /api/v1/posts/{id}/report

## Domain Events

- PostCreated
- CommentAdded
- PostLiked
- PostReported

# Kapitel 72 – Discovery-Modul: Vollständige Spezifikation

Discovery stellt Suche, Empfehlungen und personalisierte Inhalte bereit.

## Kernkomponenten

- OpenSearch-Indexe
- Autocomplete
- Geo-Suche
- Personalisierte Empfehlungen
- Trending Events
- Ähnliche Artists

# Kapitel 73 – C4-Architektur

- Level 1: Nutzer, externe Dienste und Eternal Rave
- Level 2: Web, Mobile, API Gateway, Backend, Datenbanken
- Level 3: Komponenten je Domänenservice
- Level 4: Code-Diagramme für komplexe Module

# Kapitel 74 – ADR-Katalog

ADR

Entscheidung

Status

ADR-005

Redis als zentraler Cache

Accepted

ADR-006

OpenSearch für Discovery

Accepted

ADR-007

Event Bus für asynchrone Prozesse

Accepted

ADR-008

OpenTelemetry als Observability-Standard

Accepted

# Kapitel 75 – Kubernetes-Referenzarchitektur

- Ingress Controller
- API Gateway
- Backend Deployments
- Worker Deployments
- Horizontal Pod Autoscaler
- PostgreSQL
- Redis
- OpenSearch
- Object Storage
- Monitoring Stack (Prometheus, Grafana, Loki)

# Kapitel 76 – CI/CD-Blueprint

- Pull Request mit Pflicht-Reviews
- Automatische Unit-, Integrations- und Sicherheitstests
- Container Build
- SBOM-Generierung
- Deployment nach Staging
- Blue/Green- oder Canary-Deployment
- Automatischer Rollback bei Fehlern

# Kapitel 77 – OpenAPI-3.1-Standards

Alle Services folgen einer einheitlichen OpenAPI-3.1-Spezifikation.

- Versionierung über /api/v1
- Problem Details (RFC 9457) für Fehlerantworten
- JWT Bearer Authentication
- Pagination, Filterung und Sortierung als Standard
- Idempotency-Key für kritische POST-Endpunkte

# Kapitel 78 – SQL-Standards

- UUID als Primärschlüssel
- created_at, updated_at und version in allen Aggregaten
- Foreign Keys mit ON DELETE-Regeln je Domäne
- Soft Deletes nur bei fachlichem Bedarf
- B-Tree-Indizes für häufige Suchfelder
- GIN-Indizes für Volltextsuche

# Kapitel 79 – Event Bus

Domänenereignisse werden asynchron publiziert und konsumiert.

Event

Producer

Consumer

EventPublished

Event Service

Discovery, Notification

TicketPurchased

Ticket Service

Analytics, Notification

ArtistVerified

Artist Service

Discovery

PostCreated

Community Service

Moderation, Feed

# Kapitel 80 – Sicherheitsrichtlinien

- OWASP ASVS als Referenz
- Least-Privilege-Prinzip
- Verschlüsselung sensibler Daten im Ruhezustand und während der Übertragung
- Audit-Trail für sicherheitsrelevante Aktionen
- Rate Limiting und API-Throttling
- Security-Header und Content Security Policy

# Kapitel 81 – Betriebs- und Monitoringkonzept

- Health-, Readiness- und Liveness-Probes
- SLI/SLO-Definitionen
- Zentrales Log-Management
- Distributed Tracing
- Alarmierung nach Schweregrad
- Runbooks für kritische Incidents

# Kapitel 82 – OpenAPI-Blueprint: Event Service

Referenzstruktur für eine vollständige OpenAPI-3.1-Spezifikation des Event Service.

- GET /api/v1/events
- GET /api/v1/events/{id}
- POST /api/v1/events
- PATCH /api/v1/events/{id}
- DELETE /api/v1/events/{id}
- POST /api/v1/events/{id}/publish

# Kapitel 83 – JSON-Schema-Konventionen

- UUID-Format für IDs
- RFC3339 für Datum/Zeit
- Enum-Typen für Statuswerte
- Keine zusätzlichen Properties ohne Freigabe
- Versionierte Schemas für Breaking Changes

# Kapitel 84 – Datenbank-Migrationsstrategie

- Flyway oder Liquibase als Standard
- Vorwärtskompatible Migrationen
- Rollback-Skripte für kritische Änderungen
- Migrationen Bestandteil jeder CI/CD-Pipeline
- Automatische Schema-Validierung

# Kapitel 85 – Deployment-Blueprint

- Helm Charts pro Service
- Separate Namespaces je Umgebung
- Secrets über External Secrets oder Vault
- Horizontal Pod Autoscaler
- Rolling Updates als Standard
- Blue/Green für kritische Releases

# Kapitel 86 – Disaster Recovery

- RPO und RTO je Domäne definieren
- Tägliche Datenbanksicherungen
- Regelmäßige Restore-Tests
- Geo-redundante Speicherung wichtiger Daten
- Dokumentierte Notfallprozesse

# Kapitel 87 – Engineering-Roadmap

Die nächsten Versionen konzentrieren sich auf vollständige Implementierungsartefakte für jede Domäne: vollständige OpenAPI-Dokumente, SQL-DDLs, JSON-Schemas, PlantUML-Quelltexte, ADRs, Testkataloge sowie Referenzimplementierungen für Backend-Services.

# Kapitel 88 – Referenzstruktur eines Microservices

Alle Backend-Services folgen einer einheitlichen Projektstruktur.

- api/ (REST-Controller, DTOs, OpenAPI)
- application/ (Use Cases)
- domain/ (Aggregate, Entities, Value Objects)
- infrastructure/ (Persistence, Messaging, Integrationen)
- config/ (Konfiguration)
- test/ (Unit-, Integrations- und E2E-Tests)

# Kapitel 89 – Coding Standards

- Java 21 LTS
- Spring Boot 3.x
- Hexagonale Architektur
- Constructor Injection
- Keine Businesslogik in Controllern
- Klare Trennung von Domain und Infrastruktur
- Checkstyle und SpotBugs in der Pipeline

# Kapitel 90 – API-Governance

Thema

Standard

Verpflichtend

Versionierung

/api/v1

Ja

Authentifizierung

JWT/OAuth2

Ja

Fehlerformat

RFC 9457

Ja

Pagination

cursor oder page/size

Ja

Idempotenz

Idempotency-Key

Bei kritischen POSTs

# Kapitel 91 – Testpyramide

- Unit-Tests für Domainlogik
- Integrations-Tests für Datenbank und Messaging
- API-Tests gegen OpenAPI
- End-to-End-Tests für kritische Geschäftsprozesse
- Performance- und Lasttests vor Releases

# Kapitel 92 – Release-Management

- Semantic Versioning
- Release Notes automatisch generieren
- Feature Flags für neue Funktionen
- Canary Releases für risikoreiche Änderungen
- Rollback-Strategie dokumentiert

# Kapitel 93 – Nächste Ausbaustufe

In den folgenden Versionen werden die Module Event, Ticket, Artist, Venue, Festival, Organizer, Community und Discovery mit vollständigen OpenAPI-3.1-Dokumenten, SQL-DDLs, JSON-Schemas, PlantUML-Quelltexten und Referenzimplementierungen vervollständigt.

# Kapitel 94 – Referenzprojektstruktur (Java/Spring Boot)

Empfohlene Verzeichnisstruktur für jeden Microservice.

- src/main/java/.../api
- src/main/java/.../application
- src/main/java/.../domain
- src/main/java/.../infrastructure
- src/main/resources/db/migration
- src/test/java
- src/test/resources

# Kapitel 95 – OpenAPI-Datei (Referenzaufbau)

Mindestbestandteile jeder OpenAPI-3.1-Spezifikation:

- info (Titel, Version, Kontakt)
- servers
- securitySchemes
- paths
- components/schemas
- responses
- examples
- tags

# Kapitel 96 – SQL-DDL-Richtlinien

Objekt

Standard

Begründung

Primärschlüssel

UUID

Globale Eindeutigkeit

Zeitstempel

created_at / updated_at

Nachvollziehbarkeit

Optimistic Locking

version

Konfliktvermeidung

Indizes

Such- und FK-Spalten

Performance

# Kapitel 97 – PlantUML-Standards

- Klassen-, Sequenz-, Aktivitäts- und Zustandsdiagramme
- Ein Diagramm pro Aggregate Root
- Ein Sequenzdiagramm pro Haupt-Use-Case
- C4-Diagramme ergänzend für Architekturübersichten

# Kapitel 98 – Qualitäts-Gates

- Build erfolgreich
- >=80 % Testabdeckung für Kernlogik (projektabhängig anpassbar)
- Keine kritischen Sicherheitsbefunde
- Keine Blocker im statischen Code-Scan
- Erfolgreiche Datenbankmigration
- Freigabe durch Code-Review

# Kapitel 99 – Roadmap Version 5.x

Version 5.x konzentriert sich auf vollständige Referenzartefakte je Domäne: vollständige OpenAPI-YAMLs, SQL-DDLs, JSON-Schemas, PlantUML-Quelltexte, ADRs, Kubernetes-Manifestbeispiele sowie Referenzimplementierungen für zentrale Geschäftsprozesse.

# Kapitel 100 – Domänenglossar

Ein zentrales Glossar stellt sicher, dass alle Teams dieselben fachlichen Begriffe verwenden.

Begriff

Definition

Domäne

Event

Durchführbare Veranstaltung

Event

Festival

Sammlung mehrerer Events

Festival

Venue

Veranstaltungsort

Venue

Organizer

Verantwortlicher Veranstalter

Organizer

Ticket

Zugangsberechtigung

Ticket

Artist

Auftretender Künstler

Artist

# Kapitel 101 – Domänenereigniskatalog

- UserRegistered
- UserVerified
- ArtistVerified
- VenueApproved
- FestivalPublished
- EventPublished
- TicketReserved
- TicketPurchased
- TicketRefunded
- PostCreated
- CommentAdded
- NotificationSent

# Kapitel 102 – Namenskonventionen

- REST-Pfade in Kleinbuchstaben und Pluralform
- Events im Past-Tense (z. B. TicketPurchased)
- Tabellen im snake_case
- Java-Klassen im PascalCase
- JSON-Felder im camelCase
- Umgebungsvariablen in UPPER_SNAKE_CASE

# Kapitel 103 – ADR-Vorlage

- Kontext
- Problemstellung
- Optionen
- Entscheidung
- Konsequenzen
- Alternativen
- Status
- Datum

# Kapitel 104 – Pull-Request-Checkliste

- Architektur eingehalten
- Tests erfolgreich
- OpenAPI aktualisiert
- SQL-Migration geprüft
- Dokumentation ergänzt
- Sicherheitsaspekte bewertet
- Code Review abgeschlossen

# Kapitel 105 – Ausblick Version 5.2

Die nächste Ausbaustufe erweitert das Handbuch um vollständige Referenzvorlagen für OpenAPI-YAMLs, SQL-DDLs, JSON-Schemas, PlantUML-Quelltexte, Kubernetes-Manifeste und exemplarische Backend-Implementierungen einzelner Geschäftsprozesse.

# Kapitel 106 – OpenAPI-YAML-Referenzstruktur

Empfohlene Verzeichnisstruktur für versionierte OpenAPI-Definitionen.

- openapi.yaml als Einstiegspunkt
- paths/ je Ressource
- components/schemas/
- components/responses/
- components/parameters/
- components/securitySchemes/
- examples/ für Request- und Response-Beispiele

# Kapitel 107 – SQL-DDL-Referenzvorlage

Jede Domäne erhält eine vollständige DDL inklusive Constraints, Indizes und Migrationen.

> CREATE TABLE event (  event_id UUID PRIMARY KEY,  organizer_id UUID NOT NULL,  title VARCHAR(255) NOT NULL,  status VARCHAR(32) NOT NULL,  created_at TIMESTAMP NOT NULL,  updated_at TIMESTAMP NOT NULL,  version BIGINT NOT NULL);

# Kapitel 108 – JSON-Schema-Blueprint

- $schema nach JSON Schema 2020-12
- $id für Versionierung
- required-Felder explizit definieren
- additionalProperties standardmäßig false
- Enum-Typen zentral wiederverwenden

# Kapitel 109 – PlantUML-Konventionen

> @startumlclass Eventclass OrganizerOrganizer --> Event : creates@enduml

# Kapitel 110 – Referenz-Implementierungsprozess

- Domänenmodell definieren
- SQL-DDL erstellen
- Migration schreiben
- OpenAPI spezifizieren
- DTOs und Validierung implementieren
- Use Cases entwickeln
- Tests erstellen
- Deployment automatisieren

# Kapitel 111 – Zielbild Version 6.0

Version 6.0 soll für jede Kern-Domäne vollständige Referenzartefakte inklusive Datenmodell, OpenAPI, SQL, JSON-Schemas, UML, ADRs und exemplarischer Implementierungen bereitstellen. Damit entsteht ein konsistentes Engineering-Handbuch als Grundlage für Entwicklung, Betrieb und zukünftige Erweiterungen der Eternal-Rave-Plattform.

# Kapitel 112 – API-Versionierungsstrategie

- Semantic Versioning für APIs
- Nicht-brechende Änderungen innerhalb einer Hauptversion
- Deprecation-Header und Sunset-Header
- Paralleler Betrieb mehrerer API-Versionen während Migrationen

# Kapitel 113 – Referenz: Event OpenAPI-Endpunkt

Beispiel für die vollständige Dokumentation eines Endpunkts.

> GET /api/v1/events/{eventId}200 OK- eventId (UUID)- title (string)- status (enum)- venueId (UUID)- organizerId (UUID)404 Problem Details (RFC 9457)

# Kapitel 114 – Referenz: SQL-Migrationsrichtlinien

- Eine Migration pro fachlicher Änderung
- Keine nachträglichen Änderungen veröffentlichter Migrationen
- Vor jeder Migration Datenbanksicherung prüfen
- Automatische Validierung in CI

# Kapitel 115 – Referenz: Kubernetes-Deployment

- Deployment je Microservice
- Service und Ingress getrennt verwalten
- ConfigMaps für Konfiguration
- Secrets über Vault/External Secrets
- Ressourcenlimits verpflichtend
- PodDisruptionBudgets für kritische Dienste

# Kapitel 116 – Engineering-KPIs

Kennzahl

Ziel

Deployment-Erfolgsrate

>99 %

Build-Dauer

<10 Minuten

MTTR

<60 Minuten

API-Verfügbarkeit

>99,9 %

Kritische Sicherheitslücken

0

# Kapitel 117 – Ausblick Version 5.3

Als Nächstes werden vollständige Referenzartefakte für einzelne Domänen (z. B. Event oder Ticket) mit vollständigen OpenAPI-YAMLs, SQL-DDLs, JSON-Schemas und PlantUML-Quelltexten ergänzt, sodass daraus eine direkt umsetzbare technische Spezifikation entsteht.

# Kapitel 118 – Vollständige OpenAPI-Referenz: Event Service

Nachfolgend eine Referenzstruktur einer OpenAPI-3.1-YAML für den Event Service.

> openapi: 3.1.0info:  title: Eternal Rave Event API  version: 1.0.0paths:  /api/v1/events:    get:      summary: List events    post:      summary: Create event  /api/v1/events/{eventId}:    get:      summary: Get event    patch:      summary: Update event    delete:      summary: Delete event

# Kapitel 119 – Referenz-DDL: Event

> CREATE TABLE event ( event_id UUID PRIMARY KEY, organizer_id UUID NOT NULL, venue_id UUID NOT NULL, title VARCHAR(255) NOT NULL, description TEXT, status VARCHAR(32) NOT NULL, start_time TIMESTAMP NOT NULL, end_time TIMESTAMP NOT NULL, created_at TIMESTAMP NOT NULL, updated_at TIMESTAMP NOT NULL, version BIGINT NOT NULL);

# Kapitel 120 – JSON-Schema: EventResponse

> {  "type":"object",  "required":["eventId","title","status"],  "properties":{    "eventId":{"type":"string","format":"uuid"},    "title":{"type":"string"},    "status":{"type":"string"}  },  "additionalProperties":false}

# Kapitel 121 – PlantUML: Event-Domäne

> @startumlclass Organizerclass Venueclass EventOrganizer --> EventVenue --> Event@enduml

# Kapitel 122 – Referenz-Implementierung

Für jede Domäne soll künftig eine vollständige Referenzimplementierung bereitgestellt werden. Diese umfasst:

- Aggregate Root
- Value Objects
- Repository-Interface
- Application Service
- REST-Controller
- DTOs
- Mapper
- Flyway-Migration
- OpenAPI-Datei
- Unit- und Integrationstests

# Kapitel 123 – Vollständige OpenAPI-Referenz: Ticket Service

Referenz für eine vollständige OpenAPI-3.1-Spezifikation des Ticket-Service.

> openapi: 3.1.0paths:  /api/v1/tickets:    get: {}    post: {}  /api/v1/tickets/{ticketId}:    get: {}    patch: {}  /api/v1/tickets/{ticketId}/pay:    post: {}  /api/v1/tickets/{ticketId}/refund:    post: {}

# Kapitel 124 – Referenz-DDL: Ticket

> CREATE TABLE ticket (  ticket_id UUID PRIMARY KEY,  event_id UUID NOT NULL,  user_id UUID NOT NULL,  category VARCHAR(64) NOT NULL,  status VARCHAR(32) NOT NULL,  price DECIMAL(10,2) NOT NULL,  currency CHAR(3) NOT NULL,  created_at TIMESTAMP NOT NULL,  updated_at TIMESTAMP NOT NULL,  version BIGINT NOT NULL);

# Kapitel 125 – JSON-Schema: TicketResponse

> {  "type":"object",  "required":["ticketId","eventId","status"],  "properties":{    "ticketId":{"type":"string","format":"uuid"},    "eventId":{"type":"string","format":"uuid"},    "status":{"type":"string"},    "price":{"type":"number"}  },  "additionalProperties":false}

# Kapitel 126 – PlantUML: Ticket-Domäne

> @startumlclass Userclass Ticketclass EventUser --> TicketEvent --> Ticket@enduml

# Kapitel 127 – Referenz-Checkliste je Domäne

- Domänenmodell abgeschlossen
- OpenAPI 3.1 vollständig
- SQL-DDLs und Migrationen erstellt
- JSON-Schemas validiert
- PlantUML-Diagramme vorhanden
- Repository- und Service-Schicht implementiert
- Testabdeckung dokumentiert
- ADR aktualisiert

# Kapitel 128 – Vollständige OpenAPI-Referenz: Artist Service

Referenzstruktur für die OpenAPI-3.1-Spezifikation des Artist-Service.

> openapi: 3.1.0paths:  /api/v1/artists:    get: {}    post: {}  /api/v1/artists/{artistId}:    get: {}    patch: {}    delete: {}  /api/v1/artists/{artistId}/verify:    post: {}

# Kapitel 129 – Referenz-DDL: Artist

> CREATE TABLE artist (  artist_id UUID PRIMARY KEY,  stage_name VARCHAR(255) NOT NULL,  legal_name VARCHAR(255),  country VARCHAR(100),  verified BOOLEAN NOT NULL DEFAULT FALSE,  created_at TIMESTAMP NOT NULL,  updated_at TIMESTAMP NOT NULL,  version BIGINT NOT NULL);

# Kapitel 130 – JSON-Schema: ArtistResponse

> { "type":"object", "required":["artistId","stageName","verified"], "properties":{   "artistId":{"type":"string","format":"uuid"},   "stageName":{"type":"string"},   "verified":{"type":"boolean"} }, "additionalProperties":false}

# Kapitel 131 – PlantUML: Artist-Domäne

> @startumlclass Artistclass EventArtist --> Event : performs at@enduml

# Kapitel 132 – Architektur-Checkliste

- Bounded Context definiert
- Aggregate Root dokumentiert
- OpenAPI veröffentlicht
- SQL-DDL versioniert
- JSON-Schemas validiert
- Domain Events beschrieben
- Monitoring und Metriken definiert
- Sicherheitsprüfung abgeschlossen

# Kapitel 133 – Vollständige OpenAPI-Referenz: Venue Service

> openapi: 3.1.0paths:  /api/v1/venues:    get: {}    post: {}  /api/v1/venues/{venueId}:    get: {}    patch: {}    delete: {}

# Kapitel 134 – Referenz-DDL: Venue

> CREATE TABLE venue ( venue_id UUID PRIMARY KEY, name VARCHAR(255) NOT NULL, city VARCHAR(120) NOT NULL, country VARCHAR(120) NOT NULL, capacity INTEGER, verified BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMP NOT NULL, updated_at TIMESTAMP NOT NULL, version BIGINT NOT NULL);

# Kapitel 135 – OpenAPI-Referenz: Festival Service

> openapi: 3.1.0paths:  /api/v1/festivals:    get: {}    post: {}  /api/v1/festivals/{festivalId}:    get: {}    patch: {}  /api/v1/festivals/{festivalId}/publish:    post: {}

# Kapitel 136 – Referenz-DDL: Festival

> CREATE TABLE festival ( festival_id UUID PRIMARY KEY, organizer_id UUID NOT NULL, name VARCHAR(255) NOT NULL, start_date DATE NOT NULL, end_date DATE NOT NULL, status VARCHAR(32) NOT NULL, created_at TIMESTAMP NOT NULL, updated_at TIMESTAMP NOT NULL, version BIGINT NOT NULL);

# Kapitel 137 – Integrationsmatrix

Überblick über zentrale Service-Interaktionen.

Quelle

Ziel

Ereignis/API

Event

Discovery

EventPublished

Festival

Event

FestivalCreated

Ticket

Notification

TicketPurchased

Artist

Event

ArtistAssigned

Venue

Event

VenueUpdated

# Kapitel 138 – Nächste Ausbaustufe

- Organizer-Service vollständig spezifizieren
- Community-Service vollständig spezifizieren
- Discovery-Service vollständig spezifizieren
- Domänenübergreifende Sequenzdiagramme ergänzen
- Referenzcode für zentrale Use Cases erstellen

# Kapitel 139 – Vollständige OpenAPI-Referenz: Organizer Service

> openapi: 3.1.0paths:  /api/v1/organizers:    get: {}    post: {}  /api/v1/organizers/{organizerId}:    get: {}    patch: {}  /api/v1/organizers/{organizerId}/verify:    post: {}

# Kapitel 140 – Referenz-DDL: Organizer

> CREATE TABLE organizer (  organizer_id UUID PRIMARY KEY,  name VARCHAR(255) NOT NULL,  email VARCHAR(255),  verified BOOLEAN NOT NULL DEFAULT FALSE,  country VARCHAR(120),  created_at TIMESTAMP NOT NULL,  updated_at TIMESTAMP NOT NULL,  version BIGINT NOT NULL);

# Kapitel 141 – OpenAPI-Referenz: Community Service

> openapi: 3.1.0paths:  /api/v1/posts:    get: {}    post: {}  /api/v1/posts/{postId}:    get: {}    patch: {}    delete: {}  /api/v1/posts/{postId}/comments:    post: {}

# Kapitel 142 – Referenz-DDL: Community

> CREATE TABLE post (  post_id UUID PRIMARY KEY,  author_id UUID NOT NULL,  content TEXT NOT NULL,  visibility VARCHAR(32) NOT NULL,  created_at TIMESTAMP NOT NULL,  updated_at TIMESTAMP NOT NULL,  version BIGINT NOT NULL);

# Kapitel 143 – Sequenzdiagramm: Ticketkauf

> @startumlUser -> API : Buy TicketAPI -> TicketService : reserve()TicketService -> PaymentService : pay()PaymentService --> TicketService : successTicketService -> NotificationService : TicketPurchased@enduml

# Kapitel 144 – Nächste Schritte

- Discovery-Service vollständig spezifizieren
- Benachrichtigungsservice dokumentieren
- Authentifizierungs- und Autorisierungskonzept vertiefen
- Komplette C4- und Sequenzdiagrammsammlung erstellen
- Referenzimplementierungen für End-to-End-Use-Cases ergänzen

# Kapitel 145 – Vollständige OpenAPI-Referenz: Discovery Service

> openapi: 3.1.0paths:  /api/v1/discovery/search:    get: {}  /api/v1/discovery/recommendations:    get: {}  /api/v1/discovery/trending:    get: {}  /api/v1/discovery/similar/{artistId}:    get: {}

# Kapitel 146 – Referenz-DDL: Discovery Index

> CREATE TABLE discovery_document (  document_id UUID PRIMARY KEY,  entity_type VARCHAR(32) NOT NULL,  entity_id UUID NOT NULL,  title VARCHAR(255) NOT NULL,  searchable_text TEXT NOT NULL,  geo_location POINT,  indexed_at TIMESTAMP NOT NULL);

# Kapitel 147 – Notification Service

- E-Mail-Benachrichtigungen
- Push Notifications
- In-App-Benachrichtigungen
- Webhook-Auslieferung
- Retry-Mechanismus mit Dead Letter Queue
- Template-Verwaltung und Lokalisierung

# Kapitel 148 – Authentifizierung & Autorisierung

- OAuth2 / OpenID Connect
- JWT Access- und Refresh-Tokens
- Role-Based Access Control (RBAC)
- Optional Attribute-Based Access Control (ABAC)
- Mehrfaktor-Authentifizierung für privilegierte Konten
- Auditierung sicherheitsrelevanter Aktionen

# Kapitel 149 – End-to-End-Sequenz: Event veröffentlichen

> @startumlOrganizer -> API : Publish EventAPI -> EventService : publish()EventService -> DiscoveryService : EventPublishedEventService -> NotificationService : notifyFollowers()DiscoveryService --> SearchIndex : update@enduml

# Kapitel 150 – Zielbild Version 6.0

Mit Abschluss der Version 6.0 soll jede Kern-Domäne über vollständige OpenAPI-3.1-Spezifikationen, SQL-DDLs, JSON-Schemas, PlantUML-Quelltexte, Referenzimplementierungen, Architekturdiagramme, ADRs sowie Betriebs- und Sicherheitskonzepte verfügen. Das Handbuch dient dann als durchgängige technische Referenz für Entwicklung, Test, Deployment und Betrieb der Eternal-Rave-Plattform.

# Kapitel 151 – Vollständige OpenAPI-YAML: Event Service (Auszug)

> openapi: 3.1.0info:  title: Eternal Rave Event API  version: 1.0.0components:  securitySchemes:    bearerAuth:      type: http      scheme: bearer      bearerFormat: JWTsecurity:  - bearerAuth: []paths:  /api/v1/events:    get:      tags: [Events]      summary: List events      responses:        '200':          description: Success

# Kapitel 152 – SQL-DDL: Event-Relationen

> ALTER TABLE eventADD CONSTRAINT fk_event_organizerFOREIGN KEY (organizer_id)REFERENCES organizer(organizer_id);CREATE INDEX idx_event_start_timeON event(start_time);

# Kapitel 153 – JSON-Schema: EventCreateRequest

> { "type":"object", "required":["title","venueId","startTime","endTime"], "properties":{   "title":{"type":"string","minLength":3},   "venueId":{"type":"string","format":"uuid"},   "startTime":{"type":"string","format":"date-time"},   "endTime":{"type":"string","format":"date-time"} }, "additionalProperties":false}

# Kapitel 154 – Referenz-Use-Case: Event veröffentlichen

- Validierung der Eingabedaten
- Prüfung der Organizer-Berechtigung
- Persistieren des Events
- Publizieren des Domain Events EventPublished
- Aktualisierung des Discovery-Index
- Benachrichtigung der Follower

# Kapitel 155 – Version 6.0 Roadmap

Die folgenden Kapitel werden vollständige OpenAPI-Spezifikationen, SQL-DDLs, JSON-Schemas, PlantUML-Quelltexte und Referenzcode für alle verbleibenden Kernmodule enthalten. Ziel ist ein vollständig implementierungsnahes Engineering-Handbuch für Eternal Rave.

# Kapitel 156 – API-Katalog

Alle öffentlichen und internen APIs werden zentral katalogisiert.

Service

Version

Authentifizierung

Status

Event

v1

JWT

Produktiv

Ticket

v1

JWT

Produktiv

Artist

v1

JWT

Geplant

Discovery

v1

JWT

Geplant

# Kapitel 157 – Domain-Event-Katalog

- EventPublished
- EventCancelled
- TicketPurchased
- TicketRefunded
- ArtistVerified
- FestivalPublished
- UserFollowedArtist

# Kapitel 158 – Infrastruktur-Blueprint

- Kubernetes als Orchestrierungsplattform
- Helm-Charts pro Microservice
- Terraform für Cloud-Ressourcen
- Ingress + API Gateway
- Managed PostgreSQL
- Redis für Caching
- Objektspeicher für Medien
- OpenTelemetry für Telemetrie

# Kapitel 159 – Betriebsmodell

- Blue/Green-Deployments
- Canary Releases
- Automatisierte Rollbacks
- SLO-/SLI-Überwachung
- 24/7 Alerting
- Disaster-Recovery-Tests

# Kapitel 160 – Architektur-Zielbild 6.x

Mit der 6.x-Reihe wird das Handbuch zu einer vollständigen Enterprise-Architecture-Spezifikation. Es dient als Referenz für Architektur, Implementierung, Qualitätssicherung, Deployment und Betrieb sämtlicher Eternal-Rave-Microservices und schafft eine einheitliche Grundlage für Entwicklungsteams und langfristige Wartung.

# Kapitel 161 – Datenkatalog

Jede Domäne erhält ein normiertes Datenblatt mit Entitäten, Attributen, Ownership, Lebenszyklus und Datenschutzklassifizierung.

# Kapitel 162 – API Governance

- Semantic Versioning
- Deprecation Policy
- Backward Compatibility
- Contract Testing
- Consumer Driven Contracts
- API Review Board

# Kapitel 163 – Security Architecture

- Zero Trust
- Secrets Management
- Key Rotation
- OIDC Federation
- Least Privilege
- Audit Logging

# Teil VII – Vertikale Referenzspezifikation: Event-Domäne

## Kapitel 164 – Domänenverantwortung

Der Event-Service verwaltet den vollständigen Lebenszyklus von Veranstaltungen – von der Erstellung über Veröffentlichung und Aktualisierung bis zur Archivierung. Er stellt die fachliche Quelle ('System of Record') für Eventdaten dar.

## Kapitel 165 – Aggregate und Value Objects

- Aggregate Root: Event
- Value Objects: EventSchedule, EventLocation, TicketPolicy, Visibility
- Entities: EventImage, EventTag

## Kapitel 166 – Zustandsmodell

> DRAFT  |REVIEW  |PUBLISHED  |SOLD_OUT  |FINISHED  |ARCHIVED

## Kapitel 167 – Domänenereignisse

- EventCreated
- EventUpdated
- EventPublished
- EventCancelled
- EventSoldOut
- EventArchived

## Kapitel 168 – Qualitätsanforderungen

- 99.9 % API-Verfügbarkeit
- <250 ms P95 für Lesezugriffe
- Idempotente Schreiboperationen
- Optimistic Locking
- Vollständiges Audit Logging
- OpenTelemetry Traces für alle Requests

# Teil VII – Event-Domäne (Fortsetzung)

## Kapitel 169 – Fachliches Datenmodell

- Event (Aggregate Root)
- Venue (Referenz)
- Organizer (Referenz)
- TicketCategory
- EventImage
- EventTag
- EventSchedule
- Visibility

## Kapitel 170 – Geschäftsregeln

- Ein Event muss genau einen Organizer besitzen.
- Ein Event benötigt mindestens einen Veranstaltungsort oder ein Online-Format.
- Startzeit muss vor Endzeit liegen.
- Ein veröffentlichtes Event darf nicht ohne Versionserhöhung geändert werden.
- Archivierte Events sind schreibgeschützt.

## Kapitel 171 – Vollständige Attributdefinition des Aggregats Event

Attribut

Typ

Pflicht

Beschreibung

eventId

UUID

Ja

Eindeutige Kennung

title

String

Ja

Veranstaltungstitel

description

Text

Ja

Beschreibung

organizerId

UUID

Ja

Veranstalter

venueId

UUID

Ja

Location

startTime

DateTime

Ja

Beginn

endTime

DateTime

Ja

Ende

status

Enum

Ja

Lebenszyklusstatus

visibility

Enum

Ja

Sichtbarkeit

version

Long

Ja

Optimistic Locking

## Kapitel 172 – Invarianten

- UUIDs sind unveränderlich.
- Zeitbereiche dürfen sich innerhalb eines Events nicht widersprechen.
- Titel darf innerhalb eines Organizers nicht doppelt aktiv sein.
- Statusübergänge erfolgen ausschließlich über definierte Domänenoperationen.

## Kapitel 173 – Nächster vertikaler Schritt

Als Nächstes wird ausschließlich die Event-Domäne weiter vertieft: vollständige SQL-DDLs, Constraints, Indizes, Migrationen und danach die vollständige OpenAPI-3.1-Spezifikation. Erst nach Abschluss aller Event-Artefakte beginnt die Dokumentation der nächsten Domäne.

# Teil VII – Event-Domäne (Fortsetzung)

## Kapitel 174 – Relationales Datenmodell

Das Event-Aggregat wird relational normalisiert. Fremdschlüssel verweisen ausschließlich auf Aggregate anderer Domänen.

- event
- event_image
- event_tag
- event_schedule
- ticket_category

## Kapitel 175 – SQL-DDL: Tabelle event

> CREATE TABLE event (  event_id UUID PRIMARY KEY,  organizer_id UUID NOT NULL,  venue_id UUID NOT NULL,  title VARCHAR(255) NOT NULL,  description TEXT NOT NULL,  status VARCHAR(32) NOT NULL,  visibility VARCHAR(32) NOT NULL,  start_time TIMESTAMP NOT NULL,  end_time TIMESTAMP NOT NULL,  version BIGINT NOT NULL,  created_at TIMESTAMP NOT NULL,  updated_at TIMESTAMP NOT NULL);

## Kapitel 176 – Constraints und Indizes

- PRIMARY KEY(event_id)
- FOREIGN KEY(organizer_id)
- FOREIGN KEY(venue_id)
- CHECK(start_time < end_time)
- INDEX(status)
- INDEX(start_time)
- INDEX(organizer_id)

## Kapitel 177 – Migrationsstrategie

- Versionierte Migrationen
- Vorwärtskompatible Änderungen bevorzugen
- Rollback-Skripte für kritische Migrationen
- Automatisierte Ausführung in CI/CD
- Validierung vor Produktivfreigabe

## Kapitel 178 – Persistenzregeln

- Soft Delete für archivierte Events
- Optimistic Locking über version
- Keine direkten Datenbankzugriffe außerhalb des Repository-Layers
- Transaktionen nur über Application Services

# Teil VII – Event-Domäne (Fortsetzung)

## Kapitel 179 – OpenAPI 3.1: Ressourcenübersicht

- GET /api/v1/events
- POST /api/v1/events
- GET /api/v1/events/{eventId}
- PUT /api/v1/events/{eventId}
- PATCH /api/v1/events/{eventId}
- DELETE /api/v1/events/{eventId}
- POST /api/v1/events/{eventId}/publish
- POST /api/v1/events/{eventId}/cancel
- POST /api/v1/events/{eventId}/archive

## Kapitel 180 – Query-Parameter

- page
- size
- sort
- status
- organizerId
- venueId
- from
- to
- search

## Kapitel 181 – Standardisierte Fehlerobjekte

> {  "timestamp":"2026-01-01T12:00:00Z",  "status":400,  "code":"EVENT_VALIDATION_FAILED",  "message":"Validation failed",  "traceId":"..."}

## Kapitel 182 – HTTP-Statuscodes

- 200 OK
- 201 Created
- 204 No Content
- 400 Bad Request
- 401 Unauthorized
- 403 Forbidden
- 404 Not Found
- 409 Conflict
- 422 Unprocessable Entity
- 500 Internal Server Error

## Kapitel 183 – OpenAPI-Konventionen

Alle Endpunkte verwenden JWT-basierte Authentifizierung, einheitliche Fehlerobjekte, RFC-3339-Zeitstempel, UUIDs als Ressourcenkennungen sowie paginierte Listenantworten. Änderungen an der API erfolgen rückwärtskompatibel innerhalb der Major-Version.

# Teil VII – Event-Domäne (Fortsetzung)

## Kapitel 184 – JSON-Schema: EventCreateRequest

> {  "type":"object",  "required":["title","organizerId","venueId","startTime","endTime"],  "properties":{    "title":{"type":"string","minLength":3,"maxLength":255},    "description":{"type":"string"},    "organizerId":{"type":"string","format":"uuid"},    "venueId":{"type":"string","format":"uuid"},    "startTime":{"type":"string","format":"date-time"},    "endTime":{"type":"string","format":"date-time"},    "visibility":{"type":"string","enum":["PUBLIC","PRIVATE","UNLISTED"]}  },  "additionalProperties":false}

## Kapitel 185 – JSON-Schema: EventResponse

> {  "type":"object",  "required":["eventId","title","status","version"],  "properties":{    "eventId":{"type":"string","format":"uuid"},    "title":{"type":"string"},    "status":{"type":"string"},    "version":{"type":"integer"}  },  "additionalProperties":false}

## Kapitel 186 – Validierungsregeln

- startTime muss vor endTime liegen.
- Titel ist obligatorisch und maximal 255 Zeichen lang.
- Organizer und Venue müssen existieren.
- Status wird serverseitig verwaltet.
- UUID-Felder müssen RFC-4122-konform sein.

## Kapitel 187 – Beispiel-Payloads

> POST /api/v1/events{  "title":"Summer Rave",  "organizerId":"<uuid>",  "venueId":"<uuid>",  "startTime":"2026-08-01T18:00:00Z",  "endTime":"2026-08-02T04:00:00Z",  "visibility":"PUBLIC"}

## Kapitel 188 – Vertikaler Fahrplan

Im nächsten Abschnitt folgen Repository-Interfaces, Application Services, Domänenoperationen und Transaktionsgrenzen. Erst nach Abschluss der vollständigen Implementierungsreferenz des Event-Service wird zur nächsten Domäne gewechselt.

# Teil VII – Event-Domäne (Fortsetzung)

## Kapitel 189 – Repository-Interfaces

- EventRepository
- EventImageRepository
- EventTagRepository
- TicketCategoryRepository
- Repository-Methoden sind ausschließlich fachlich orientiert.

## Kapitel 190 – Repository-Verträge

> interface EventRepository {  Event save(Event event);  Optional<Event> findById(UUID eventId);  Page<Event> search(EventCriteria criteria);  void delete(Event event);}

## Kapitel 191 – Application Services

- CreateEventService
- UpdateEventService
- PublishEventService
- CancelEventService
- ArchiveEventService

## Kapitel 192 – Transaktionsgrenzen

- Eine Geschäftsoperation entspricht genau einer Transaktion.
- Domain Events werden nach erfolgreichem Commit veröffentlicht.
- Externe Integrationen erfolgen asynchron über Events oder Outbox.

## Kapitel 193 – Domänenoperationen

- create()
- updateDetails()
- publish()
- cancel()
- archive()
- changeVisibility()

---

# Anhang – Referenzimplementierung im Repository (app-v2)

Dieser Anhang beschreibt ausschließlich den **nachweisbaren Implementierungsstand** im Repository `app-v2/`. Er ergänzt die zielarchitektonischen Kapitel dieses Handbuchs und ersetzt sie nicht. Für den aktuellen Tagesstand siehe `PROJECT_STATE.md`.

## Aktive Codebasis

| Bereich | Implementierung (Repository) |
|---------|------------------------------|
| App | Expo SDK 57, React Native 0.86, TypeScript, Expo Router |
| Web | React Native Web, statischer Export |
| Backend | Supabase (PostgreSQL, Auth, Storage) |
| Datenzugriff | Repository-Pattern; Local- und Supabase-Datasources |
| Feature-Flag | `EXPO_PUBLIC_USE_SUPABASE` (Standard: lokaler Mock) |
| Tests | Vitest |
| Paketversion | `0.2.0` (`app-v2/package.json`) |

## Abweichungen zur Zielarchitektur in diesem Handbook

Die Kapitel zu Microservices, Java/Spring Boot, Flutter, Kafka und Kubernetes beschreiben die **langfristige Zielarchitektur**. Im Repository existiert derzeit eine **monolithische Expo-App** mit Supabase-Backend — keine separaten Microservices, kein Spring Boot, kein Flutter.

## Datenbank (implementiert)

Migrationen unter `app-v2/supabase/migrations/` (8 Dateien). Tabellen u. a.: `events`, `genres`, `cities`, `venues`, `artists`, `collections`, `sources`, `import_jobs`, `import_records`, `import_logs`, `import_audit_logs`. Primärschlüssel: `text` (nicht UUID wie in Ziel-DDLs). RLS aktiv; Hilfsfunktionen `is_admin()`, `admin_role()`, `has_admin_role()`.

## Authentifizierung (implementiert)

- Admin-Login unter `/admin/login` (Web-only Admin-Bereich)
- Supabase Auth; Rollen via JWT `app_metadata.role` (`viewer`, `editor`, `reviewer`, `source_manager`, `admin`, `owner`)
- Gemeinsamer Login für Consumer und Admin: **Ziel** (`BACKLOG.md` ER-001), noch nicht umgesetzt

## Import-Pipeline (implementiert)

Adapter (`json_ld`, `rss`, `atom`, `ical`, `csv`, `api_json`), Orchestrator, Matching, Review-Workflow. Manueller Import-Start; Scheduler/Webhook-Laufzeit im Datenmodell, nicht im Code.

## Verweise

- Architektur im Code: `app-v2/docs/ARCHITECTURE.md`, `app-v2/docs/backend.md`
- Import: `app-v2/docs/import-foundation.md` ff.
- Admin: `app-v2/docs/admin-web.md`
