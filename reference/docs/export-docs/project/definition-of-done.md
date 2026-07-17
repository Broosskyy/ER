# Eternal Rave — Definition of Done (Sprint)

> Pre-Sprint · Juni 2026  
> A sprint is **not complete** until every item below is satisfied.

---

## Sprint Completion Checklist

| # | Criterion | Required |
|---|-----------|----------|
| 1 | **Build successful** — app compiles without errors (`expo` / native build as applicable) | ✔ |
| 2 | **TypeScript clean** — `npm run typecheck` passes with zero errors | ✔ |
| 3 | **ESLint successful** — lint passes (when configured; add in Sprint 2+ if missing) | ✔ |
| 4 | **Tests successful** — unit/integration tests pass (when test suite exists) | ✔ |
| 5 | **Documentation updated** — relevant Band docs, ADRs, rules and README aligned | ✔ |
| 6 | **Reports created** — all [Sprint Deliverables](../../README.md#sprint-deliverables) present | ✔ |
| 7 | **ZIP created** — `SPRINT_X_REPORT.zip` committed on `main` | ✔ |
| 8 | **No known blockers** — P0 issues documented in `OPEN_ISSUES.md` only if deferred with approval | ✔ |
| 9 | **Review completed** — code + doc review done; feedback addressed or tracked | ✔ |
| 10 | **Merge possible** — PR approved; no conflicts; CI green (when available) | ✔ |

---

## Deliverable Files (per sprint)

Each sprint must produce:

- `SPRINT_X_REPORT.md`
- `CHANGED_FILES.md`
- `OPEN_ISSUES.md`
- `NEXT_STEPS.md`
- `DECISIONS.md`
- `TEST_RESULTS.md`
- `METRICS.md`
- `KNOWN_LIMITATIONS.md`
- `SPRINT_X_REPORT.zip`

---

## Exceptions

| Situation | Rule |
|-----------|------|
| Doc-only sprint | Build/tests may be N/A; typecheck still runs if TS touched |
| ESLint not yet configured | Document in `TEST_RESULTS.md` as “skipped — pending setup” |
| No test suite yet | Document in `TEST_RESULTS.md`; Sprint 14 adds pyramid |
| Known P1/P2 open | Allowed in `OPEN_ISSUES.md`; must not block merge if sprint goal met |

---

## References

- [Development Workflow](../../README.md#development-workflow)
- [Branch Strategy](../../README.md#branch-strategy)
- [Versioning](./versioning.md)
- [PROJECT_RULES.md](../rules/PROJECT_RULES.md)

---

*Quality gate before every merge to `main`.*
