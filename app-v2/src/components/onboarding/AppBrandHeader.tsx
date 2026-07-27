import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { AppIcon } from '@/components/primitives/AppIcon';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

import type { AppBrandVariant } from './view-models';

export interface AppBrandHeaderProps {
  title?: string;
  subtitle?: string;
  variant?: AppBrandVariant;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Mockups 01–08 brand header for splash, onboarding, and auth. */
export function AppBrandHeader({
  title = 'ETERNΛL RΛVE',
  subtitle,
  variant = 'large',
  style,
  testID,
}: AppBrandHeaderProps) {
  const { theme } = useTheme();
  const compact = variant === 'compact';

  return (
    <View style={[styles.root, compact && styles.compact, style]} testID={testID}>
      <View
        style={[
          styles.logo,
          {
            borderColor: theme.colors.accent,
            backgroundColor: theme.colors.accentMuted,
            borderRadius: theme.radiusRoles.card,
          },
        ]}
      >
        <AppIcon name="diamond-outline" size={compact ? 'md' : 'lg'} color={theme.colors.accent} />
      </View>
      <AppText role={compact ? 'titleSmall' : 'titleMedium'} style={styles.brand}>
        {title}
      </AppText>
      {subtitle ? (
        <AppText role="bodyMuted" color={theme.colors.textSecondary} style={styles.subtitle}>
          {subtitle}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    gap: spacing.md,
  },
  compact: {
    gap: spacing.sm,
  },
  logo: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  brand: {
    letterSpacing: 4,
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
  },
});
