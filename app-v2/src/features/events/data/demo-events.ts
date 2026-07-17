import { ImageSourcePropType } from 'react-native';

export type DemoEvent = {
  id: string;
  title: string;
  venueName: string;
  city: string;
  dateLabel: string;
  timeLabel: string;
  genres: string[];
  image: ImageSourcePropType;
  isFeatured: boolean;
  isFavorite: boolean;
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
    venueName: 'Sisyphos',
    city: 'Berlin',
    dateLabel: '24 MAI',
    timeLabel: '23:00',
    genres: ['Techno', 'Hard Techno'],
    image: require('../../../../assets/demo/event-void.png'),
    isFeatured: true,
    isFavorite: false,
  },
  {
    id: 'klangkuenstler-berghain',
    title: 'Klangkuenstler',
    venueName: 'Berghain',
    city: 'Berlin',
    dateLabel: '25 MAI',
    timeLabel: '00:00',
    genres: ['Techno'],
    image: require('../../../../assets/demo/event-berghain.png'),
    isFeatured: true,
    isFavorite: false,
  },
  {
    id: 'fckng-serious',
    title: 'FCKNG SERIOUS',
    venueName: '://about blank',
    city: 'Berlin',
    dateLabel: '24 MAI',
    timeLabel: '23:30',
    genres: ['Techno', 'Hard Techno'],
    image: require('../../../../assets/demo/event-about-blank.png'),
    isFeatured: false,
    isFavorite: false,
  },
  {
    id: 'watergate-nights',
    title: 'Watergate Nights',
    venueName: 'Watergate',
    city: 'Berlin',
    dateLabel: '24 MAI',
    timeLabel: '22:00',
    genres: ['House', 'Techno'],
    image: require('../../../../assets/demo/event-watergate.png'),
    isFeatured: false,
    isFavorite: false,
  },
  {
    id: 'sisyphos-open-air',
    title: 'Sisyphos Open Air',
    venueName: 'Sisyphos',
    city: 'Berlin',
    dateLabel: '25 MAI',
    timeLabel: '18:00',
    genres: ['House'],
    image: require('../../../../assets/demo/event-sisyphos.png'),
    isFeatured: false,
    isFavorite: false,
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
