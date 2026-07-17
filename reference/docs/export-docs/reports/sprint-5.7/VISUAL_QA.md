# Visual QA — Sprint 5.7

## Scores

| Area | Score | Notes |
|------|-------|-------|
| Branding | **92%** | Purple #7C3AED, dark surfaces, logo consistent |
| Mockup Match | **89%** | Home + Events aligned; detail screen pending |
| Typography | **88%** | DE labels, genre caps, price formatting |
| Spacing | **86%** | px-4 screen padding, section unless safe area edge cases |
| Cards | **90%** | DateBadge, event variants, club cards |
| Buttons | **88%** | Primary/secondary chips unified |
| Navigation | **87%** | Bottom nav + deep links functional |
| Animations | **80%** | AnimatedPressable scale; no exaggerated motion |
| Safe Areas | **85%** | insets respected on tabs |
| Dark Mode | **95%** | Default dark throughout |
| Accessibility | **77%** | Labels on pressables; ANR impacts testing |

**Overall Visual QA: 87 / 100**

---

## Branding

- Primary purple on active chips, icons, prices (hero)
- Success green on event list prices (`Ab X,XX €`)
- White date badges on event thumbnails
- Unified `BorderRadius.md` / `BorderRadius.lg`

## Mockup Match highlights

- ✅ Home hero horizontal carousel
- ✅ Top Clubs vertical cards
- ✅ Events filter bar + "Karte anzeigen"
- ✅ DE category chips on Home + Events
- ⚠️ Event detail screen not fully captured at runtime
- ⚠️ Onboarding duplicate button visible on some slides

## Typography

- Section titles: bold xl/2xl
- Genre labels: 10px uppercase primary
- Search placeholder: German mockup text

## Spacing & grid

- Horizontal screen padding 16px
- Card gaps mb-3 consistent
- Bottom nav clearance: `BOTTOM_NAV_HEIGHT + insets`

## Cards & buttons

- `FeaturedEventCard` — mockup hero layout
- `EventCard` variants: `homeCompact`, `events`
- `FilterChip` — primary active / elevated inactive

## Navigation

- Tab bar: Home, Events, Map, Saved, Profile
- Deep links: `eternalrave://route` configured in AndroidManifest

## Animations

- Press scale 0.94–0.98 via `AnimatedPressable`
- No heavy screen transitions added

## Dark mode

- Background `#0B0B0F`, surfaces `#15151B` — consistent

## Accessibility

- `accessibilityLabel` on cards and nav
- ANR dialogs block automated a11y audit this sprint
