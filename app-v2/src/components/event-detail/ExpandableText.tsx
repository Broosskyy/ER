import { useState } from 'react';
import { NativeSyntheticEvent, Pressable, StyleSheet, TextLayoutEventData, View, ViewStyle } from 'react-native';

import { TextButton } from '@/components/buttons/TextButton';
import { AppText } from '@/components/layout/AppText';
import { spacing } from '@/design/spacing';

const DEFAULT_COLLAPSED_LINES = 4;
const COLLAPSED_CHAR_THRESHOLD = 180;

export interface ExpandableTextProps {
  text: string;
  collapsedLines?: number;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  style?: ViewStyle;
  testID?: string;
}

/** Mockup 11 description with Mehr/Weniger anzeigen — UI-only. */
export function ExpandableText({
  text,
  collapsedLines = DEFAULT_COLLAPSED_LINES,
  expanded: controlledExpanded,
  onExpandedChange,
  style,
  testID,
}: ExpandableTextProps) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const expanded = controlledExpanded ?? internalExpanded;

  const handleToggle = () => {
    const next = !expanded;
    if (onExpandedChange) {
      onExpandedChange(next);
      return;
    }
    setInternalExpanded(next);
  };

  const handleTextLayout = (event: NativeSyntheticEvent<TextLayoutEventData>) => {
    if (expanded) {
      return;
    }
    setIsTruncated(event.nativeEvent.lines.length >= collapsedLines);
  };

  const canToggle = isTruncated || expanded || text.length > COLLAPSED_CHAR_THRESHOLD;

  return (
    <View style={[styles.container, style]} testID={testID}>
      <AppText
        role="bodyMuted"
        numberOfLines={expanded ? undefined : collapsedLines}
        onTextLayout={handleTextLayout}
      >
        {text}
      </AppText>
      {canToggle ? (
        <TextButton
          label={expanded ? 'Weniger anzeigen' : 'Mehr anzeigen'}
          variant="primary"
          onPress={handleToggle}
          accessibilityLabel={expanded ? 'Weniger Beschreibung anzeigen' : 'Mehr Beschreibung anzeigen'}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
});
