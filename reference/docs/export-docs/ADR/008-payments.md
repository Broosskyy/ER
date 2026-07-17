# ADR-008: Payments

**Status:** Proposed (nicht implementiert)  
**Datum:** Juni 2026 · Sprint 0

## Kontext

Band 4 Kapitel `08_Zahlungssysteme_Abonnements.md` (Stub). Mockups 16–17 (Tickets). Band 1 Vision: Tickets, Organizer Subscriptions.

## Entscheidung (geplant)

**Phase 1 (MVP/V1):** Externe Ticket-URLs (`ticketUrl` auf Events) — **bereits implementiert**, kein In-App Payment.

**Phase 2 (V3+):** In-App Payments evaluieren:

| Option | Use Case |
|--------|----------|
| Stripe | Web + Organizer Subscriptions |
| Google Play Billing | Android In-App |
| RevenueCat | Abo-Abstraction |

## Begründung

- MVP beantwortet Discovery — Tickets via Link ausreichend
- In-App Payments = Compliance, Store Fees, PCI — später
- Mockups 16–17 = V3+ Scope

## Konsequenzen Sprint 0

- Keine Payment-Library installieren
- `ticketUrl` in Event-Modell beibehalten
- Neues ADR vor jeder Payment-Integration

## Referenzen

- Band 4 Kap. 08, Mockups 16–17
- `app/event/[id].tsx` Get tickets button
