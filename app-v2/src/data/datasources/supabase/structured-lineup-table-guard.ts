export function isMissingStructuredLineupTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const cause = 'cause' in error ? (error as { cause?: unknown }).cause : error;
  if (!cause || typeof cause !== 'object') {
    return false;
  }

  const code = 'code' in cause ? String((cause as { code?: string }).code) : '';
  const message = 'message' in cause ? String((cause as { message?: string }).message) : '';
  return (
    code === 'PGRST205' ||
    /event_lineup_entries/i.test(message) ||
    /event_lineup_entry_artists/i.test(message)
  );
}
