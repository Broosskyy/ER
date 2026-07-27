import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { Phase1APrimitivesPreview } from '@/components/preview/Phase1APrimitivesPreview';
import { Phase1BFoundationPreview } from '@/components/preview/Phase1BFoundationPreview';
import { Phase2AEventDiscoveryPreview } from '@/components/preview/Phase2AEventDiscoveryPreview';
import { Phase2AExploreGridPreview } from '@/components/preview/Phase2AExploreGridPreview';
import { Phase2BTicketProfilePreview } from '@/components/preview/Phase2BTicketProfilePreview';
import { Phase2DMapLocationPreview } from '@/components/preview/Phase2DMapLocationPreview';
import { Phase2ESearchFilterPreview } from '@/components/preview/Phase2ESearchFilterPreview';
import { Phase2FEventDetailSavedPreview } from '@/components/preview/Phase2FEventDetailSavedPreview';
import { Phase2GAuthOnboardingPreview } from '@/components/preview/Phase2GAuthOnboardingPreview';
import { Phase2HOrganizerAdminPreview } from '@/components/preview/Phase2HOrganizerAdminPreview';
import { AppScreen } from '@/components/layout/AppScreen';
import { AppText } from '@/components/layout/AppText';
import { SafeAreaContainer } from '@/components/layout/SafeAreaContainer';
import type { AppTextRole, ThemeModePreference } from '@/design/theme/types';
import {
  APP_TEXT_ROLES,
  THEME_COLOR_KEYS,
  useTheme,
} from '@/design/theme/index';
import { spacing, spacingRoles } from '@/design/spacing';

function ColorSwatch({ label, color }: { label: string; color: string }) {
  return (
    <View style={styles.swatchRow}>
      <View style={[styles.swatch, { backgroundColor: color, borderColor: color }]} />
      <View style={styles.swatchMeta}>
        <AppText role="label">{label}</AppText>
        <AppText role="caption">{color}</AppText>
      </View>
    </View>
  );
}

function ModeButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.modeButton,
        active
          ? {
              borderColor: theme.colors.accent,
              backgroundColor: theme.colors.accentMuted,
            }
          : { borderColor: theme.colors.borderSubtle },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <AppText role="label" color={active ? theme.colors.accent : undefined}>
        {label}
      </AppText>
    </Pressable>
  );
}

function PreviewContents() {
  const { theme } = useTheme();
  const sections = [
    'Phase 0 – Theme',
    'Phase 1A – Core Primitives',
    'Phase 1B – Foundations',
    'Phase 2A – Discovery',
    'Phase 2B – Ticket, Profile & Organizer',
    'Phase 2D – Map & Location',
    'Phase 2E – Search & Filter',
    'Phase 2F – Event Detail & Saved',
    'Phase 2G – Onboarding, Auth & Permissions',
    'Phase 2H – Organizer & Admin',
  ];

  return (
    <View
      accessibilityLabel="Vorschau-Inhaltsverzeichnis"
      style={[
        styles.contents,
        {
          backgroundColor: theme.colors.surfaceSubtle,
          borderColor: theme.colors.borderSubtle,
          borderRadius: theme.radiusRoles.card,
        },
      ]}
    >
      <AppText role="label">Inhalt</AppText>
      {sections.map((section) => (
        <AppText key={section} role="caption" color={theme.colors.textSecondary}>
          {section}
        </AppText>
      ))}
    </View>
  );
}

export default function DesignPreviewScreen() {
  const { theme, mode, resolvedMode, setMode } = useTheme();
  const { colors } = theme;

  const setThemeMode = (nextMode: ThemeModePreference) => () => {
    setMode(nextMode);
  };

  return (
    <AppScreen>
      <SafeAreaContainer>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <AppText role="titleLarge">Theme Preview</AppText>
          <AppText role="bodyMuted">
            Internal acceptance page — Sprint 2A Phase 0. Resolved: {resolvedMode} (preference:{' '}
            {mode})
          </AppText>
          <PreviewContents />

          <View style={styles.modeRow}>
            <ModeButton label="Light" active={mode === 'light'} onPress={setThemeMode('light')} />
            <ModeButton label="Dark" active={mode === 'dark'} onPress={setThemeMode('dark')} />
            <ModeButton
              label="System"
              active={mode === 'system'}
              onPress={setThemeMode('system')}
            />
          </View>

          <View style={styles.section}>
            <AppText role="titleMedium">Surfaces</AppText>
            <View
              style={[
                styles.surfaceBlock,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.borderSubtle,
                },
              ]}
            >
              <AppText role="body">Background</AppText>
            </View>
            <View
              style={[
                styles.surfaceBlock,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.borderSubtle,
                },
              ]}
            >
              <AppText role="body">Surface</AppText>
            </View>
            <View
              style={[
                styles.surfaceBlock,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.borderSubtle,
                },
              ]}
            >
              <AppText role="body">Surface Elevated</AppText>
            </View>
            <View
              style={[
                styles.surfaceBlock,
                {
                  backgroundColor: colors.surfaceSubtle,
                  borderColor: colors.borderSubtle,
                },
              ]}
            >
              <AppText role="body">Surface Subtle</AppText>
            </View>
          </View>

          <View style={styles.section}>
            <AppText role="titleMedium">Semantic Colors</AppText>
            {(
              [
                ['Accent', colors.accent],
                ['Accent Pressed', colors.accentPressed],
                ['Accent Muted', colors.accentMuted],
                ['Success', colors.success],
                ['Success Muted', colors.successMuted],
                ['Warning', colors.warning],
                ['Warning Muted', colors.warningMuted],
                ['Destructive', colors.destructive],
                ['Destructive Muted', colors.destructiveMuted],
                ['Border Subtle', colors.borderSubtle],
                ['Border Strong', colors.borderStrong],
                ['Overlay', colors.overlay],
                ['Skeleton Base', colors.skeletonBase],
                ['Skeleton Highlight', colors.skeletonHighlight],
              ] as const
            ).map(([label, color]) => (
              <ColorSwatch key={label} label={label} color={color} />
            ))}
          </View>

          <View style={styles.section}>
            <AppText role="titleMedium">Typography Roles</AppText>
            {APP_TEXT_ROLES.map((role: AppTextRole) => (
              <View key={role} style={styles.typeRow}>
                <AppText role="caption" style={styles.typeLabel}>
                  {role}
                </AppText>
                <AppText role={role}>Eternal Rave — {role}</AppText>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <AppText role="titleMedium">Text Hierarchy</AppText>
            <AppText role="body">Primary body text for readable content.</AppText>
            <AppText role="bodyMuted">Muted body text for secondary information.</AppText>
            <AppText role="caption">Caption text for timestamps and metadata.</AppText>
          </View>

          <View style={styles.section}>
            <AppText role="titleMedium">Actions</AppText>
            <View style={styles.actionRow}>
              <PrimaryButton label="Primary" onPress={() => undefined} />
              <SecondaryButton label="Secondary" onPress={() => undefined} />
            </View>
          </View>

          <View style={styles.section}>
            <AppText role="titleMedium">Contract Keys</AppText>
            <AppText role="caption">
              {THEME_COLOR_KEYS.length} color keys · {APP_TEXT_ROLES.length} text roles
            </AppText>
          </View>

          <Phase1APrimitivesPreview />
          <Phase1BFoundationPreview />
          <Phase2AEventDiscoveryPreview />
          <Phase2AExploreGridPreview />
          <Phase2BTicketProfilePreview />
          <Phase2DMapLocationPreview />
          <Phase2ESearchFilterPreview />
          <Phase2FEventDetailSavedPreview />
          <Phase2GAuthOnboardingPreview />
          <Phase2HOrganizerAdminPreview />
        </ScrollView>
      </SafeAreaContainer>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl * 2,
    gap: spacingRoles.sectionGap,
  },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  modeButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  contents: {
    gap: spacing.xs,
    padding: spacing.lg,
    borderWidth: 1,
  },
  section: {
    gap: spacing.md,
  },
  surfaceBlock: {
    borderRadius: 12,
    padding: spacing.lg,
    borderWidth: 1,
  },
  swatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
  },
  swatchMeta: {
    flex: 1,
    gap: spacing.xs,
  },
  typeRow: {
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  typeLabel: {
    textTransform: 'lowercase',
  },
  actionRow: {
    gap: spacing.md,
  },
});
