import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/buttons/IconButton';
import { AppText } from '@/components/layout/AppText';
import { colors } from '@/design/colors';
import { fontSize } from '@/design/typography';
import { getNotificationScreenPath, useNotifications } from '@/features/notifications';

export function NotificationButton() {
  const router = useRouter();
  const { badgeLabel } = useNotifications();

  return (
    <View style={styles.wrap}>
      <IconButton
        icon="notifications-outline"
        accessibilityLabel="Benachrichtigungen"
        onPress={() => router.push(getNotificationScreenPath())}
      />
      {badgeLabel ? (
        <View style={styles.badge}>
          <AppText style={styles.badgeText}>{badgeLabel}</AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: colors.textOnPrimary,
    fontSize: fontSize.xs,
    fontWeight: '700',
    lineHeight: 14,
  },
});
