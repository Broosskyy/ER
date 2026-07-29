import { StyleSheet, View, ViewStyle } from 'react-native';

import { CardFoundation } from '@/components/cards/CardFoundation';
import { AppText } from '@/components/layout/AppText';
import { Section } from '@/components/layout/Section';
import { Stack } from '@/components/layout/Stack';
import { AppIcon } from '@/components/primitives/AppIcon';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

import type { TimetableSectionViewModel } from './view-models';

export interface TimetableSectionProps {
  timetable: TimetableSectionViewModel;
  title?: string;
  onArtistPress?: (artistId: string) => void;
  style?: ViewStyle;
  testID?: string;
}

/** Timetable foundation — stage, artist, start, end. */
export function TimetableSection({
  timetable,
  title = 'LINE-UP & TIMETABLE',
  style,
  testID,
}: TimetableSectionProps) {
  const { theme } = useTheme();
  const isEmpty = timetable.slots.length === 0;

  return (
    <Section title={title} style={style} testID={testID}>
      {isEmpty ? (
        <CardFoundation padding="md">
          <View style={styles.placeholder}>
            <AppIcon name="time-outline" size="lg" colorRole="muted" />
            <AppText role="bodyMuted" color={theme.colors.textSecondary} style={styles.placeholderText}>
              {timetable.placeholderMessage ?? 'Timetable noch nicht veröffentlicht'}
            </AppText>
          </View>
        </CardFoundation>
      ) : (
        <Stack gap="sm">
          {timetable.slots.map((slot) => (
            <CardFoundation key={slot.id} padding="md">
              <View style={styles.slotRow}>
                <View style={styles.slotMeta}>
                  <AppText role="caption" color={theme.colors.textSecondary}>
                    {slot.stageLabel}
                  </AppText>
                  <AppText role="bodyStrong" numberOfLines={1}>
                    {slot.artistName}
                  </AppText>
                </View>
                <View style={styles.timeColumn}>
                  <AppText role="bodyMuted">{slot.startLabel}</AppText>
                  {slot.endLabel ? (
                    <AppText role="caption" color={theme.colors.textSecondary}>
                      {slot.endLabel}
                    </AppText>
                  ) : null}
                </View>
              </View>
            </CardFoundation>
          ))}
        </Stack>
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  placeholderText: {
    textAlign: 'center',
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  slotMeta: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  timeColumn: {
    alignItems: 'flex-end',
    gap: spacing.xs,
    flexShrink: 0,
  },
});
