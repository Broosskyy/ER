# APK Build — Known Limitations

## Build environment

- Local Gradle build, not EAS cloud preview
- Release APK uses project signing config from prebuild (not Play Store upload key)

## Dependencies

- expo-doctor reports minor version drift (expo 56.0.12, async-storage 3.x)
- `expo-font` peer dependency not installed (recommended by expo-doctor)

## Backend

- Demo mode when Supabase env vars not embedded at build time
- No runtime verification on physical device in CI

## Distribution

- APK ~105 MB — large download on mobile networks
- User must allow unknown sources for sideload install

## Out of scope (unchanged)

- No new features, UI, architecture, or database changes in this build run
