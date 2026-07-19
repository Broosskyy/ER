export interface NotificationMetadata {
  imageUrl?: string;
  changeVersion?: string;
  field?: string;
  previousValue?: string;
  currentValue?: string;
}

export function isNotificationMetadata(value: unknown): value is NotificationMetadata {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    (record.imageUrl === undefined || typeof record.imageUrl === 'string') &&
    (record.changeVersion === undefined || typeof record.changeVersion === 'string') &&
    (record.field === undefined || typeof record.field === 'string') &&
    (record.previousValue === undefined || typeof record.previousValue === 'string') &&
    (record.currentValue === undefined || typeof record.currentValue === 'string')
  );
}
