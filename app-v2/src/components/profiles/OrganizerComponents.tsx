import { Image, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { Badge } from '@/components/feedback/Badge';
import { CardFoundation } from '@/components/cards/CardFoundation';
import { InteractiveCard } from '@/components/cards/InteractiveCard';
import { IconButton } from '@/components/buttons/IconButton';
import { AppText } from '@/components/layout/AppText';
import { AppIcon } from '@/components/primitives/AppIcon';
import { componentSize } from '@/design/layout';
import { borderWidth } from '@/design/radii';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

import { FollowButton } from './FollowButton';
import { VerificationBadge } from './VerificationBadge';
import type { FollowState, OrganizerClaimStatus, OrganizerProfileViewModel, TeamMemberViewModel } from './view-models';

export function OrganizerClaimBadge({ status }: { status: OrganizerClaimStatus }) {
  const values = {
    unclaimed: { label: 'Nicht beansprucht', badgeStatus: 'default' as const },
    pending: { label: 'Claim in Prüfung', badgeStatus: 'warning' as const },
    verified: { label: 'Offizieller Veranstalter', badgeStatus: 'success' as const },
    rejected: { label: 'Claim abgelehnt', badgeStatus: 'error' as const },
  };
  const resolved = values[status];
  return <Badge label={resolved.label} status={resolved.badgeStatus} />;
}

export interface OrganizerProfileCardProps {
  organizer: OrganizerProfileViewModel;
  followState?: FollowState;
  onFollowPress?: () => void;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function OrganizerProfileCard({ organizer, followState, onFollowPress, onPress, style }: OrganizerProfileCardProps) {
  const { theme } = useTheme();

  const header = (
    <View style={styles.header}>
      {organizer.logo ? (
        <Image source={organizer.logo} style={[styles.logo, { borderColor: theme.colors.accent }]} />
      ) : (
        <View
          style={[
            styles.logo,
            styles.logoFallback,
            { borderColor: theme.colors.accent, backgroundColor: theme.colors.surfaceSubtle },
          ]}
        >
          <AppIcon name="business-outline" color={theme.colors.accent} />
        </View>
      )}
      <View style={styles.copy}>
        <AppText role="cardTitle" numberOfLines={2}>
          {organizer.name}
        </AppText>
        <VerificationBadge status={organizer.verificationStatus} />
        {organizer.description ? (
          <AppText role="bodyMuted" numberOfLines={2}>
            {organizer.description}
          </AppText>
        ) : null}
      </View>
    </View>
  );

  const content = (
    <CardFoundation padding="md" style={[styles.card, style]}>
      {header}
      <View style={styles.stats}>
        {organizer.eventCountLabel ? <Stat value={organizer.eventCountLabel} label="Events" /> : null}
        {organizer.followerCountLabel ? (
          <Stat value={organizer.followerCountLabel} label="Follower" />
        ) : null}
      </View>
      {organizer.claimStatus ? <OrganizerClaimBadge status={organizer.claimStatus} /> : null}
    </CardFoundation>
  );

  const followAction =
    followState != null ? (
      <View style={styles.followInline}>
        <FollowButton state={followState} onPress={onFollowPress} />
      </View>
    ) : null;

  if (!onPress) {
    return (
      <View accessibilityLabel={organizer.accessibilityLabel} style={styles.staticRow}>
        <View style={styles.staticContent}>{content}</View>
        {followAction}
      </View>
    );
  }

  return (
    <InteractiveCard
      onPress={onPress}
      accessibilityLabel={organizer.accessibilityLabel}
      actions={followAction}
      actionsPlacement="trailing"
    >
      {content}
    </InteractiveCard>
  );
}

export interface TeamMemberRowProps {
  member: TeamMemberViewModel;
  onMenuPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Team management row from mockup 39; no team administration behavior. */
export function TeamMemberRow({ member, onMenuPress, style }: TeamMemberRowProps) {
  const { theme } = useTheme();
  return (
    <View style={[styles.member, style]} accessibilityLabel={member.accessibilityLabel}>
      {member.avatar ? <Image source={member.avatar} style={styles.memberAvatar} /> : <View style={[styles.memberAvatar, styles.logoFallback, { backgroundColor: theme.colors.surfaceSubtle }]}><AppIcon name="person-outline" color={theme.colors.textSecondary} /></View>}
      <View style={styles.memberCopy}>
        <AppText role="bodyStrong">{member.name}</AppText>
        <AppText role="caption" color={theme.colors.textSecondary}>{member.statusLabel}</AppText>
      </View>
      <Badge label={roleLabel(member.role)} status={roleStatus(member.role)} />
      {onMenuPress ? <IconButton icon="ellipsis-vertical" size="sm" accessibilityLabel={`Menü für ${member.name}`} onPress={onMenuPress} /> : null}
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const { theme } = useTheme();
  return <View><AppText role="titleSmall">{value}</AppText><AppText role="caption" color={theme.colors.textSecondary}>{label}</AppText></View>;
}

function roleLabel(role: TeamMemberViewModel['role']) {
  return { owner: 'Owner', admin: 'Admin', editor: 'Editor', promoter: 'Promoter', viewer: 'Viewer' }[role];
}

function roleStatus(role: TeamMemberViewModel['role']) {
  return role === 'owner' || role === 'admin' ? 'info' as const : role === 'editor' || role === 'promoter' ? 'success' as const : 'default' as const;
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  header: { flexDirection: 'row', gap: spacing.md },
  logo: {
    width: componentSize.organizerLogoSize,
    height: componentSize.organizerLogoSize,
    borderRadius: componentSize.organizerLogoSize / 2,
    borderWidth: borderWidth.strong,
  },
  logoFallback: { alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: spacing.xs, minWidth: 0 },
  followInline: {
    flexShrink: 0,
    alignSelf: 'flex-start',
  },
  staticRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  staticContent: {
    flex: 1,
    minWidth: 0,
  },
  stats: { flexDirection: 'row', gap: spacing.xxl },
  member: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: componentSize.teamMemberRowMinHeight,
  },
  memberAvatar: {
    width: componentSize.teamMemberAvatarSize,
    height: componentSize.teamMemberAvatarSize,
    borderRadius: componentSize.teamMemberAvatarSize / 2,
  },
  memberCopy: { flex: 1, gap: spacing.xs },
});
