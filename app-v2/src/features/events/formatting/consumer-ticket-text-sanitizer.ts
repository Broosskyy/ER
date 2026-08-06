const CONSUMER_DIAGNOSTIC_NOTE_PATTERN =
  /^(surface:|extraction|diagnostic|review_required|confidence:)/i;

export function isConsumerDiagnosticText(value: string | undefined): boolean {
  if (!value?.trim()) {
    return false;
  }
  return CONSUMER_DIAGNOSTIC_NOTE_PATTERN.test(value.trim());
}
