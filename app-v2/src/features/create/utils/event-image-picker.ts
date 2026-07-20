import { Platform } from 'react-native';

import type { EventImageDraft } from '@/features/create/types/event-draft-form';

export interface PickedEventImage {
  localUri: string;
  mimeType: string;
  fileName?: string;
  byteLength?: number;
}

export async function pickEventImage(): Promise<PickedEventImage | null> {
  if (Platform.OS === 'web') {
    return pickEventImageWeb();
  }

  return pickEventImageNative();
}

async function pickEventImageWeb(): Promise<PickedEventImage | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.style.display = 'none';

    input.onchange = () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) {
        resolve(null);
        return;
      }

      resolve({
        localUri: URL.createObjectURL(file),
        mimeType: file.type || 'image/jpeg',
        fileName: file.name,
        byteLength: file.size,
      });
    };

    input.oncancel = () => {
      input.remove();
      resolve(null);
    };

    document.body.appendChild(input);
    input.click();
  });
}

async function pickEventImageNative(): Promise<PickedEventImage | null> {
  const ImagePicker = await import('expo-image-picker');

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
    allowsEditing: false,
  });

  if (result.canceled || !result.assets[0]) {
    return null;
  }

  const asset = result.assets[0];
  return {
    localUri: asset.uri,
    mimeType: asset.mimeType ?? 'image/jpeg',
    fileName: asset.fileName ?? undefined,
    byteLength: asset.fileSize,
  };
}

export function toEventImageDraft(picked: PickedEventImage): EventImageDraft {
  return {
    remoteUrl: '',
    localUri: picked.localUri,
    mimeType: picked.mimeType,
    fileName: picked.fileName,
  };
}
