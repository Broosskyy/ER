import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { useTheme } from '@/design/theme';

import { shouldCollapseDescription, DEFAULT_COLLAPSED_LINE_COUNT } from './expandable-text-logic';

export { shouldCollapseDescription, DEFAULT_COLLAPSED_LINE_COUNT };

export interface ExpandableTextProps {
  text: string;
  collapsedLineCount?: number;
  expandLabel?: string;
  collapseLabel?: string;
  testID?: string;
}

export function ExpandableText({
  text,
  collapsedLineCount = DEFAULT_COLLAPSED_LINE_COUNT,
  expandLabel = 'Mehr anzeigen',
  collapseLabel = 'Weniger anzeigen',
  testID,
}: ExpandableTextProps) {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const collapsible = useMemo(() => shouldCollapseDescription(text, collapsedLineCount), [text, collapsedLineCount]);

  if (!collapsible) {
    return (
      <AppText role="body" testID={testID}>
        {text}
      </AppText>
    );
  }

  return (
    <View testID={testID}>
      <AppText role="body" numberOfLines={expanded ? undefined : collapsedLineCount}>
        {text}
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={expanded ? collapseLabel : expandLabel}
        onPress={() => setExpanded((value) => !value)}
        style={styles.toggle}
        testID={expanded ? `${testID}-collapse` : `${testID}-expand`}
      >
        <AppText role="caption" style={{ color: theme.colors.primary }}>
          {expanded ? collapseLabel : expandLabel}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
});
