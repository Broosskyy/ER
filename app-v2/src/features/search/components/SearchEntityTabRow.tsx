import { StyleSheet, View } from 'react-native';

import { FilterChip } from '@/features/home/components/FilterChip';
import type { SearchEntityTab } from '@/features/search/domain/location-scope';

const TABS: Array<{ id: SearchEntityTab; label: string }> = [
  { id: 'all', label: 'Alle' },
  { id: 'events', label: 'Events' },
  { id: 'artists', label: 'Artists' },
  { id: 'venues', label: 'Clubs' },
  { id: 'organizers', label: 'Veranstalter' },
];

export interface SearchEntityTabRowProps {
  value: SearchEntityTab;
  onChange: (tab: SearchEntityTab) => void;
}

export function SearchEntityTabRow({ value, onChange }: SearchEntityTabRowProps) {
  return (
    <View style={styles.row} testID="search-entity-tabs">
      {TABS.map((tab) => (
        <FilterChip
          key={tab.id}
          label={tab.label}
          selected={value === tab.id}
          onPress={() => onChange(tab.id)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
