/** Accessibility roles that map to interactive HTML elements on React Native Web. */
export const INTERACTIVE_ACCESSIBILITY_ROLES = new Set([
  'button',
  'link',
  'checkbox',
  'radio',
  'menuitem',
  'tab',
  'switch',
]);

export interface AccessibilityTreeNode {
  role?: string;
  children?: AccessibilityTreeNode[];
}

/** Returns true when an interactive role is nested inside another interactive role. */
export function hasNestedInteractiveAccessibilityRoles(
  node: AccessibilityTreeNode,
  ancestorIsInteractive = false,
): boolean {
  const isInteractive = node.role ? INTERACTIVE_ACCESSIBILITY_ROLES.has(node.role) : false;

  if (isInteractive && ancestorIsInteractive) {
    return true;
  }

  return (node.children ?? []).some((child) =>
    hasNestedInteractiveAccessibilityRoles(child, ancestorIsInteractive || isInteractive),
  );
}

/** Flat sibling structure used by `InteractiveCard` (safe on web). */
export function buildInteractiveCardAccessibilityTree(options: {
  hasActions: boolean;
  actionCount?: number;
}): AccessibilityTreeNode {
  const actionCount = options.actionCount ?? 1;

  return {
    children: [
      { role: 'button' },
      ...(options.hasActions
        ? Array.from({ length: actionCount }, () => ({ role: 'button' as const }))
        : []),
    ],
  };
}

/** Legacy nested pressable pattern that causes invalid HTML on web. */
export function buildNestedPressableCardAccessibilityTree(
  nestedActionCount = 1,
): AccessibilityTreeNode {
  return {
    role: 'button',
    children: Array.from({ length: nestedActionCount }, () => ({ role: 'button' as const })),
  };
}
