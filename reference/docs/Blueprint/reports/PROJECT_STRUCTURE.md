# Project Structure — Master Blueprint

**Version:** 1.0  
**Phase:** BP-0  
**Date:** 2026-07-03

---

## Location

```
/workspace/Blueprint/          ← Project root (NOT under docs/)
```

---

## Full tree

```
Blueprint/
├── 00_READ_ME_FIRST.md
│
├── 01_VISION/
│   ├── Vision.md
│   ├── Mission.md
│   ├── Values.md
│   └── Principles.md
│
├── 02_PRODUCT/
│   ├── Product.md
│   ├── User_Groups.md
│   ├── Feature_Roadmap.md
│   ├── Release_Plan.md
│   └── Core_Features.md
│
├── 03_BUSINESS/
│   ├── Business_Model.md
│   ├── Pricing.md
│   ├── Revenue.md
│   ├── Eternal_Pass.md
│   ├── Organizer_Pro.md
│   ├── Artist_Pro.md
│   ├── Club_Pro.md
│   ├── Festival_Pro.md
│   ├── Partner_Program.md
│   └── Monetization.md
│
├── 04_COMMUNITY/
│   ├── Community.md
│   ├── Reputation.md
│   ├── Badges.md
│   ├── Levels.md
│   ├── Referrals.md
│   └── Friends.md
│
├── 05_MARKETING/
│   ├── Brand.md
│   ├── Growth.md
│   ├── Launch.md
│   ├── Social.md
│   ├── Content.md
│   └── SEO_ASO.md
│
├── 06_TECH/
│   ├── Architecture.md
│   ├── Backend.md
│   ├── Automation.md
│   ├── AI.md
│   ├── Infrastructure.md
│   └── Security.md
│
├── 07_DESIGN/
│   ├── Branding.md
│   ├── Design_System.md
│   ├── UX_Principles.md
│   ├── UI_Guidelines.md
│   └── Animation.md
│
├── 08_OPERATIONS/
│   ├── Support.md
│   ├── Moderation.md
│   ├── Legal.md
│   ├── GDPR.md
│   └── Processes.md
│
├── 09_ROADMAP/
│   ├── 2026.md
│   ├── 2027.md
│   ├── 2028.md
│   ├── 2029.md
│   ├── 2030.md
│   └── Long_Term.md
│
├── 10_FINANCE/
│   ├── Cost_Model.md
│   ├── Forecast.md
│   ├── KPIs.md
│   └── Budget.md
│
├── 11_INVESTORS/
│   ├── Pitch.md
│   ├── Vision_Deck.md
│   ├── Funding.md
│   └── Milestones.md
│
├── 12_APPENDIX/
│   ├── Glossary.md
│   ├── Decisions.md
│   ├── Resources.md
│   └── Useful_Links.md
│
├── 99_ARCHIVE/
│   └── README.md
│
└── reports/
    ├── BLUEPRINT_SETUP_REPORT.md
    ├── BLUEPRINT_GUIDELINES.md
    ├── CREATED_FILES.md
    ├── PROJECT_STRUCTURE.md
    └── NEXT_STEPS.md
```

---

## Four documentation layers (project context)

| Layer | Location | Role |
|-------|----------|------|
| App | `app/`, `src/` | Code |
| Band 0–5 | `docs/` | Technical project docs |
| **Master Blueprint** | `Blueprint/` | Vision, product, business, strategy |
| Mockups | `assets/mockups/` | Design reference |

Sprint Reports remain under `docs/reports/sprint-x/` — unchanged.
