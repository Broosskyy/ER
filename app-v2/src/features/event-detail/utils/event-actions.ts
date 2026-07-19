import { Linking, Platform, Share } from 'react-native';

import type { EventDisplayModel } from '@/features/events';
import { formatEventDateTime } from '@/features/events';
import { isSafeExternalHttpUrl } from '@/platform/linking/external-url';

function getEventShareUrl(eventId: string): string | undefined {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return undefined;
  }

  return `${window.location.origin}/event/${eventId}`;
}

export async function shareEvent(event: EventDisplayModel): Promise<void> {
  const message = [
    event.title,
    formatEventDateTime(event),
    `${event.venue}, ${event.city}`,
  ].join('\n');

  const url = getEventShareUrl(event.id);

  await Share.share(url ? { message, url } : { message });
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
