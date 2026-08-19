import type { EventCandidate, EventCandidateValidation } from '../types/event-candidate';

function isHttpsUrl(value: string | undefined): boolean {
  return typeof value === 'string' && value.startsWith('https://');
}

function hostnameOf(url: string): string | undefined {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

function isTicketProviderOfficialUrl(url: string): boolean {
  const hostname = hostnameOf(url);
  if (!hostname) {
    return false;
  }
  return /(?:^|\.)ticket\.io$|(?:^|\.)fourvenues\.com$|^shop\.paylogic\.com$|ticketkings|eventim\.|(?:^|\.)arep\.co$/i.test(
    hostname,
  );
}

function isGenericOfficialHomepage(url: string): boolean {
  try {
    const path = new URL(url).pathname.replace(/\/+$/, '') || '/';
    return path === '/' || /^\/(?:de|en|events|event)?$/.test(path);
  } catch {
    return false;
  }
}

function isGenericSocialProfile(url: string): boolean {
  try {
    const hostname = hostnameOf(url) ?? '';
    const path = new URL(url).pathname.replace(/\/+$/, '') || '/';
    const segments = path.split('/').filter(Boolean);
    const isInstagram = hostname === 'instagram.com' || hostname.endsWith('.instagram.com');
    const isFacebook = hostname === 'facebook.com' || hostname.endsWith('.facebook.com') || hostname === 'fb.com';
    const isPost =
      segments.includes('p') ||
      segments.includes('reel') ||
      segments.includes('reels') ||
      segments.includes('tv') ||
      path.includes('/posts/') ||
      path.includes('/permalink.php') ||
      segments[0] === 'events';
    if (isPost) {
      return false;
    }
    return (isInstagram || isFacebook) && segments.length === 1;
  } catch {
    return false;
  }
}

function isUnverifiedSocialPost(url: string): boolean {
  try {
    const hostname = hostnameOf(url) ?? '';
    const path = new URL(url).pathname;
    const segments = path.split('/').filter(Boolean);
    const isInstagram = hostname === 'instagram.com' || hostname.endsWith('.instagram.com');
    const isFacebook = hostname === 'facebook.com' || hostname.endsWith('.facebook.com') || hostname === 'fb.com';
    const isPost =
      segments.includes('p') ||
      segments.includes('reel') ||
      segments.includes('reels') ||
      segments.includes('tv') ||
      path.includes('/posts/') ||
      path.includes('/permalink.php') ||
      (isFacebook && segments[0] === 'events');
    return (isInstagram || isFacebook) && isPost;
  } catch {
    return false;
  }
}

export function validateEventCandidate(candidate: EventCandidate): EventCandidateValidation {
  const reasons: string[] = [];

  if (!candidate.title.trim()) {
    reasons.push('missing_title');
  }

  if (!candidate.startsAt || Number.isNaN(Date.parse(candidate.startsAt))) {
    reasons.push('invalid_starts_at');
  }

  if (candidate.endsAt && Date.parse(candidate.endsAt) < Date.parse(candidate.startsAt)) {
    reasons.push('end_before_start');
  }

  if (!candidate.venue?.name?.trim()) {
    reasons.push('missing_venue');
  }

  if (candidate.imageUrl && !isHttpsUrl(candidate.imageUrl)) {
    reasons.push('invalid_image_url');
  }

  if (candidate.origin.kind === 'official_connector') {
    if (!isHttpsUrl(candidate.origin.officialUrl)) {
      reasons.push('official_source_missing');
      reasons.push('missing_official_url');
    } else if (isTicketProviderOfficialUrl(candidate.origin.officialUrl)) {
      reasons.push('official_source_missing');
      reasons.push('ticket_url_used_as_official_source');
    } else if (isGenericOfficialHomepage(candidate.origin.officialUrl)) {
      reasons.push('official_source_missing');
      reasons.push('generic_homepage_used_as_official_source');
    } else if (isGenericSocialProfile(candidate.origin.officialUrl)) {
      reasons.push('official_source_missing');
      reasons.push('generic_social_profile_used_as_official_source');
    } else if (isUnverifiedSocialPost(candidate.origin.officialUrl)) {
      reasons.push('official_source_missing');
      reasons.push('social_post_without_verified_account');
    }
    if (!candidate.origin.sourceEventKey.trim()) {
      reasons.push('missing_source_event_key');
    }
    if (!candidate.origin.pageFingerprint.trim()) {
      reasons.push('missing_fingerprint');
    }
  }

  const lineupNames = new Set<string>();
  for (const act of candidate.lineup) {
    const key = act.billingName.trim().toLowerCase();
    if (lineupNames.has(key)) {
      reasons.push('duplicate_lineup_entry');
    }
    lineupNames.add(key);
  }

  const sortOrders = candidate.lineup.map((act) => act.sortOrder);
  if (new Set(sortOrders).size !== sortOrders.length) {
    reasons.push('duplicate_lineup_sort_order');
  }

  if (reasons.length > 0) {
    return {
      decision: reasons.some((reason) =>
        [
          'missing_title',
          'invalid_starts_at',
          'end_before_start',
          'missing_official_url',
          'official_source_missing',
          'ticket_url_used_as_official_source',
          'generic_homepage_used_as_official_source',
          'generic_social_profile_used_as_official_source',
          'social_post_without_verified_account',
        ].includes(reason),
      )
        ? 'rejected'
        : 'review_required',
      reasons,
    };
  }

  return { decision: 'persist_ready', reasons: [] };
}
