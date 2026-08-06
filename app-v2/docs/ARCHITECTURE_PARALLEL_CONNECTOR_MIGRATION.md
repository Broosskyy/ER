# Architecture — Parallel Connector Migration

1. Legacy path remains active in production
2. New unified-contract pilots run staging-only
3. Compare legacy vs pilot vs Phase 4.8.0 ground truth
4. Per-source shadow validation before scheduling switch
5. Rollback to legacy connector version retained

No production Event writes, no cache invalidation, no global merge changes in Phase 4.8.1.
