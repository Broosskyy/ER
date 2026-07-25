import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppScreen, AppText, SafeAreaContainer } from '@/components';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { useTheme } from '@/design/theme';
import type { ThemeColors, ThemeMode } from '@/design/theme/types';
import { TEXT_ROLE_KEYS } from '@/design/theme/types';
import { spacing, spacingRoles } from '@/design/spacing';

const MODE_OPTIONS: ThemeMode[] = ['light', 'dark', 'system'];

const COLOR_SWATCHES = [
  { key: 'background', label: 'Background' },
  { key: 'surface', label: 'Surface' },
  { key: 'surfaceElevated', label: 'Surface Elevated' },
  { key: 'surfaceSubtle', label: 'Surface Subtle' },
  { key: 'borderSubtle', label: 'Border Subtle' },
  { key: 'borderStrong', label: 'Border Strong' },
  { key: 'accent', label: 'Accent' },
  { key: 'accentPressed', label: 'Accent Pressed' },
  { key: 'accentMuted', label: 'Accent Muted' },
  { key: 'success', label: 'Success' },
  { key: 'successMuted', label: 'Success Muted' },
  { key: 'warning', label: 'Warning' },
  { key: 'warningMuted', label: 'Warning Muted' },
  { key: 'destructive', label: 'Destructive' },
  { key: 'destructiveMuted', label: 'Destructive Muted' },
  { key: 'skeletonBase', label: 'Skeleton Base' },
  { key: 'skeletonHighlight', label: 'Skeleton Highlight' },
] as const;

export default function DesignPreviewScreen() {
  const { theme, mode, resolvedMode, setMode } = useTheme();

  return (
    <AppScreen>
      <SafeAreaContainer edges={['top', 'bottom']} style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <AppText role="titleLarge">Theme Preview</AppText>
          <AppText role="bodyMuted">
            Internal acceptance screen for Sprint 2A Phase 0. Mode: {mode} · Resolved:{' '}
            {resolvedMode}
          </AppText>

          <View style={styles.modeRow}>
            {MODE_OPTIONS.map((option) => (
              <Pressable
                key={option}
                accessibilityRole="button"
                onPress={() => setMode(option)}
                style={[
                  styles.modeChip,
                  {
                    backgroundColor:
                      mode === option ? theme.colors.accent : theme.colors.surface,
                    borderColor: theme.colors.borderSubtle,
                  },
                ]}
              >
                <AppText
                  role="label"
                  style={{
                    color: mode === option ? theme.colors.textOnAccent : theme.colors.textSecondary,
                  }}
                >
                  {option}
                </AppText>
              </Pressable>
            ))}
          </View>

          <View style={styles.section}>
            <AppText role="titleMedium">Color Roles</AppText>
            <View style={styles.swatchGrid}>
              {COLOR_SWATCHES.map((swatch) => {
                const color = theme.colors[swatch.key as keyof ThemeColors];
                return (
                  <View
                    key={swatch.key}
                    style={[
                      styles.swatch,
                      {
                        backgroundColor: color,
                        borderColor: theme.colors.borderSubtle,
                      },
                    ]}
                  >
                    <AppText role="caption" style={{ color: theme.colors.textPrimary }}>
                      {swatch.label}
                    </AppText>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <AppText role="titleMedium">Typography Roles</AppText>
            {TEXT_ROLE_KEYS.map((role) => (
              <View key={role} style={styles.typeRow}>
                <AppText role="caption" style={styles.typeLabel}>
                  {role}
                </AppText>
                <AppText role={role}>Eternal Rave — Discover. Connect. Rave.</AppText>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <AppText role="titleMedium">Actions</AppText>
            <PrimaryButton label="Primary Action" onPress={() => undefined} />
            <SecondaryButton label="Secondary Action" onPress={() => undefined} />
          </View>

          <View
            style={[
              styles.overlayPreview,
              { backgroundColor: theme.colors.overlay, borderColor: theme.colors.borderSubtle },
            ]}
          >
            <AppText role="bodyStrong" style={{ color: theme.colors.textOnAccent }}>
              Overlay preview
            </AppText>
          </View>
        </ScrollView>
      </SafeAreaContainer>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingVertical: spacing.lg,
    gap: spacing.lg,
  },
  modeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  modeChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  section: {
    gap: spacing.md,
  },
  swatchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  swatch: {
    width: '47%',
    minHeight: 72,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.sm,
    justifyContent: 'flex-end',
  },
  typeRow: {
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  typeLabel: {
    textTransform: 'lowercase',
  },
  overlayPreview: {
    minHeight: 96,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
});
