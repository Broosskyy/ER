export const PWA_CONFIG = {
  name: 'Eternal Rave',
  shortName: 'Eternal Rave',
  description:
    'Entdecke elektronische Musikveranstaltungen, speichere Events und bleibe über Updates informiert.',
  themeColor: '#0B0B0F',
  backgroundColor: '#0B0B0F',
  startUrl: '/',
  scope: '/',
  lang: 'de',
  manifestPath: '/manifest.webmanifest',
  serviceWorkerPath: '/sw.js',
  cacheVersion: 'v0.2.0',
} as const;

export const WEB_PAGE_TITLES = {
  home: 'Eternal Rave',
  search: 'Events — Eternal Rave',
  map: 'Map — Eternal Rave',
  saved: 'Saved — Eternal Rave',
  profile: 'Profile — Eternal Rave',
  notifications: 'Notifications — Eternal Rave',
  eventDetail: 'Event — Eternal Rave',
  collection: 'Collection — Eternal Rave',
  adminLogin: 'Admin Login — Eternal Rave',
  adminDashboard: 'Admin — Eternal Rave',
} as const;
