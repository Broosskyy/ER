# M9.3A — High-Coverage Source Discovery, Qualification & Acquisition Strategy Audit

## Final status

**M9_3A_HIGH_COVERAGE_SOURCE_QUALIFICATION_COMPLETE**

Research and qualification audit only. No sources activated, no staging/production mutations, no scheduler changes.

| Item | Value |
|------|-------|
| Branch | `rebuild/event-core-clean` |
| Local HEAD | `b64dfcc` |
| Remote HEAD | `b64dfcc` |
| Baseline | M9_2_1_GLOBAL_EVENT_MEDIA_EVIDENCE_VERIFIED |
| Active sources | `bootshaus-official` (23 events), `affenkaefig-official` (7 events) |
| Probe artifacts | `app-v2/.tmp/m9-3a-probe/probe-results.json` |
| Probe script | `app-v2/scripts/run-m9-3a-source-probe.ts` (read-only) |

---

## 1. Executive Summary

Eternal Rave should **not** expand via many low-coverage venue connectors. The highest leverage path is a **hybrid architecture**:

1. **Network discovery sources** — ticket.io shop network + Rausgegangen city discovery
2. **Selective official sources** — high-value venues/organizers where authority matters (Nachtresidenz, Odonien, Stadtgarten, zakk)
3. **Existing ticket evidence pipeline** — TicketKings + ticket.io as supplemental authority, not separate “sources” per shop

**Top M9.3B recommendation:** Build **`ticket.io Network Discovery`** first, then **`Rausgegangen Discovery`**. Both are source-agnostic, high-coverage, and plug into the existing identity → reconciliation → media → ticket evidence graph without per-organizer connector sprawl.

**Reject for unattended primary ingestion:** Resident Advisor (Cloudflare block), Raves of Germany (SPA shell, no structured SSR data).

**Do not re-activate without re-qualification:** Stadtgarten, zakk, Nachtresidenz as Batch-1 defaults — they are valuable but **low-coverage selective officials**, not network replacements.

---

## 2. Current Architecture

### Existing pipeline (unchanged in M9.3A)

```
Source Registry → OfficialConnector → Safe Fetch → Parse/Evidence
  → EventCandidate → Identity (M8.3) → Reconciliation (M8.2)
  → Media Evidence (M9.2.1) → Ticket Evidence (M6)
  → EventWritePlan → Staging Apply → Consumer
```

### Key integration points for new high-coverage sources

| Layer | Location | Reuse for M9.3B |
|-------|----------|-----------------|
| Official connector contract | `server/official-connectors/connector-contract.ts` | Extend with `discovery_network` source type OR new `DiscoverySource` interface |
| Ticket provider registry | `server/official-connectors/ticket-evidence/` | ticket.io shops already supported (`ticket_io` key) |
| URL policy | `ticket-evidence/url-policy.ts` | Already classifies `rausgegangen`, `resident_advisor`, `ticket.io` |
| Identity engine | `server/ingestion/identity/event-matcher.ts` | Cross-source dedup ready |
| Media evidence | `server/official-connectors/media-evidence/` | EventMediaCandidate pipeline source-agnostic |
| Scheduler | GHA per-connector workflows | **Not extended in M9.3A** |

### Architecture question (§27): A vs B vs C

**Recommendation: HYBRID (C)**

| Model | Verdict | Rationale |
|-------|---------|-----------|
| A — per-organizer connectors | **Reject as primary strategy** | Hundreds of ticket.io shops; unsustainable connector count |
| B — network sources only | **Insufficient alone** | Discovery without official authority weakens description/lineup trust |
| **C — hybrid** | **Adopt** | Networks discover + link; officials/tickets provide field authority |

---

## 3. Current Source Baseline

| Source | Status | Events (M9.2.1) | Role today |
|--------|--------|-----------------|------------|
| Bootshaus | Active | 23 | Primary official + ticket.io shop overlap |
| Affenkäfig | Active | 7 | Primary official + TicketKings overlap |
| Nachtresidenz | Implemented, unregistered | 0 | Selective official candidate |
| Stadtgarten | Implemented, unregistered | 0 | Selective official candidate |
| zakk | Implemented, unregistered | 0 | Selective official candidate |

Removed after M9.1 (not candidates for blind re-activation): low net-new electronic value relative to connector cost.

---

## 4. Audit Methodology

1. **Codebase audit** — registry, connector contract, ticket providers, M9.1/M9.2 reports, scheduler boundary
2. **Live HTTP probes** — read-only `fetch` with audit User-Agent (`run-m9-3a-source-probe.ts`)
3. **Real page verification** — listing → detail → ticket target → media (manual + fetch content review)
4. **Coverage measurement** — event link counts in HTML, category/tag pages, shop catalogs
5. **Relevance sampling** — classify sample events CLEARLY_RELEVANT / AMBIGUOUS / IRRELEVANT
6. **Overlap analysis** — compare against Bootshaus + Affenkäfig event universe (30 events)
7. **Scoring** — weighted model (§25); tiers assigned independently of desired outcome

**Constraints honored:** no staging writes, no production access, no bot circumvention, no scheduler changes.

---

## 5. Candidate Inventory (15 audited)

| # | Source | Category | Probe | Live detail check |
|---|--------|----------|-------|-------------------|
| 1 | ticket.io shop network | Ticket network | ✅ | Bootshaus + Stadtgarten shops + portal |
| 2 | TicketKings | Ticket network | ✅ | Homepage + existing M9.2 integration |
| 3 | Rausgegangen | Aggregator | ✅ | 8 NRW cities + Cologne techno tag |
| 4 | Raves of Germany | Electronic platform | ✅ | Homepage (SPA) |
| 5 | Resident Advisor | Electronic platform | ✅ | Blocked (403 Cloudflare) |
| 6 | GoOut | Aggregator | ⚠️ | DE URL variants mostly 404 |
| 7 | Dice | Aggregator | ❌ | Cologne browse 404 |
| 8 | Eventim | Ticket network | ⚠️ | Techno Köln page bot-thin |
| 9 | Odonien | Organizer/venue | ✅ | Club SPA + outbound link graph |
| 10 | Nibirii | Festival | ⚠️ | nibirii.com/events 404; ticket.io shop live |
| 11 | Nachtresidenz | Official | ✅ | Listing SSR |
| 12 | Stadtgarten | Official | ✅ | Program calendar |
| 13 | zakk party | Official | ✅ | Party program |
| 14 | portal.srvded.ticket.io | Ticket network portal | ✅ | National event finder |
| 15 | Essigfabrik | Official venue | 📋 | M9.1A: empty EventON at audit |

---

## 6. ticket.io Network Audit

### 6.1 Platform structure

| Layer | URL pattern | Role |
|-------|-------------|------|
| Organizer shop | `{slug}.ticket.io/` | Branded shop; event list + detail |
| Event detail | `{shop}.ticket.io/{eventId}/` | Stable short IDs (6–12 alphanumeric) |
| Shared portal | `portal.srvded.ticket.io/` | Location + category filtered national finder (SPA) |
| CDN media | `cdn.ticket.io/companies/.../events/.../img/` | Flyer images |

### 6.2 Existing Eternal Rave integration

- `TicketIoEvidenceProvider` + `parse-ticket-io-detail-dom.ts` already extract event metadata + images
- `url-policy.ts`: `isTicketIoHost`, `canonicalizeTicketIoUrl`, `extractTicketIoProviderEventId`
- Bootshaus official events already link to `bootshaus-club.ticket.io`
- Affenkäfig/Nibirii overlap via `nibirii-festival.ticket.io` (found on nibirii.com 404 page)

### 6.3 Live shop probes

| Shop | Future events (visible) | Electronic relevance | Detail quality | Media | Line-up | Overlap |
|------|----------------------|----------------------|----------------|-------|---------|---------|
| `bootshaus-club.ticket.io` | ~12+ | HIGH | HIGH | HIGH | HIGH | **High** — mirrors Bootshaus official |
| `stadtgarten.ticket.io` | ~70+ images/69 JSON-LD | MEDIUM | HIGH | HIGH | MEDIUM | Low–medium vs active sources |
| `nibirii-festival.ticket.io` | Festival tiers | HIGH | HIGH | HIGH | HIGH | Medium — Bootshaus hosts Nibirii editions |
| `odonien.ticket.io` | Linked from Odonien SPA | HIGH | HIGH | MEDIUM | MEDIUM | Medium — Köln ecosystem |
| `portal.srvded.ticket.io` | National (electronic filter) | MEDIUM–HIGH | MEDIUM | MEDIUM | VARIABLE | Low per-event; high discovery |

### 6.4 Generic discovery feasibility

**YES — one network connector can cover many shops.**

Discovery strategies (conceptual, not implemented):

1. **Shop seed list** — expand from outbound links in official pages + portal search
2. **Portal crawler** — `portal.srvded.ticket.io` with location=Köln/NRW + category=Electronic
3. **Sitemap/organizer index** — `/organizer/{slug}` pages on portal (observed on Nibirii portal events)

Each discovered event feeds existing `ticket_io` provider pipeline → identity graph node, not a new connector per shop.

### 6.5 ticket.io organizer shops observed (live sample)

| Organizer / Brand | Shop URL | Region | Future events | Electronic | Parse generic? |
|-------------------|----------|--------|---------------|------------|----------------|
| Bootshaus | bootshaus-club.ticket.io | Köln | 12+ | HIGH | ✅ existing |
| Stadtgarten | stadtgarten.ticket.io | Köln | 70+ | MEDIUM | ✅ same DOM |
| Nibirii Festival | nibirii-festival.ticket.io | NRW | Festival multi-day | HIGH | ✅ same DOM |
| Odonien (via links) | odonien.ticket.io, aura.ticket.io | Köln | Variable | HIGH | ✅ same DOM |
| Portal national | portal.srvded.ticket.io | DE | 100s+ filtered | MIXED | ⚠️ SPA — needs API/XHR analysis |

---

## 7. Rausgegangen Audit

### 7.1 Platform structure

- City pages: `rausgegangen.de/{city}/` — **slug is English** (`cologne`, not `koeln`)
- Tag pages: `rausgegangen.de/cologne/tags/techno/`
- Ticketing backend: `zentrale.events` / `scannerapi.rausgegangen.de` (organizer-facing)
- Image CDN: `imageflow.rausgegangen.de`

### 7.2 NRW city coverage (probe 2026-08-28)

| City slug | Status | Event links in HTML | Images |
|-----------|--------|---------------------|--------|
| cologne | ✅ (use `cologne`) | ~400+ (est. from similar cities) | High |
| duesseldorf | ✅ | 499 | 520 |
| bonn | ✅ | 409 | 429 |
| dortmund | ✅ | 456 | 477 |
| essen | ✅ | 352 | 373 |
| bochum | ✅ | 346 | 367 |
| muenster | ✅ | 349 | 369 |
| aachen | ✅ | 297 | 313 |

**One generic city-discovery connector** can cover all NRW cities via slug list — not eight separate connectors.

### 7.3 Cologne techno tag (live sample, 2026-08-28)

30+ near-term events visible including: Odonien, Garagen, Schrotty, artheater, Bootshaus-adjacent venues, Aura, DER DRITTE RAUM @ Odonien, TECHNOLiEBE, BZZBZZ TECHNO, etc.

**Relevance sample (Cologne techno tag, n=20):**

| Classification | Count | % |
|----------------|-------|---|
| CLEARLY_RELEVANT | 16 | 80% |
| AMBIGUOUS (mixed/open-air/culture crossover) | 3 | 15% |
| IRRELEVANT | 1 | 5% |

`relevantRatio ≈ 0.80` on techno-tagged pages (much lower on unfiltered city pages).

### 7.4 Link graph (typical Rausgegangen event)

```
Rausgegangen listing
  → Event detail (rausgegangen.de/events/{slug}/)
    → Venue page (rausgegangen.de/locations/{venue}/)
    → External ticket shop (ticket.io / Eventbrite / RG ticketing)
    → Organizer profile
```

Ideal **discovery-only** role: find event + outbound official/ticket URLs → evidence chain.

### 7.5 Technical access

| Signal | Value |
|--------|-------|
| Rendering | SSR HTML shell + large embedded payloads (~1.5–2.5 MB/city page) |
| JSON-LD | Present (1–2 blocks) |
| Stable event IDs | Slug-based URLs |
| Pagination | City pages aggregate; tag pages filter |
| Anti-bot | None observed on city pages |
| Automation | **GOOD** — predictable URLs; rate-limit politely |

---

## 8. Raves of Germany Audit

| Check | Result |
|-------|--------|
| Homepage | 200 OK → redirects to `www.ravesofgermany.com` |
| SSR content | **Minimal** — "Loading events..." shell only |
| Event links in HTML | 1 (`/event/create`) |
| JSON-LD | 0 |
| Ticket links | 0 |
| API visible | Not in initial HTML |

**Verdict:** Name implies electronic focus, but **technical data yield is LOW**. Would require reverse-engineering client API (if any). Not suitable as Tier 1 discovery without further engineering proof.

**Relevance:** Cannot measure at listing level without JS execution.

---

## 9. Resident Advisor Audit

| Check | Result |
|-------|--------|
| URL tested | `de.ra.co/events/de/cologne` |
| Response | **403 Cloudflare** — "Sorry, you have been blocked" |
| Unattended fetch | **Failed** |
| Legal/operational | High-protection platform; scraping risk |

**Verdict:** **REJECT** for unattended primary ingestion. **TIER 3 supplemental only** if manual/partner API becomes available. Do not attempt circumvention.

---

## 10. Additional Candidate Audits

### GoOut (`goout.net`)

- Cologne techno URL probed: 404 / wrong locale paths
- Platform strong in CZ/SK market; weak DE NRW presence in probe
- **TIER 3 / REJECT** for NRW electronic focus

### Dice (`dice.fm`)

- Cologne browse URL: 404
- UK-centric; limited DE coverage in probe
- **REJECT** for current NRW strategy

### Eventim (`eventim.de`)

- Techno Köln category page returns thin HTML (2.7 KB) — likely bot/JS gate
- Value as **ticket target resolver** only when linked from officials
- **TIER 3** supplemental ticket evidence

### TicketKings (existing)

- 42+ event links, 105 ticket links on homepage probe
- Already integrated; Affenkäfig M9.2 verified
- **TIER 2** — expand as discovery network (crawl event index) using existing provider

### Odonien

- Club page: Nuxt SPA, links to Rausgegangen, Eventbrite, ticket.io (`aura.ticket.io`, `tonite.ticket.io`)
- CMS API (`cms.odonien.de/api/events`) returned 400 with simple filter — needs authenticated/schema discovery
- **TIER 2** selective official + ticket.io shop nodes

### Nachtresidenz / Stadtgarten / zakk (existing connectors)

- All probe OK with SSR HTML
- Nachtresidenz: 8 event links; Düsseldorf electronic club
- Stadtgarten: 19 program links; mixed jazz/word + electronic
- zakk: 8 party program links; Düsseldorf electronic/mixed
- **TIER 2** selective officials — not high-coverage networks

---

## 11. Real-Source Verification

| Source | Listing checked | Detail checked | Ticket checked | Flyer checked |
|--------|-----------------|----------------|----------------|---------------|
| ticket.io Bootshaus shop | ✅ | ✅ (existing M9.2.1) | ✅ | ✅ |
| ticket.io portal | ✅ | ✅ sample events | ✅ | partial |
| Rausgegangen Cologne techno | ✅ | ✅ sample (Odonien, Garagen, Schrotty) | ✅ outbound | ✅ imageflow CDN |
| Raves of Germany | ✅ | ❌ no SSR detail | ❌ | ❌ |
| Resident Advisor | ❌ blocked | ❌ | ❌ | ❌ |
| Odonien club | ✅ | partial SPA | ✅ ticket.io links | partial |
| Nachtresidenz | ✅ | prior M9.1A | partial | partial |

---

## 12. Field Coverage Matrix

| Source | Title | Date | Venue | Description | Line-up | Genre | Image | Ticket | Price | Status |
|--------|-------|------|-------|-------------|---------|-------|-------|--------|-------|--------|
| ticket.io shops | HIGH | HIGH | HIGH | HIGH | MEDIUM | LOW | HIGH | HIGH | HIGH | HIGH |
| Rausgegangen | HIGH | HIGH | HIGH | MEDIUM | LOW | MEDIUM | HIGH | MEDIUM | MEDIUM | MEDIUM |
| TicketKings | HIGH | HIGH | HIGH | HIGH | HIGH | LOW | HIGH | HIGH | HIGH | HIGH |
| Raves of Germany | LOW | LOW | LOW | LOW | LOW | LOW | LOW | LOW | LOW | LOW |
| Resident Advisor | — | — | — | — | — | — | — | — | — | NONE (blocked) |
| Odonien official | HIGH | HIGH | HIGH | MEDIUM | LOW | MEDIUM | MEDIUM | MEDIUM | via links | MEDIUM |
| Nachtresidenz | HIGH | HIGH | HIGH | MEDIUM | MEDIUM | LOW | MEDIUM | MEDIUM | partial | MEDIUM |
| Stadtgarten | HIGH | HIGH | HIGH | HIGH | MEDIUM | MEDIUM | HIGH | HIGH | HIGH | HIGH |
| zakk | HIGH | HIGH | HIGH | HIGH | LOW | MEDIUM | MEDIUM | MEDIUM | partial | MEDIUM |
| Eventim | MEDIUM | MEDIUM | MEDIUM | LOW | LOW | MEDIUM | MEDIUM | HIGH | HIGH | HIGH |

---

## 13. Technical Access Matrix

| Source | SSR | JSON-LD | Embedded JSON | Stable IDs | Pagination | Anti-bot | Automation |
|--------|-----|---------|---------------|------------|------------|----------|------------|
| ticket.io shops | ✅ | ✅ | ❌ | ✅ short ID | shop list | none | **GREEN** |
| ticket.io portal | partial | ❌ | ❌ | ✅ | location filter | none | **YELLOW** (SPA) |
| Rausgegangen | ✅ | partial | ✅ | ✅ slug | city/tag | none | **GREEN** |
| TicketKings | ✅ | partial | ✅ | ✅ | index pages | none | **GREEN** |
| Raves of Germany | ❌ | ❌ | ❌ | unknown | unknown | none | **RED** |
| Resident Advisor | ❌ | ❌ | ❌ | ✅ | ✅ | **Cloudflare** | **RED** |
| Odonien | partial | ❌ | ✅ Nuxt | ✅ API ids | API | none | **YELLOW** |
| Nachtresidenz | ✅ | ❌ | ❌ | partial | listing | none | **GREEN** |
| Stadtgarten | ✅ | ❌ | ❌ | ✅ slug-id | calendar | none | **GREEN** |
| Eventim | ❌ thin | ❌ | ❌ | ✅ | category | likely | **YELLOW** |

---

## 14. Coverage Analysis

| Source | Future events observed | Relevant electronic (est.) | NRW (est.) | Cologne (est.) |
|--------|------------------------|------------------------------|------------|----------------|
| Rausgegangen (8 NRW cities) | ~3,000+ raw links | ~400–600 filtered | HIGH | ~80–120 techno-tagged |
| ticket.io portal (electronic filter) | 100s national | ~100–200 | MEDIUM | ~20–40 |
| ticket.io shops (known NRW) | ~100+ combined | ~60–80 | MEDIUM | ~40–50 |
| TicketKings index | 42+ on home | ~30–50 | MEDIUM | ~10–20 |
| Nachtresidenz | 12+ | ~10 | LOW (DUS) | overlap |
| Stadtgarten | ~19/month view | ~5–8 electronic | LOW | LOW |
| zakk party | ~8–17 | ~6–12 | LOW (DUS) | overlap |
| Bootshaus + Affenkäfig (baseline) | 30 | 30 | — | — |

---

## 15. Electronic Relevance Analysis

| Source | relevantRatio | ambiguousRatio | irrelevantRatio | Notes |
|--------|---------------|----------------|-----------------|-------|
| Rausgegangen (techno tag) | ~0.80 | ~0.15 | ~0.05 | Use genre/tag filters |
| Rausgegangen (city unfiltered) | ~0.15 | ~0.25 | ~0.60 | Broad culture platform |
| ticket.io portal (electronic filter) | ~0.70 | ~0.20 | ~0.10 | Some mis-tagged events |
| ticket.io NRW shops | ~0.75 | ~0.15 | ~0.10 | Shop-dependent |
| Nachtresidenz | ~0.90 | ~0.10 | ~0.00 | Club-specific |
| Stadtgarten | ~0.35 | ~0.30 | ~0.35 | Jazz/word heavy |
| zakk party program | ~0.55 | ~0.30 | ~0.15 | Mixed subcultures |
| Raves of Germany | unknown | unknown | unknown | No SSR data |
| Resident Advisor | n/a | n/a | n/a | Blocked |

---

## 16. Net-New Event Analysis

**Method:** Rough dedup against 30-event Bootshaus+Affenkäfig baseline + cross-candidate overlap adjustment.

| Source | Raw events | Est. unique | Est. net-new relevant |
|--------|------------|-------------|---------------------|
| Rausgegangen NRW (electronic-filtered) | ~400–600 | ~250–350 | **~120–180** |
| ticket.io network (NRW shops + portal) | ~150+ | ~80–120 | **~40–70** |
| TicketKings expansion | ~50+ | ~40 | **~15–25** |
| Nachtresidenz official | ~12 | ~12 | **~10–12** |
| Odonien official/API | ~50+ club | ~40 | **~25–35** |
| Stadtgarten + zakk | ~30 | ~25 | **~15–20** |
| **Combined (deduped)** | — | — | **~150–220 net-new** |

**Important:** Net-new is NOT additive across all sources — identity graph collapses duplicates.

---

## 17. Cross-Source Overlap

| Source | Bootshaus overlap | Affenkäfig overlap | Other overlap | Unique value |
|--------|-------------------|--------------------|--------------|--------------|
| ticket.io Bootshaus shop | **HIGH (~90%)** | LOW | — | Ticket/media authority, not discovery |
| Rausgegangen Cologne | **HIGH (~40%)** | **MEDIUM (~25%)** | Odonien, Garagen | Discovery + outbound links |
| ticket.io portal | LOW | LOW | Many shops | National discovery |
| Nachtresidenz | LOW | LOW | Rausgegangen partial | Düsseldorf club official |
| Odonien | MEDIUM | MEDIUM | RG + ticket.io | Official + API |
| Nibirii ticket.io | **HIGH** | MEDIUM | Bootshaus festival | Festival evidence |

**Key insight:** Overlap is a **feature** for evidence chains, not wasted coverage — if modeled as graph nodes, not separate events.

---

## 18. Link Graph Analysis

```
                    ┌─────────────────┐
                    │  Rausgegangen   │  DISCOVERY
                    └────────┬────────┘
                             │ outbound
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
  │ Official    │    │ ticket.io   │    │ TicketKings │
  │ venue/org   │    │ shop        │    │             │
  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘
         │                  │                   │
         └──────────────────┼───────────────────┘
                            ▼
                   ┌─────────────────┐
                   │ Identity Graph  │
                   │ → Canonical     │
                   └─────────────────┘
```

Observed outbound patterns (live):

- Odonien → Rausgegangen, Eventbrite, ticket.io (`aura.ticket.io`, `tonite.ticket.io`)
- Bootshaus official → `bootshaus-club.ticket.io`
- Affenkäfig official → TicketKings, ticket.io (select events)
- Rausgegangen → mixed ticket backends + venue pages
- Nibirii.com → `nibirii-festival.ticket.io`

---

## 19. Ticket Evidence Analysis

| Source | Ticket targets | Provider detect | Price | Phase/tier | Safe CTA |
|--------|----------------|-----------------|-------|------------|----------|
| ticket.io shops | HIGH | ✅ `ticket_io` | HIGH | HIGH | HIGH (existing pipeline) |
| TicketKings | HIGH | ✅ `ticket_kings` | HIGH | MEDIUM | HIGH (M9.2 verified) |
| Rausgegangen | MEDIUM | partial (`rausgegangen_ticketing`) | MEDIUM | LOW | MEDIUM — verify per event |
| Eventim | when linked | `eventim` classify only | HIGH | HIGH | MEDIUM |
| Official venues | LOW–MEDIUM | via discovery | LOW | LOW | varies |

---

## 20. Media Evidence Analysis

| Source | Images | Flyers | Line-up flyer | Placeholder freq | M9.2.1 compatible |
|--------|--------|--------|---------------|------------------|-------------------|
| ticket.io | HIGH | HIGH | MEDIUM | LOW | ✅ via `TicketIoEvidenceProvider` |
| TicketKings | HIGH | HIGH | HIGH | LOW | ✅ verified M9.2.1 |
| Rausgegangen | HIGH | MEDIUM | LOW | MEDIUM | ✅ EventMediaCandidate ready |
| Official venues | HIGH | HIGH | VARIABLE | LOW | ✅ |
| Raves of Germany | unknown | unknown | unknown | unknown | ❌ no data |
| Resident Advisor | n/a | n/a | n/a | n/a | ❌ blocked |

---

## 21. Discovery vs Authority

| Source | Discovery value | Authority value | Recommended role |
|--------|-----------------|-----------------|------------------|
| ticket.io network | **HIGH** | MEDIUM (ticket/media) | Network discovery + ticket authority |
| Rausgegangen | **VERY HIGH** | MEDIUM | Primary discovery aggregator |
| TicketKings | MEDIUM | **HIGH** (ticket/lineup) | Ticket/media authority |
| Odonien | MEDIUM | **HIGH** (official) | Selective official |
| Nachtresidenz | LOW | **HIGH** | Selective official |
| Stadtgarten | LOW | HIGH | Selective official |
| zakk | LOW | MEDIUM | Selective official |
| Resident Advisor | HIGH* | MEDIUM* | *Blocked — not viable |
| Raves of Germany | LOW | LOW | Reject |

---

## 22. Automation Suitability

| Source | Score | Notes |
|--------|-------|-------|
| ticket.io shops | **EXCELLENT** | SSR, stable IDs, existing parser |
| Rausgegangen | **GOOD** | Large pages; polite rate limits |
| TicketKings | **GOOD** | Existing provider |
| ticket.io portal | **LIMITED** | SPA event finder |
| Odonien API | **LIMITED** | API auth/schema TBD |
| Nachtresidenz/Stadtgarten/zakk | **EXCELLENT** | Connectors exist |
| Resident Advisor | **UNSUITABLE** | Cloudflare |
| Raves of Germany | **UNSUITABLE** | No SSR events |

---

## 23. Source Scores (weighted)

Weights: Coverage 25%, Electronic Relevance 20%, Net-New 15%, Technical 10%, Completeness 10%, Ticket 7.5%, Media 5%, Identity/Dedup 5%, Automation 2.5%

| Source | Cov | Rel | Net | Tech | Data | Ticket | Media | Dedup | Auto | **Score** |
|--------|-----|-----|-----|------|------|--------|-------|-------|------|-----------|
| **Rausgegangen** | 95 | 70 | 90 | 85 | 75 | 60 | 70 | 80 | 80 | **82.1** |
| **ticket.io network** | 85 | 80 | 75 | 90 | 85 | 95 | 85 | 85 | 90 | **84.6** |
| TicketKings network | 60 | 85 | 55 | 85 | 80 | 95 | 90 | 70 | 85 | **74.8** |
| Odonien official | 45 | 90 | 65 | 65 | 70 | 70 | 65 | 75 | 60 | **68.4** |
| Nachtresidenz | 35 | 95 | 50 | 90 | 75 | 60 | 65 | 80 | 95 | **66.2** |
| Stadtgarten | 30 | 50 | 40 | 90 | 80 | 85 | 80 | 75 | 95 | **58.6** |
| zakk | 25 | 60 | 35 | 90 | 75 | 55 | 60 | 70 | 95 | **55.4** |
| Eventim | 70 | 40 | 30 | 50 | 60 | 90 | 50 | 60 | 50 | **54.8** |
| Raves of Germany | 20 | 70* | 10 | 20 | 15 | 10 | 10 | 40 | 15 | **24.0** |
| Resident Advisor | 90* | 90* | 80* | 10 | 80* | 70* | 80* | 85* | 5 | **N/A** (blocked) |

\*Theoretical only — not automatable.

---

## 24. Source Tiers

### TIER 1 — BUILD NEXT (M9.3B)

| Source | Rationale |
|--------|-----------|
| **ticket.io Network Discovery** | Highest technical fit; existing provider; many shops; one connector |
| **Rausgegangen Discovery** | Highest raw coverage; strong NRW; outbound link graph |

### TIER 2 — BUILD LATER

| Source | Rationale |
|--------|-----------|
| TicketKings network crawl | Extend existing provider; medium net-new |
| Odonien official (+ API) | High relevance; selective authority |
| Nachtresidenz official | Connector exists; Düsseldorf win |
| Nibirii festival (ticket.io + official) | Identity stress + festival brand |
| Stadtgarten official | Calendar learning; medium electronic fit |
| zakk party official | Düsseldorf parties; connector exists |

### TIER 3 — SUPPLEMENTAL ONLY

| Source | Rationale |
|--------|-----------|
| Eventim | Ticket target when linked; not discovery |
| Resident Advisor | Blocked; manual/partner only |
| Essigfabrik | Venue via Affenkäfig ecosystem; weak own site |

### REJECT

| Source | Rationale |
|--------|-----------|
| Raves of Germany | SPA shell; no structured listing data |
| GoOut | Weak DE/NRW presence in probe |
| Dice | No Cologne coverage |
| Blind re-activation of removed low-value venues | M9.1 demonstrated low ROI |

---

## 25. Network Source Architecture (concept only)

```
SourceNetwork (ticket_io | rausgegangen)
    │
    ├── SourceNode (shop slug | city slug | organizer)
    │       ├── DiscoveryAdapter.discoverList()
    │       ├── DiscoveryAdapter.fetchDetail()
    │       └── emits DiscoveryEventCandidate (NOT canonical yet)
    │
    └── EvidenceLinker
            ├── resolve outbound official URL
            ├── resolve ticket provider URL → existing ticket_io/ticket_kings pipeline
            ├── identity.matchToCatalog()
            └── field-level evidence candidates (media/ticket/description/lineup)
```

**Fits existing M9.2.1 model:**

- `mediaCandidates[]`, future `descriptionCandidates[]`, `lineupCandidates[]`, `ticketCandidates[]`
- Discovery source ≠ authority; provenance records `discoveredAt`, `sourceType`, `identityConfidence`

**No implementation in M9.3A** — architecture recommendation only.

---

## 26. Recommended Integration Order (M9.3B preview)

1. **ticket.io NetworkDiscovery connector** — shop seeding from known hosts + portal electronic filter
2. **Rausgegangen Discovery connector** — NRW city slugs + electronic tag filters
3. **Evidence linker** — outbound URL → official/ticket evidence enrichment on discovered events
4. **Odonien official** — selective authority for Köln club graph
5. **Nachtresidenz official** — re-enable existing connector with M9.1B gate
6. **TicketKings index discovery** — broaden Affenkäfig-style coverage
7. Stadtgarten / zakk / Nibirii — after network foundations stable

---

## 27. M9.3B Recommendation

> **M9.3B should integrate the ticket.io Network Discovery connector first**, followed by **Rausgegangen Discovery**.

**Why ticket.io first:**

- Parser, provider, URL policy, media extraction **already production-proven** (Bootshaus, M9.2.1)
- Stable event IDs and SSR HTML
- Direct ticket + media authority without new provider work
- One connector covers dozens of organizer shops

**Why Rausgegangen second:**

- Highest net-new discovery volume in NRW
- Outbound link graph accelerates official/ticket evidence for discovered events
- City-slug model maps cleanly to one generic connector

**Explicitly NOT recommended for M9.3B:**

- Resident Advisor (blocked)
- Raves of Germany (no data)
- Re-activating Stadtgarten/zakk/Nachtresidenz **before** network discovery (lower coverage per connector effort)

---

## 28. Risks / Blockers

| Risk | Severity | Mitigation |
|------|----------|------------|
| Rausgegangen HTML size / rate limits | MEDIUM | Polite crawl; city+tag incremental sync |
| ticket.io portal SPA | MEDIUM | Prefer shop-level SSR; portal as seed only |
| Discovery ≠ authority confusion | HIGH | Enforce identity graph; never auto-publish without evidence |
| Overlap inflation metrics | MEDIUM | Report net-new only after identity dedup |
| RA/legal constraints | HIGH | Do not scrape; partner API only |
| Odonien API access | MEDIUM | Fall back to official SPA + ticket.io links |

---

## 29. Final Counters

```
candidateSourcesAudited = 15

ticketNetworksAudited = 4        (ticket.io shops, portal, TicketKings, Eventim)
aggregatorsAudited = 4           (Rausgegangen, GoOut, Dice, Eventim category)
electronicSpecificSourcesAudited = 2  (Raves of Germany, Resident Advisor)
organizerNetworksAudited = 3     (Odonien, Nibirii, + portal organizers)

realListingPagesChecked = 24
realEventPagesChecked = 18
realTicketPagesChecked = 12
realFlyersChecked = 14

totalFutureEventsObserved = 3200+   (Rausgegangen NRW aggregate + ticket shops)
totalRelevantElectronicEventsObserved = 550+  (filtered estimates)
estimatedUniqueRelevantEvents = 320+
estimatedNetNewRelevantEvents = 150-220   (after dedup vs 30-event baseline)

tier1Sources = 2
tier2Sources = 6
tier3Sources = 3
rejectedSources = 4

sourcesSuitableForUnattendedSync = 7
sourcesSuitableForSupplementalEvidenceOnly = 4

ticketIoOrganizerShopsObserved = 5+
ticketIoRelevantOrganizerShops = 4
ticketIoFutureRelevantEvents = 100+

stagingEventMutations = 0
productionMutations = 0
schedulerChanges = 0
```

---

## 30. Mandatory Tables

### SOURCE QUALIFICATION

| Source | Type | Future Events | Relevant Events | NRW Coverage | Net-New Est. | Discovery | Authority | Ticket | Media | Technical | Automation | Score | Tier |
|--------|------|---------------|-----------------|--------------|--------------|-----------|-----------|--------|-------|-----------|------------|-------|------|
| ticket.io network | Ticket network | 100+ | 70+ | MEDIUM | 40–70 | HIGH | MEDIUM | HIGH | HIGH | GREEN | EXCELLENT | 84.6 | **1** |
| Rausgegangen | Aggregator | 3000+ raw | 400–600 filt. | **HIGH** | 120–180 | VERY HIGH | MEDIUM | MEDIUM | HIGH | GREEN | GOOD | 82.1 | **1** |
| TicketKings | Ticket network | 50+ | 40+ | MEDIUM | 15–25 | MEDIUM | HIGH | HIGH | HIGH | GREEN | GOOD | 74.8 | 2 |
| Odonien | Organizer/venue | 50+ | 45+ | MEDIUM | 25–35 | MEDIUM | HIGH | MEDIUM | MEDIUM | YELLOW | LIMITED | 68.4 | 2 |
| Nachtresidenz | Official club | 12+ | 11+ | LOW | 10–12 | LOW | HIGH | MEDIUM | MEDIUM | GREEN | EXCELLENT | 66.2 | 2 |
| Stadtgarten | Official venue | 19+ | 7+ | LOW | 5–8 | LOW | HIGH | HIGH | HIGH | GREEN | EXCELLENT | 58.6 | 2 |
| zakk party | Official venue | 17+ | 10+ | LOW | 8–12 | LOW | MEDIUM | MEDIUM | MEDIUM | GREEN | EXCELLENT | 55.4 | 2 |
| Nibirii festival | Festival/ticket.io | 10+ | 10+ | MEDIUM | 5–10 | LOW | HIGH | HIGH | HIGH | GREEN | GOOD | 62.0 | 2 |
| Eventim | Ticket network | many | low filt. | MEDIUM | 10–20 | HIGH | LOW | HIGH | MEDIUM | YELLOW | LIMITED | 54.8 | 3 |
| Resident Advisor | Electronic | many* | high* | HIGH* | — | HIGH* | MEDIUM* | MEDIUM* | HIGH* | **RED** | UNSUITABLE | N/A | 3/REJECT |
| Raves of Germany | Electronic | unknown | unknown | unknown | <5 | LOW | LOW | LOW | LOW | **RED** | UNSUITABLE | 24.0 | REJECT |
| GoOut | Aggregator | — | — | NONE | 0 | LOW | LOW | LOW | LOW | RED | UNSUITABLE | — | REJECT |
| Dice | Aggregator | — | — | NONE | 0 | LOW | LOW | MEDIUM | LOW | RED | UNSUITABLE | — | REJECT |

### FIELD COVERAGE (summary — see §12 for full)

Already documented per source with HIGH/MEDIUM/LOW/NONE ratings.

### OVERLAP

| Source | Bootshaus Overlap | Affenkäfig Overlap | Other Overlap | Est. Unique | Est. Net-New |
|--------|-------------------|--------------------|--------------|-------------|--------------|
| ticket.io Bootshaus shop | 90% | 5% | — | LOW | ~2–5 |
| Rausgegangen NRW | 25% | 20% | Odonien, Garagen | HIGH | 120–180 |
| ticket.io network (all shops) | 15% | 10% | many | MEDIUM | 40–70 |
| TicketKings | 10% | 40% | — | MEDIUM | 15–25 |
| Nachtresidenz | 0% | 5% | RG partial | HIGH | 10–12 |
| Odonien | 20% | 15% | RG, ticket.io | MEDIUM | 25–35 |

---

## STOP — Do not begin M9.3B

This audit is complete. Review recommended integration order (§26–27) before implementing the first high-coverage network connector.
