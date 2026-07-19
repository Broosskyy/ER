import type { RejectReason } from '@/features/import/models/statuses';

export const REJECT_REASON_LABELS: Record<RejectReason, string> = {
  not_relevant: 'Not a relevant event',
  incomplete_data: 'Incomplete data',
  invalid_data: 'Invalid data',
  outdated_event: 'Outdated event',
  wrong_region: 'Wrong region',
  spam: 'Spam',
  source_error: 'Source error',
  other: 'Other reason',
};
