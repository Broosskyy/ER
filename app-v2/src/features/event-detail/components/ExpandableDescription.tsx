import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { colors } from '@/design/colors';
import { spacing } from '@/design/spacing';
import { textRoles } from '@/design/typography';

const COLLAPSED_CHAR_THRESHOLD = 180;

export interface ExpandableDescriptionProps {
  text: string;
  collapsedLines?: number;
}

export function ExpandableDescription({
  text,
  collapsedLines = 4,
}: ExpandableDescriptionProps) {
  const [expanded, setExpanded] = useState(false);
  const canExpand = text.length > COLLAPSED_CHAR_THRESHOLD;

  return (
    <>
      <AppText style={styles.description} numberOfLines={expanded ? undefined : collapsedLines}>
        {text}
      </AppText>
      {canExpand ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setExpanded((current) => !current)}
          hitSlop={8}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <AppText style={styles.toggle}>{expanded ? 'Show less' : 'Show more'}</AppText>
        </Pressable>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  description: {
    ...textRoles.body,
    color: colors.textSecondary,
  },
  toggle: {
    ...textRoles.metadata,
    color: colors.primary,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  pressed: {
    opacity: 0.85,
  },
});
