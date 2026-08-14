import { StyleSheet, View } from 'react-native';

export function useHomeVenueRailsLayout() {
  return { clubCardWidth: 160 };
}

export function HomeVenueRailsSection(_props: { clubCardWidth: number }) {
  return <View style={styles.hidden} />;
}

const styles = StyleSheet.create({
  hidden: {
    display: 'none',
  },
});
