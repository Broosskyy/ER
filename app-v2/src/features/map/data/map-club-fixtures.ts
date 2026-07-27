import { getEventImageAsset } from '@/features/events/data/demo-images';

import type { MapClub } from '../types/discovery-models';

/** Local club markers for map discovery until venue discovery is wired. */
export const MAP_CLUB_FIXTURES: MapClub[] = [
  {
    id: 'bootshaus',
    markerType: 'club',
    title: 'Bootshaus',
    cityLabel: 'Köln',
    latitude: 50.9416,
    longitude: 6.974,
    image: getEventImageAsset('club-bootshaus'),
    logoReady: true,
  },
  {
    id: 'berghain',
    markerType: 'club',
    title: 'Berghain',
    cityLabel: 'Berlin',
    latitude: 52.5105,
    longitude: 13.443,
    image: getEventImageAsset('club-berghain'),
    logoReady: true,
  },
  {
    id: 'sisyphos',
    markerType: 'club',
    title: 'Sisyphos',
    cityLabel: 'Berlin',
    latitude: 52.5284,
    longitude: 13.4912,
    image: getEventImageAsset('club-sisyphos'),
    logoReady: true,
  },
  {
    id: 'about-blank',
    markerType: 'club',
    title: '://about blank',
    cityLabel: 'Berlin',
    latitude: 52.5078,
    longitude: 13.4532,
    image: getEventImageAsset('club-about-blank'),
    logoReady: true,
  },
  {
    id: 'watergate',
    markerType: 'club',
    title: 'Watergate',
    cityLabel: 'Berlin',
    latitude: 52.4987,
    longitude: 13.4479,
    image: getEventImageAsset('club-watergate'),
    logoReady: true,
  },
];
