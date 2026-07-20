import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/buttons/IconButton';
import { AppText } from '@/components/layout/AppText';
import { colors } from '@/design/colors';
import { fontSize } from '@/design/typography';
import { ActivityPanel } from '@/features/activity';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';
import { useNotifications } from '@/features/notifications';

export function NotificationButton() {
  const [panelVisible, setPanelVisible] = useState(false);
  const { t } = useAppTranslation();
  const { badgeLabel, unreadCount } = useNotifications();

  const badgeAccessibilityLabel =
    unreadCount > 0
      ? t('home.header.unreadActivityA11y', { count: unreadCount })
      : t('home.header.noUnreadActivityA11y');

  return (
    <>
      <View style={styles.wrap} testID="home-activity-button">
        <IconButton
          icon="notifications-outline"
          accessibilityLabel={t('home.header.activityA11y')}
          onPress={() => setPanelVisible(true)}
        />
        {badgeLabel ? (
          <View
            style={styles.badge}
            accessibilityLabel={badgeAccessibilityLabel}
            accessibilityRole="text"
          >
            <AppText style={styles.badgeText}>{badgeLabel}</AppText>
          </View>
        ) : null}
      </View>

      <ActivityPanel visible={panelVisible} onClose={() => setPanelVisible(false)} />
    </>
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
