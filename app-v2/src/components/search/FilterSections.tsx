import { StyleSheet, View, ViewStyle } from 'react-native';

import { CategoryChip } from '@/components/discovery/CategoryChip';
import { FilterChip } from '@/components/discovery/FilterChip';
import { AppText } from '@/components/layout/AppText';
import { Stack } from '@/components/layout/Stack';
import { CitySelector, DistanceChip } from '@/components/map/MapControls';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

import type {
  ArtistFilterViewModel,
  CityFilterViewModel,
  DateFilterViewModel,
  DistanceFilterViewModel,
  GenreFilterViewModel,
  OrganizerFilterViewModel,
  PriceFilterViewModel,
  VenueFilterViewModel,
} from './view-models';

interface FilterSectionProps {
  title: string;
  children: React.ReactNode;
  style?: ViewStyle;
}

function FilterSection({ title, children, style }: FilterSectionProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.section, style]}>
      <AppText role="label" color={theme.colors.textSecondary}>
        {title}
      </AppText>
      {children}
    </View>
  );
}

export interface GenreFilterProps {
  options: GenreFilterViewModel[];
  onToggle?: (id: string) => void;
  style?: ViewStyle;
}

export function GenreFilter({ options, onToggle, style }: GenreFilterProps) {
  return (
    <FilterSection title="Genre" style={style}>
      <View style={styles.chipWrap}>
        {options.map((option) => (
          <CategoryChip
            key={option.id}
            label={option.label}
            selected={option.selected}
            onPress={() => onToggle?.(option.id)}
          />
        ))}
      </View>
    </FilterSection>
  );
}

export interface DateFilterProps {
  options: DateFilterViewModel[];
  onSelect?: (id: DateFilterViewModel['id']) => void;
  style?: ViewStyle;
}

export function DateFilter({ options, onSelect, style }: DateFilterProps) {
  return (
    <FilterSection title="Datum" style={style}>
      <View style={styles.chipWrap}>
        {options.map((option) => (
          <FilterChip
            key={option.id}
            label={option.label}
            selected={option.selected}
            onPress={() => onSelect?.(option.id)}
          />
        ))}
      </View>
    </FilterSection>
  );
}

export interface PriceFilterProps {
  options: PriceFilterViewModel[];
  onToggle?: (id: string) => void;
  style?: ViewStyle;
}

export function PriceFilter({ options, onToggle, style }: PriceFilterProps) {
  return (
    <FilterSection title="Preis" style={style}>
      <View style={styles.chipWrap}>
        {options.map((option) => (
          <FilterChip
            key={option.id}
            label={option.label}
            selected={option.selected}
            onPress={() => onToggle?.(option.id)}
          />
        ))}
      </View>
    </FilterSection>
  );
}

export interface DistanceFilterProps {
  options: DistanceFilterViewModel[];
  onSelect?: (id: string) => void;
  style?: ViewStyle;
}

/** Reuses map `DistanceChip` — no duplicate distance chip implementation. */
export function DistanceFilter({ options, onSelect, style }: DistanceFilterProps) {
  return (
    <FilterSection title="Entfernung" style={style}>
      <View style={styles.chipWrap}>
        {options.map((option) => (
          <DistanceChip
            key={option.id}
            label={option.label}
            selected={option.selected}
            onPress={() => onSelect?.(option.id)}
          />
        ))}
      </View>
    </FilterSection>
  );
}

export interface CityFilterProps {
  options: CityFilterViewModel[];
  onSelect?: (id: string) => void;
  style?: ViewStyle;
}

/** Reuses map `CitySelector` — no duplicate city selector implementation. */
export function CityFilter({ options, onSelect, style }: CityFilterProps) {
  return (
    <FilterSection title="Ort" style={style}>
      <Stack gap="sm">
        {options.map((option) => (
          <CitySelector
            key={option.id}
            cityLabel={option.cityLabel}
            selected={option.selected}
            onPress={() => onSelect?.(option.id)}
          />
        ))}
      </Stack>
    </FilterSection>
  );
}

export interface VenueFilterProps {
  options: VenueFilterViewModel[];
  onToggle?: (id: string) => void;
  style?: ViewStyle;
}

export function VenueFilter({ options, onToggle, style }: VenueFilterProps) {
  return (
    <FilterSection title="Venue" style={style}>
      <View style={styles.chipWrap}>
        {options.map((option) => (
          <CategoryChip
            key={option.id}
            label={option.label}
            selected={option.selected}
            onPress={() => onToggle?.(option.id)}
          />
        ))}
      </View>
    </FilterSection>
  );
}

export interface OrganizerFilterProps {
  options: OrganizerFilterViewModel[];
  onToggle?: (id: string) => void;
  style?: ViewStyle;
}

export function OrganizerFilter({ options, onToggle, style }: OrganizerFilterProps) {
  return (
    <FilterSection title="Veranstalter" style={style}>
      <View style={styles.chipWrap}>
        {options.map((option) => (
          <CategoryChip
            key={option.id}
            label={option.label}
            selected={option.selected}
            onPress={() => onToggle?.(option.id)}
          />
        ))}
      </View>
    </FilterSection>
  );
}

export interface ArtistFilterProps {
  options: ArtistFilterViewModel[];
  onToggle?: (id: string) => void;
  style?: ViewStyle;
}

/**
 * Artist filter chips are not shown in mockups 09, 10, or 13.
 * This minimal chip grid exists for preview/documentation only.
 */
export function ArtistFilter({ options, onToggle, style }: ArtistFilterProps) {
  return (
    <FilterSection title="Artist" style={style}>
      <AppText role="caption">Nicht mockup-belegt — minimale Chip-Darstellung.</AppText>
      <View style={styles.chipWrap}>
        {options.map((option) => (
          <CategoryChip
            key={option.id}
            label={option.label}
            selected={option.selected}
            onPress={() => onToggle?.(option.id)}
          />
        ))}
      </View>
    </FilterSection>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
