export const HOME_HEADER_CONFIG = {
  showsDiamondLogo: false,
  showsCreateButton: true,
  showsNotificationButton: true,
  notificationRequiresAuth: true,
} as const;

export function shouldShowNotificationButton(isAuthenticated: boolean): boolean {
  if (!HOME_HEADER_CONFIG.showsNotificationButton) {
    return false;
  }

  if (HOME_HEADER_CONFIG.notificationRequiresAuth) {
    return isAuthenticated;
  }

  return true;
}
