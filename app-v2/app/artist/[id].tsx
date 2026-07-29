import { useLocalSearchParams } from 'expo-router';

import { PublicEntityProfileScreen } from '@/features/profiles/components/PublicEntityProfileScreen';

export default function ArtistPublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const entityId = Array.isArray(id) ? id[0] : id;

  return <PublicEntityProfileScreen entityType="artist" entityId={entityId} />;
}
