import { DbLifecycleStatus } from '@/types/database';

export type EventActorRole = 'guest' | 'user' | 'organizer' | 'verified_organizer' | 'moderator' | 'admin';

export interface EventPermissionContext {
  role: EventActorRole;
  userId?: string | null;
  isOwner?: boolean;
  eventStatus?: DbLifecycleStatus;
}

export function canCreateDraft(ctx: EventPermissionContext): boolean {
  return ctx.role === 'organizer' || ctx.role === 'verified_organizer' || ctx.role === 'admin';
}

export function canEditDraft(ctx: EventPermissionContext): boolean {
  if (ctx.role === 'admin' || ctx.role === 'moderator') return true;
  if (!ctx.isOwner) return false;
  return ctx.role === 'organizer' || ctx.role === 'verified_organizer';
}

export function canSubmitEvent(ctx: EventPermissionContext): boolean {
  return ctx.role !== 'guest';
}

export function canReviewEvent(ctx: EventPermissionContext): boolean {
  return ctx.role === 'admin' || ctx.role === 'moderator';
}

export function canPublishEvent(ctx: EventPermissionContext): boolean {
  return ctx.role === 'admin';
}

export function canDeleteDraft(ctx: EventPermissionContext): boolean {
  if (ctx.role === 'admin') return true;
  if (!ctx.isOwner) return false;
  const status = ctx.eventStatus;
  return status === 'draft' || status === 'imported_draft' || status === 'rejected';
}
