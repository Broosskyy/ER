import { describe, expect, it } from 'vitest';

import { isValidEmailAddress } from '@/features/auth/utils/email-validation';

describe('email validation', () => {
  it('accepts valid email addresses', () => {
    expect(isValidEmailAddress('user@example.com')).toBe(true);
    expect(isValidEmailAddress('  user@example.com  ')).toBe(true);
  });

  it('rejects invalid email addresses', () => {
    expect(isValidEmailAddress('')).toBe(false);
    expect(isValidEmailAddress('not-an-email')).toBe(false);
    expect(isValidEmailAddress('missing@domain')).toBe(false);
    expect(isValidEmailAddress('@domain.com')).toBe(false);
  });
});
