export function formatRelativeNotificationTime(
  createdAt: string,
  referenceDate: Date = new Date(),
): string {
  const createdDate = new Date(createdAt);

  if (Number.isNaN(createdDate.getTime())) {
    return '';
  }

  const diffMs = referenceDate.getTime() - createdDate.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);

  if (diffMinutes < 1) {
    return 'Gerade eben';
  }

  if (diffMinutes < 60) {
    return `vor ${diffMinutes} Min.`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24 && referenceDate.getDate() === createdDate.getDate()) {
    return `vor ${diffHours} Std.`;
  }

  const yesterday = new Date(referenceDate);
  yesterday.setDate(referenceDate.getDate() - 1);

  if (
    createdDate.getDate() === yesterday.getDate() &&
    createdDate.getMonth() === yesterday.getMonth() &&
    createdDate.getFullYear() === yesterday.getFullYear()
  ) {
    return 'Gestern';
  }

  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(createdDate)
    .replace('.', '');
}
