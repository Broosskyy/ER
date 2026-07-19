import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WebTopNav } from '@/components/navigation/WebTopNav';
import { colorRoles } from '@/design/colors';
import { componentSize } from '@/design/layout';
import { spacing } from '@/design/spacing';
import { fontSize } from '@/design/typography';
import { SearchProvider } from '@/features/search/SearchContext';
import { useResponsiveLayout } from '@/platform/responsive';
import { getBottomTabBarHeight, getBottomTabBarPadding } from '@/platform/tab-bar-insets';

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
  const { showWebTopNav } = useResponsiveLayout();
  const bottomPadding = getBottomTabBarPadding(insets);
  const tabBarHeight = getBottomTabBarHeight(insets);

  return (
    <SearchProvider>
      <View style={styles.root}>
        {showWebTopNav ? <WebTopNav /> : null}
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: colorRoles.bottomNavActive,
            tabBarInactiveTintColor: colorRoles.bottomNavInactive,
            tabBarStyle: showWebTopNav
              ? styles.hiddenTabBar
              : [
                  styles.tabBar,
                  {
                    height: tabBarHeight,
                    paddingBottom: bottomPadding,
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
      </View>
    </SearchProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  hiddenTabBar: {
    display: 'none',
  },
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
