# ER Motion

**Status:** Kanonisch · Sprint 1 Design DNA  
**Quelle:** Mockups 70–79 (Motion System), ER Design System v3, Handbook Ch. 1  
**Zweck:** Animations- und Übergangsregeln — subtil, schnell, zweckgebunden.

---

## 1. Grundsatz

Motion unterstützt **Verständnis und Feedback** — nie Dekoration.

- Schnell genug, um nicht zu stören
- Langsam genug, um wahrgenommen zu werden
- 60fps auf allen Geräten
- Reduziert bei `prefers-reduced-motion`
- Eternal Rave fühlt sich **leicht** an — auch in Bewegung

**Referenz-Qualität:** Apple (Präzision), Linear (Geschwindigkeit), Spotify (subtile Übergänge)

---

## 2. Timing-Skala

| Token | Dauer | Verwendung |
|-------|-------|------------|
| `instant` | 100ms | Micro-Feedback (Press, Toggle) |
| `fast` | 150ms | Chip Select, Icon State |
| `normal` | **200ms** | Standard-Übergänge (Design System v3) |
| `moderate` | **250ms** | Sheet Slide, Modal Fade |
| `slow` | **300ms** | Page Transitions, große Bewegungen |
| `deliberate` | 400ms | Onboarding, Hero Reveals (selten) |

**Regel (Design System v3):** Standard-Animationen **200–300ms**. Nie >500ms für UI-Feedback.

---

## 3. Easing-Kurven

| Name | Kurve | Verwendung |
|------|-------|------------|
| `easeOut` | cubic-bezier(0, 0, 0.2, 1) | Elemente erscheinen (Enter) |
| `easeIn` | cubic-bezier(0.4, 0, 1, 1) | Elemente verschwinden (Exit) |
| `easeInOut` | cubic-bezier(0.4, 0, 0.2, 1) | Zustandswechsel |
| `spring` | tension: 300, friction: 30 | Bottom Sheet, interaktive Elemente |

**Verboten:** `linear` für sichtbare UI-Bewegungen (wirkt mechanisch).

---

## 4. Motion-Kategorien

### 4.1 Feedback (Micro-Interactions)

| Aktion | Motion | Dauer |
|--------|--------|-------|
| Button Press | Scale 0.97 + opacity | 100ms |
| Chip Select | Background color transition | 150ms |
| Favorite Toggle | Scale pulse 1.0 → 1.2 → 1.0 | 200ms |
| Toggle Switch | Slide + color | 200ms |
| Haptic (Mobile) | Light impact bei Primary CTA | simultan |

### 4.2 Navigation

| Übergang | Motion | Dauer |
|----------|--------|-------|
| Tab Switch | Crossfade Content | 200ms |
| Push Screen | Slide from right | 250ms |
| Modal Open | Fade + Scale 0.95 → 1.0 | 250ms |
| Modal Close | Fade + Scale 1.0 → 0.95 | 200ms |
| Bottom Sheet Open | Slide from bottom + backdrop fade | 300ms |
| Bottom Sheet Close | Slide down + backdrop fade | 250ms |

### 4.3 Content

| Zustand | Motion | Dauer |
|---------|--------|-------|
| Skeleton Loading | Opacity pulse 0.4 → 0.7 → 0.4 | 1200ms loop |
| Image Load | Fade in from placeholder | 300ms |
| List Item Appear | Fade + translateY(8px → 0) | 200ms, staggered 50ms |
| Empty → Content | Crossfade | 300ms |
| Pull to Refresh | Native indicator | system |

### 4.4 Admin

| Aktion | Motion | Dauer |
|--------|--------|-------|
| Sidebar Toggle (Mobile) | Slide from left | 250ms |
| Toast Notification | Slide up + fade | 250ms in, 200ms out |
| Form Save Success | Brief checkmark or toast | 200ms |
| Expand/Collapse Section | Height animation | 250ms |

---

## 5. Was animiert wird — was nicht

### ✅ Animieren

- Screen-Übergänge
- Bottom Sheets und Modals
- State Changes (selected, loading, error)
- Skeleton → Content
- Favorite/Save Feedback
- Scroll-basierte Header-Transitions (dezent)

### ❌ Nicht animieren

- Hintergrundfarben ganzer Screens
- Parallax-Effekte
- Partikel, Glow, Pulse auf idle Elements
- Animated Gradients
- Bounce-Effekte (außer sehr subtil bei Success)
- Dauerhaft laufende Animationen (außer Skeleton)
- Neon/Cyberpunk-Glitch-Effekte

---

## 6. Skeleton Loading (Mockup 60)

```
Phase 1: Skeleton sichtbar (sofort)
Phase 2: Pulse Animation (1200ms loop)
Phase 3: Content fade-in (300ms)
Phase 4: Skeleton entfernt
```

**Regel:** Skeleton-Form folgt dem echten Content-Layout — keine generischen Rechtecke.

| Content | Skeleton-Form |
|---------|---------------|
| Event Card | Thumbnail-Rect + 2–3 Text-Lines |
| Featured Hero | 16:9 Rect + Title Line |
| Profile | Circle (Avatar) + 2 Lines |
| Admin List Row | 1 breite Line + 1 kurze Line |

---

## 7. Bottom Sheet Motion (Mockup 59)

```
Open:
  1. Backdrop fade 0 → 0.72 (200ms, easeOut)
  2. Sheet translateY(100%) → 0 (300ms, spring)

Close:
  1. Sheet translateY(0) → 100% (250ms, easeIn)
  2. Backdrop fade 0.72 → 0 (200ms, easeIn)

Drag:
  - Follow finger
  - Snap: <30% → close, >30% → open
  - Velocity-based dismiss
```

---

## 8. Reduced Motion

Bei `prefers-reduced-motion: reduce`:

- Alle Dauern → 0ms oder instant
- Skeleton: statisch (kein Pulse)
- Übergänge: Crossfade ohne Translation
- Keine Scale-Animationen

---

## 9. Performance-Regeln

| Regel | Detail |
|-------|--------|
| Animiere `transform` und `opacity` | Nicht `width`, `height`, `top`, `left` |
| `useNativeDriver: true` | Wo möglich (RN) |
| Keine Animationen auf Scroll | Nur Header-Collapse (dezent) |
| Max 3 gleichzeitige Animationen | Performance |
| List Stagger max 10 Items | Danach sofort |

---

## 10. Evolution V2 Motion-Änderungen

| Mockup-Ist | Evolution V2 |
|------------|--------------|
| AnimatedCard mit Elevation | Statische Cards, subtiler Press |
| Glow auf Buttons | Kein Glow — nur Color Transition |
| Hero Gradient Animation | Statischer Gradient oder keiner |
| Bounce auf Tab Switch | Crossfade |
| Pulse auf Notification Badge | Statischer Dot |

---

## 11. Mockup-Referenz (70–79)

| Mockup | Inhalt | Status |
|--------|--------|--------|
| 70 | Transition System | 🔴 Nicht implementiert |
| 71 | Loading States | 🟡 Skeleton vorhanden |
| 72 | Micro-Interactions | 🔴 Teilweise |
| 73 | Gesture System | 🔴 Map Sheet nur |
| 74 | Page Transitions | 🔴 Default RN |
| 75 | Modal Animations | 🟡 Basic Modal |
| 76 | List Animations | 🔴 Nicht implementiert |
| 77 | Pull to Refresh | 🔴 Nicht implementiert |
| 78 | Haptic Feedback | 🔴 Nicht implementiert |
| 79 | Motion Principles | ✅ Dieses Dokument |

---

## 12. Verwandte Dokumente

- `ER_COMPONENT_LIBRARY.md` — Skeleton, Toast, Sheet
- `ER_SCREEN_PATTERNS.md` — Zustands-Patterns
- `ER_DESIGN_EVOLUTION_V2.md` — Motion-Reduktion
- `ER_DO_AND_DONT.md` — Animations-Verbote
