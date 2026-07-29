import { useRouter, type Href } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppScreen, ResponsiveScreen } from '@/components';
import { Skeleton } from '@/components/feedback/Skeleton';
import { TextButton } from '@/components/buttons/TextButton';
import { FollowButton } from '@/components/profiles/FollowButton';
import { ProfileHeader } from '@/components/profiles/ProfileHeader';
import { ProfileTabs } from '@/components/profiles/ProfileTabs';
import { spacing, spacingRoles } from '@/design/spacing';
import { useScreenBottomInset } from '@/platform/screen-insets';
import type { FollowEntityType } from '@/features/follows/follow-service';
import {
  artistProfileRoute,
  organizerProfileRoute,
  venueProfileRoute,
} from '@/features/profiles/routes/entity-profile-routes';

import { EntityNotFoundState } from './EntityNotFoundState';
import { EntityProfileEventsSection } from './EntityProfileEventsSection';
import { useEntityFollow } from '../hooks/useEntityFollow';
import { useEntityProfile } from '../hooks/useEntityProfile';

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
  const { state, canonicalId, header, events, error, retry } = useEntityProfile(
    entityType,
    entityId,
  );
  const { followState, toggle, error: followError } = useEntityFollow({
    entityType,
    entityId: canonicalId ?? entityId,
  });

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
          onGoBack={() => router.back()}
        />
      </AppScreen>
    );
  }

  if (state === 'error' || !header || !events) {
    return (
      <AppScreen>
        <View style={styles.error}>
          <EntityNotFoundState
            entityLabel={ENTITY_LABELS[entityType]}
            onGoBack={() => router.back()}
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
            <TextButton label="Zurück" onPress={() => router.back()} style={styles.back} />
            <ProfileHeader
              profile={header}
              followAction={
                <FollowButton state={followState} onPress={() => void toggle()} />
              }
            />
            {followError ? (
              <TextButton label={followError} disabled style={styles.followError} />
            ) : null}
            <ProfileTabs tabs={['events', 'about']} selectedTab="events" />
            <EntityProfileEventsSection
              events={events}
              onEventPress={(eventId) => router.push(`/event/${eventId}`)}
            />
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
