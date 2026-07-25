import { describe, expect, it } from 'vitest';

import { resolveTextButtonStyle } from '@/components/buttons/text-button-styles';
import { resolveBadgeStyle } from '@/components/feedback/badge-styles';
import { resolveIconColor } from '@/components/primitives/icon-colors';
import { resolveIconSize } from '@/components/primitives/icon-sizes';
import { darkTheme } from '@/design/theme/dark';
import { lightTheme } from '@/design/theme/light';

describe('AppIcon tokens', () => {
  it('resolves icon sizes from component tokens', () => {
    expect(resolveIconSize('sm')).toBe(20);
    expect(resolveIconSize('md')).toBe(24);
    expect(resolveIconSize('lg')).toBe(28);
  });

  it('resolves icon colors for light and dark themes', () => {
    expect(resolveIconColor(lightTheme.colors, 'accent')).toBe(lightTheme.colors.accent);
    expect(resolveIconColor(darkTheme.colors, 'muted')).toBe(darkTheme.colors.textSecondary);
    expect(resolveIconColor(darkTheme.colors, 'destructive')).toBe(darkTheme.colors.destructive);
  });
});

describe('Badge styles', () => {
  it('resolves all status variants for light theme', () => {
    const statuses = ['default', 'success', 'warning', 'error', 'info'] as const;

    for (const status of statuses) {
      const style = resolveBadgeStyle(lightTheme.colors, status);
      expect(style.backgroundColor).toBeTruthy();
      expect(style.borderColor).toBeTruthy();
      expect(style.textColor).toBeTruthy();
    }
  });

  it('uses semantic success colors for success badge', () => {
    const style = resolveBadgeStyle(darkTheme.colors, 'success');
    expect(style.textColor).toBe(darkTheme.colors.success);
    expect(style.backgroundColor).toBe(darkTheme.colors.successMuted);
  });
});

describe('TextButton styles', () => {
  it('reduces opacity when disabled', () => {
    const style = resolveTextButtonStyle(lightTheme, {
      variant: 'primary',
      pressed: false,
      hovered: false,
      disabled: true,
    });
    expect(style.opacity).toBe(0.5);
  });

  it('uses accent pressed color on primary press', () => {
    const style = resolveTextButtonStyle(darkTheme, {
      variant: 'primary',
      pressed: true,
      hovered: false,
      disabled: false,
    });
    expect(style.labelColor).toBe(darkTheme.colors.accentPressed);
  });

  it('uses accent muted background for ghost hover', () => {
    const style = resolveTextButtonStyle(lightTheme, {
      variant: 'ghost',
      pressed: false,
      hovered: true,
      disabled: false,
    });
    expect(style.backgroundColor).toBe(lightTheme.colors.accentMuted);
  });

  it('uses secondary text colors', () => {
    const style = resolveTextButtonStyle(lightTheme, {
      variant: 'secondary',
      pressed: false,
      hovered: false,
      disabled: false,
    });
    expect(style.labelColor).toBe(lightTheme.colors.textSecondary);
  });
});

describe('Spacing primitives contract', () => {
  it('exposes spacing tokens used by Spacer and Stack', () => {
    expect(lightTheme.spacing.md).toBe(12);
    expect(lightTheme.spacingRoles.sectionTitleGap).toBe(lightTheme.spacing.sm);
    expect(darkTheme.spacing.xl).toBe(20);
  });
});
