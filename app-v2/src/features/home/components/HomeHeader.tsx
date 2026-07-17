import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { colors } from '@/design/colors';
import { componentSize } from '@/design/layout';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';

import { NotificationButton } from './NotificationButton';

export function HomeHeader() {
  return (
    <View style={styles.container}>
      <View style={styles.logoMark}>
        <Ionicons name="diamond" size={componentSize.iconMd} color={colors.primary} />
      </View>
      <AppText style={styles.brand}>ETERNAL RΛVE</AppText>
      <NotificationButton />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: componentSize.headerContentHeight,
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingBottom: spacing.sm,
  },
  logoMark: {
    width: componentSize.iconButtonSize,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  brand: {
    ...textRoles.sectionTitle,
    fontSize: 16,
    letterSpacing: 2,
    textTransform: 'uppercase',
    flex: 1,
    textAlign: 'center',
  },
});
