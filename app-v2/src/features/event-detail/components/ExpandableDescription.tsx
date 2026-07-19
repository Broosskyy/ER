import { useState } from 'react';
import { NativeSyntheticEvent, Pressable, StyleSheet, TextLayoutEventData, View } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { colors } from '@/design/colors';
import { spacing } from '@/design/spacing';
import { textRoles } from '@/design/typography';

const COLLAPSED_LINES = 4;
const COLLAPSED_CHAR_THRESHOLD = 180;

export interface ExpandableDescriptionProps {
  text: string;
  collapsedLines?: number;
}

export function ExpandableDescription({
  text,
  collapsedLines = COLLAPSED_LINES,
}: ExpandableDescriptionProps) {
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);

  const handleTextLayout = (event: NativeSyntheticEvent<TextLayoutEventData>) => {
    if (isDescriptionExpanded) {
      return;
    }

    const lineCount = event.nativeEvent.lines.length;
    setIsTruncated(lineCount >= collapsedLines);
  };

  const canToggle =
    isTruncated || isDescriptionExpanded || text.length > COLLAPSED_CHAR_THRESHOLD;

  return (
    <View style={styles.container}>
      <AppText
        style={styles.description}
        numberOfLines={isDescriptionExpanded ? undefined : collapsedLines}
        onTextLayout={handleTextLayout}
      >
        {text}
      </AppText>
      {canToggle ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isDescriptionExpanded ? 'Show less description' : 'Show more description'}
          onPress={() => setIsDescriptionExpanded((current) => !current)}
          hitSlop={12}
          style={({ pressed }) => [styles.toggleButton, pressed && styles.pressed]}
        >
          <AppText style={styles.toggle}>
            {isDescriptionExpanded ? 'Show less' : 'Show more'}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  description: {
    ...textRoles.body,
    color: colors.textSecondary,
  },
  toggleButton: {
    alignSelf: 'flex-start',
    zIndex: 2,
  },
  toggle: {
    ...textRoles.metadata,
    color: colors.primary,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
});
