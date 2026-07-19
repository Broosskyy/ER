import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { colors } from '@/design/colors';
import { componentSize } from '@/design/layout';
import { spacing, spacingRoles } from '@/design/spacing';
import { fontSize, textRoles } from '@/design/typography';

import { NotificationButton } from './NotificationButton';

export function HomeHeader() {
  return (
    <View style={styles.container}>
      <View style={styles.logoMark}>
        <Ionicons name="diamond" size={componentSize.iconSm} color={colors.primary} />
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
    height: componentSize.headerContentHeight,
    paddingHorizontal: spacingRoles.screenHorizontal,
    marginBottom: spacing.xs,
  },
  logoMark: {
    width: componentSize.iconButtonSize,
    alignItems: 'flex-start',
    justifyContent: 'center',
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
