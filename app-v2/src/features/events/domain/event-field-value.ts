const EVENT_PLACEHOLDER_TEXT =
  /^(n\/a|na|tba|tbd|none|unknown|unbekannt|—|-|\.)$/i;

export function isMeaningfulEventText(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value.trim()) && !EVENT_PLACEHOLDER_TEXT.test(value.trim());
}

export function meaningfulEventText(value: unknown): string | undefined {
  return isMeaningfulEventText(value) ? value.trim() : undefined;
}

export function hasMeaningfulEventValue(value: unknown): boolean {
  if (typeof value === 'string') {
    return isMeaningfulEventText(value);
  }
  if (Array.isArray(value)) {
    return value.some(hasMeaningfulEventValue);
  }
  return value !== undefined && value !== null;
}

export function hasValidEventCoordinates(
  latitude: number | undefined,
  longitude: number | undefined,
): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude!) <= 90 &&
    Math.abs(longitude!) <= 180 &&
    !(latitude === 0 && longitude === 0)
  );
}
