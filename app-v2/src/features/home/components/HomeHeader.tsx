import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { useAuth } from '@/features/auth';
import { spacing, spacingRoles } from '@/design/spacing';
import { fontSize, textRoles } from '@/design/typography';
import { shouldShowNotificationButton } from '@/features/home/home-header-config';

import { CreateHeaderButton } from './CreateHeaderButton';
import { NotificationButton } from './NotificationButton';

export function HomeHeader() {
  const { isAuthenticated } = useAuth();
  const showActivityButton = shouldShowNotificationButton(isAuthenticated);

  return (
    <View style={styles.container} testID="home-header">
      <View style={styles.sideSlot}>
        <CreateHeaderButton />
      </View>
      <AppText style={styles.brand}>ETERNAL RΛVE</AppText>
      <View style={[styles.sideSlot, styles.sideSlotRight]}>
        {showActivityButton ? <NotificationButton /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    paddingHorizontal: spacingRoles.screenHorizontal,
    marginBottom: spacing.xs,
  },
  sideSlot: {
    minWidth: 88,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  sideSlotRight: {
    alignItems: 'flex-end',
  },
  brand: {
    ...textRoles.sectionTitle,
    fontSize: fontSize.md,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    flex: 1,
    textAlign: 'center',
  },
});
