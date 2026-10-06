import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { useTheme } from '@/design/theme';

export type ProfileTab = 'events' | 'posts' | 'saved' | 'about';

export interface ProfileTabsProps {
  tabs: ProfileTab[];
  selectedTab: ProfileTab;
  onTabPress?: (tab: ProfileTab) => void;
  style?: StyleProp<ViewStyle>;
}

const labels: Record<ProfileTab, string> = {
  events: 'Events',
  posts: 'Beiträge',
  saved: 'Gespeichert',
  about: 'Über',
};

/** Navigation-agnostic segmented tabs; mockup 38 currently evidences Events and Über. */
export function ProfileTabs({ tabs, selectedTab, onTabPress, style }: ProfileTabsProps) {
  const { theme } = useTheme();
  return (
    <View style={[styles.tabs, { borderBottomColor: theme.colors.borderSubtle }, style]} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const selected = tab === selectedTab;
        return (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            accessibilityLabel={labels[tab]}
            accessibilityState={{ selected }}
            disabled={!onTabPress}
            onPress={() => onTabPress?.(tab)}
            style={[styles.tab, { borderBottomColor: selected ? theme.colors.accent : 'transparent' }]}
          >
            <AppText role="label" color={selected ? theme.colors.accent : theme.colors.textSecondary}>{labels[tab]}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2 },
});
