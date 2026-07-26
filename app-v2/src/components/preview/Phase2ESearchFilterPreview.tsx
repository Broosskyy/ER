import { useState } from 'react';
import { View } from 'react-native';

import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { SearchBar } from '@/components/inputs/SearchBar';
import { Section } from '@/components/layout/Section';
import { Stack } from '@/components/layout/Stack';
import { ActiveFilterBar } from '@/components/search/ActiveFilterBar';
import { FilterBottomSheet } from '@/components/search/FilterBottomSheet';
import {
  ArtistFilter,
  CityFilter,
  DateFilter,
  DistanceFilter,
  GenreFilter,
  OrganizerFilter,
  PriceFilter,
  VenueFilter,
} from '@/components/search/FilterSections';
import {
  RecentSearchItem,
  SearchSectionHeader,
  SearchSuggestionItem,
  TrendingSearchItem,
} from '@/components/search/SearchItems';
import { SearchResultGroup } from '@/components/search/SearchResultGroup';
import { NoResultsState, SearchErrorState, SearchLoadingState } from '@/components/search/SearchStates';
import { SortSelector } from '@/components/search/SortSelector';

import {
  previewActiveFilters,
  previewArtistFilters,
  previewCityFilters,
  previewDateFilters,
  previewDistanceFilters,
  previewEventGroup,
  previewEventResults,
  previewGenreFilters,
  previewOrganizerFilters,
  previewPriceFilters,
  previewRecentSearches,
  previewSortOptions,
  previewSuggestions,
  previewTrendingSearches,
  previewVenueFilters,
} from './phase-2e-fixtures';
import { PreviewThemeFrame } from './PreviewThemeFrame';

function SearchInputShowcase() {
  const [query, setQuery] = useState('Techno');

  return (
    <Stack gap="md">
      <SearchBar placeholder="Suche nach Events, Clubs, Künstlern..." />
      <SearchBar
        value={query}
        onChangeText={setQuery}
        onClear={() => setQuery('')}
        placeholder="Suche nach Events, Clubs, Künstlern..."
      />
      <SearchBar value="Berlin" loading placeholder="Suche nach Events, Clubs, Künstlern..." />
      <SearchBar value="" disabled placeholder="Suche nach Events, Clubs, Künstlern..." />
    </Stack>
  );
}

function SuggestionsShowcase() {
  return (
    <Stack gap="md">
      <SearchSectionHeader title="Vorschläge" actionLabel="Alle löschen" onActionPress={() => undefined} />
      {previewSuggestions.map((suggestion) => (
        <SearchSuggestionItem key={suggestion.id} suggestion={suggestion} onPress={() => undefined} />
      ))}
    </Stack>
  );
}

function RecentTrendingShowcase() {
  return (
    <Stack gap="lg">
      <Stack gap="sm">
        <SearchSectionHeader title="Zuletzt gesucht" />
        {previewRecentSearches.map((item) => (
          <RecentSearchItem
            key={item.id}
            item={item}
            onPress={() => undefined}
            onRemove={() => undefined}
          />
        ))}
      </Stack>
      <Stack gap="sm">
        <SearchSectionHeader title="Trending" count={previewTrendingSearches.length} />
        {previewTrendingSearches.map((item) => (
          <TrendingSearchItem key={item.id} item={item} onPress={() => undefined} />
        ))}
      </Stack>
    </Stack>
  );
}

function FilterShowcase() {
  const [sheetVisible, setSheetVisible] = useState(false);

  return (
    <Stack gap="md">
      <SecondaryButton label="Filter öffnen" onPress={() => setSheetVisible(true)} />
      <GenreFilter options={previewGenreFilters} />
      <DateFilter options={previewDateFilters} />
      <PriceFilter options={previewPriceFilters} />
      <DistanceFilter options={previewDistanceFilters} />
      <CityFilter options={previewCityFilters} />
      <VenueFilter options={previewVenueFilters} />
      <OrganizerFilter options={previewOrganizerFilters} />
      <ArtistFilter options={previewArtistFilters} />
      <SortSelector options={previewSortOptions} />
      <ActiveFilterBar filters={previewActiveFilters} onRemove={() => undefined} />
      <FilterBottomSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onApply={() => setSheetVisible(false)}
        onReset={() => setSheetVisible(false)}
      >
        <GenreFilter options={previewGenreFilters} />
        <DateFilter options={previewDateFilters} />
        <PriceFilter options={previewPriceFilters} />
        <DistanceFilter options={previewDistanceFilters} />
        <CityFilter options={previewCityFilters} />
      </FilterBottomSheet>
    </Stack>
  );
}

function ResultsShowcase() {
  return (
    <Stack gap="lg">
      <SearchResultGroup group={previewEventGroup} events={previewEventResults} />
      <NoResultsState primaryAction={<SecondaryButton label="Filter zurücksetzen" onPress={() => undefined} />} />
      <SearchLoadingState />
      <SearchErrorState onAction={() => undefined} onDismiss={() => undefined} />
    </Stack>
  );
}

function Phase2EShowcase() {
  return (
    <Stack gap="xl">
      <Section title="Search">
        <SearchInputShowcase />
      </Section>
      <Section title="Suggestions, Recent & Trending">
        <SuggestionsShowcase />
        <RecentTrendingShowcase />
      </Section>
      <Section title="Filter & Sort">
        <FilterShowcase />
      </Section>
      <Section title="Results & States">
        <ResultsShowcase />
      </Section>
    </Stack>
  );
}

export function Phase2ESearchFilterPreview() {
  return (
    <Section
      title="Sprint 2A Phase 2E – Search & Filter Components"
      subtitle="UI-only search and filter presentation — no search logic, API, or persistence"
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        <PreviewThemeFrame mode="light" label="Light">
          <Phase2EShowcase />
        </PreviewThemeFrame>
        <PreviewThemeFrame mode="dark" label="Dark">
          <Phase2EShowcase />
        </PreviewThemeFrame>
      </View>
    </Section>
  );
}
