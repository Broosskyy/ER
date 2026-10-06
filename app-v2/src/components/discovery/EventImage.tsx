import { ReactNode, useState } from 'react';
import { Image, ImageSourcePropType, StyleSheet, View, ViewStyle } from 'react-native';

import { AppIcon } from '@/components/primitives/AppIcon';
import { useTheme } from '@/design/theme';
import { componentSize } from '@/design/layout';

export type EventImageVariant =
  | 'list'
  | 'featured'
  | 'featuredHome'
  | 'compact'
  | 'compactPremium'
  | 'verticalPremium'
  | 'hero'
  | 'spotlight';

export interface EventImageProps {
  source?: ImageSourcePropType;
  variant?: EventImageVariant;
  overlay?: ReactNode;
  style?: ViewStyle;
  testID?: string;
}

/**
 * Shared event image treatment with mockup-backed list, featured, and compact ratios.
 */
export function EventImage({
  source,
  variant = 'list',
  overlay,
  style,
  testID,
}: EventImageProps) {
  const { theme } = useTheme();
  const [hasError, setHasError] = useState(false);
  const hasSource = Boolean(source) && !hasError;

  return (
    <View
      testID={testID}
      style={[
        styles.container,
        getVariantStyle(variant),
        {
          backgroundColor: theme.colors.surfaceElevated,
          borderRadius: theme.radiusRoles.eventThumbnail,
        },
        style,
      ]}
    >
      {hasSource ? (
        <Image
          source={source}
          style={styles.image}
          resizeMode="cover"
          onError={() => setHasError(true)}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <AppIcon name="image-outline" size="lg" colorRole="muted" />
      )}
      {overlay}
    </View>
  );
}

function getVariantStyle(variant: EventImageVariant): ViewStyle {
  switch (variant) {
    case 'featured':
      return {
        width: '100%',
        aspectRatio: componentSize.featuredHeroAspectRatio,
      };
    case 'featuredHome':
      return {
        width: '100%',
        aspectRatio: componentSize.featuredHomeAspectRatio,
      };
    case 'spotlight':
      return {
        width: '100%',
        aspectRatio: componentSize.venueSpotlightAspectRatio,
      };
    case 'hero':
      return {
        width: '100%',
        aspectRatio: componentSize.eventDetailHeroAspectRatio,
      };
    case 'compact':
      return {
        width: componentSize.discoveryCompactThumbnailSize,
        height: componentSize.discoveryCompactThumbnailSize,
      };
    case 'compactPremium':
      return {
        width: componentSize.compactPremiumThumbnailSize,
        height: componentSize.compactPremiumThumbnailSize,
      };
    case 'verticalPremium':
      return {
        width: '100%',
        aspectRatio: componentSize.verticalPremiumAspectRatio,
      };
    case 'list':
    default:
      return {
        width: componentSize.eventListThumbnailWidth,
        aspectRatio: componentSize.discoveryListThumbnailAspectRatio,
      };
  }
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
});
