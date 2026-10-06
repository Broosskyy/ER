import { StyleSheet, View, ViewStyle } from 'react-native';

import { CitySelector } from '@/components/map/MapControls';
import { AppText } from '@/components/layout/AppText';
import { Section } from '@/components/layout/Section';
import { Stack } from '@/components/layout/Stack';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

export interface CityOnboardingSelectorProps {
  cities: Array<{ id: string; cityLabel: string; selected?: boolean }>;
  onSelect?: (id: string) => void;
  style?: ViewStyle;
  testID?: string;
}

/**
 * Onboarding city selection — reuses map `CitySelector`.
 * Mockup 04 implies city choice without dedicated picker UI.
 */
export function CityOnboardingSelector({
  cities,
  onSelect,
  style,
  testID,
}: CityOnboardingSelectorProps) {
  const { theme } = useTheme();

  return (
    <Section title="Deine Stadt" style={style} testID={testID}>
      <AppText role="bodyMuted" color={theme.colors.textSecondary}>
        Wähle deine Stadt für Events in deiner Nähe.
      </AppText>
      <Stack gap="sm" style={styles.list}>
        {cities.map((city) => (
          <CitySelector
            key={city.id}
            cityLabel={city.cityLabel}
            selected={city.selected}
            onPress={() => onSelect?.(city.id)}
          />
        ))}
      </Stack>
    </Section>
  );
}

const styles = StyleSheet.create({
  list: {
    marginTop: spacing.sm,
  },
});
