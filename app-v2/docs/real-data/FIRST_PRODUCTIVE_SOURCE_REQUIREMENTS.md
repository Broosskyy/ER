# First Productive Source Requirements

**Keine externe Quelle aktivieren ohne geklärte Rechte.**

## Mindestfelder

external_id, title, start_at + timezone (IANA), city; empfohlen: venue, ticket_url, cancellation status.

## Bevorzugte Quellentypen

1. Partner-Feed mit Vereinbarung
2. Offizielle Organizer-API
3. Structured data mit Nutzungsrecht

## Checkliste vor Aktivierung

- [ ] Nutzungsbedingungen dokumentiert
- [ ] API-Zugang in Staging
- [ ] Rate Limits konfiguriert
- [ ] Admin-Review mit echten Daten getestet
- [ ] Schriftliche Freigabe vorliegt

## Empfohlene erste Quelle

Vertraglich freigegebener Partner-Feed (ein Veranstalter/Venue-Netzwerk) — geringes Rechts- und Dedup-Risiko.

**Erforderlich:** API-URL, Credentials (Env), Ansprechpartner, Beispiel-Response (nicht im Repo).
