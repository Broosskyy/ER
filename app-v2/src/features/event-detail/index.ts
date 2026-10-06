export { EventNotFoundState } from './components/EventNotFoundState';
export {
  EventDetailContent,
  EventDetailLoadingState,
} from './components/EventDetailContent';

export async function openEventInMaps(): Promise<boolean> {
  return false;
}

export async function openEventTicketUrl(_ticketUrl?: string): Promise<boolean> {
  return false;
}

export async function shareEvent(): Promise<void> {
  return undefined;
}
