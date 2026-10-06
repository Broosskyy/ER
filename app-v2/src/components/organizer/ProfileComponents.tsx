import type { ReactNode } from 'react';
import { Image, StyleSheet, View, ViewStyle, type ImageSourcePropType } from 'react-native';

import { GhostButton } from '@/components/buttons/GhostButton';
import { IconButton } from '@/components/buttons/IconButton';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { CardFoundation } from '@/components/cards/CardFoundation';
import { AppText } from '@/components/layout/AppText';
import { Stack } from '@/components/layout/Stack';
import { AppIcon } from '@/components/primitives/AppIcon';
import { VerificationBadge } from '@/components/profiles/VerificationBadge';
import type { VerificationStatus } from '@/components/profiles/view-models';
import { componentSize } from '@/design/layout';
import { borderWidth } from '@/design/radii';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

import type { ProfileCompletionViewModel, SocialLinkViewModel, SocialPlatform } from './view-models';

export interface OrganizerProfileEditorHeaderProps {
  name: string;
  verificationStatus: VerificationStatus;
  completionPercent: number;
  logo?: ImageSourcePropType;
  onPreviewPress?: () => void;
  previewLabel?: string;
  style?: ViewStyle;
  testID?: string;
}

/** Mockup 38 profile editor header. */
export function OrganizerProfileEditorHeader({
  name,
  verificationStatus,
  completionPercent,
  logo,
  onPreviewPress,
  previewLabel = 'Vorschau',
  style,
  testID,
}: OrganizerProfileEditorHeaderProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.editorHeader, style]} testID={testID}>
      <View style={styles.editorRow}>
        {logo ? (
          <Image source={logo} style={[styles.logo, { borderColor: theme.colors.accent }]} />
        ) : (
          <View style={[styles.logo, styles.logoFallback, { borderColor: theme.colors.accent, backgroundColor: theme.colors.surfaceSubtle }]}>
            <AppIcon name="business-outline" color={theme.colors.accent} />
          </View>
        )}
        <View style={styles.editorCopy}>
          <AppText role="titleSmall">{name}</AppText>
          <VerificationBadge status={verificationStatus} />
          <AppText role="caption" color={theme.colors.textSecondary}>
            Profil zu {completionPercent}% vollständig
          </AppText>
        </View>
        {onPreviewPress ? (
          <GhostButton label={previewLabel} onPress={onPreviewPress} />
        ) : null}
      </View>
    </View>
  );
}

export interface ProfileCompletionCardProps {
  completion: ProfileCompletionViewModel;
  onCtaPress?: () => void;
  style?: ViewStyle;
  testID?: string;
}

export function ProfileCompletionCard({ completion, onCtaPress, style, testID }: ProfileCompletionCardProps) {
  const { theme } = useTheme();

  return (
    <View accessibilityLabel={completion.accessibilityLabel}>
    <CardFoundation padding="md" style={[styles.completion, style]} testID={testID}>
      <View style={styles.completionHeader}>
        <AppText role="sectionTitle">Profil vervollständigen</AppText>
        <AppText role="titleSmall" color={theme.colors.accent}>{completion.percent}%</AppText>
      </View>
      <View style={[styles.completionBar, { backgroundColor: theme.colors.borderSubtle }]}>
        <View style={[styles.completionFill, { width: `${completion.percent}%`, backgroundColor: theme.colors.accent }]} />
      </View>
      <AppText role="caption" color={theme.colors.textSecondary}>{completion.statusLabel}</AppText>
      {completion.openItems.map((item) => (
        <AppText key={item} role="bodyMuted" color={theme.colors.textSecondary}>• {item}</AppText>
      ))}
      {completion.ctaLabel && onCtaPress ? (
        <PrimaryButton label={completion.ctaLabel} onPress={onCtaPress} />
      ) : null}
    </CardFoundation>
    </View>
  );
}

export interface OrganizerProfileSectionCardProps {
  title: string;
  description?: string;
  children?: ReactNode;
  onEditPress?: () => void;
  style?: ViewStyle;
  testID?: string;
}

export function OrganizerProfileSectionCard({
  title,
  description,
  children,
  onEditPress,
  style,
  testID,
}: OrganizerProfileSectionCardProps) {
  return (
    <CardFoundation padding="md" style={[styles.section, style]} testID={testID}>
      <View style={styles.sectionHeader}>
        <AppText role="sectionTitle">{title}</AppText>
        {onEditPress ? (
          <IconButton icon="create-outline" size="sm" accessibilityLabel={`${title} bearbeiten`} onPress={onEditPress} />
        ) : null}
      </View>
      {description ? <AppText role="bodyMuted">{description}</AppText> : null}
      {children}
    </CardFoundation>
  );
}

const SOCIAL_ICONS: Record<SocialPlatform, 'logo-instagram' | 'logo-facebook' | 'musical-notes-outline' | 'globe-outline' | 'logo-tiktok' | 'logo-twitter'> = {
  instagram: 'logo-instagram',
  facebook: 'logo-facebook',
  soundcloud: 'musical-notes-outline',
  website: 'globe-outline',
  tiktok: 'logo-tiktok',
  x: 'logo-twitter',
};

export interface SocialLinkRowProps {
  link: SocialLinkViewModel;
  onEditPress?: () => void;
  onRemovePress?: () => void;
  style?: ViewStyle;
  testID?: string;
}

export function SocialLinkRow({ link, onEditPress, onRemovePress, style, testID }: SocialLinkRowProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.socialRow, style]} testID={testID} accessibilityLabel={link.accessibilityLabel}>
      <AppIcon name={SOCIAL_ICONS[link.platform]} color={theme.colors.accent} />
      <View style={styles.socialCopy}>
        <AppText role="bodyStrong">{link.valueLabel}</AppText>
        {link.verified ? <AppText role="caption" color={theme.colors.success}>Verifiziert</AppText> : null}
        {link.errorLabel ? <AppText role="caption" color={theme.colors.destructive}>{link.errorLabel}</AppText> : null}
      </View>
      <Stack direction="horizontal" gap="xs">
        {onEditPress ? <IconButton icon="create-outline" size="sm" accessibilityLabel="Bearbeiten" onPress={onEditPress} /> : null}
        {onRemovePress ? <IconButton icon="trash-outline" size="sm" accessibilityLabel="Entfernen" onPress={onRemovePress} /> : null}
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  editorHeader: { gap: spacing.md },
  editorRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  logo: {
    width: componentSize.organizerLogoSize,
    height: componentSize.organizerLogoSize,
    borderRadius: componentSize.organizerLogoSize / 2,
    borderWidth: borderWidth.strong,
  },
  logoFallback: { alignItems: 'center', justifyContent: 'center' },
  editorCopy: { flex: 1, gap: spacing.xs },
  completion: { gap: spacing.sm },
  completionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  completionBar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  completionFill: { height: '100%', borderRadius: 3 },
  section: { gap: spacing.sm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  socialRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  socialCopy: { flex: 1, gap: spacing.xs },
});
