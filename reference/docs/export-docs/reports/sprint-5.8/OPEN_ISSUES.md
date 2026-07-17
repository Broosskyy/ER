# Open Issues — Sprint 5.8

## P1 — Emulator ANR bei Runtime-Capture

- **Symptom:** „System UI isn't responding“ / „Pixel Launcher isn't responding“ während adb-Screencap auf CI-Emulator (ohne KVM).
- **Impact:** Nicht alle 15 Screenshots konnten nativ in einem Durchlauf ohne ANR-Overlay erfasst werden.
- **Mitigation:** Auth/Welcome/Admin via Expo Web (gleicher JS-Bundle); `14_account_required.png` nativ auf Android erfasst.
- **Action:** Re-Capture auf physischem Gerät oder Emulator mit Hardware-Beschleunigung.

## P2 — Onboarding Slides 2–4 (adb tap)

- Automatisches Tippen auf Mockup-CTA ist auf Emulator unzuverlässig; `?slide=N` Deeplink für QA hinzugefügt.
- Produktiv-Flow per Tap auf Mockup-Button funktioniert manuell auf Gerät.

## P3 — Web Welcome Button-Layout

- Auf Expo Web rendern Primary/Secondary-Buttons schmal links; nativ korrekt full-width.
- Kein Release-Blocker — natives Layout verifiziert via APK.

## P4 — Supabase Demo-Modus

- Login/Register ohne Backend simuliert weiterhin direkten Home-Zugang.
- Echte Auth-Flows benötigen Supabase-Env.
