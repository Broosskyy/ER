# 05 — Product Operations

Releases, Distribution, Operations und Roadmap.

---

## Android APK (aktuell)

| Version | Download |
|---------|----------|
| **v1.7.0** (latest) | [GitHub Release](https://github.com/Broosskyy/Eternal-Rave/releases/download/v1.7.0/Eternal-Rave-v1.7.0.apk) |
| v1.6.0 | [Download](https://github.com/Broosskyy/Eternal-Rave/releases/download/v1.6.0/Eternal-Rave-v1.6.0.apk) |
| v1.5.0 | [Download](https://github.com/Broosskyy/Eternal-Rave/releases/download/v1.5.0/Eternal-Rave-v1.5.0.apk) |

Alle Releases: https://github.com/Broosskyy/Eternal-Rave/releases

---

## Operations-Kapitel (Band 5 Bible)

| # | Datei | Thema |
|---|-------|-------|
| 01 | [Produktlebenszyklus](./01_Produktlebenszyklus.md) | Lifecycle |
| 02 | [Release Prozess](./02_Release_Prozess.md) | Releases |
| 03 | [QA Test Strategy](./03_QA_Test_Strategy.md) | Testing |
| 04 | [Feature Lifecycle](./04_Feature_Lifecycle.md) | Features |
| 05 | [Bug & Issue Management](./05_Bug_Issue_Management.md) | Bugs |
| 06 | [Analytics & KPIs](./06_Analytics_KPIs.md) | Metriken |
| 07 | [Support & Kundenerfolg](./07_Support_Kundenerfolg.md) | Support |
| 08 | [Community & Moderation](./08_Community_Moderation.md) | Moderation |
| 09 | [Content & Marketing](./09_Content_Marketing_Guidelines.md) | Marketing |
| 10 | [Launch & Go-To-Market](./10_Launch_Go_To_Market.md) | Launch |
| 11 | [App Store Distribution](./11_App_Store_Distribution.md) | Stores |
| 12 | [Operations & Skalierung](./12_Operations_Skalierung.md) | Skalierung |
| **13** | **[Automation Operations](./13_Automation_Operations.md)** | **Event Automation Betrieb** |
| **14** | **[Identity Operations](./14_Identity_Operations.md)** | **Auth & Account Betrieb** |
| **15** | **[Organizer Verification Operations](./15_Organizer_Verification_Operations.md)** | **Verification Betrieb** |

---

## Verwandte Bände

| Band | Bezug |
|------|-------|
| [4.5 Event Automation](../04.5-event-automation/README.md) | Technische Automation-Doku |
| [4.6 Authentication](../04.6-authentication-identity/README.md) | Auth-System Doku |
| [4 Backend](../04-backend/README.md) | Supabase, API |

---

## Installation

1. APK auf Android-Gerät herunterladen  
2. „Unbekannte Quellen“ erlauben  
3. Installieren  

## Build (lokal)

```bash
npm run build:apk
```

Output: `android/app/build/outputs/apk/release/app-release.apk`

## Version Roadmap

| Version | Fokus |
|---------|-------|
| V0.1–0.3 | Frontend, Supabase, Published Feed ✅ |
| V1 | Public Release / Play Store 🟡 |
| V2 | Automatic Event Discovery |
| V3 | Organizer Ecosystem |
| V4 | Community |
| V5 | AI Recommendations |

## APK-Größe (~105 MB)

Universal-APK mit 4 CPU-Architekturen + React Native Native Stack.  
Optimierung: arm64-only Build oder Play Store AAB → ~30–40 MB Download.
