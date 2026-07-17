# Open Issues — Sprint 5.7

## Screenshot / QA

1. **Event detail runtime capture** — `/event/[id]` not reliably reached via adb automation; screenshot shows events list or launcher.
2. **Emulator System UI ANR** — intermittent during batch capture; re-test on physical device recommended.
3. **Onboarding slide 1 runtime** — timing-sensitive; may need longer splash wait.
4. **Rendered UI incomplete set** — onboarding slides 2–5 not captured on web (only key screens); extend script if needed.

## UI / Mockup

5. **Onboarding duplicate "Weiter" button** — two stacked primary buttons on onboarding slides.
6. **Events filter dropdowns** — visual bar only; no full picker modals.
7. **Event Details screen** — layout polish deferred to Sprint 5.8.

## Build / Assets

8. **Onboarding PNG format** — fixed (JPEG mislabeled as PNG); verify on iOS build.
9. **Web deps** — `react-dom` / `react-native-web` added for rendered UI pipeline.

## Accessibility

10. **ANR blocked a11y audit** — re-run TalkBack after stable device capture.
