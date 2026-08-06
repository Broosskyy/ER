export type AccountCapabilityRole = 'guest' | 'user' | 'admin' | 'owner';

export interface AccountCapabilityInput {
  isAuthenticated: boolean;
  email?: string | null;
  role?: string | null;
  displayName?: string | null;
  username?: string | null;
  hasLinkedOrganizerProfile: boolean;
}

export interface AccountCapabilities {
  role: AccountCapabilityRole;
  isAuthenticated: boolean;
  isPlatformAdmin: boolean;
  isPlatformOwner: boolean;
  canManageOrganizerProfile: boolean;
  displayName: string;
  handleOrTypeLabel: string;
}

const ADMIN_ROLES = new Set(['admin', 'owner', 'editor']);

function resolveRole(input: AccountCapabilityInput): AccountCapabilityRole {
  if (!input.isAuthenticated) {
    return 'guest';
  }

  const role = input.role?.toLowerCase();
  if (role === 'owner') {
    return 'owner';
  }
  if (role === 'admin' || role === 'editor') {
    return 'admin';
  }
  return 'user';
}

/**
 * Resolve truthful profile-tab capabilities from auth session + modeled links only.
 * Does not invent Club Owner / verification states.
 */
export function resolveAccountCapabilities(input: AccountCapabilityInput): AccountCapabilities {
  const role = resolveRole(input);
  const isPlatformOwner = role === 'owner';
  const isPlatformAdmin = isPlatformOwner || ADMIN_ROLES.has(input.role?.toLowerCase() ?? '');

  const emailLocal = input.email?.split('@')[0]?.trim();
  const displayName =
    input.displayName?.trim() && input.displayName.trim() !== 'Rave Guest'
      ? input.displayName.trim()
      : emailLocal || (isPlatformOwner ? 'Platform Owner' : isPlatformAdmin ? 'Admin' : 'Eternal Rave');

  const handleOrTypeLabel = !input.isAuthenticated
    ? 'Gast'
    : isPlatformOwner
      ? 'Platform Owner'
      : isPlatformAdmin
        ? 'Admin'
        : input.username?.trim()
          ? `@${input.username.trim()}`
          : input.email?.trim() || 'Eternal Rave';

  return {
    role,
    isAuthenticated: input.isAuthenticated,
    isPlatformAdmin,
    isPlatformOwner,
    canManageOrganizerProfile: input.isAuthenticated && input.hasLinkedOrganizerProfile,
    displayName,
    handleOrTypeLabel,
  };
}
