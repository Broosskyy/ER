const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmailAddress(email: string): boolean {
  const trimmed = email.trim();
  if (!trimmed) {
    return false;
  }

  return EMAIL_PATTERN.test(trimmed);
}
