import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AppText } from '@/components/layout/AppText';
import { colorRoles, colors } from '@/design/colors';
import { componentSize, layout } from '@/design/layout';
import { radiusRoles } from '@/design/radii';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { FilterChip } from '@/features/home/components/FilterChip';
import {
  getActiveCityOptions,
  getActiveDateOptions,
  getActiveGenreOptions,
  getActiveSortOptions,
} from '@/features/search/config/filter-config';
import type { GenreFilterId } from '@/features/search/config/filter-config.types';
import {
  DEFAULT_EVENT_FILTERS,
  type DateRangeFilter,
  type EventFilters,
  type SortByFilter,
} from '@/features/search/constants';

export interface FilterSheetProps {
  visible: boolean;
  appliedFilters: EventFilters;
  mode?: 'full' | 'collection';
  onClose: () => void;
  onApply: (filters: EventFilters) => void;
}

function createDraftDefaults(mode: 'full' | 'collection', appliedFilters: EventFilters): EventFilters {
  if (mode === 'collection') {
    return {
      ...appliedFilters,
      dateRange: 'all-dates',
      query: '',
    };
  }

  return appliedFilters;
}

export function FilterSheet({
  visible,
  appliedFilters,
  mode = 'full',
  onClose,
  onApply,
}: FilterSheetProps) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<EventFilters>(appliedFilters);
  const tabBarInset = Math.max(insets.bottom, spacing.sm);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      setDraft(createDraftDefaults(mode, appliedFilters));
    });

    return () => cancelAnimationFrame(frame);
  }, [visible, appliedFilters, mode]);

  const toggleGenre = useCallback((genreId: GenreFilterId) => {
    setDraft((current) => {
      const isSelected = current.genres.includes(genreId);
      const genres = isSelected
        ? current.genres.filter((id) => id !== genreId)
        : [...current.genres, genreId];

      return { ...current, genres };
    });
  }, []);

  const handleResetDraft = useCallback(() => {
    setDraft({
      ...DEFAULT_EVENT_FILTERS,
      ...(mode === 'collection' ? { dateRange: 'all-dates' as const, query: '' } : {}),
    });
  }, [mode]);

  const handleApply = useCallback(() => {
    onApply(draft);
    onClose();
  }, [draft, onApply, onClose]);

  const dateOptions = getActiveDateOptions();
  const genreOptions = getActiveGenreOptions();
  const cityOptions = getActiveCityOptions();
  const sortOptions = getActiveSortOptions();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          {
            paddingBottom: layout.bottomNavHeight + tabBarInset + spacing.md,
          },
        ]}
      >
        <View style={styles.header}>
          <AppText style={styles.title}>Filters</AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close filters"
            onPress={onClose}
            hitSlop={8}
            style={({ pressed }) => [styles.closeIconButton, pressed && styles.pressed]}
          >
            <Ionicons name="close" size={componentSize.iconMd} color={colors.textPrimary} />
          </Pressable>
        </View>

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
              {genreOptions.map((option) => (
                <FilterChip
                  key={option.id}
                  label={option.label}
                  selected={draft.genres.includes(option.id)}
                  onPress={() => toggleGenre(option.id)}
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <AppText style={styles.sectionTitle}>City</AppText>
            <View style={styles.chipWrap}>
              {cityOptions.map((option) => (
                <FilterChip
                  key={option.id}
                  label={option.label}
                  selected={draft.city === option.value}
                  onPress={() => setDraft((current) => ({ ...current, city: option.value }))}
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <AppText style={styles.sectionTitle}>Sort by</AppText>
            <View style={styles.chipWrap}>
              {sortOptions.map((option) => (
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
          <PrimaryButton label="Apply Filters" onPress={handleApply} />
          <SecondaryButton label="Reset All" onPress={handleResetDraft} />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: {
    ...textRoles.sectionTitle,
  },
  closeIconButton: {
    width: componentSize.iconButtonSize,
    height: componentSize.iconButtonSize,
    alignItems: 'center',
    justifyContent: 'center',
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
  pressed: {
    opacity: 0.85,
  },
});
