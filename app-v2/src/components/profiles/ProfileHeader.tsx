import type { ReactNode } from 'react';
import { Image, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { AppIcon } from '@/components/primitives/AppIcon';
import { componentSize } from '@/design/layout';
import { borderWidth } from '@/design/radii';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

import { ProfileStats } from './ProfileStats';
import { VerificationBadge } from './VerificationBadge';
import type { ProfileHeaderViewModel } from './view-models';

export interface ProfileHeaderProps {
  profile: ProfileHeaderViewModel;
  followAction?: ReactNode;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Shared public-profile header based on mockups 15 and 38. */
export function ProfileHeader({ profile, followAction, primaryAction, secondaryAction, style }: ProfileHeaderProps) {
  const { theme } = useTheme();
  return (
    <View style={[styles.container, style]} accessibilityLabel={profile.accessibilityLabel}>
      <View style={styles.top}>
        {profile.avatar ? <Image source={profile.avatar} style={[styles.avatar, { borderColor: theme.colors.accent }]} /> : (
          <View style={[styles.avatar, styles.avatarFallback, { borderColor: theme.colors.accent, backgroundColor: theme.colors.surfaceSubtle }]}>
            <AppIcon name={profile.type === 'organizer' ? 'business-outline' : 'person-outline'} color={theme.colors.accent} />
          </View>
        )}
        <View style={styles.identity}>
          <View style={styles.nameRow}>
            <AppText role="titleMedium">{profile.name}</AppText>
            <VerificationBadge status={profile.verificationStatus} showIcon />
          </View>
          <AppText role="bodyMuted">{profile.handleOrTypeLabel}</AppText>
          {profile.locationLabel ? <InfoLine icon="location-outline" label={profile.locationLabel} /> : null}
          {profile.websiteLabel ? <InfoLine icon="globe-outline" label={profile.websiteLabel} /> : null}
        </View>
      </View>
      {profile.bio ? <AppText role="body">{profile.bio}</AppText> : null}
      {profile.stats?.length ? <ProfileStats stats={profile.stats} /> : null}
      {followAction || primaryAction || secondaryAction ? <View style={styles.actions}>{followAction}{primaryAction}{secondaryAction}</View> : null}
    </View>
  );
}

function InfoLine({ icon, label }: { icon: 'location-outline' | 'globe-outline'; label: string }) {
  const { theme } = useTheme();
  return <View style={styles.infoLine}><AppIcon name={icon} size="sm" color={theme.colors.textMuted} /><AppText role="caption" color={theme.colors.textSecondary}>{label}</AppText></View>;
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: componentSize.profileAvatarSize,
    height: componentSize.profileAvatarSize,
    borderRadius: componentSize.profileAvatarSize / 2,
    borderWidth: borderWidth.strong,
  },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  identity: { flex: 1, gap: spacing.xs },
  nameRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  infoLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
