import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { colorRoles } from '@/design/colors';
import { spacing } from '@/design/spacing';

export function NotificationsEmptyState() {
  return (
    <View style={styles.container} testID="notifications-empty-state">
      <Ionicons name="notifications-off-outline" size={48} color={colorRoles.emptyStateIcon} />
      <EmptyState
        title="Noch keine Aktivitäten"
        description="Hier erscheinen Updates zu neuen Events, deinen gespeicherten Events und Ticket-Infos."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
});
