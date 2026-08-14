import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppScreen, ResponsiveScreen } from '@/components';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { spacingRoles } from '@/design/spacing';

export function HomeFeedContent() {
  const router = useRouter();

  return (
    <AppScreen>
      <ResponsiveScreen style={styles.container}>
        <View style={styles.stateWrap}>
          <EmptyState
            title="Keine Events vorhanden"
            description="Der Event-Core wurde zurückgesetzt. Events erscheinen hier, sobald der neue Datenpfad live ist."
            primaryAction={
              <PrimaryButton label="Suche öffnen" onPress={() => router.push('/(tabs)/search')} />
            }
          />
        </View>
      </ResponsiveScreen>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  stateWrap: {
    flex: 1,
    paddingHorizontal: spacingRoles.screenHorizontal,
    justifyContent: 'center',
  },
});
