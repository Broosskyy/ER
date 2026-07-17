import { Href } from 'expo-router';

/** Fallback when the stack has no back history. */
export const NavigationFallbacks = {
  home: '/home' as Href,
  profile: '/profile' as Href,
  organizer: '/organizer' as Href,
  admin: '/admin' as Href,
  adminImport: '/admin/import' as Href,
  adminReview: '/admin/review-events' as Href,
} as const;

export const StackTransition = {
  /** Push-style screens (detail, forms, dashboards). */
  push: {
    animation: 'slide_from_right' as const,
    animationDuration: 220,
  },
  /** Lighter overlay-style screens (auth). */
  modal: {
    animation: 'fade_from_bottom' as const,
    animationDuration: 240,
  },
  /** Tab root — no stack animation. */
  none: {
    animation: 'none' as const,
  },
};
