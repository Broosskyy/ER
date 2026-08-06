import { useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppScreen, ResponsiveScreen } from '@/components';
import { Skeleton } from '@/components/feedback/Skeleton';
import { TextButton } from '@/components/buttons/TextButton';
import { FollowButton } from '@/components/profiles/FollowButton';
import { ProfileHeader } from '@/components/profiles/ProfileHeader';
import { ProfileTabs, type ProfileTab } from '@/components/profiles/ProfileTabs';
import { spacing, spacingRoles } from '@/design/spacing';
import { useScreenBottomInset } from '@/platform/screen-insets';
import type { FollowEntityType } from '@/features/follows/follow-service';
import {
  artistProfileRoute,
  organizerProfileRoute,
  venueProfileRoute,
} from '@/features/profiles/routes/entity-profile-routes';

import { EntityNotFoundState } from './EntityNotFoundState';
import { EntityProfileAboutSection } from './EntityProfileAboutSection';
import { EntityProfileEventsSection } from './EntityProfileEventsSection';
import { navigateBackSafely } from '@/features/navigation/safe-back-navigation';

import { useEntityFollow } from '../hooks/useEntityFollow';
import { useEntityProfile } from '../hooks/useEntityProfile';
import {
  buildEntityProfileAboutContent,
  hasEntityProfileAboutContent,
} from '../utils/entity-profile-about';

const ENTITY_LABELS: Record<FollowEntityType, string> = {
  organizer: 'Veranstalter',
  venue: 'Venue',
  artist: 'Artist',
};

function profileRouteFor(entityType: FollowEntityType, id: string): string {
  if (entityType === 'organizer') return organizerProfileRoute(id);
  if (entityType === 'venue') return venueProfileRoute(id);
  return artistProfileRoute(id);
}

export interface PublicEntityProfileScreenProps {
  entityType: FollowEntityType;
  entityId?: string;
}

export function PublicEntityProfileScreen({
  entityType,
  entityId,
}: PublicEntityProfileScreenProps) {
  const router = useRouter();
  const bottomInset = useScreenBottomInset();
  const [selectedTab, setSelectedTab] = useState<ProfileTab>('events');
  const { state, canonicalId, header, record, events, error, retry } = useEntityProfile(
    entityType,
    entityId,
  );
  const { followState, followerCount, toggle, error: followError } = useEntityFollow({
    entityType,
    entityId: canonicalId ?? entityId,
  });

  const genreLabelsFromHeader = useMemo(() => {
    if (!header || header.type !== 'artist') {
      return [];
    }
    const prefix = 'Artist · ';
    const label = header.handleOrTypeLabel;
    if (!label.startsWith(prefix)) {
      return [];
    }
    return label
      .slice(prefix.length)
      .split(',')
      .map((genre) => genre.trim())
      .filter(Boolean);
  }, [header]);

  const aboutContent = useMemo(() => {
    if (!record) {
      return null;
    }
    return buildEntityProfileAboutContent(entityType, record, genreLabelsFromHeader);
  }, [entityType, genreLabelsFromHeader, record]);

  const showAboutTab = aboutContent ? hasEntityProfileAboutContent(aboutContent) : false;
  const profileTabs: ProfileTab[] = showAboutTab ? ['events', 'about'] : ['events'];
  const activeTab: ProfileTab =
    showAboutTab && selectedTab === 'about' ? 'about' : 'events';

  const profileHeader = useMemo(() => {
    if (!header) {
      return null;
    }
    let merged = header;
    if (followerCount != null) {
      const stats = header.stats?.filter((stat) => stat.id !== 'followers') ?? [];
      merged = {
        ...header,
        stats: [
          { id: 'followers' as const, valueLabel: String(followerCount), label: 'Follower' },
          ...stats,
        ],
      };
    }
    if (showAboutTab) {
      merged = {
        ...merged,
        bio: undefined,
        locationLabel: undefined,
        websiteLabel: undefined,
      };
    }
    return merged;
  }, [followerCount, header, showAboutTab]);

  useEffect(() => {
    if (!entityId || !canonicalId || canonicalId === entityId) {
      return;
    }
    router.replace(profileRouteFor(entityType, canonicalId) as Href);
  }, [canonicalId, entityId, entityType, router]);

  if (state === 'loading') {
    return (
      <AppScreen>
        <View style={styles.loading}>
          <Skeleton shape="card" height={120} />
          <Skeleton shape="card" height={200} />
          <Skeleton shape="card" height={200} />
        </View>
      </AppScreen>
    );
  }

  if (state === 'not_found') {
    return (
      <AppScreen>
        <EntityNotFoundState
          entityLabel={ENTITY_LABELS[entityType]}
          onGoBack={() => navigateBackSafely(router)}
        />
      </AppScreen>
    );
  }

  if (state === 'error' || !header || !events || !profileHeader) {
    return (
      <AppScreen>
        <View style={styles.error}>
          <EntityNotFoundState
            entityLabel={ENTITY_LABELS[entityType]}
            onGoBack={() => navigateBackSafely(router)}
          />
          <TextButton label="Erneut versuchen" onPress={retry} />
          {error ? <TextButton label={error} disabled /> : null}
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomInset + spacing.lg }}
      >
        <ResponsiveScreen style={styles.frame}>
          <View style={styles.content}>
            <TextButton
              label="Zurück"
              onPress={() => navigateBackSafely(router)}
              style={styles.back}
            />
            <ProfileHeader
              profile={profileHeader}
              followAction={
                <FollowButton state={followState} onPress={() => void toggle()} />
              }
            />
            {followError ? (
              <TextButton label={followError} disabled style={styles.followError} />
            ) : null}
            <ProfileTabs
              tabs={profileTabs}
              selectedTab={activeTab}
              onTabPress={setSelectedTab}
            />
            {activeTab === 'events' ? (
              <EntityProfileEventsSection
                events={events}
                onEventPress={(eventId) => router.push(`/event/${eventId}`)}
              />
            ) : null}
            {activeTab === 'about' && aboutContent ? (
              <EntityProfileAboutSection content={aboutContent} />
            ) : null}
          </View>
        </ResponsiveScreen>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 0,
  },
  content: {
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  back: {
    alignSelf: 'flex-start',
    paddingHorizontal: 0,
  },
  loading: {
    padding: spacingRoles.screenHorizontal,
    gap: spacing.md,
  },
  error: {
    gap: spacing.md,
  },
  followError: {
    alignSelf: 'flex-start',
    paddingHorizontal: 0,
  },
});
