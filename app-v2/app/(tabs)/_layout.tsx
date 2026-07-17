import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet } from 'react-native';

import { colorRoles } from '@/design/colors';
import { componentSize, layout } from '@/design/layout';
import { fontSize } from '@/design/typography';

type TabIconName = keyof typeof Ionicons.glyphMap;

function tabIcon(name: TabIconName, focused: boolean) {
  return (
    <Ionicons
      name={name}
      size={componentSize.iconMd}
      color={focused ? colorRoles.bottomNavActive : colorRoles.bottomNavInactive}
    />
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colorRoles.bottomNavActive,
        tabBarInactiveTintColor: colorRoles.bottomNavInactive,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarItemStyle: styles.tabBarItem,
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
    height: layout.bottomNavHeight,
    paddingTop: 6,
    paddingBottom: Platform.select({ ios: 4, android: 6, default: 6 }),
    backgroundColor: colorRoles.bottomNavBackground,
    borderTopColor: colorRoles.bottomNavBorder,
    borderTopWidth: 1,
  },
  tabBarLabel: {
    fontSize: fontSize.xs,
    fontWeight: '500',
    marginTop: 2,
  },
  tabBarItem: {
    paddingVertical: 2,
  },
});
