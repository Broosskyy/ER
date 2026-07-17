import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colorRoles } from '@/design/colors';
import { componentSize, layout } from '@/design/layout';
import { spacing } from '@/design/spacing';
import { fontSize } from '@/design/typography';

type TabIconName = keyof typeof Ionicons.glyphMap;

function tabIcon(name: TabIconName, focused: boolean) {
  return (
    <Ionicons
      name={name}
      size={focused ? componentSize.bottomNavIconSizeActive : componentSize.bottomNavIconSize}
      color={focused ? colorRoles.bottomNavActive : colorRoles.bottomNavInactive}
    />
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const androidBottomPadding = spacing.sm;
  const iosBottomPadding = Math.max(insets.bottom, spacing.sm);
  const tabBarHeight =
    layout.bottomNavHeight + (Platform.OS === 'ios' ? iosBottomPadding : androidBottomPadding);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colorRoles.bottomNavActive,
        tabBarInactiveTintColor: colorRoles.bottomNavInactive,
        tabBarStyle: [
          styles.tabBar,
          {
            height: tabBarHeight,
            paddingBottom: Platform.OS === 'ios' ? iosBottomPadding : androidBottomPadding,
          },
        ],
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarItemStyle: styles.tabBarItem,
        tabBarIconStyle: styles.tabBarIcon,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) =>
            tabIcon(focused ? 'home' : 'home-outline', focused),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Events',
          tabBarIcon: ({ focused }) =>
            tabIcon(focused ? 'calendar' : 'calendar-outline', focused),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: ({ focused }) => tabIcon(focused ? 'map' : 'map-outline', focused),
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: 'Saved',
          tabBarIcon: ({ focused }) => tabIcon(focused ? 'heart' : 'heart-outline', focused),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) =>
            tabIcon(focused ? 'person' : 'person-outline', focused),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    paddingTop: spacing.sm,
    backgroundColor: colorRoles.bottomNavBackground,
    borderTopColor: colorRoles.bottomNavBorder,
    borderTopWidth: 1,
  },
  tabBarLabel: {
    fontSize: fontSize.xs,
    fontWeight: '500',
    marginTop: spacing.xs,
    marginBottom: 0,
  },
  tabBarItem: {
    paddingVertical: 0,
    justifyContent: 'center',
  },
  tabBarIcon: {
    marginBottom: 0,
  },
});
