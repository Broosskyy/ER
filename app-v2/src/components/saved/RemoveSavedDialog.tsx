import { Dialog } from '@/components/overlay/Dialog';

export interface RemoveSavedDialogProps {
  visible: boolean;
  eventTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
  testID?: string;
}

/** Mockup 14 remove-from-saved confirmation — reuses Dialog. */
export function RemoveSavedDialog({
  visible,
  eventTitle,
  onConfirm,
  onCancel,
  testID,
}: RemoveSavedDialogProps) {
  return (
    <Dialog
      visible={visible}
      title="Aus Gespeichert entfernen?"
      message={`${eventTitle} wird aus deinen gespeicherten Events entfernt.`}
      mode="destructive"
      confirmLabel="Entfernen"
      cancelLabel="Abbrechen"
      onConfirm={onConfirm}
      onCancel={onCancel}
      testID={testID}
    />
  );
}
