import type { Ionicons } from '@expo/vector-icons';

import { buildRegisterHref, CREATE_HUB_RETURN_ROUTE } from '@/features/auth/auth-route-utils';

export { CREATE_HUB_RETURN_ROUTE };

export const CREATE_CONTRIBUTION_OPTION_IDS = [
  'event',
  'organizer',
  'venue',
  'artist',
] as const;

export type CreateContributionOptionId = (typeof CREATE_CONTRIBUTION_OPTION_IDS)[number];
export type CreateOptionId = CreateContributionOptionId | 'account';

export interface CreateOption {
  id: CreateOptionId;
  icon: keyof typeof Ionicons.glyphMap;
  requiresAuth: boolean;
}

export const CREATE_OPTIONS: readonly CreateOption[] = [
  { id: 'event', icon: 'calendar-outline', requiresAuth: true },
  { id: 'organizer', icon: 'people-outline', requiresAuth: true },
  { id: 'venue', icon: 'business-outline', requiresAuth: true },
  { id: 'artist', icon: 'musical-notes-outline', requiresAuth: true },
  { id: 'account', icon: 'person-add-outline', requiresAuth: false },
] as const;

export function isCreateContributionOptionId(
  value: string | undefined,
): value is CreateContributionOptionId {
  return (
    typeof value === 'string' &&
    (CREATE_CONTRIBUTION_OPTION_IDS as readonly string[]).includes(value)
  );
}

export function getCreateContributionRoute(
  optionId: CreateContributionOptionId,
): '/create/event' | `/create/${Exclude<CreateContributionOptionId, 'event'>}` {
  if (optionId === 'event') {
    return '/create/event';
  }

  return `/create/${optionId}`;
}

export function getCreateOptionTargetHref(
  optionId: CreateOptionId,
  isAuthenticated: boolean,
): string | null {
  if (optionId === 'account') {
    return buildRegisterHref(CREATE_HUB_RETURN_ROUTE);
  }

  if (!isAuthenticated) {
    return null;
  }

  return getCreateContributionRoute(optionId);
}

export function shouldPromptCreateAuth(
  optionId: CreateOptionId,
  isAuthenticated: boolean,
): boolean {
  return optionId !== 'account' && !isAuthenticated;
}
