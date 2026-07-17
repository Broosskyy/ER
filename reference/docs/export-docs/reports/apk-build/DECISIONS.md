# APK Build — Decisions

## B-D01 — Local Gradle over EAS Cloud

**Decision:** Build with `expo prebuild` + `./gradlew assembleRelease` locally.

**Rationale:** EAS requires authenticated cloud credentials; local SDK available and produces installable APK.

## B-D02 — Official logo source

**Decision:** Extract `02_Splash_Logo.png` from `Eternal_Rave_Screens_Renamed.zip` only.

**Rationale:** Per build spec — single official branding asset; ZIP archives unchanged.

## B-D03 — No version bump

**Decision:** Keep version `1.7.0`, versionCode `7`.

**Rationale:** Build spec explicitly forbids version changes.

## B-D04 — Minimal dependency fixes

**Decision:** Do not run `expo install --fix` or async-storage downgrade.

**Rationale:** Build succeeded; avoid breaking changes outside build scope.

## B-D05 — APK via GitHub Release

**Decision:** Distribute 105 MB APK via GitHub Release, not git commit.

**Rationale:** Binary too large for repo; provides stable direct download URL.
