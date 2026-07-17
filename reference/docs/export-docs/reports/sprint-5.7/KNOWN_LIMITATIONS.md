# Known Limitations — Sprint 5.7

1. **Event detail runtime screenshot** — automated navigation did not reliably open `/event/[id]`; comparison uses mockup + rendered UI for detail layout.

2. **Emulator ANR** — `System UI isn't responding` appears under automated adb load; runtime screenshots may include overlay.

3. **Onboarding slide 1 runtime capture** — cold-start timing; file may capture transition frame.

4. **Onboarding duplicate "Weiter" button** — visible on slides 2–4; layout bug to fix in future polish sprint.

5. **Rendered UI** — Expo Web only; native-specific effects (blur, haptics) not represented.

6. **Map** — placeholder UI by design (Mapbox deferred).

7. **Guest mode automation** — AsyncStorage seeding not available on release build; deep links used instead.

8. **Web dependencies** — `react-dom` + `react-native-web` added for rendered UI capture only.

9. **PNG asset fix** — onboarding PNGs were mislabeled JPEGs; converted for Android AAPT (build fix, not feature).

10. **Filter dropdowns** — Events filter bar is visual/toggle only; full picker UI deferred.
