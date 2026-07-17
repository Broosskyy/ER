# 07 — Event Lifecycle (Automation)

> Band 4.5 · Lifecycle im Automation-Kontext

---

## Automation Lifecycle (Zielbild)

```
Entwurf (Draft)
  ↓
Importiert (Imported Draft)
  ↓
Moderation (Pending Review / Needs Review)
  ↓
Freigegeben (Approved)
  ↓
Live (Published)          ← nur diese im Public Feed
  ↓
Aktualisiert (Updated)    ← Metadata sync, Version bump
  ↓
Archiviert (Archived)     ← Event vorbei / inactive
  ↓
Gelöscht (Deleted/Rejected)
```

---

## Mapping DB (Ist — Band 4)

| Automation | DB `lifecycle_status` |
|------------|----------------------|
| Entwurf | `draft` |
| Importiert | `imported_draft` |
| Moderation | `pending_review`, `needs_review` |
| Freigegeben | `approved` |
| Live | `published` |
| — | `rejected`, `duplicate` |

**Aktualisiert/Archiviert:** Future — `updated_at`, soft archive flag

---

## Regeln

1. **Nur `published`** erscheint im Public Feed
2. Imports starten als `imported_draft` oder `pending_review`
3. Nie Auto-Publish nach Import
4. Updates an live Events → neue Moderation wenn kritische Felder (Datum, Ort)

---

## Code

- `src/types/lifecycle.ts` — Status unions
- `src/utils/lifecycleMap.ts` — UI ↔ DB
- `updateEventLifecycle()` in `events.ts`

---

## Referenzen

- [03_Import_Pipeline.md](./03_Import_Pipeline.md)
- [Band 4 Backend](../04-backend/README.md)
