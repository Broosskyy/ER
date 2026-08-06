import { useCallback, useEffect, useRef, useState } from 'react';

import { followService } from '@/features/follows/follow-runtime';
import type { FollowState } from '@/components/profiles/view-models';
import type { FollowEntityType } from '@/features/follows/follow-service';

export interface UseEntityFollowInput {
  entityType: FollowEntityType;
  entityId?: string;
}

export interface UseEntityFollowResult {
  followState: FollowState;
  isFollowing: boolean;
  followerCount: number | null;
  toggle: () => Promise<void>;
  error: string | null;
}

export function useEntityFollow({ entityType, entityId }: UseEntityFollowInput): UseEntityFollowResult {
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(Boolean(entityId));
  const [error, setError] = useState<string | null>(null);
  const togglingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      if (!entityId) {
        setIsFollowing(false);
        setFollowerCount(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        await followService.hydrate();
        const [following, count] = await Promise.all([
          followService.isFollowing(entityType, entityId),
          followService.getFollowerCount(entityType, entityId),
        ]);
        if (!cancelled) {
          setIsFollowing(following);
          setFollowerCount(count);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Follow-Status konnte nicht geladen werden.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadStatus();

    return () => {
      cancelled = true;
    };
  }, [entityId, entityType]);

  const toggle = useCallback(async () => {
    if (!entityId || togglingRef.current || loading) {
      return;
    }

    togglingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const currentlyFollowing = await followService.isFollowing(entityType, entityId);
      if (currentlyFollowing) {
        await followService.unfollow(entityType, entityId);
        setIsFollowing(false);
        setFollowerCount((current) => (current == null ? current : Math.max(0, current - 1)));
      } else {
        await followService.follow(entityType, entityId);
        setIsFollowing(true);
        setFollowerCount((current) => (current == null ? 1 : current + 1));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Follow-Aktion fehlgeschlagen.');
    } finally {
      setLoading(false);
      togglingRef.current = false;
    }
  }, [entityId, entityType, loading]);

  const followState: FollowState = !entityId
    ? 'disabled'
    : loading
      ? 'loading'
      : isFollowing
        ? 'following'
        : 'follow';

  return {
    followState,
    isFollowing,
    followerCount,
    toggle,
    error,
  };
}
