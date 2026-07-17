export const Colors = {
  background: '#0B0B0F',
  surface: '#15151B',
  surfaceElevated: '#1F1F27',
  mapSurface: '#12121A',
  primary: '#7C3AED',
  primaryHighlight: '#A855F7',
  primaryDeep: '#4C1D95',
  textPrimary: '#F5F5F5',
  textSecondary: '#9CA3AF',
  border: '#2A2A35',
  live: '#EF4444',
  success: '#22C55E',
  warning: '#F59E0B',
  white: '#FFFFFF',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  screen: 16,
} as const;

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

/** Font sizes aligned with Band 2 / Mockup type scale */
export const Typography = {
  caption: 10,
  xs: 11,
  sm: 12,
  base: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  display: 30,
} as const;

/** Subtle elevation for cards — use sparingly (premium flat UI) */
export const Shadows = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
} as const;

export const ImageGradients = {
  default: ['#0B0B0F', '#4C1D95'] as const,
  fallback: ['#15151B', '#3B0764', '#7C3AED'] as const,
} as const;

export const AppConfig = {
  name: 'Eternal Rave',
  tagline: 'Discover. Connect. Rave.',
  locationLabel: 'Near you',
  defaultCity: 'Berlin',
} as const;

export const TabRoutes = [
  { name: 'home', label: 'Home', icon: 'home' as const },
  { name: 'search', label: 'Events', icon: 'calendar' as const },
  { name: 'map', label: 'Map', icon: 'map' as const },
  { name: 'favorites', label: 'Saved', icon: 'heart' as const },
  { name: 'profile', label: 'Profile', icon: 'person' as const },
] as const;

export type TabRouteName = (typeof TabRoutes)[number]['name'];

export const DiscoveryCategories = [
  { id: 'all', label: 'All' },
  { id: 'techno', label: 'Techno' },
  { id: 'house', label: 'House' },
  { id: 'hardtechno', label: 'Hard Techno' },
  { id: 'melodic', label: 'Melodic' },
  { id: 'trance', label: 'Trance' },
  { id: 'minimal', label: 'Minimal' },
] as const;

export const HomeCategoryFilters = [
  { id: 'all', label: 'Alle' },
  { id: 'today', label: 'Heute' },
  { id: 'weekend', label: 'Dieses Wochenende' },
  { id: 'techno', label: 'Techno' },
  { id: 'house', label: 'House' },
] as const;

export const EventsCategoryFilters = [
  { id: 'all', label: 'Alle' },
  { id: 'today', label: 'Heute' },
  { id: 'weekend', label: 'Dieses Wochenende' },
  { id: 'techno', label: 'Techno' },
  { id: 'house', label: 'House' },
  { id: 'hardtechno', label: 'Hard Techno' },
] as const;

export const HomeDateFilters = [
  { id: 'today', label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'weekend', label: 'Weekend' },
  { id: 'month', label: 'This Month' },
] as const;

export const GenreFilters = [
  { id: 'all', label: 'All' },
  { id: 'techno', label: 'Techno' },
  { id: 'house', label: 'House' },
  { id: 'hardtechno', label: 'Hard Techno' },
  { id: 'melodic', label: 'Melodic' },
  { id: 'trance', label: 'Trance' },
  { id: 'drumandbass', label: 'DnB' },
  { id: 'psytrance', label: 'Psytrance' },
  { id: 'hardcore', label: 'Hardcore' },
  { id: 'industrial', label: 'Industrial' },
  { id: 'minimal', label: 'Minimal' },
] as const;

export const CityFilters = [
  { id: 'all', label: 'All Cities' },
  { id: 'berlin', label: 'Berlin' },
  { id: 'hamburg', label: 'Hamburg' },
  { id: 'koeln', label: 'Köln' },
  { id: 'frankfurt', label: 'Frankfurt' },
  { id: 'amsterdam', label: 'Amsterdam' },
  { id: 'rotterdam', label: 'Rotterdam' },
  { id: 'vienna', label: 'Vienna' },
  { id: 'zurich', label: 'Zurich' },
  { id: 'prague', label: 'Prague' },
  { id: 'barcelona', label: 'Barcelona' },
  { id: 'london', label: 'London' },
] as const;

export const SearchDateFilters = [
  { id: 'all', label: 'Any Date' },
  { id: 'today', label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'weekend', label: 'Weekend' },
  { id: 'month', label: 'This Month' },
] as const;

export const BOTTOM_NAV_HEIGHT = 64;

/** Import / confidence score UI (Band 4.5) */
export function getImportConfidenceColor(scorePct: number): string {
  if (scorePct >= 85) return Colors.success;
  if (scorePct >= 70) return Colors.warning;
  return Colors.live;
}

/** Duplicate detection confidence bar */
export function getDuplicateConfidenceColor(confidence: number): string {
  const pct = confidence * 100;
  if (pct >= 75) return Colors.live;
  if (pct >= 50) return Colors.warning;
  return Colors.textSecondary;
}
