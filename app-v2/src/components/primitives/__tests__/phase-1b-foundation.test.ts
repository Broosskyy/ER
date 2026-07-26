import { describe, expect, it } from 'vitest';

import {
  resolveFilledButtonStyle,
  resolveIconButtonDimensions,
  resolveIconButtonStyle,
} from '@/components/buttons/button-styles';
import { resolveCardStyle } from '@/components/cards/card-styles';
import { resolveBannerStyle } from '@/components/feedback/banner-styles';
import { resolveSkeletonStyle } from '@/components/feedback/skeleton-styles';
import { resolveToastStyle, toastMetrics } from '@/components/feedback/toast-styles';
import { resolveTextInputStyle } from '@/components/inputs/text-input-styles';
import { resolveSurfaceStyle } from '@/components/layout/surface-styles';
import { resolveOverlayStyle } from '@/components/overlay/overlay-styles';
import { darkTheme } from '@/design/theme/dark';
import { lightTheme } from '@/design/theme/light';

describe('Text input styles', () => {
  it('uses accent border on focus', () => {
    const style = resolveTextInputStyle(lightTheme, {
      focused: true,
      disabled: false,
    });
    expect(style.borderColor).toBe(lightTheme.colors.accent);
    expect(style.visualState).toBe('focus');
  });

  it('uses destructive border on error', () => {
    const style = resolveTextInputStyle(darkTheme, {
      focused: false,
      disabled: false,
      error: true,
    });
    expect(style.borderColor).toBe(darkTheme.colors.destructive);
    expect(style.helperColor).toBe(darkTheme.colors.destructive);
  });

  it('reduces opacity when disabled', () => {
    const style = resolveTextInputStyle(lightTheme, {
      focused: false,
      disabled: true,
    });
    expect(style.visualState).toBe('disabled');
    expect(style.opacity).toBe(0.5);
  });

  it('keeps readable state for readonly', () => {
    const style = resolveTextInputStyle(lightTheme, {
      focused: false,
      disabled: false,
      readOnly: true,
    });
    expect(style.visualState).toBe('readonly');
    expect(style.opacity).toBe(1);
  });
});

describe('Filled button styles', () => {
  it('uses pressed primary background', () => {
    const style = resolveFilledButtonStyle(lightTheme, {
      variant: 'primary',
      pressed: true,
      hovered: false,
      disabled: false,
    });
    expect(style.backgroundColor).toBe(lightTheme.colorRoles.buttonPrimaryPressed);
  });

  it('uses destructive outline for destructive variant', () => {
    const style = resolveFilledButtonStyle(darkTheme, {
      variant: 'destructive',
      pressed: false,
      hovered: false,
      disabled: false,
    });
    expect(style.borderColor).toBe(darkTheme.colors.destructive);
    expect(style.labelColor).toBe(darkTheme.colors.destructive);
  });
});

describe('Icon button styles', () => {
  it('reduces opacity when disabled', () => {
    const style = resolveIconButtonStyle(lightTheme, {
      pressed: false,
      disabled: true,
    });
    expect(style.opacity).toBe(0.5);
  });

  it('resolves sm, md, and lg dimensions', () => {
    expect(resolveIconButtonDimensions('sm').iconSize).toBe(20);
    expect(resolveIconButtonDimensions('md').iconSize).toBe(24);
    expect(resolveIconButtonDimensions('lg').iconSize).toBe(28);
  });
});

describe('Feedback styles', () => {
  it('resolves skeleton colors from theme', () => {
    const style = resolveSkeletonStyle(lightTheme.colors);
    expect(style.backgroundColor).toBe(lightTheme.colors.skeletonBase);
    expect(style.highlightColor).toBe(lightTheme.colors.skeletonHighlight);
  });

  it('resolves toast warning variant', () => {
    const style = resolveToastStyle(darkTheme.colors, 'warning');
    expect(style.textColor).toBe(darkTheme.colors.warning);
    expect(style.backgroundColor).toBe(darkTheme.colors.warningMuted);
  });

  it('resolves banner success variant', () => {
    const style = resolveBannerStyle(lightTheme.colors, 'success');
    expect(style.borderColor).toBe(lightTheme.colors.success);
    expect(style.titleColor).toBe(lightTheme.colors.success);
  });

  it('uses default toast duration token', () => {
    expect(toastMetrics.defaultDurationMs).toBe(4000);
  });
});

describe('Layout and overlay styles', () => {
  it('resolves surface variants', () => {
    expect(resolveSurfaceStyle(lightTheme, 'subtle').backgroundColor).toBe(
      lightTheme.colors.surfaceSubtle,
    );
    expect(resolveSurfaceStyle(lightTheme, 'transparent').backgroundColor).toBe(
      lightTheme.colors.transparent,
    );
  });

  it('reduces card opacity when disabled', () => {
    const style = resolveCardStyle(darkTheme, {
      elevated: false,
      pressed: false,
      disabled: true,
    });
    expect(style.opacity).toBe(0.5);
  });

  it('uses overlay scrim from color roles', () => {
    const style = resolveOverlayStyle(lightTheme);
    expect(style.scrimColor).toBe(lightTheme.colorRoles.overlayScrim);
    expect(style.surfaceColor).toBe(lightTheme.colors.surface);
  });
});
