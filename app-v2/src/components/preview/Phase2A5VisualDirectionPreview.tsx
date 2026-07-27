import { useMemo, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { EventCard } from '@/components/discovery/EventCard';
import { EventListItem } from '@/components/discovery/EventListItem';
import { FilterChip } from '@/components/discovery/FilterChip';
import { SearchBar } from '@/components/inputs/SearchBar';
import { AppText } from '@/components/layout/AppText';
import { Section } from '@/components/layout/Section';
import { Stack } from '@/components/layout/Stack';
import { getEventImageAsset } from '@/features/events/data/demo-images';
import { layout } from '@/design/layout';
import { spacing, spacingRoles } from '@/design/spacing';
import { useTheme } from '@/design/theme';

import {
  HomePreviewBottomNav,
  HomePreviewDesktopNav,
  HomePreviewHeader,
  HomeSectionHeader,
} from './HomePreviewChrome';
import {
  resolveHomeContentMaxWidth,
  resolveHomeFeaturedWidth,
  resolveHomeGridColumns,
  type HomeMasterBreakpoint,
} from './home-master-layout';
import {
  featuredIndustrialRebirth,
  HOME_FILTER_CHIPS,
  HOME_LOCATION_LABEL,
  nearYouEvents,
  tonightListItems,
  weekendEvents,
} from './home-visual-direction-fixtures';
import { PreviewThemeFrame } from './PreviewThemeFrame';

const IMAGE_MAP: Record<string, string> = {
  'industrial-rebirth': 'poster-gebaeude',
  'void-bootshaus': 'void-techno-saturday',
  'odonien-night': 'minimal-warehouse',
  'gewoelbe-session': 'fckng-serious',
  'bootshaus-tonight': 'watergate-nights',
  'berlin-underground': 'no-coords-berlin',
  'void-berlin': 'klangkuenstler-berghain',
  'rhein-open-air': 'poster-rhein',
};

function withPreviewImage<T extends { id: string }>(item: T): T & { image: ReturnType<typeof getEventImageAsset> } {
  return {
    ...item,
    image: getEventImageAsset(item.id, IMAGE_MAP[item.id]),
  };
}

function PreviewDeviceFrame({
  width,
  label,
  children,
}: {
  width?: number;
  label: string;
  children: ReactNode;
}) {
  const { theme } = useTheme();

  return (
    <View style={[styles.deviceFrame, width ? { width, maxWidth: '100%' } : styles.deviceFrameFluid]}>
      <AppText role="caption" color={theme.colors.textSecondary}>
        {label}
      </AppText>
      <View
        style={[
          styles.deviceScreen,
          {
            backgroundColor: theme.colors.background,
            borderColor: theme.colors.borderSubtle,
          },
          width ? { width } : undefined,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

interface HomeMasterContentProps {
  breakpoint: HomeMasterBreakpoint;
  containerWidth: number;
}

function HomeMasterContent({ breakpoint, containerWidth }: HomeMasterContentProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const isDesktop = breakpoint === 'desktop';
  const isTablet = breakpoint === 'tablet';
  const contentMaxWidth = resolveHomeContentMaxWidth(breakpoint);
  const gridColumns = resolveHomeGridColumns(breakpoint);
  const featuredWidth = resolveHomeFeaturedWidth(containerWidth, breakpoint);

  const featured = useMemo(() => withPreviewImage(featuredIndustrialRebirth), []);
  const nearYou = useMemo(() => nearYouEvents.map(withPreviewImage), []);
  const tonight = useMemo(() => tonightListItems.map(withPreviewImage), []);
  const weekend = useMemo(() => weekendEvents.map(withPreviewImage), []);

  const horizontalPadding = isDesktop || isTablet ? spacing.xl : spacingRoles.screenHorizontal;

  return (
    <View style={styles.masterRoot}>
      {isDesktop ? <HomePreviewDesktopNav /> : null}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingHorizontal: horizontalPadding,
            maxWidth: contentMaxWidth,
            alignSelf: isDesktop || isTablet ? 'center' : undefined,
            width: isDesktop || isTablet ? '100%' : undefined,
          },
        ]}
      >
        {!isDesktop ? <HomePreviewHeader locationLabel={HOME_LOCATION_LABEL} /> : null}

        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Events, Clubs, Künstler suchen"
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {HOME_FILTER_CHIPS.map((chip) => (
            <FilterChip
              key={chip.id}
              label={chip.label}
              selected={selectedFilter === chip.id}
              onPress={() => setSelectedFilter(chip.id)}
            />
          ))}
        </ScrollView>

        {isDesktop ? (
          <View style={styles.desktopHeroRow}>
            <View style={[styles.desktopFeatured, { maxWidth: featuredWidth }]}>
              <HomeSectionHeader title="Featured" />
              <EventCard event={featured} variant="featured" onPress={() => undefined} />
            </View>
            <View style={styles.desktopTonight}>
              <HomeSectionHeader title="Heute Abend" />
              <Stack gap="md">
                {tonight.map((item) => (
                  <EventListItem key={item.id} event={item} onPress={() => undefined} />
                ))}
              </Stack>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.featuredSection}>
              <HomeSectionHeader title="Featured" />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.featuredCarousel}
              >
                <View style={{ width: featuredWidth }}>
                  <EventCard event={featured} variant="featured" onPress={() => undefined} />
                </View>
              </ScrollView>
            </View>

            <View style={styles.sectionBlock}>
              <HomeSectionHeader title="Highlights" />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.cardCarousel}
              >
                {nearYou.map((event) => (
                  <View key={event.id} style={{ width: featuredWidth * 0.88 }}>
                    <EventCard event={event} variant="featured" onPress={() => undefined} />
                  </View>
                ))}
              </ScrollView>
            </View>

            <View style={styles.sectionBlock}>
              <HomeSectionHeader title="Heute Abend" />
              <Stack gap="md">
                {tonight.map((item) => (
                  <EventListItem key={item.id} event={item} onPress={() => undefined} />
                ))}
              </Stack>
            </View>
          </>
        )}

        <View style={styles.sectionBlock}>
          <HomeSectionHeader title="Dieses Wochenende" />
          <View style={[styles.eventGrid, { gap: spacingRoles.listItemGap }]}>
            {weekend.map((event) => (
              <View
                key={event.id}
                style={gridColumns > 1 ? { width: `${100 / gridColumns}%` as `${number}%`, paddingHorizontal: spacing.xs } : undefined}
              >
                <EventCard event={event} onPress={() => undefined} />
              </View>
            ))}
          </View>
        </View>

        {!isDesktop ? (
          <View style={styles.sectionBlock}>
            <HomeSectionHeader title="In deiner Nähe" />
            <Stack gap="md">
              {nearYou.map((event) => (
                <EventCard key={event.id} event={event} variant="compact" onPress={() => undefined} />
              ))}
            </Stack>
          </View>
        ) : (
          <View style={styles.sectionBlock}>
            <HomeSectionHeader title="In deiner Nähe" />
            <View style={[styles.eventGrid, { gap: spacingRoles.listItemGap }]}>
              {nearYou.map((event) => (
                <View
                  key={event.id}
                  style={{ width: `${100 / gridColumns}%` as `${number}%`, paddingHorizontal: spacing.xs }}
                >
                  <EventCard event={event} onPress={() => undefined} />
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.sectionBlock}>
          <HomeSectionHeader title="Weitere Events" actionLabel="Alle anzeigen" />
          <Stack gap="md">
            {nearYou.slice(0, 2).map((event) => (
              <EventListItem key={`more-${event.id}`} event={event} onPress={() => undefined} />
            ))}
          </Stack>
        </View>

        {!isDesktop ? <View style={styles.bottomNavSpacer} /> : null}
      </ScrollView>

      {!isDesktop ? <HomePreviewBottomNav /> : null}
    </View>
  );
}

function MobileHomeMaster({ mode }: { mode: 'light' | 'dark' }) {
  return (
    <PreviewThemeFrame mode={mode} label={`Mobile Home ${mode === 'light' ? 'Light' : 'Dark'}`}>
      <PreviewDeviceFrame width={390} label="390 px — Mobile Master">
        <HomeMasterContent breakpoint="mobile" containerWidth={390} />
      </PreviewDeviceFrame>
    </PreviewThemeFrame>
  );
}

function DesktopHomeMaster() {
  return (
    <PreviewThemeFrame mode="light" label="Desktop Home Light">
      <PreviewDeviceFrame label={`${layout.maxContentWidthDesktop}px content · 1280 px frame`}>
        <View style={{ width: '100%', minWidth: 1024 }}>
          <HomeMasterContent breakpoint="desktop" containerWidth={1280} />
        </View>
      </PreviewDeviceFrame>
    </PreviewThemeFrame>
  );
}

export function Phase2A5VisualDirectionPreview() {
  return (
    <Section
      title="Sprint 2A.5 – Visual Direction Lock"
      subtitle="Binding mobile and desktop home masters — preview-only composition, no product migration"
    >
      <AppText role="bodyMuted">
        Reference widths: Mobile 360 / 390 / 430 px · Tablet 768 px · Desktop 1024 / 1440 px. Masters
        below use 390 px (mobile) and 1280 px (desktop) as primary QA frames.
      </AppText>

      <View style={styles.masterRow}>
        <MobileHomeMaster mode="light" />
        <MobileHomeMaster mode="dark" />
      </View>

      <DesktopHomeMaster />
    </Section>
  );
}

const styles = StyleSheet.create({
  masterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    alignItems: 'flex-start',
  },
  deviceFrame: {
    gap: spacing.sm,
  },
  deviceFrameFluid: {
    flex: 1,
    minWidth: 320,
  },
  deviceScreen: {
    overflow: 'hidden',
    borderRadius: 16,
    borderWidth: 1,
  },
  masterRoot: {
    flex: 1,
    minHeight: 640,
  },
  scrollContent: {
    gap: spacingRoles.sectionGap,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  chipRow: {
    gap: spacingRoles.chipGap,
    paddingVertical: spacing.xs,
  },
  featuredSection: {
    gap: spacingRoles.sectionTitleGap,
  },
  featuredCarousel: {
    gap: spacing.md,
    paddingRight: spacing.lg,
  },
  cardCarousel: {
    gap: spacing.md,
    paddingRight: spacing.lg,
  },
  sectionBlock: {
    gap: spacingRoles.sectionTitleGap,
  },
  eventGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  desktopHeroRow: {
    flexDirection: 'row',
    gap: spacing.xl,
    alignItems: 'flex-start',
  },
  desktopFeatured: {
    flex: 1.2,
    gap: spacingRoles.sectionTitleGap,
  },
  desktopTonight: {
    flex: 1,
    gap: spacingRoles.sectionTitleGap,
  },
  bottomNavSpacer: {
    height: spacing.md,
  },
});
