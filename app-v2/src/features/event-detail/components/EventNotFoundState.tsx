import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { AppText } from '@/components/layout/AppText';
import { colorRoles } from '@/design/colors';
import { componentSize } from '@/design/layout';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';

export interface EventNotFoundStateProps {
  onGoBack: () => void;
}

export function EventNotFoundState({ onGoBack }: EventNotFoundStateProps) {
  return (
    <View style={styles.container}>
      <Ionicons
        name="alert-circle-outline"
        size={componentSize.iconLg * 2}
        color={colorRoles.emptyStateIcon}
      />
      <AppText style={styles.title}>Event not found</AppText>
      <AppText style={styles.description}>
        This event may have been removed or the link is invalid.
      </AppText>
      <PrimaryButton label="Go back" onPress={onGoBack} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacingRoles.screenHorizontal,
    gap: spacing.sm,
  },
  title: {
    ...textRoles.sectionTitle,
    textAlign: 'center',
    color: colorRoles.emptyStateTitle,
  },
  description: {
    ...textRoles.metadata,
    textAlign: 'center',
    color: colorRoles.emptyStateDescription,
    marginBottom: spacing.md,
  },
  button: {
    minWidth: 160,
  },
});
