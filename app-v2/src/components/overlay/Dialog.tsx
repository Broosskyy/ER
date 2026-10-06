import { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { DestructiveButton } from '@/components/buttons/DestructiveButton';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AppText } from '@/components/layout/AppText';
import { Stack } from '@/components/layout/Stack';

import { AppModal } from './AppModal';
import { overlayMetrics } from './overlay-styles';

export type DialogMode = 'alert' | 'confirm' | 'destructive';

export interface DialogProps {
  visible: boolean;
  title: string;
  message?: string;
  mode?: DialogMode;
  /** @deprecated Use mode="destructive" */
  destructive?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Alert / confirm dialog primitive — mockup 58 confirm pattern.
 */
export function Dialog({
  visible,
  title,
  message,
  mode,
  destructive = false,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  children,
  style,
  testID,
}: DialogProps) {
  const resolvedMode: DialogMode = mode ?? (destructive ? 'destructive' : 'confirm');
  const isAlert = resolvedMode === 'alert';
  const isDestructive = resolvedMode === 'destructive';

  return (
    <AppModal
      visible={visible}
      title={title}
      onClose={onCancel}
      testID={testID}
      showCloseButton={!isAlert}
      style={[{ maxWidth: overlayMetrics.dialogMaxWidth }, style]}
      footer={
        <Stack direction="horizontal" gap="md" justify="end">
          {!isAlert ? <SecondaryButton label={cancelLabel} onPress={onCancel} /> : null}
          {isDestructive ? (
            <DestructiveButton label={confirmLabel} onPress={onConfirm} />
          ) : (
            <PrimaryButton label={confirmLabel} onPress={onConfirm} />
          )}
        </Stack>
      }
    >
      <View style={styles.content}>
        {message ? <AppText role="bodyMuted">{message}</AppText> : null}
        {children}
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: overlayMetrics.gap,
  },
});
