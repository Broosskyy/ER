# Migration Export — Bericht

Erstellt am: 2026-07-17 14:56:38 UTC

## Zusammenfassung

| Metrik | Wert |
|--------|------|
| Gesamtzahl Dateien im Projekt | 663 |
| Exportierte Dateien | 432 |
| Größe der ZIP | 24M (24903118 Bytes) |

## Übernommene Ordner / Bereiche

- `assets`
- `Blueprint`
- `database`
- `docs`
- `.github`
- `(root)`
- `scripts`
- `src`
- `supabase`

## Bewusst ausgeschlossen

### Build- und Cache-Ordner
- `node_modules/`, `dist/`, `build/`, `.next/`, `.turbo/`, `.cache/`, `coverage/`
- `.git/`, `.expo/`
- Android/iOS Build-Ordner (nicht vorhanden im aktuellen Stand)

### Anwendungscode (nicht als Referenz exportiert)
- `app/` — Expo-Router-Screens und Navigation
- `src/components/` — UI-Komponenten
- `src/hooks/` — React-Hooks
- `src/utils/` — Hilfsfunktionen

### Generierte Artefakte und Berichte
- `package-lock.json` — automatisch generierte Lock-Datei
- Sprint-/Crash-/APK-Report-ZIPs im Projektroot und in `docs/reports/`
- Screenshot-Capture-Skripte (`scripts/capture-*`, `scripts/recapture-*`, `scripts/stability-*`)
- Log-Dateien (`.expo/dev/logs/`)

## Besonders wichtig für den Neubau

- Blueprint/ — Produktvision, Tech- und Design-Dokumentation
- docs/ — Architektur, ADRs, Sprint-Dokumentation
- assets/mockups/ — UI-Mockups (ZIP-Archive)
- assets/onboarding/ — Onboarding-Screen-Referenzen
- src/types/database.ts — Supabase-Datenbanktypen
- src/domain/ — Event-Domain-Modell
- supabase/migrations/ — Datenbankschema
- supabase/seed*.sql — Seed-Daten
- src/constants/theme.ts — Design-Tokens (Farben, Spacing, Typography)
- tailwind.config.js — Tailwind/NativeWind-Konfiguration
- package.json — Abhängigkeiten und Skripte
- .env.example — Umgebungsvariablen-Vorlage
- src/services/ — API-Schicht als Referenz

## Exportierte Dateitypen

- `.md`: 332 Dateien
- `.ts`: 44 Dateien
- `.png`: 19 Dateien
- `.sql`: 9 Dateien
- `.zip`: 8 Dateien
- `.gitkeep`: 7 Dateien
- `.json`: 4 Dateien
- `.js`: 4 Dateien
- `.yml`: 1 Dateien
- `.npmrc`: 1 Dateien
- `.gitignore`: 1 Dateien
- `.example`: 1 Dateien
- `.css`: 1 Dateien

## Vollständige Liste exportierter Dateien

<details>
<summary>Alle 432 Dateien anzeigen</summary>

```
app.json
assets/android-icon-background.png
assets/android-icon-foreground.png
assets/android-icon-monochrome.png
assets/branding/.gitkeep
assets/design-system/.gitkeep
assets/favicon.png
assets/icon.png
assets/illustrations/.gitkeep
assets/mockups/Eternal_Rave_Screens_Renamed_Part2.zip
assets/mockups/Eternal_Rave_Screens_Renamed_Part3.zip
assets/mockups/Eternal_Rave_Screens_Renamed_Part4.zip
assets/mockups/Eternal_Rave_Screens_Renamed_Part5.zip
assets/mockups/Eternal_Rave_Screens_Renamed_Part6.zip
assets/mockups/Eternal_Rave_Screens_Renamed_Part7.zip
assets/mockups/Eternal_Rave_Screens_Renamed_Part8.zip
assets/mockups/Eternal_Rave_Screens_Renamed.zip
assets/mockups/.gitkeep
assets/motion-library/.gitkeep
assets/onboarding/02_Splash_Logo.png
assets/onboarding/03_Onboarding_01_Welcome.png
assets/onboarding/04_Onboarding_02_Discover_Events.png
assets/onboarding/05_Onboarding_03_Community.png
assets/onboarding/06_Onboarding_04_Tickets.png
assets/onboarding/07_Login.png
assets/onboarding/08_Register.png
assets/onboarding/09_Home.png
assets/onboarding/10_Events.png
assets/onboarding/11_Event_Details.png
assets/onboarding/12_Map.png
assets/onboarding/14_Saved.png
assets/onboarding/15_Profile.png
assets/README.md
assets/splash-icon.png
assets/ui-components/.gitkeep
babel.config.js
Blueprint/00_READ_ME_FIRST.md
Blueprint/01_VISION/Mission.md
Blueprint/01_VISION/Principles.md
Blueprint/01_VISION/Values.md
Blueprint/01_VISION/Vision.md
Blueprint/02_PRODUCT/Core_Features.md
Blueprint/02_PRODUCT/Feature_Roadmap.md
Blueprint/02_PRODUCT/Product.md
Blueprint/02_PRODUCT/Release_Plan.md
Blueprint/02_PRODUCT/User_Groups.md
Blueprint/03_BUSINESS/Artist_Pro.md
Blueprint/03_BUSINESS/Business_Model.md
Blueprint/03_BUSINESS/Club_Pro.md
Blueprint/03_BUSINESS/Eternal_Pass.md
Blueprint/03_BUSINESS/Festival_Pro.md
Blueprint/03_BUSINESS/Monetization.md
Blueprint/03_BUSINESS/Organizer_Pro.md
Blueprint/03_BUSINESS/Partner_Program.md
Blueprint/03_BUSINESS/Pricing.md
Blueprint/03_BUSINESS/Revenue.md
Blueprint/04_COMMUNITY/Badges.md
Blueprint/04_COMMUNITY/Community.md
Blueprint/04_COMMUNITY/Friends.md
Blueprint/04_COMMUNITY/Levels.md
Blueprint/04_COMMUNITY/Referrals.md
Blueprint/04_COMMUNITY/Reputation.md
Blueprint/05_MARKETING/Brand.md
Blueprint/05_MARKETING/Content.md
Blueprint/05_MARKETING/Growth.md
Blueprint/05_MARKETING/Launch.md
Blueprint/05_MARKETING/SEO_ASO.md
Blueprint/05_MARKETING/Social.md
Blueprint/06_TECH/AI.md
Blueprint/06_TECH/Architecture.md
Blueprint/06_TECH/Automation.md
Blueprint/06_TECH/Backend.md
Blueprint/06_TECH/Infrastructure.md
Blueprint/06_TECH/Security.md
Blueprint/07_DESIGN/Animation.md
Blueprint/07_DESIGN/Branding.md
Blueprint/07_DESIGN/Design_System.md
Blueprint/07_DESIGN/UI_Guidelines.md
Blueprint/07_DESIGN/UX_Principles.md
Blueprint/08_OPERATIONS/GDPR.md
Blueprint/08_OPERATIONS/Legal.md
Blueprint/08_OPERATIONS/Moderation.md
Blueprint/08_OPERATIONS/Processes.md
Blueprint/08_OPERATIONS/Support.md
Blueprint/09_ROADMAP/2026.md
Blueprint/09_ROADMAP/2027.md
Blueprint/09_ROADMAP/2028.md
Blueprint/09_ROADMAP/2029.md
Blueprint/09_ROADMAP/2030.md
Blueprint/09_ROADMAP/Long_Term.md
Blueprint/10_FINANCE/Budget.md
Blueprint/10_FINANCE/Cost_Model.md
Blueprint/10_FINANCE/Forecast.md
Blueprint/10_FINANCE/KPIs.md
Blueprint/11_INVESTORS/Funding.md
Blueprint/11_INVESTORS/Milestones.md
Blueprint/11_INVESTORS/Pitch.md
Blueprint/11_INVESTORS/Vision_Deck.md
Blueprint/12_APPENDIX/Decisions.md
Blueprint/12_APPENDIX/Glossary.md
Blueprint/12_APPENDIX/Resources.md
Blueprint/12_APPENDIX/Useful_Links.md
Blueprint/99_ARCHIVE/README.md
Blueprint/reports/BLUEPRINT_GUIDELINES.md
Blueprint/reports/BLUEPRINT_SETUP_REPORT.md
Blueprint/reports/CREATED_FILES.md
Blueprint/reports/NEXT_STEPS.md
Blueprint/reports/PROJECT_STRUCTURE.md
database/.gitkeep
database/README.md
docs/00-master-index/01_Dokumentationsuebersicht.md
docs/00-master-index/02_Navigation.md
docs/00-master-index/03_Dokumentenstruktur.md
docs/00-master-index/04_Versionsverwaltung.md
docs/00-master-index/05_Aenderungsprotokoll.md
docs/00-master-index/06_Verantwortlichkeiten.md
docs/00-master-index/07_Glossar.md
docs/00-master-index/08_Dokumentationsprinzipien.md
docs/00-master-index/09_Quick_Links.md
docs/00-master-index/10_Master_Roadmap.md
docs/00-master-index/11_Naechste_Schritte.md
docs/00-master-index/12_Dokumentationsstatus.md
docs/00-master-index/README-BAND.md
docs/00-master-index/README.md
docs/01-product-vision/00_Cover.md
docs/01-product-vision/01_Executive_Summary.md
docs/01-product-vision/02_Vision_Mission.md
docs/01-product-vision/03_Personas.md
docs/01-product-vision/04_Problem.md
docs/01-product-vision/05_Solution.md
docs/01-product-vision/06_Core_Features.md
docs/01-product-vision/07_User_Journey.md
docs/01-product-vision/08_Information_Architecture.md
docs/01-product-vision/09_Roles.md
docs/01-product-vision/10_UX_Principles.md
docs/01-product-vision/11_Business_Roadmap.md
docs/01-product-vision/MASTER-PROMPT-v3.0.md
docs/01-product-vision/PRODUCT-VISION.md
docs/01-product-vision/README.md
docs/02-ui-design/01_Design_System_Uebersicht.md
docs/02-ui-design/02_Farbpalette.md
docs/02-ui-design/03_Typography.md
docs/02-ui-design/04_Komponentenbibliothek.md
docs/02-ui-design/05_Screen_Guidelines.md
docs/02-ui-design/06_Icon_System.md
docs/02-ui-design/07_Motion_Library.md
docs/02-ui-design/08_Gestures_Interactions.md
docs/02-ui-design/09_Zustaende_Feedback.md
docs/02-ui-design/10_Accessibility.md
docs/02-ui-design/11_Responsive_Plattformen.md
docs/02-ui-design/12_Design_Roadmap.md
docs/02-ui-design/MOCKUP-ALIGNMENT.md
docs/02-ui-design/MOCKUP-SCREENS.md
docs/02-ui-design/README-BAND.md
docs/02-ui-design/README.md
docs/03-development/01_Tech_Stack.md
docs/03-development/02_Architektur.md
docs/03-development/03_Projektstruktur.md
docs/03-development/04_Komponentenarchitektur.md
docs/03-development/05_State_Management.md
docs/03-development/06_API_Layer.md
docs/03-development/07_Datenmodell.md
docs/03-development/08_Testing_Strategy.md
docs/03-development/09_Coding_Standards.md
docs/03-development/10_DevOps_CICD.md
docs/03-development/11_Performance.md
docs/03-development/12_Roadmap.md
docs/03-development/BERICHT-ETERNAL-RAVE-GESAMT.md
docs/03-development/README-BAND.md
docs/03-development/README.md
docs/04.5-event-automation/01_Automation_Overview.md
docs/04.5-event-automation/02_Event_Sources.md
docs/04.5-event-automation/03_Import_Pipeline.md
docs/04.5-event-automation/04_AI_Agent.md
docs/04.5-event-automation/05_Event_Confidence.md
docs/04.5-event-automation/06_Duplicate_Detection.md
docs/04.5-event-automation/07_Event_Lifecycle.md
docs/04.5-event-automation/08_Organizer_Verification.md
docs/04.5-event-automation/09_Moderation_Workflow.md
docs/04.5-event-automation/10_Monitoring.md
docs/04.5-event-automation/11_Security_Legal.md
docs/04.5-event-automation/12_Roadmap.md
docs/04.5-event-automation/AUTOMATION_ARCHITECTURE.md
docs/04.5-event-automation/README.md
docs/04.6-authentication-identity/01_Authentication_Overview.md
docs/04.6-authentication-identity/02_User_Roles.md
docs/04.6-authentication-identity/03_Login.md
docs/04.6-authentication-identity/04_Registration.md
docs/04.6-authentication-identity/05_Organizer_Verification.md
docs/04.6-authentication-identity/06_Session_Management.md
docs/04.6-authentication-identity/07_Security.md
docs/04.6-authentication-identity/08_Account_Lifecycle.md
docs/04.6-authentication-identity/09_Roadmap.md
docs/04.6-authentication-identity/README.md
docs/04-backend/01_Architektur_Uebersicht.md
docs/04-backend/02_Infrastruktur_Deployment.md
docs/04-backend/03_Authentifizierung_Autorisierung.md
docs/04-backend/04_API_Design_Standards.md
docs/04-backend/05_Datenmodell_Datenbanken.md
docs/04-backend/06_Realtime_Services.md
docs/04-backend/07_Sicherheit_Compliance.md
docs/04-backend/08_Zahlungssysteme_Abonnements.md
docs/04-backend/09_Monitoring_Logging.md
docs/04-backend/10_Backup_Disaster_Recovery.md
docs/04-backend/11_Roadmap_Zukunft.md
docs/04-backend/12_Backend_Readiness.md
docs/04-backend/README-BAND.md
docs/04-backend/README.md
docs/05-product-operations/01_Produktlebenszyklus.md
docs/05-product-operations/02_Release_Prozess.md
docs/05-product-operations/03_QA_Test_Strategy.md
docs/05-product-operations/04_Feature_Lifecycle.md
docs/05-product-operations/05_Bug_Issue_Management.md
docs/05-product-operations/06_Analytics_KPIs.md
docs/05-product-operations/06b_Product_Discovery.md
docs/05-product-operations/07_Support_Kundenerfolg.md
docs/05-product-operations/08_Community_Moderation.md
docs/05-product-operations/09_Content_Marketing_Guidelines.md
docs/05-product-operations/10_Launch_Go_To_Market.md
docs/05-product-operations/11_App_Store_Distribution.md
docs/05-product-operations/12_Operations_Skalierung.md
docs/05-product-operations/13_Automation_Operations.md
docs/05-product-operations/14_Identity_Operations.md
docs/05-product-operations/15_Organizer_Verification_Operations.md
docs/05-product-operations/README-BAND.md
docs/05-product-operations/README.md
docs/ADR/001-react-native.md
docs/ADR/002-expo.md
docs/ADR/003-supabase.md
docs/ADR/004-navigation.md
docs/ADR/005-routing.md
docs/ADR/006-state-management.md
docs/ADR/007-maps.md
docs/ADR/008-payments.md
docs/ADR/009-analytics.md
docs/ADR/README.md
docs/analysis/01_project_audit.md
docs/analysis/02_mockup_index.md
docs/analysis/03_gap_analysis.md
docs/analysis/04_component_inventory.md
docs/analysis/05_screen_inventory.md
docs/analysis/06_architecture_review.md
docs/analysis/07_design_review.md
docs/analysis/08_performance_review.md
docs/analysis/09_technical_debt.md
docs/analysis/10_migration_roadmap.md
docs/analysis/BAND-4-5-4-6-INTEGRATION-BERICHT.md
docs/project/definition-of-done.md
docs/PROJECT_READY.md
docs/PROJECT_STRUCTURE.md
docs/project/versioning.md
docs/README.md
docs/reports/apk-build/APK_BUILD_REPORT.md
docs/reports/apk-build/BUILD_ERRORS.md
docs/reports/apk-build/CHANGED_FILES.md
docs/reports/apk-build/DECISIONS.md
docs/reports/apk-build/INSTALL_INSTRUCTIONS.md
docs/reports/apk-build/KNOWN_LIMITATIONS.md
docs/reports/apk-build/METRICS.md
docs/reports/apk-build/TEST_RESULTS.md
docs/reports/crash-analysis-2/CHANGED_FILES.md
docs/reports/crash-analysis-2/CRASH_ANALYSIS_2.md
docs/reports/crash-analysis-2/CRASH_FIX_PLAN_2.md
docs/reports/crash-analysis-2/LOGCAT_EXCERPT.md
docs/reports/crash-analysis-2/TEST_RESULTS.md
docs/reports/crash-analysis/CHANGED_FILES.md
docs/reports/crash-analysis/CRASH_ANALYSIS.md
docs/reports/crash-analysis/CRASH_FIX_PLAN.md
docs/reports/crash-analysis/TEST_RESULTS.md
docs/reports/sprint-2/CHANGED_FILES.md
docs/reports/sprint-2/DECISIONS.md
docs/reports/sprint-2/KNOWN_LIMITATIONS.md
docs/reports/sprint-2/METRICS.md
docs/reports/sprint-2/NEXT_STEPS.md
docs/reports/sprint-2/OPEN_ISSUES.md
docs/reports/sprint-2/SPRINT_2_REPORT.md
docs/reports/sprint-2/TEST_RESULTS.md
docs/reports/sprint-3/CHANGED_FILES.md
docs/reports/sprint-3/DECISIONS.md
docs/reports/sprint-3/KNOWN_LIMITATIONS.md
docs/reports/sprint-3/METRICS.md
docs/reports/sprint-3/NEXT_STEPS.md
docs/reports/sprint-3/OPEN_ISSUES.md
docs/reports/sprint-3/SPRINT_3_REPORT.md
docs/reports/sprint-3/TEST_RESULTS.md
docs/reports/sprint-4/CHANGED_FILES.md
docs/reports/sprint-4/DECISIONS.md
docs/reports/sprint-4/KNOWN_LIMITATIONS.md
docs/reports/sprint-4/METRICS.md
docs/reports/sprint-4/NEXT_STEPS.md
docs/reports/sprint-4/OPEN_ISSUES.md
docs/reports/sprint-4/SPRINT_4_REPORT.md
docs/reports/sprint-4/TEST_RESULTS.md
docs/reports/sprint-5.6/CHANGED_FILES.md
docs/reports/sprint-5.6/DECISIONS.md
docs/reports/sprint-5.6/KNOWN_LIMITATIONS.md
docs/reports/sprint-5.6/METRICS.md
docs/reports/sprint-5.6/NEXT_STEPS.md
docs/reports/sprint-5.6/OPEN_ISSUES.md
docs/reports/sprint-5.6/QA_SCORE.md
docs/reports/sprint-5.6/SPRINT_5_6_REPORT.md
docs/reports/sprint-5.6/TEST_RESULTS.md
docs/reports/sprint-5.7/CHANGED_FILES.md
docs/reports/sprint-5.7/DEVICE_INFO.md
docs/reports/sprint-5.7/KNOWN_LIMITATIONS.md
docs/reports/sprint-5.7/MOCKUP_COMPARISON.md
docs/reports/sprint-5.7/NEXT_STEPS.md
docs/reports/sprint-5.7/OPEN_ISSUES.md
docs/reports/sprint-5.7/QA_SCORE.md
docs/reports/sprint-5.7/SCREENSHOT_COMPARISON.md
docs/reports/sprint-5.7/SPRINT_5_7_REPORT.md
docs/reports/sprint-5.7/SPRINT_REPORT.md
docs/reports/sprint-5.7/TEST_RESULTS.md
docs/reports/sprint-5.7/UI_AUDIT.md
docs/reports/sprint-5.7/VISUAL_QA.md
docs/reports/sprint-5.8.1/CHANGED_FILES.md
docs/reports/sprint-5.8.1/FIXED_ISSUES.md
docs/reports/sprint-5.8.1/LOGCAT_REPORT.md
docs/reports/sprint-5.8.1/NEXT_STEPS.md
docs/reports/sprint-5.8.1/OPEN_ISSUES.md
docs/reports/sprint-5.8.1/PERFORMANCE_REPORT.md
docs/reports/sprint-5.8.1/STABILITY_REPORT.md
docs/reports/sprint-5.8.1/TEST_RESULTS.md
docs/reports/sprint-5.8/CHANGED_FILES.md
docs/reports/sprint-5.8/DECISIONS.md
docs/reports/sprint-5.8/KNOWN_LIMITATIONS.md
docs/reports/sprint-5.8/NEXT_STEPS.md
docs/reports/sprint-5.8/OPEN_ISSUES.md
docs/reports/sprint-5.8/RUNTIME_QA.md
docs/reports/sprint-5.8/SPRINT_5_8_REPORT.md
docs/reports/sprint-5.8/TEST_RESULTS.md
docs/reports/sprint-5.8/VISUAL_QA.md
docs/reports/sprint-5/CHANGED_FILES.md
docs/reports/sprint-5/DECISIONS.md
docs/reports/sprint-5/KNOWN_LIMITATIONS.md
docs/reports/sprint-5/METRICS.md
docs/reports/sprint-5/NEXT_STEPS.md
docs/reports/sprint-5/OPEN_ISSUES.md
docs/reports/sprint-5/SPRINT_5_REPORT.md
docs/reports/sprint-5/TEST_RESULTS.md
docs/rules/ARCHITECTURE_RULES.md
docs/rules/CODING_RULES.md
docs/rules/CURSOR_RULES.md
docs/rules/DESIGN_RULES.md
docs/rules/PROJECT_RULES.md
docs/rules/README.md
docs/sprint-0.5/01_ARCHITECTURE_VALIDATION.md
docs/sprint-0.5/02_DOCUMENTATION_VALIDATION.md
docs/sprint-0.5/03_DESIGN_VALIDATION.md
docs/sprint-0.5/04_SECURITY_VALIDATION.md
docs/sprint-0.5/05_AUTOMATION_VALIDATION.md
docs/sprint-0.5/06_AUTH_VALIDATION.md
docs/sprint-0.5/07_PROJECT_HEALTH.md
docs/sprint-0.5/08_SPRINT1_READINESS.md
docs/sprint-0.5/MERGE-REPORT-README.md
docs/sprint-0.5/README.md
docs/sprint-0-final/01_PROJECT_FOUNDATION_REPORT.md
docs/sprint-0-final/02_DOCUMENTATION_FINAL.md
docs/sprint-0-final/03_ARCHITECTURE_FINAL.md
docs/sprint-0-final/04_RULES_FINAL.md
docs/sprint-0-final/05_PROJECT_STRUCTURE_FINAL.md
docs/sprint-0-final/06_PROJECT_HEALTH_FINAL.md
docs/sprint-0-final/07_SPRINT1_READY.md
docs/sprint-0-final/README.md
eas.json
.env.example
.github/workflows/auto-close-obsolete-prs.yml
.gitignore
global.css
global.d.ts
metro.config.js
nativewind-env.d.ts
.npmrc
package.json
PRE_SPRINT_REPORT.md
README.md
scripts/generate-seed-events.js
SPRINT_1_REPORT.md
src/constants/navigation.ts
src/constants/onboarding.ts
src/constants/placeholderAssets.ts
src/constants/theme.ts
src/data/events.ts
src/data/seedEventSources.ts
src/data/seedSubmissions.ts
src/domain/event/index.ts
src/domain/event/permissions.ts
src/domain/event/status.ts
src/domain/event/types.ts
src/lib/supabase/client.ts
src/lib/supabase/env.ts
src/repositories/eventRepository.ts
src/services/adminService.ts
src/services/authService.ts
src/services/eventDraftService.ts
src/services/eventLifecycleService.ts
src/services/eventReviewService.ts
src/services/eventService.ts
src/services/eventSources.ts
src/services/events.ts
src/services/eventSubmissionService.ts
src/services/favoriteService.ts
src/services/favorites.ts
src/services/firstLaunchStorage.ts
src/services/importService.ts
src/services/imports.ts
src/services/index.ts
src/services/organizers.ts
src/services/profiles.ts
src/services/publicFeedService.ts
src/services/sourceImport.ts
src/services/submissionService.ts
src/services/submissions.ts
src/services/types.ts
src/types/auth.ts
src/types/database.ts
src/types/eventSource.ts
src/types/event.ts
src/types/lifecycle.ts
src/validation/eventValidation.ts
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_event_sources.sql
supabase/migrations/003_user_submission_rls.sql
supabase/migrations/004_duplicate_warning_events.sql
supabase/migrations/005_auth_roles_moderator.sql
supabase/migrations/006_event_foundation.sql
supabase/README.md
supabase/seed_event_sources.sql
supabase/seed_published_events.sql
supabase/seed.sql
tailwind.config.js
tsconfig.json
```

</details>
