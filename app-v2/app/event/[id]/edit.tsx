import { useLocalSearchParams } from 'expo-router';

import { ContributorEventFormScreen } from '@/features/create/components/ContributorEventFormScreen';

export default function EditContributorEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id) {
    return null;
  }

  return <ContributorEventFormScreen mode="edit" eventId={id} />;
}
