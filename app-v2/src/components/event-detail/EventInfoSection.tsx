import { StyleSheet, View, ViewStyle } from 'react-native';

import { EventMetaRow } from '@/components/discovery/EventMetaRow';
import { Divider } from '@/components/primitives/Divider';
import { Section } from '@/components/layout/Section';
import { spacing } from '@/design/spacing';

import { ExpandableText } from './ExpandableText';
import type { EventInfoViewModel } from './view-models';

export interface EventInfoSectionProps {
  info: EventInfoViewModel;
  title?: string;
  onItemPress?: (id: string) => void;
  style?: ViewStyle;
  testID?: string;
}

/** Mockup 11 metadata block with optional expandable description. */
export function EventInfoSection({
  info,
  title = 'Infos',
  onItemPress,
  style,
  testID,
}: EventInfoSectionProps) {
  return (
    <Section title={title} style={style} testID={testID}>
      {info.description ? <ExpandableText text={info.description} /> : null}
      <View style={styles.rows}>
        {info.items.map((item, index) => (
          <View key={item.id} style={styles.rowGroup}>
            <EventMetaRow
              icon={item.icon}
              label={item.label}
              value={item.value}
              secondaryValue={item.secondaryValue}
              onPress={item.pressable && onItemPress ? () => onItemPress(item.id) : undefined}
            />
            {index < info.items.length - 1 ? <Divider /> : null}
          </View>
        ))}
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  rows: {
    gap: spacing.sm,
  },
  rowGroup: {
    gap: spacing.sm,
  },
});
