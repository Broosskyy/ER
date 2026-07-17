import { ViewStyle } from 'react-native';

/**
 * Eternal Rave elevation tokens — V1 preliminary.
 *
 * Sources:
 * - reference/old-code/src/constants/theme.ts (Shadows)
 * - reference/mockups/screens/65_DesignSystem_Radius_Elevation.jpg
 * - V1 mockups use predominantly flat surfaces; shadows are subtle
 */
export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  /** REVIEW: bottom sheet on 12_Map.jpg — elevation inferred, not precisely measured */
  elevated: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 8,
  },
} as const satisfies Record<string, ViewStyle>;

export type ShadowToken = keyof typeof shadows;
