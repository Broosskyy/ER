import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';

import { IconButton } from '@/components/buttons/IconButton';
import { AppText } from '@/components/layout/AppText';
import { AppIcon } from '@/components/primitives/AppIcon';
import { layout } from '@/design/layout';
import { spacing, spacingRoles } from '@/design/spacing';
import { useTheme } from '@/design/theme';

const BOTTOM_TABS = [
  { id: 'home', label: 'Home', icon: 'home' as const, active: true },
  { id: 'events', label: 'Events', icon: 'calendar-outline' as const },
  { id: 'map', label: 'Map', icon: 'map-outline' as const },
  { id: 'saved', label: 'Saved', icon: 'heart-outline' as const },
  { id: 'profile', label: 'Profile', icon: 'person-outline' as const },
];

const DESKTOP_LINKS = ['Entdecken', 'Events', 'Karte', 'Gespeichert'];

export interface HomePreviewHeaderProps {
  locationLabel?: string;
  style?: ViewStyle;
}

/** Preview-only home header — not wired to navigation. */
export function HomePreviewHeader({ locationLabel = 'Köln, Deutschland', style }: HomePreviewHeaderProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.header, style]}>
      <View style={styles.headerTop}>
        <AppText role="label" color={theme.colors.accent}>
          ETERNAL RAVE
        </AppText>
        <IconButton
          icon="notifications-outline"
          size="sm"
          accessibilityLabel="Benachrichtigungen"
          onPress={() => undefined}
        />
      </View>
      <View style={styles.locationRow}>
        <AppIcon name="location-outline" size="sm" color={theme.colors.accent} />
        <AppText role="bodyStrong">{locationLabel}</AppText>
        <AppIcon name="chevron-down" size="sm" color={theme.colors.textSecondary} />
        <View style={styles.locationSpacer} />
        <IconButton icon="options-outline" size="sm" accessibilityLabel="Filter" onPress={() => undefined} />
      </View>
    </View>
  );
}

export function HomePreviewBottomNav({ style }: { style?: ViewStyle }) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.bottomNav,
        {
          borderTopColor: theme.colors.borderSubtle,
          backgroundColor: theme.colors.surface,
        },
        style,
      ]}
      accessibilityLabel="Bottom Navigation Vorschau"
    >
      {BOTTOM_TABS.map((tab) => (
        <View key={tab.id} style={styles.bottomTab}>
          <AppIcon
            name={tab.icon}
            size="sm"
            color={tab.active ? theme.colors.accent : theme.colors.textSecondary}
          />
          <AppText
            role="caption"
            color={tab.active ? theme.colors.accent : theme.colors.textSecondary}
          >
            {tab.label}
          </AppText>
        </View>
      ))}
    </View>
  );
}

export function HomePreviewDesktopNav({ style }: { style?: ViewStyle }) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.desktopNav,
        {
          borderBottomColor: theme.colors.borderSubtle,
          backgroundColor: theme.colors.surface,
        },
        style,
      ]}
    >
      <AppText role="titleSmall" color={theme.colors.accent}>
        ETERNAL RAVE
      </AppText>
      <View style={styles.desktopLinks}>
        {DESKTOP_LINKS.map((link, index) => (
          <AppText
            key={link}
            role="label"
            color={index === 0 ? theme.colors.accent : theme.colors.textSecondary}
          >
            {link}
          </AppText>
        ))}
      </View>
      <View style={styles.desktopActions}>
        <IconButton icon="search-outline" size="sm" accessibilityLabel="Suchen" onPress={() => undefined} />
        <IconButton icon="notifications-outline" size="sm" accessibilityLabel="Benachrichtigungen" onPress={() => undefined} />
        <IconButton icon="person-circle-outline" size="sm" accessibilityLabel="Profil" onPress={() => undefined} />
      </View>
    </View>
  );
}

export interface HomeSectionHeaderProps {
  title: string;
  actionLabel?: string;
  onActionPress?: () => void;
}

export function HomeSectionHeader({ title, actionLabel = 'Mehr anzeigen', onActionPress }: HomeSectionHeaderProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.sectionHeader}>
      <AppText role="titleMedium">{title}</AppText>
      <Pressable accessibilityRole="button" onPress={onActionPress}>
        <AppText role="label" color={theme.colors.accent}>
          {actionLabel}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  locationSpacer: { flex: 1 },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    minHeight: layout.bottomNavHeight,
    borderTopWidth: 1,
    paddingTop: spacingRoles.bottomNavPaddingTop,
    paddingHorizontal: spacingRoles.screenHorizontal,
  },
  bottomTab: {
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: layout.minTouchTarget,
  },
  desktopNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  desktopLinks: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.lg,
  },
  desktopActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
});
