# Data Retention — Eternal Rave

**Sprint:** 12.7C  
**Status:** Internal policy — implement automation in future sprints  
**Last updated:** July 2026

---

## 1. Principles

- Store data only as long as necessary for the stated purpose
- Delete or anonymize when no longer needed
- Document retention periods per data category
- Automate deletion where feasible

---

## 2. Retention schedule

### 2.1 End-user data (device-local)

| Data | Purpose | Retention | Deletion method | Responsible | Automation |
|------|---------|-----------|-----------------|-------------|------------|
| Favorites (event IDs) | App functionality | Until user clears app data or uninstalls | OS app data clear | User | Manual (user action) |
| Notifications | Local notification center | Until deleted in-app or app data cleared | In-app delete / app clear | User | Manual |
| Event snapshots | Notification diffing | Until app data cleared | App clear | User | Manual |
| Sync state | Last sync timestamp | Until app data cleared | App clear | User | Manual |

**No server-side retention** — data never leaves device (except anon event fetch for content).

### 2.2 Admin accounts

| Data | Purpose | Retention | Deletion method | Responsible | Automation |
|------|---------|-----------|-----------------|-------------|------------|
| Admin user (Supabase Auth) | Authentication | While employment/contract active | Admin deletes via Supabase dashboard | Operations | Manual |
| Admin session tokens | Active session | Session lifetime + refresh window | Logout / token expiry | System | Automatic (Supabase) |
| Admin JWT refresh | Session continuity | Per Supabase Auth config (default 7 days refresh) | Expiry | System | Automatic |

**Account deletion grace period (future):** 14 days between request and hard delete (documented, not implemented).

### 2.3 Import and audit data

| Data | Purpose | Retention | Deletion method | Responsible | Automation |
|------|---------|-----------|-----------------|-------------|------------|
| `import_jobs` | Job tracking | 12 months after completion | Hard delete | Engineering | **Future:** scheduled job |
| `import_records` | Staging/review | 6 months after approval/rejection | Hard delete | Engineering | **Future:** scheduled job |
| `import_records.raw_payload` | Source data | 6 months (same as record) | Cascade with record | Engineering | **Future:** scheduled job |
| `import_logs` | Diagnostics | 90 days | Hard delete | Engineering | **Future:** scheduled job |
| `import_audit_logs` | Accountability | 24 months | Hard delete | Operations | **Future:** scheduled job |

### 2.4 Content data

| Data | Purpose | Retention | Deletion method | Responsible | Automation |
|------|---------|-----------|-----------------|-------------|------------|
| Published events | User display | Until archived or deleted by admin | Status → `deleted` / hard delete | Content team | Manual (admin) |
| Draft/review events | Editorial workflow | Until published or rejected | Admin action | Content team | Manual |
| Reference data (genres, cities) | App taxonomy | Indefinite while active | Deactivate (`active = false`) | Content team | Manual |
| Storage images (`events` bucket) | Event posters | Tied to event lifecycle | Delete object when event deleted | Engineering | **Future:** cascade |

### 2.5 Error and diagnostic data

| Data | Purpose | Retention | Deletion method | Responsible | Automation |
|------|---------|-----------|-----------------|-------------|------------|
| Import log messages | Debugging | 90 days | DB purge | Engineering | **Future:** scheduled |
| Client console logs | Development | Not persisted in production | N/A | — | N/A |
| Hosting access logs | Security | 30 days (provider default) | Provider rotation | Hosting | Provider-managed |
| Supabase logs | Platform diagnostics | Per Supabase plan | Provider policy | Supabase | Provider-managed |

---

## 3. Sessions

| Property | Value |
|----------|-------|
| Admin session persistence | Enabled (`persistSession: true`) |
| Auto-refresh | Enabled (`autoRefreshToken: true`) |
| Idle timeout | **Not implemented** — recommended: 30 min inactivity logout |
| Invalid session handling | Redirect to `/admin/login` |
| Expired session | Supabase refresh failure → unauthenticated state |

---

## 4. Backups

| Item | Policy |
|------|--------|
| **Supabase backups** | Daily automatic (plan-dependent); point-in-time recovery if enabled |
| **Backup retention** | Per Supabase plan (typically 7–30 days) |
| **Encryption** | At rest (Supabase managed) + in transit (TLS) |
| **Restoration** | Via Supabase dashboard |
| **Deletion from backups** | Backups expire per retention; no manual PII purge from backups currently |
| **Recommendation** | Enable PITR for production; document backup access controls |

---

## 5. Deletion concepts

### 5.1 Soft delete

Used only where business continuity requires recovery:

| Entity | Soft delete method | When |
|--------|-------------------|------|
| Events | `status = 'deleted'` or `'archived'` | Before permanent removal |
| Admin accounts | Deactivate (if supported) | Before hard delete during grace period |

### 5.2 Hard delete

Permanent removal of personal data:

| Entity | Method | Dependencies |
|--------|--------|--------------|
| Admin Auth user | Supabase Auth admin API | Revoke sessions first |
| Import records | `DELETE FROM import_records` | Check FK to import_jobs |
| Import audit logs | Scheduled purge | None (append-only) |
| Device favorites | App data clear | None |

### 5.3 Anonymization

For statistical retention without personal identifiers:

| Entity | Anonymization | When |
|--------|---------------|------|
| Import audit logs (future) | Replace `actor_id` with `deleted-user` | After admin account deletion |
| Import jobs `triggered_by` | Set to NULL | After admin account deletion |

**Current:** No anonymization jobs implemented.

### 5.4 Deletion order (admin account)

```
1. Revoke active sessions (signOut all devices)
2. Reassign or anonymize import_records.reviewed_by
3. Anonymize import_audit_logs.actor_id
4. Anonymize import_jobs.triggered_by
5. Delete Supabase Auth user
6. Log completion in operations audit
```

---

## 6. Responsibilities

| Role | Responsibility |
|------|----------------|
| **Controller (Eternal Rave)** | Define and approve retention periods |
| **Engineering** | Implement automated purge jobs |
| **Operations** | Execute manual deletions, admin account lifecycle |
| **Legal** | Review retention against legal obligations |
| **Supabase (processor)** | Platform backup and infrastructure retention |

---

## 7. Automation roadmap

| Task | Priority | Sprint |
|------|----------|--------|
| Scheduled purge of `import_logs` (>90 days) | Medium | Future |
| Scheduled purge of `import_records` (>6 months) | Medium | Future |
| Admin idle session timeout | High | 12.7D or security sprint |
| Admin account deletion workflow | Medium | When HR process defined |
| Cascade delete storage objects | Low | When uploads are active |

---

## Related documents

- [Privacy architecture](privacy.md)
- [Security & privacy review](security-privacy.md)
- [Legal documents](legal.md)
