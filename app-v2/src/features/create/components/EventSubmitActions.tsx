import { StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { spacing } from '@/design/spacing';

export interface EventSubmitActionsLabels {
  edit: string;
  submit: string;
  submitting: string;
}

export interface EventSubmitActionsProps {
  labels: EventSubmitActionsLabels;
  submitting: boolean;
  onEdit: () => void;
  onSubmit: () => void;
}

export function EventSubmitActions({
  labels,
  submitting,
  onEdit,
  onSubmit,
}: EventSubmitActionsProps) {
  return (
    <View style={styles.container}>
      <SecondaryButton label={labels.edit} onPress={onEdit} disabled={submitting} />
      <PrimaryButton
        label={submitting ? labels.submitting : labels.submit}
        onPress={onSubmit}
        disabled={submitting}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
});
