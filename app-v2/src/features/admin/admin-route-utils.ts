import { buildLoginHref, isSafeReturnRoute } from '@/features/auth/auth-route-utils';

const ADMIN_PREFIX = '/admin';

export function isSafeAdminReturnRoute(path: string | null | undefined): path is string {
  if (!path || typeof path !== 'string') {
    return false;
  }

  if (!path.startsWith(ADMIN_PREFIX)) {
    return false;
  }

  if (path.startsWith('/admin/login')) {
    return false;
  }

  if (path.includes('://') || path.startsWith('//')) {
    return false;
  }

  return true;
}

export function buildAdminLoginHref(returnTo?: string | null): string {
  if (isSafeAdminReturnRoute(returnTo)) {
    return buildLoginHref(returnTo);
  }

  return buildLoginHref('/admin');
}

export type AdminRouteKey =
  | 'dashboard'
  | 'events'
  | 'event-detail'
  | 'imports'
  | 'sources'
  | 'source-detail'
  | 'jobs'
  | 'job-detail'
  | 'review'
  | 'review-detail'
  | 'settings';

export function resolveAdminRouteKey(segments: string[]): AdminRouteKey {
  const path = segments.join('/');

  if (path === 'admin' || path === 'admin/index') {
    return 'dashboard';
  }

  if (path.startsWith('admin/events/') && segments.length >= 3) {
    return 'event-detail';
  }

  if (path.startsWith('admin/events')) {
    return 'events';
  }

  if (path.startsWith('admin/imports/sources/') && segments.length >= 4) {
    return 'source-detail';
  }

  if (path.startsWith('admin/imports/sources')) {
    return 'sources';
  }

  if (path.startsWith('admin/imports/jobs/') && segments.length >= 4) {
    return 'job-detail';
  }

  if (path.startsWith('admin/imports/jobs')) {
    return 'jobs';
  }

  if (path.startsWith('admin/imports/review/') && segments.length >= 4) {
    return 'review-detail';
  }

  if (path.startsWith('admin/imports/review')) {
    return 'review';
  }

  if (path.startsWith('admin/imports')) {
    return 'imports';
  }

  if (path.startsWith('admin/settings')) {
    return 'settings';
  }

  return 'dashboard';
}
