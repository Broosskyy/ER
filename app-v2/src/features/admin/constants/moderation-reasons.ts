import type { ModerationReasonCode } from '@/features/admin/types/moderation-types';

export const MODERATION_REASON_LABELS: Record<ModerationReasonCode, string> = {
  incomplete_data: 'Unvollständige Daten',
  invalid_data: 'Ungültige Daten',
  wrong_region: 'Falsche Region',
  duplicate_suspected: 'Dublette vermutet',
  policy_violation: 'Richtlinienverstoß',
  quality_issue: 'Qualitätsproblem',
  other: 'Sonstiger Grund',
};

export const MODERATION_REASON_CODES = Object.keys(MODERATION_REASON_LABELS) as ModerationReasonCode[];
