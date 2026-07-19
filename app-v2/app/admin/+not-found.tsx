import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { AppText } from '@/components/layout/AppText';
import { textRoles } from '@/design/typography';

export default function AdminNotFoundScreen() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
      <AppText style={textRoles.sectionTitle}>Admin page not found</AppText>
      <AppText style={textRoles.metadata}>This admin route does not exist.</AppText>
      <PrimaryButton label="Back to dashboard" onPress={() => router.replace('/admin')} />
    </View>
  );
}
