# Architecture — Evidence Contract

Every `FieldEvidenceCandidate` includes field name, raw/normalized values, source,
origin URL, evidence type, extraction strategy, timestamps, confidence, reliability,
identity match, review state, inclusion/rejection reasons.

Evidence types distinguish official pages, ticket platforms, list rows, checkout,
JSON-LD, HTML, flyer, manual admin, inferred, and legacy compatibility.

**Inferred candidates never silently outrank explicit public evidence.**

See `src/features/import/contracts/field-evidence-candidate.ts`.
