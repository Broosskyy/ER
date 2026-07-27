# Event Submission Model

## EventSubmission

```typescript
type SubmissionDisplayStatus =
  | 'draft'
  | 'pending'        // intern: review
  | 'in_review'
  | 'needs_changes'
  | 'resubmitted'
  | 'approved'
  | 'published'
  | 'rejected'
  | 'cancelled'
  | 'archived';

interface EventSubmission {
  id: string;
  eventId: string;
  draftId: string;
  organizerId: string;
  status: SubmissionDisplayStatus;
  submittedAt: string;
  updatedAt: string;
  eventSnapshot: AdminEventRecord;
  history: Array<{ status: SubmissionDisplayStatus; at: string }>;
}
```

## Status-Mapping

| Intern (`AdminEventRecord.status`) | Anzeige |
|-----------------------------------|---------|
| `draft` | `draft` |
| `review` | `pending` |

## Persistenz

Key: `app.eventSubmissions.v1`

## Service-Interface

- `submitEvent(draftId, userId)` — setzt Status `review`, erzeugt Submission
- `loadSubmission(id)` / `listSubmissions(userId)`
- Keine Remote-API in V1
