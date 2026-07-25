import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WebTopNav } from '@/components/navigation/WebTopNav';
import { useTheme } from '@/design/theme';
import { componentSize } from '@/design/layout';
import { spacing } from '@/design/spacing';
import { fontSize } from '@/design/typography';
import { SearchProvider } from '@/features/search/SearchContext';
import { useResponsiveLayout } from '@/platform/responsive';
import { getBottomTabBarHeight, getBottomTabBarPadding } from '@/platform/tab-bar-insets';

type TabIconName = keyof typeof Ionicons.glyphMap;

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { showWebTopNav } = useResponsiveLayout();
  const { theme } = useTheme();
  const bottomPadding = getBottomTabBarPadding(insets);
  const tabBarHeight = getBottomTabBarHeight(insets);
  const { colorRoles } = theme;

  const tabIcon = (name: TabIconName, focused: boolean) => (
    <Ionicons
      name={name}
      size={focused ? componentSize.bottomNavIconSizeActive : componentSize.bottomNavIconSize}
      color={focused ? colorRoles.bottomNavActive : colorRoles.bottomNavInactive}
    />
  );

  return (
    <SearchProvider>
      <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
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
                    backgroundColor: colorRoles.bottomNavBackground,
                    borderTopColor: colorRoles.bottomNavBorder,
                  },
                ],
            tabBarLabelStyle: styles.tabBarLabel,
            tabBarItemStyle: styles.tabBarItem,
            tabBarIconStyle: styles.tabBarIcon,
            tabBarHideOnKeyboard: true,
            sceneStyle: { backgroundColor: theme.colors.background },
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
              href: null,
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
