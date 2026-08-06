import { Linking, Platform, Share } from 'react-native';

import type { EventDisplayModel } from '@/features/events';
import { formatEventDateTime } from '@/features/events';
import { isSafeExternalHttpUrl } from '@/platform/linking/external-url';

function buildShareMessage(event: EventDisplayModel): string {
  return [event.title, formatEventDateTime(event), event.locationLabelComma].join('\n');
}

function buildShareUrl(eventId: string): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/event/${eventId}`;
  }
  return `https://eternalrave.app/event/${eventId}`;
}

async function copyShareFallback(text: string): Promise<void> {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  await Share.share({ message: text });
}

export async function shareEvent(event: EventDisplayModel): Promise<void> {
  const message = buildShareMessage(event);
  const url = buildShareUrl(event.id);
  const payload = `${message}\n${url}`;

  try {
    const result = await Share.share({ message: payload, url });
    if (result.action === Share.dismissedAction) {
      return;
    }
  } catch {
    await copyShareFallback(payload);
  }
}

export async function openEventTicketUrl(url: string): Promise<boolean> {
  if (!isSafeExternalHttpUrl(url)) {
    return false;
  }

  const normalized = url.trim();

  try {
    const canOpen = await Linking.canOpenURL(normalized);

    if (!canOpen && Platform.OS === 'ios') {
      await Linking.openURL(normalized);
      return true;
    }

    if (!canOpen) {
      return false;
    }

    await Linking.openURL(normalized);
    return true;
  } catch {
    return false;
  }
}

export async function openEventInMaps(event: EventDisplayModel): Promise<boolean> {
  if (!event.address) {
    return false;
  }

  const query = encodeURIComponent(`${event.address}, ${event.city}`);
  const url = Platform.select({
    ios: `maps:0,0?q=${query}`,
    android: `geo:0,0?q=${query}`,
    default: `https://www.google.com/maps/search/?api=1&query=${query}`,
  });

  if (!url) {
    return false;
  }

  try {
    const canOpen = await Linking.canOpenURL(url);

    if (!canOpen) {
      await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
      return true;
    }

    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
