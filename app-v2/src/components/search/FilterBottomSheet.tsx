import type { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { Stack } from '@/components/layout/Stack';
import { BottomSheet } from '@/components/overlay/BottomSheet';
import { spacing } from '@/design/spacing';

export interface FilterBottomSheetProps {
  visible: boolean;
  title?: string;
  onClose: () => void;
  onApply?: () => void;
  onReset?: () => void;
  applyLabel?: string;
  resetLabel?: string;
  children: ReactNode;
  style?: ViewStyle;
  testID?: string;
}

/**
 * Filter presentation sheet — mockups 10, 13, 59.
 * Uses the shared `BottomSheet` foundation; no second sheet architecture.
 */
export function FilterBottomSheet({
  visible,
  title = 'Filter',
  onClose,
  onApply,
  onReset,
  applyLabel = 'Anwenden',
  resetLabel = 'Zurücksetzen',
  children,
  style,
  testID,
}: FilterBottomSheetProps) {
  return (
    <BottomSheet
      visible={visible}
      title={title}
      onClose={onClose}
      testID={testID}
      footer={
        <View style={styles.footer}>
          <SecondaryButton label={resetLabel} onPress={onReset ?? onClose} style={styles.footerButton} />
          <PrimaryButton label={applyLabel} onPress={onApply ?? onClose} style={styles.footerButton} />
        </View>
      }
    >
      <Stack gap="lg" style={style}>
        {children}
      </Stack>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  footerButton: {
    flex: 1,
  },
});
