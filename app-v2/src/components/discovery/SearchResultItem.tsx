import { StyleProp, ViewStyle } from 'react-native';

import { EventListItem } from './EventListItem';
import type { SearchResultItemViewModel } from './view-models';

export interface SearchResultItemProps {
  result: SearchResultItemViewModel;
  saved?: boolean;
  onPress?: () => void;
  onFavoritePress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Event-only search result UI. Current search mockups do not define layouts for
 * venue, organizer, or artist results.
 */
export function SearchResultItem({
  result,
  saved,
  onPress,
  onFavoritePress,
  style,
  testID,
}: SearchResultItemProps) {
  return (
    <EventListItem
      event={result}
      saved={saved}
      onPress={onPress}
      onFavoritePress={onFavoritePress}
      style={style}
      testID={testID}
    />
  );
}
