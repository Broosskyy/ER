export const APP_SCHEME = 'eternal-rave';

export const IOS_LINKING_PATHS = {
  event: (id: string) => `/event/${id}`,
  collection: (type: string) => `/collection/${type}`,
  notifications: '/notifications',
  home: '/',
} as const;

export function buildNativeDeepLink(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${APP_SCHEME}://${normalized.replace(/^\//, '')}`;
}

export function buildUniversalLink(origin: string, path: string): string {
  const base = origin.replace(/\/$/, '');
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalized}`;
}

export function getAssociatedDomainFromEnv(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  return value.replace(/^https?:\/\//, '').replace(/\/$/, '');
}
