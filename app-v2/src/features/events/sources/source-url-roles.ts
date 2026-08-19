export type ConsumerSourceUrlRole =
  | 'eventSourceUrl'
  | 'officialEventUrl'
  | 'organizerSocialUrl'
  | 'venueSocialUrl'
  | 'ticketUrl'
  | 'sourceImageUrl';

export type ClassifiedUrlKind =
  | 'ticket'
  | 'social_post'
  | 'social_profile'
  | 'generic_homepage'
  | 'event_detail_page'
  | 'unknown';

export type SocialPlatform = 'instagram' | 'facebook' | 'tiktok' | 'x';

const TICKET_PROVIDER_HOST_PATTERN =
  /(?:^|\.)ticket\.io$|(?:^|\.)fourvenues\.com$|^shop\.paylogic\.com$|ticketkings|eventim\.|(?:^|\.)arep\.co$/i;

const GENERIC_PATH_PATTERN = /^\/(?:(?:de|en|events|event)\/?)?$/i;

const INSTAGRAM_POST_SEGMENTS = new Set(['p', 'reel', 'reels', 'tv']);
const INSTAGRAM_RESERVED = new Set([
  ...INSTAGRAM_POST_SEGMENTS,
  'stories',
  'explore',
  'accounts',
  'direct',
  'about',
  'legal',
]);
const FACEBOOK_POST_MARKERS = ['/posts/', '/permalink.php', '/photo.php', '/videos/', '/watch/'];
const FACEBOOK_RESERVED = new Set(['events', 'watch', 'photo.php', 'permalink.php', 'pages', 'groups', 'login']);

export function hostnameOf(url: string): string | undefined {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

export function isHttpsUrl(url: string | null | undefined): url is string {
  return typeof url === 'string' && url.startsWith('https://');
}

export function isTicketProviderUrl(url: string | null | undefined): boolean {
  if (!isHttpsUrl(url)) {
    return false;
  }
  const hostname = hostnameOf(url);
  return Boolean(hostname && TICKET_PROVIDER_HOST_PATTERN.test(hostname));
}

export function isGenericHomepageUrl(url: string | null | undefined): boolean {
  if (!isHttpsUrl(url)) {
    return false;
  }
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/+$/, '') || '/';
    return path === '/' || GENERIC_PATH_PATTERN.test(`${path}/`);
  } catch {
    return false;
  }
}

export function socialPlatformOf(url: string): SocialPlatform | undefined {
  const hostname = hostnameOf(url)?.replace(/^www\./, '') ?? '';
  if (hostname === 'instagram.com' || hostname.endsWith('.instagram.com')) {
    return 'instagram';
  }
  if (hostname === 'facebook.com' || hostname.endsWith('.facebook.com') || hostname === 'fb.com' || hostname.endsWith('.fb.com')) {
    return 'facebook';
  }
  if (hostname === 'tiktok.com' || hostname.endsWith('.tiktok.com')) {
    return 'tiktok';
  }
  if (hostname === 'x.com' || hostname === 'twitter.com' || hostname.endsWith('.x.com') || hostname.endsWith('.twitter.com')) {
    return 'x';
  }
  return undefined;
}

function pathSegments(url: string): string[] {
  try {
    return new URL(url).pathname.split('/').filter(Boolean);
  } catch {
    return [];
  }
}

export function normalizeSocialHandle(handle: string | null | undefined): string | undefined {
  const normalized = handle?.trim().replace(/^@/, '').replace(/\/+$/, '').toLowerCase();
  return normalized || undefined;
}

export function extractSocialHandle(url: string): string | undefined {
  const platform = socialPlatformOf(url);
  const segments = pathSegments(url);
  if (!platform || segments.length === 0) {
    return undefined;
  }
  if (platform === 'instagram') {
    if (INSTAGRAM_POST_SEGMENTS.has(segments[0] ?? '')) {
      return undefined;
    }
    if (segments[0] && !INSTAGRAM_RESERVED.has(segments[0])) {
      return normalizeSocialHandle(segments[0]);
    }
  }
  if (platform === 'facebook') {
    if (segments[0] === 'events' || FACEBOOK_RESERVED.has(segments[0] ?? '')) {
      return undefined;
    }
    return normalizeSocialHandle(segments[0]);
  }
  if (platform === 'tiktok' || platform === 'x') {
    const handle = segments[0]?.startsWith('@') ? segments[0] : segments[0];
    if (handle && !['video', 'status', 'i', 'intent'].includes(handle.toLowerCase())) {
      return normalizeSocialHandle(handle);
    }
  }
  return undefined;
}

export function isSocialPostUrl(url: string | null | undefined): boolean {
  if (!isHttpsUrl(url) || !socialPlatformOf(url)) {
    return false;
  }
  const segments = pathSegments(url);
  const platform = socialPlatformOf(url);
  if (platform === 'instagram') {
    return (
      INSTAGRAM_POST_SEGMENTS.has(segments[0] ?? '') ||
      INSTAGRAM_POST_SEGMENTS.has(segments[1] ?? '')
    );
  }
  if (platform === 'facebook') {
    const href = url.toLowerCase();
    return FACEBOOK_POST_MARKERS.some((marker) => href.includes(marker)) || segments[0] === 'events';
  }
  if (platform === 'tiktok') {
    return segments.includes('video');
  }
  if (platform === 'x') {
    return segments.includes('status');
  }
  return false;
}

export function isSocialProfileUrl(url: string | null | undefined): boolean {
  if (!isHttpsUrl(url) || !socialPlatformOf(url) || isSocialPostUrl(url)) {
    return false;
  }
  return Boolean(extractSocialHandle(url));
}

export function classifyUrlKind(url: string | null | undefined): ClassifiedUrlKind {
  if (!isHttpsUrl(url)) {
    return 'unknown';
  }
  if (isTicketProviderUrl(url)) {
    return 'ticket';
  }
  if (isSocialPostUrl(url)) {
    return 'social_post';
  }
  if (isSocialProfileUrl(url)) {
    return 'social_profile';
  }
  if (isGenericHomepageUrl(url)) {
    return 'generic_homepage';
  }
  return 'event_detail_page';
}

export function websiteOriginUrl(url: string): string | undefined {
  if (!isHttpsUrl(url) || socialPlatformOf(url) || isTicketProviderUrl(url)) {
    return undefined;
  }
  try {
    return `${new URL(url).origin}/`;
  } catch {
    return undefined;
  }
}

function titleCaseToken(value: string): string {
  if (!value) {
    return '';
  }
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

export function officialSourceBrand(url: string, organizerName?: string | null): string {
  if (socialPlatformOf(url)) {
    const handle = extractSocialHandle(url);
    if (handle) {
      return titleCaseToken(handle);
    }
    const organizer = organizerName?.replace(/\s+/g, ' ').trim();
    return organizer ? titleCaseToken(organizer.toLowerCase()) : '';
  }
  const hostname = hostnameOf(url)?.replace(/^www\./, '') ?? '';
  const siteLabel = hostname.split('.')[0] ?? '';
  return titleCaseToken(siteLabel);
}

export function officialEventSourceLabel(url: string, organizerName?: string | null): string {
  const brand = officialSourceBrand(url, organizerName);
  return brand ? `Offizielle Eventseite von ${brand}` : 'Offizielle Eventseite';
}

export function officialSocialPostSourceLabel(url: string, organizerName?: string | null): string {
  const platform = socialPlatformOf(url);
  const brand = officialSourceBrand(url, organizerName);
  if (platform === 'instagram') {
    return brand ? `Offizieller Instagram-Beitrag von ${brand}` : 'Offizieller Instagram-Beitrag';
  }
  if (platform === 'facebook') {
    return brand ? `Offizieller Facebook-Beitrag von ${brand}` : 'Offizieller Facebook-Beitrag';
  }
  return brand ? `Offizieller Social-Media-Beitrag von ${brand}` : 'Offizieller Social-Media-Beitrag';
}

export function organizerWebsiteLabel(): string {
  return 'Website';
}

export function socialProfileLabel(url: string): string {
  const platform = socialPlatformOf(url);
  if (platform === 'instagram') {
    return 'Instagram';
  }
  if (platform === 'facebook') {
    return 'Facebook';
  }
  if (platform === 'tiktok') {
    return 'TikTok';
  }
  if (platform === 'x') {
    return 'X';
  }
  return 'Profil';
}

export function handlesMatchExactly(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = normalizeSocialHandle(left);
  const b = normalizeSocialHandle(right);
  return Boolean(a && b && a === b);
}
