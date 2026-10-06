import { StyleSheet, View, ViewStyle } from 'react-native';

import { GhostButton } from '@/components/buttons/GhostButton';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { CardFoundation } from '@/components/cards/CardFoundation';
import { AppTextInput } from '@/components/inputs/AppTextInput';
import { Badge } from '@/components/feedback/Badge';
import { Dialog } from '@/components/overlay/Dialog';
import { AppText } from '@/components/layout/AppText';
import { Stack } from '@/components/layout/Stack';
import { TeamMemberRow } from '@/components/profiles/OrganizerComponents';
import type { TeamMemberViewModel } from '@/components/profiles/view-models';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

import { resolveInviteBadgeStatus, resolveInviteStatusLabel, resolveTeamRoleBadgeStatus, resolveTeamRoleLabel } from './organizer-styles';
import type { TeamInviteViewModel, TeamMemberManagementViewModel } from './view-models';

export interface TeamRoleBadgeProps {
  role: TeamMemberManagementViewModel['role'];
  style?: ViewStyle;
  testID?: string;
}

/** Mockup 39 role badges. */
export function TeamRoleBadge({ role, style, testID }: TeamRoleBadgeProps) {
  return (
    <Badge
      label={resolveTeamRoleLabel(role)}
      status={resolveTeamRoleBadgeStatus(role)}
      style={style}
      testID={testID}
    />
  );
}

export interface TeamMemberManagementRowProps {
  member: TeamMemberManagementViewModel;
  onMenuPress?: () => void;
  style?: ViewStyle;
  testID?: string;
}

/** Wraps TeamMemberRow with email from mockup 39. */
export function TeamMemberManagementRow({ member, onMenuPress, style, testID }: TeamMemberManagementRowProps) {
  const { theme } = useTheme();
  const rowMember: TeamMemberViewModel = {
    id: member.id,
    name: member.name,
    avatar: member.avatar,
    role: member.role,
    statusLabel: member.statusLabel,
    accessibilityLabel: member.accessibilityLabel,
  };

  return (
    <View style={[styles.managementRow, style]} testID={testID}>
      <TeamMemberRow member={rowMember} onMenuPress={onMenuPress} />
      <AppText role="caption" color={theme.colors.textSecondary} style={styles.email}>
        {member.emailLabel}
      </AppText>
    </View>
  );
}

export interface TeamInviteCardProps {
  emailPlaceholder?: string;
  roleLabel?: string;
  messagePlaceholder?: string;
  sendLabel?: string;
  onSendPress?: () => void;
  style?: ViewStyle;
  testID?: string;
}

export function TeamInviteCard({
  emailPlaceholder = 'name@beispiel.de',
  roleLabel = 'Editor',
  messagePlaceholder = 'Optionale Nachricht',
  sendLabel = 'Einladung senden',
  onSendPress,
  style,
  testID,
}: TeamInviteCardProps) {
  return (
    <CardFoundation padding="md" style={[styles.inviteCard, style]} testID={testID}>
      <AppText role="sectionTitle">Mitglied einladen</AppText>
      <AppTextInput placeholder={emailPlaceholder} accessibilityLabel="E-Mail für Einladung" />
      <AppText role="caption">Rolle: {roleLabel}</AppText>
      <AppTextInput placeholder={messagePlaceholder} multiline accessibilityLabel="Einladungsnachricht" />
      {onSendPress ? <PrimaryButton label={sendLabel} onPress={onSendPress} /> : null}
    </CardFoundation>
  );
}

export interface PendingInviteRowProps {
  invite: TeamInviteViewModel;
  onRevokePress?: () => void;
  style?: ViewStyle;
  testID?: string;
}

export function PendingInviteRow({ invite, onRevokePress, style, testID }: PendingInviteRowProps) {
  return (
    <View style={[styles.inviteRow, style]} testID={testID} accessibilityLabel={invite.accessibilityLabel}>
      <View style={styles.inviteCopy}>
        <AppText role="bodyStrong">{invite.emailLabel}</AppText>
        <TeamRoleBadge role={invite.role} />
        {invite.sentLabel ? <AppText role="caption">Gesendet: {invite.sentLabel}</AppText> : null}
      </View>
      <Badge label={resolveInviteStatusLabel(invite.status)} status={resolveInviteBadgeStatus(invite.status)} />
      {onRevokePress ? <GhostButton label="Widerrufen" onPress={onRevokePress} /> : null}
    </View>
  );
}

export interface RemoveTeamMemberDialogProps {
  visible: boolean;
  memberName: string;
  onConfirm: () => void;
  onCancel: () => void;
  testID?: string;
}

export function RemoveTeamMemberDialog({
  visible,
  memberName,
  onConfirm,
  onCancel,
  testID,
}: RemoveTeamMemberDialogProps) {
  return (
    <Dialog
      visible={visible}
      title="Teammitglied entfernen"
      message={`Möchtest du ${memberName} wirklich aus dem Team entfernen?`}
      mode="destructive"
      confirmLabel="Entfernen"
      cancelLabel="Abbrechen"
      onConfirm={onConfirm}
      onCancel={onCancel}
      testID={testID}
    />
  );
}

const styles = StyleSheet.create({
  managementRow: { gap: spacing.xs },
  email: { marginLeft: 56 },
  inviteCard: { gap: spacing.md },
  inviteRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  inviteCopy: { flex: 1, gap: spacing.xs },
});
