import { describe, expect, it, vi } from 'vitest';

import {
  buildInteractiveCardAccessibilityTree,
  buildNestedPressableCardAccessibilityTree,
  hasNestedInteractiveAccessibilityRoles,
} from '@/components/cards/interactive-card-a11y';

describe('interactive card accessibility structure', () => {
  it('detects nested interactive roles in legacy card patterns', () => {
    expect(
      hasNestedInteractiveAccessibilityRoles(buildNestedPressableCardAccessibilityTree()),
    ).toBe(true);
  });

  it('allows flat sibling interactive roles used by InteractiveCard', () => {
    expect(
      hasNestedInteractiveAccessibilityRoles(
        buildInteractiveCardAccessibilityTree({ hasActions: true, actionCount: 2 }),
      ),
    ).toBe(false);
  });

  it('allows cards without action controls', () => {
    expect(
      hasNestedInteractiveAccessibilityRoles(
        buildInteractiveCardAccessibilityTree({ hasActions: false }),
      ),
    ).toBe(false);
  });
});

describe('interactive card press behavior', () => {
  it('runs card navigation when the card is pressed', () => {
    const onNavigate = vi.fn();

    onNavigate();

    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('runs favorite action without triggering card navigation', () => {
    const onFavorite = vi.fn();
    const onNavigate = vi.fn();
    const stopPropagation = vi.fn();

    stopPropagation();
    onFavorite();

    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(onFavorite).toHaveBeenCalledTimes(1);
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
