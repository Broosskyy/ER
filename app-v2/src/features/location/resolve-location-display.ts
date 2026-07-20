import type { UserLocationRecord, UserLocationUiStatus } from '@/features/location/types/user-location';
import { formatUserLocationLabel } from '@/features/location/format-user-location';

export function resolveLocationDisplayLabel(
  status: UserLocationUiStatus,
  location: UserLocationRecord | null,
  locale: string,
  labels: { choose: string; loading: string },
): string {
  if (status === 'loading') {
    return labels.loading;
  }

  const formatted = formatUserLocationLabel(location, locale);
  if (formatted) {
    return formatted;
  }

  return labels.choose;
}
