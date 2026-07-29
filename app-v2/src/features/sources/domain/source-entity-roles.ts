/**
 * Business roles describing what kind of entity a source primarily supplies data for.
 * A source may have multiple roles (e.g. club + venue). This is distinct from admin RBAC.
 */
export const SOURCE_ENTITY_ROLES = [
  'club',
  'venue',
  'organizer',
  'festival',
  'artist',
  'ticketing',
  'community',
] as const;

export type SourceEntityRole = (typeof SOURCE_ENTITY_ROLES)[number];

export function isSourceEntityRole(value: unknown): value is SourceEntityRole {
  return typeof value === 'string' && (SOURCE_ENTITY_ROLES as readonly string[]).includes(value);
}

export function parseSourceEntityRoles(value: unknown): SourceEntityRole[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isSourceEntityRole);
}

export function sourceHasEntityRole(roles: readonly SourceEntityRole[], role: SourceEntityRole): boolean {
  return roles.includes(role);
}
