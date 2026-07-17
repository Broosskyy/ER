export function parseCoordinate(value: string | number | undefined): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);

  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return parsed;
}

export function isValidLatitude(value: number | undefined): boolean {
  return value !== undefined && value >= -90 && value <= 90;
}

export function isValidLongitude(value: number | undefined): boolean {
  return value !== undefined && value >= -180 && value <= 180;
}

export function hasValidCoordinates(
  latitude: number | undefined,
  longitude: number | undefined,
): latitude is number {
  return isValidLatitude(latitude) && isValidLongitude(longitude);
}
