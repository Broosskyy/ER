import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { AppText } from '@/components/layout/AppText';
import { colorRoles, colors } from '@/design/colors';
import { radiusRoles } from '@/design/radii';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { FilterChip } from '@/features/home/components/FilterChip';
import {
  DATE_RANGE_FILTERS,
  DEFAULT_EVENT_FILTERS,
  SEARCH_GENRE_CHIPS,
  SORT_BY_FILTERS,
  type DateRangeFilter,
  type EventFilters,
  type SearchGenreChipId,
  type SortByFilter,
} from '@/features/search/constants';
import { getBottomTabBarHeight } from '@/platform/tab-bar-insets';

export interface FilterSheetProps {
  visible: boolean;
  initialFilters: EventFilters;
  mode?: 'full' | 'collection';
  activeFilterCount?: number;
  availableCities?: string[];
  onClose: () => void;
  onApply: (filters: EventFilters) => void;
  onReset: () => void;
}

export function FilterSheet({
  visible,
  initialFilters,
  mode = 'full',
  onClose,
  onApply,
  onReset,
  availableCities = ['Köln'],
}: FilterSheetProps) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<EventFilters>(initialFilters);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      setDraft(initialFilters);
    });

    return () => cancelAnimationFrame(frame);
  }, [visible, initialFilters]);

  const dateOptions =
    mode === 'collection'
      ? DATE_RANGE_FILTERS.filter((item) => item.id === 'all-dates')
      : DATE_RANGE_FILTERS;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          {
            paddingBottom: getBottomTabBarHeight(insets) + spacing.md,
          },
        ]}
      >
        <View style={styles.handle} />
        <AppText style={styles.title}>Filters</AppText>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {mode === 'full' ? (
            <View style={styles.section}>
              <AppText style={styles.sectionTitle}>Date</AppText>
              <View style={styles.chipWrap}>
                {dateOptions.map((option) => (
                  <FilterChip
                    key={option.id}
                    label={option.label}
                    selected={draft.dateRange === option.id}
                    onPress={() =>
                      setDraft((current) => ({
                        ...current,
                        dateRange: option.id as DateRangeFilter,
                      }))
                    }
                  />
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <AppText style={styles.sectionTitle}>Genres</AppText>
            <View style={styles.chipWrap}>
              {SEARCH_GENRE_CHIPS.map((chip) => (
                <FilterChip
                  key={chip.id}
                  label={chip.label}
                  selected={draft.genreId === chip.id}
                  onPress={() =>
                    setDraft((current) => ({
                      ...current,
                      genreId: chip.id as SearchGenreChipId,
                    }))
                  }
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <AppText style={styles.sectionTitle}>City</AppText>
            <View style={styles.chipWrap}>
              {availableCities.map((city) => (
                <FilterChip
                  key={city}
                  label={city}
                  selected={draft.city === city}
                  onPress={() => setDraft((current) => ({ ...current, city }))}
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <AppText style={styles.sectionTitle}>Sort by</AppText>
            <View style={styles.chipWrap}>
              {SORT_BY_FILTERS.map((option) => (
                <FilterChip
                  key={option.id}
                  label={option.label}
                  selected={draft.sortBy === option.id}
                  onPress={() =>
                    setDraft((current) => ({
                      ...current,
                      sortBy: option.id as SortByFilter,
                    }))
                  }
                />
              ))}
            </View>
          </View>
        </ScrollView>

        <View style={styles.actions}>
          <PrimaryButton label="Apply Filters" onPress={() => onApply(draft)} />
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              onReset();
              setDraft(DEFAULT_EVENT_FILTERS);
            }}
            style={({ pressed }) => [styles.resetButton, pressed && styles.pressed]}
          >
            <AppText style={styles.resetText}>Reset</AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
          >
            <AppText style={styles.closeText}>Close</AppText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    maxHeight: '82%',
    backgroundColor: colorRoles.screenBackground,
    borderTopLeftRadius: radiusRoles.card,
    borderTopRightRadius: radiusRoles.card,
    paddingTop: spacing.sm,
    paddingHorizontal: spacingRoles.screenHorizontal,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  title: {
    ...textRoles.sectionTitle,
    marginBottom: spacing.md,
  },
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.md,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...textRoles.metadata,
    color: colorRoles.emptyStateDescription,
    fontWeight: '600',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacingRoles.chipGap,
  },
  actions: {
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  resetButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  resetText: {
    ...textRoles.metadata,
    color: colors.primary,
    fontWeight: '600',
  },
  closeButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  closeText: {
    ...textRoles.metadata,
    color: colorRoles.emptyStateDescription,
  },
  pressed: {
    opacity: 0.85,
  },
});
