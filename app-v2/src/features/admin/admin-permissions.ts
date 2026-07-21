import {
  hasPermission,
  type AdminPermission,
  type AdminRole,
} from '@/features/import/admin/admin-roles';

export function canAccessAdmin(role: AdminRole | null): boolean {
  return role !== null;
}

export function canViewDashboard(role: AdminRole | null): boolean {
  return canAccessAdmin(role);
}

export function canViewEvents(role: AdminRole | null): boolean {
  return canAccessAdmin(role);
}

export function canEditEvents(role: AdminRole | null): boolean {
  if (!role) {
    return false;
  }

  return role === 'editor' || role === 'admin' || role === 'owner';
}

export function canDeleteEvents(role: AdminRole | null): boolean {
  return canEditEvents(role);
}

export function canPublishEvents(role: AdminRole | null): boolean {
  if (!role) {
    return false;
  }

  return role === 'admin' || role === 'owner';
}

export function canModerateContributorEvents(role: AdminRole | null): boolean {
  return canPublishEvents(role);
}

export function canViewContributorReviewQueue(role: AdminRole | null): boolean {
  return canViewEvents(role);
}

export function canViewImports(role: AdminRole | null): boolean {
  return canAccessAdmin(role);
}

export function canViewSources(role: AdminRole | null): boolean {
  return hasPermission(role, 'sources:read');
}

export function canManageSources(role: AdminRole | null): boolean {
  return hasPermission(role, 'sources:write');
}

export function canViewImportJobs(role: AdminRole | null): boolean {
  return hasPermission(role, 'jobs:read');
}

export function canReviewImports(role: AdminRole | null): boolean {
  return hasPermission(role, 'records:read');
}

export function canResolveImportRecords(role: AdminRole | null): boolean {
  if (!role) {
    return false;
  }

  return (
    hasPermission(role, 'records:approve') ||
    hasPermission(role, 'records:reject') ||
    hasPermission(role, 'records:duplicate')
  );
}

export function canViewLogs(role: AdminRole | null): boolean {
  return hasPermission(role, 'logs:read');
}

export function canViewArtists(role: AdminRole | null): boolean {
  return canAccessAdmin(role);
}

export function canEditArtists(role: AdminRole | null): boolean {
  return canEditEvents(role);
}

export function canCreateArtists(role: AdminRole | null): boolean {
  return canEditArtists(role);
}

export function canArchiveArtists(role: AdminRole | null): boolean {
  return canPublishEvents(role);
}

export function canPublishArtists(role: AdminRole | null): boolean {
  return canPublishEvents(role);
}

export function canVerifyArtists(role: AdminRole | null): boolean {
  return canPublishEvents(role);
}

export function canEditEventLineup(role: AdminRole | null): boolean {
  return canEditEvents(role);
}

export function canDeleteArtists(role: AdminRole | null): boolean {
  return canEditArtists(role);
}

export function canManageAdminSettings(role: AdminRole | null): boolean {
  if (!role) {
    return false;
  }

  return role === 'admin' || role === 'owner';
}

export function canAccessAdminRoute(
  routeKey: import('./admin-route-utils').AdminRouteKey,
  role: AdminRole | null,
): boolean {
  switch (routeKey) {
    case 'dashboard':
      return canViewDashboard(role);
    case 'events':
    case 'event-detail':
      return canViewEvents(role);
    case 'events-review':
    case 'events-review-detail':
      return canViewContributorReviewQueue(role);
    case 'artists':
    case 'artist-detail':
      return canViewArtists(role);
    case 'imports':
      return canViewImports(role);
    case 'sources':
    case 'source-detail':
      return canViewSources(role);
    case 'jobs':
    case 'job-detail':
      return canViewImportJobs(role);
    case 'review':
    case 'review-detail':
      return canReviewImports(role);
    case 'settings':
      return canManageAdminSettings(role);
    default:
      return false;
  }
}

export function listRoutePermissions(role: AdminRole | null): AdminPermission[] {
  if (!role) {
    return [];
  }

  const permissions = new Set<AdminPermission>();
  const candidates: AdminPermission[] = [
    'sources:read',
    'sources:write',
    'sources:test',
    'imports:start',
    'jobs:read',
    'records:read',
    'records:edit',
    'records:approve',
    'records:reject',
    'records:duplicate',
    'logs:read',
    'audit:read',
  ];

  for (const permission of candidates) {
    if (hasPermission(role, permission)) {
      permissions.add(permission);
    }
  }

  return [...permissions];
}
