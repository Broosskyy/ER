import { isValidHttpUrl } from '@/features/events/formatting/urls';

export interface EventDraftLinkValues {
  websiteUrl?: string;
  instagramUrl?: string;
  facebookUrl?: string;
}

export function appendContributorLinks(
  description: string,
  links: EventDraftLinkValues,
  labels: { website: string; instagram: string; facebook: string },
): string {
  const trimmedDescription = description.trim();
  const linkLines: string[] = [];

  if (links.websiteUrl?.trim()) {
    linkLines.push(`${labels.website}: ${links.websiteUrl.trim()}`);
  }
  if (links.instagramUrl?.trim()) {
    linkLines.push(`${labels.instagram}: ${links.instagramUrl.trim()}`);
  }
  if (links.facebookUrl?.trim()) {
    linkLines.push(`${labels.facebook}: ${links.facebookUrl.trim()}`);
  }

  if (linkLines.length === 0) {
    return trimmedDescription;
  }

  if (!trimmedDescription) {
    return linkLines.join('\n');
  }

  return `${trimmedDescription}\n\n${linkLines.join('\n')}`;
}

export function parseContributorDescription(
  description: string,
  labels: { website: string; instagram: string; facebook: string },
): {
  description: string;
  websiteUrl: string;
  instagramUrl: string;
  facebookUrl: string;
} {
  const lines = description.split('\n');
  const bodyLines: string[] = [];
  let websiteUrl = '';
  let instagramUrl = '';
  let facebookUrl = '';

  for (const line of lines) {
    if (line.startsWith(`${labels.website}: `)) {
      websiteUrl = line.slice(labels.website.length + 2).trim();
      continue;
    }
    if (line.startsWith(`${labels.instagram}: `)) {
      instagramUrl = line.slice(labels.instagram.length + 2).trim();
      continue;
    }
    if (line.startsWith(`${labels.facebook}: `)) {
      facebookUrl = line.slice(labels.facebook.length + 2).trim();
      continue;
    }
    bodyLines.push(line);
  }

  return {
    description: bodyLines.join('\n').trim(),
    websiteUrl,
    instagramUrl,
    facebookUrl,
  };
}

export function normalizeOptionalUrlField(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return isValidHttpUrl(trimmed) ? trimmed : undefined;
}
