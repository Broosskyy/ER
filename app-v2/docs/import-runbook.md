# Import Runbook

Operational guide for Eternal Rave import administrators.

## Add a Source

1. Go to **Admin → Imports → Sources → New**
2. Set name, adapter type, and source URL
3. Configure adapter-specific field mapping if needed
4. Set trust score and leave inactive until tested
5. Save

## Test a Source

1. Open source detail
2. Click **Test Source**
3. Review: record count, warnings, sample records
4. Fix configuration if errors appear
5. Re-test until successful or acceptable warnings

## Start an Import

1. Activate the source
2. Click **Import** on sources list (or use source detail after save)
3. Wait for job completion
4. Open job detail to review metrics and logs

## Analyze Errors

1. Open **Import Jobs** and filter by errors
2. Open job detail — check error summary and logs
3. Filter logs by `error` level
4. Common issues:
   - Invalid URL or SSRF block
   - Parse failures (malformed feed)
   - Validation errors (missing title/date/location)

## Review Records

1. Open **Review Queue**
2. Filter by source, status, or duplicate score
3. Open record detail
4. Edit normalized fields if needed
5. Resolve duplicate suggestions
6. Approve (creates draft event) or reject with reason

## Handle Failed Jobs

1. Check job error summary
2. Review adapter logs
3. Fix source configuration
4. Deactivate source if external feed is broken
5. Re-run manual import after fix

## Deactivate a Source

1. Open source in Sources list
2. Click **Deactivate**
3. Running imports are not cancelled automatically — wait for completion
4. No new imports can start while inactive

## Safe Rollback

Sprint 12D does not include automatic rollback. Manual steps:

1. Deactivate the source
2. Reject or mark duplicate any incorrect import records
3. Delete draft events in **Admin → Events** if wrongly approved
4. Review audit log for affected records

Do not delete import records without documenting the reason in audit/reject notes.

## Verification Checklist

After import + review:

- [ ] Import record status is `imported` or `duplicate` or `rejected`
- [ ] Approved records have `resulting_event_id`
- [ ] Created events are `draft`, not `published`
- [ ] Audit log entries exist for all actions
