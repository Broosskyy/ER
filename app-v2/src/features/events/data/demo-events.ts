import { ImageSourcePropType } from 'react-native';

export type DemoEvent = {
  id: string;
  title: string;
  image: ImageSourcePropType;
  date: string;
  startTime: string;
  endTime?: string;
  venue: string;
  city: string;
  address?: string;
  genres: string[];
  artists: string[];
  lineup?: string[];
  description: string;
  ageRestriction?: string;
  organizer?: string;
  sourceName?: string;
  ticketUrl?: string;
  priceText?: string;
  startsAt: string;
  isFeatured: boolean;
  /** Demo coordinates for map markers — optional; events without coords are excluded from map. */
  latitude?: number;
  longitude?: number;
};

export const HOME_FILTER_CHIPS = [
  { id: 'all', label: 'Alle' },
  { id: 'today', label: 'Heute' },
  { id: 'weekend', label: 'Dieses Wochenende' },
  { id: 'techno', label: 'Techno' },
  { id: 'house', label: 'House' },
] as const;

export type HomeFilterChipId = (typeof HOME_FILTER_CHIPS)[number]['id'];

export const demoEvents: DemoEvent[] = [
  {
    id: 'void-techno-saturday',
    title: 'VOID: Techno Saturday',
    venue: 'Sisyphos',
    city: 'Berlin',
    address: 'Hauptstraße 15, 10317 Berlin',
    date: '24 MAI',
    startTime: '23:00',
    endTime: '08:00',
    genres: ['Techno', 'Hard Techno'],
    artists: ['VOID Collective'],
    lineup: ['VOID Collective', 'Amelie Lens', 'I Hate Models', 'Kobosil'],
    description:
      'VOID returns to Sisyphos with a night of uncompromising techno. Expect a marathon session across indoor and outdoor floors, immersive lighting, and a crowd that knows how to rave until sunrise. Dress for Berlin weather and arrive early — the queue moves fast once doors open.',
    ageRestriction: '18+',
    organizer: 'VOID Events',
    sourceName: 'Eternal Rave',
    priceText: 'from €15',
    ticketUrl: 'https://www.sisyphos-berlin.net/',
    startsAt: '2026-05-24T23:00:00',
    latitude: 52.5109,
    longitude: 13.4969,
    image: require('../../../../assets/demo/event-void.png'),
    isFeatured: true,
  },
  {
    id: 'klangkuenstler-berghain',
    title: 'Klangkuenstler',
    venue: 'Berghain',
    city: 'Berlin',
    address: 'Am Wriezener Bahnhof, 10243 Berlin',
    date: '25 MAI',
    startTime: '00:00',
    endTime: '12:00',
    genres: ['Techno'],
    artists: ['Klangkuenstler'],
    lineup: ['Klangkuenstler', 'Dax J', 'Somewhen'],
    description:
      'Klangkuenstler takes over Berghain with a driving, industrial-leaning techno set. One of Berlin’s most iconic rooms meets one of the scene’s most in-demand artists for a late-night session built for the dedicated.',
    ageRestriction: '18+',
    organizer: 'Berghain',
    sourceName: 'Eternal Rave',
    priceText: 'from €20',
    ticketUrl: 'https://www.berghain.berlin/',
    startsAt: '2026-05-25T00:00:00',
    latitude: 52.5112,
    longitude: 13.4437,
    image: require('../../../../assets/demo/event-berghain.png'),
    isFeatured: true,
  },
  {
    id: 'fckng-serious',
    title: 'FCKNG SERIOUS',
    venue: '://about blank',
    city: 'Berlin',
    address: 'Markgrafendamm 24b, 10245 Berlin',
    date: '24 MAI',
    startTime: '23:30',
    endTime: '10:00',
    genres: ['Techno', 'Hard Techno'],
    artists: ['FCKNG SERIOUS'],
    lineup: ['FCKNG SERIOUS', '999999999', 'Nico Moreno'],
    description:
      'Hard, fast, and unapologetic — FCKNG SERIOUS brings peak-time energy to ://about blank. A night for those who like their techno raw, with relentless kicks and a warehouse atmosphere that does not let up.',
    ageRestriction: '18+',
    organizer: '://about blank',
    sourceName: 'Eternal Rave',
    priceText: 'from €12',
    startsAt: '2026-05-24T23:30:00',
    latitude: 52.5074,
    longitude: 13.4648,
    image: require('../../../../assets/demo/event-about-blank.png'),
    isFeatured: false,
  },
  {
    id: 'watergate-nights',
    title: 'Watergate Nights',
    venue: 'Watergate',
    city: 'Berlin',
    address: 'Falckensteinstraße 49, 10997 Berlin',
    date: '24 MAI',
    startTime: '22:00',
    endTime: '06:00',
    genres: ['House', 'Techno'],
    artists: ['Watergate Residents'],
    lineup: ['Magda', 'Ellen Allien', 'Rodriguez Jr.'],
    description:
      'Watergate Nights blends house and techno with panoramic Spree views. Two floors, resident selectors, and a crowd that bridges melodic grooves with late-night drive. Perfect for a full evening by the river.',
    ageRestriction: '18+',
    organizer: 'Watergate',
    sourceName: 'Eternal Rave',
    priceText: 'from €14',
    ticketUrl: 'https://water-gate.de/',
    startsAt: '2026-05-24T22:00:00',
    latitude: 52.4986,
    longitude: 13.4418,
    image: require('../../../../assets/demo/event-watergate.png'),
    isFeatured: false,
  },
  {
    id: 'sisyphos-open-air',
    title: 'Sisyphos Open Air',
    venue: 'Sisyphos',
    city: 'Berlin',
    address: 'Hauptstraße 15, 10317 Berlin',
    date: '25 MAI',
    startTime: '18:00',
    endTime: '02:00',
    genres: ['House'],
    artists: ['Sisyphos'],
    lineup: ['Dixon', 'Ame', 'Adriatique'],
    description:
      'An open-air afternoon flowing into a warm house night at Sisyphos. Sunsets, garden vibes, and deeper grooves across the club’s outdoor areas before the party moves inside.',
    organizer: 'Sisyphos',
    sourceName: 'Eternal Rave',
    startsAt: '2026-05-25T18:00:00',
    latitude: 52.5111,
    longitude: 13.4972,
    image: require('../../../../assets/demo/event-sisyphos.png'),
    isFeatured: false,
  },
];

export function getDemoEventById(id: string): DemoEvent | undefined {
  return demoEvents.find((event) => event.id === id);
}

export function getFeaturedDemoEvents(): DemoEvent[] {
  return demoEvents.filter((event) => event.isFeatured);
}

export function getTonightDemoEvents(): DemoEvent[] {
  return demoEvents.filter((event) => !event.isFeatured);
}

export function getAllDemoEvents(): DemoEvent[] {
  return demoEvents;
}

export function hasMapCoordinates(
  event: DemoEvent,
): event is DemoEvent & { latitude: number; longitude: number } {
  return (
    typeof event.latitude === 'number' &&
    typeof event.longitude === 'number' &&
    Number.isFinite(event.latitude) &&
    Number.isFinite(event.longitude)
  );
}

export function getMapDemoEvents(): (DemoEvent & { latitude: number; longitude: number })[] {
  return demoEvents.filter(hasMapCoordinates);
}

export function formatEventTimeRange(event: DemoEvent): string {
  if (event.endTime) {
    return `${event.startTime} – ${event.endTime}`;
  }

  return event.startTime;
}

export function formatEventDateTime(event: DemoEvent): string {
  return `${event.date} · ${formatEventTimeRange(event)}`;
}
