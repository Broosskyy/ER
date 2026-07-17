import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { AppText } from '@/components/layout/AppText';
import { colorRoles, colors } from '@/design/colors';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';

export interface BottomTicketCTAProps {
  ticketUrl?: string;
  onPressTickets: () => void;
}

export function BottomTicketCTA({ ticketUrl, onPressTickets }: BottomTicketCTAProps) {
  const insets = useSafeAreaInsets();

  if (!ticketUrl) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      style={[styles.container, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}
    >
      <PrimaryButton label="Tickets" onPress={onPressTickets} style={styles.button} />
    </View>
  );
}

export function BottomTicketUnavailable() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      <View style={styles.unavailable}>
        <AppText style={styles.unavailableText}>Tickets unavailable</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colorRoles.bottomNavBorder,
  },
  button: {
    width: '100%',
    minHeight: 52,
  },
  unavailable: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colorRoles.cardBorder,
    backgroundColor: colorRoles.cardBackground,
  },
  unavailableText: {
    ...textRoles.metadata,
    color: colors.textSecondary,
    fontWeight: '600',
  },
});
