# Sprint 3 — Decisions

## AD-S3-01: EventEntity as canonical domain model

Single `EventEntity` in `src/domain/event/` with mappers to/from `EventRow` and existing `Event` feed type preserved.

## AD-S3-02: Repository pattern without store rewrite

`EventRepository` introduced; `useEventStore` unchanged to avoid breaking changes. New hooks for Sprint 3 flows.

## AD-S3-03: Lifecycle transition enforcement

`LIFECYCLE_TRANSITIONS` map enforced in `eventLifecycleService`. Legacy free-form updates now routed through `transitionEventLifecycle`.

## AD-S3-04: Non-destructive DB migration

Migration 006 adds columns and tables only. Existing enum values preserved; `archived` and `deleted` added.

## AD-S3-05: Automation fields prepared, not active

`automation_status`, `duplicate_group`, `import_source`, `external_id`, `automation_notes` on events — no automation logic in Sprint 3.

## AD-S3-06: Audit + submission history tables

`event_review_audit` and `event_submission_history` for moderation trail and submission revisions — foundation only.
