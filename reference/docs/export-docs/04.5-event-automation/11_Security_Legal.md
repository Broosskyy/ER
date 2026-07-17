# 11 — Security & Legal

> Band 4.5 · DSGVO, Datenschutz, Urheberrecht, Missbrauchsschutz

---

## Übersicht

Event Automation verarbeitet personenbezogene und urheberrechtlich geschützte Daten aus externen Quellen. Rechtliche und sicherheitstechnische Anforderungen gelten **vor** technischer Skalierung.

---

## DSGVO

| Anforderung | Umsetzung (Ziel) |
|-------------|------------------|
| Rechtsgrundlage | Berechtigtes Interesse / Einwilligung je Quelle |
| Datenminimierung | Nur Event-relevante Felder speichern |
| Zweckbindung | Keine Weitergabe an Dritte ohne Basis |
| Auskunft / Löschung | Account-Lifecycle (Band 4.6) |
| Auftragsverarbeitung | DPA mit Supabase, KI-Provider |
| Speicherdauer | Events archiviert nach Event-Ende + Frist |

**Personenbezogene Daten in Events:** Organizer-Namen, Venue-Kontakte, Künstler — nur soweit öffentlich verfügbar.

---

## Datenschutz

- Keine Scraping von privaten Profilen oder geschlossenen Gruppen
- Opt-out für Organizer (Entfernung auf Anfrage)
- Privacy Policy verlinkt in App
- Cookie/Tracking nur mit Consent (Web future)
- Logs: keine Passwörter, Tokens, vollständige PII

Siehe auch [Band 4.6 Security](../04.6-authentication-identity/07_Security.md)

---

## Missbrauchsschutz

| Bedrohung | Maßnahme |
|-----------|----------|
| Spam-Events | Rate Limiting, Confidence, Review |
| Fake Organizer | Verification + Entzug |
| Scraping Eternal Rave | API Rate Limits, ToS |
| Quellen-Manipulation | Quellenbewertung, Audit |
| Bulk-Import-Angriffe | Admin-only, Auth |

**Organizer Verification** reduziert Missbrauch bei vertrauenswürdigen Quellen — siehe [08_Organizer_Verification.md](./08_Organizer_Verification.md)

---

## Urheberrecht

| Inhalt | Regel |
|--------|-------|
| Flyer / Bilder | Nur mit Recht (API, Partner, Organizer-Upload) |
| Hotlinking | Bevorzugt eigene CDN-Kopie mit Erlaubnis |
| Text / Beschreibungen | Kurze Zitate OK, kein Volltext-Copy |
| Social Media | Nur öffentliche Posts, Plattform-TOS beachten |
| RSS | Feed-Nutzung gemäß Publisher-Richtlinien |

**Bei Unsicherheit:** Event ohne Bild veröffentlichen oder Admin-Review.

---

## Logging

| Log-Typ | Inhalt | Aufbewahrung |
|---------|--------|--------------|
| Import Log | source, status, duration | 90 Tage |
| Moderation Audit | admin, action, event | 2 Jahre |
| Security Log | failed auth, rate limit | 1 Jahr |
| Error Log | stack, context (kein PII) | 30 Tage |

Logs sind **append-only** für Audit-relevante Aktionen.

---

## Quellenbewertung

Jede Quelle erhält ein Vertrauenslevel (siehe [02_Event_Sources.md](./02_Event_Sources.md)):

| Level | Beispiel | Scraping erlaubt |
|-------|----------|------------------|
| A | Verifizierter Organizer, offizielle API | Ja (vertraglich) |
| B | RSS, Partner | Ja (Feed/API) |
| C | Öffentliche Webseiten | Nur robots.txt + TOS konform |
| D | Social Hints | Manuell / KI mit Review |
| F | Unbekannt | Blockiert bis Prüfung |

**Regel:** Keine Quelle ohne dokumentierte rechtliche Basis aktivieren.

---

## Compliance-Checkliste (Pre-Launch Automation)

- [ ] Privacy Policy aktualisiert (Automation, Quellen)
- [ ] Impressum / AGB
- [ ] DPA Supabase
- [ ] Quellen-Register mit Rechtsgrundlage
- [ ] Audit Log implementiert
- [ ] Admin-Zugang geschützt (Band 4.6)
- [ ] Bild-Rechte dokumentiert pro Quelle

---

## Referenzen

- [02_Event_Sources.md](./02_Event_Sources.md)
- [08_Organizer_Verification.md](./08_Organizer_Verification.md)
- [04-backend/07_Sicherheit_Compliance.md](../04-backend/07_Sicherheit_Compliance.md)
- [04.6-authentication-identity/07_Security.md](../04.6-authentication-identity/07_Security.md)
