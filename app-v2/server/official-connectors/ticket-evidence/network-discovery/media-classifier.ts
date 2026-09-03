import type { TicketIoMediaRole } from './types';

export function classifyTicketIoMediaUrl(url: string, context?: { title?: string }): TicketIoMediaRole {
  const lower = url.toLowerCase();
  const title = (context?.title ?? '').toLowerCase();

  if (/\/companies\/[^/]+\/events\/[^/]+\/img\//i.test(url)) {
    if (/lineup|line-up|timetable|schedule/i.test(lower) || /lineup|line-up/i.test(title)) {
      return 'lineup_flyer';
    }
    return 'event_flyer';
  }

  if (/hero|cover|banner|header/i.test(lower)) {
    return 'event_hero';
  }

  if (/announcement|teaser|presale|vorverkauf/i.test(lower)) {
    return 'announcement_flyer';
  }

  if (/logo|brand|company/i.test(lower)) {
    return 'organizer_branding';
  }

  if (/\/(?:ticket|shop|product)\b/i.test(lower)) {
    return 'ticket_marketing';
  }

  if (/placeholder|spacer|icon|sprite|decoration/i.test(lower)) {
    return 'decorative';
  }

  if (/cdn\.ticket\.io/i.test(url)) {
    return 'event_flyer';
  }

  return 'unknown';
}

export function classifyMediaUrls(urls: string[], context?: { title?: string }): TicketIoMediaRole[] {
  return [...new Set(urls.map((url) => classifyTicketIoMediaUrl(url, context)))];
}

export function mediaQualityScore(roles: TicketIoMediaRole[]): number {
  let score = 0;
  if (roles.includes('lineup_flyer')) score += 3;
  if (roles.includes('event_flyer')) score += 2;
  if (roles.includes('event_hero')) score += 2;
  if (roles.includes('announcement_flyer')) score += 1;
  if (roles.includes('organizer_branding')) score -= 1;
  if (roles.includes('decorative')) score -= 1;
  if (roles.includes('generic_shop_image')) score -= 1;
  return Math.max(0, score);
}
