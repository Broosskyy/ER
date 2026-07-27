# Consumer RC1 — Content Realism & Brand Identity

**Datum:** 2026-07-26

---

## Änderungen

### Demo-Assets
- Abstrakte `poster-*.png`-Platzhalter (Kreise/Farbflächen) durch **10 fotorealistische JPGs** ersetzt
- **5 Event-Poster** (`assets/demo/posters/*.jpg`) — dunkle Club-/Rave-Atmosphäre, Violett/Neon
- **5 Club-Bilder** (`assets/demo/clubs/*.jpg`) — je eigenes Motiv für Top-Clubs-Rail

### Top Clubs
- Fixtures auf **Berghain, Sisyphos, Bootshaus, ://about blank, Watergate** mit dedizierten Club-Assets
- Keine Wiederverwendung von Event-Postern mehr

### Featured / Heute Abend
- Jedes publizierte Demo-Event hat ein **eigenes Bild** (eindeutige Asset-Keys)
- Staging-Event-IDs in `demo-images.ts` gemappt (Supabase-Modus)

### Demo-Daten (`raw-demo-events.ts`)
- Realistische Künstler, Venues, Preise (`ab 14,00 €` … `ab 22,00 €`)
- Keine „Demo Act“-Lineups, keine Test-URLs
- Titel: z. B. `Klangkuenstler · All Night Long`, `Rhein Sessions`, `Sunset Garden`

### Branding
- Logo: `letterSpacing` 1.5 → **1.35** (dezenter Wordmark-Rhythmus)

---

## Screenshots

`docs/visual-qa/sprint-rc1/`

| Datei | Inhalt |
|-------|--------|
| `home-light.png` | Home Light |
| `home-dark.png` | Home Dark |
| `home-tonight-light.png` | Heute Abend |
| `home-clubs-light.png` | Top Clubs |

---

## Betroffene Dateien

- `assets/demo/posters/*.jpg` (neu)
- `assets/demo/clubs/*.jpg` (neu)
- `src/features/events/data/demo-images.ts`
- `src/features/events/data/raw-demo-events.ts`
- `src/features/home/data/home-club-fixtures.ts`
- `src/components/branding/EternalRaveLogo.tsx`

---

## Ehrliche Bewertung

**Wirkt Eternal Rave jetzt wie ein echtes Consumer-Produkt?**

**NEIN**

### Gründe (max. 5)

1. **Nested-Button-Fehler** — roter Runtime-Toast auf Home (`<button> cannot contain a nested…`) zerstört Store-Qualität.
2. **Supabase vs. lokale Demo-Daten** — bei `USE_SUPABASE=true` zeigen Titel/Events weiterhin Staging-Seed-Texte (z. B. „Klangkuenstler at Halle“, „Cologne House Flow“), nicht die überarbeiteten lokalen Demo-Events.
3. **Featured-Rail** — im Viewport oft nur **eine** Hero-Karte sichtbar; 2-up-Flyer-Wirkung aus Mockup fehlt.
4. **Heute Abend** — nur ein Event in der Tonight-Sektion (Datenlage), wirkt dünn für eine echte Event-App.
5. **KI-generierte Assets** — fotorealistisch, aber noch erkennbar generisch; nicht durchgängig wie ein kuratierter Fotoshoot.
