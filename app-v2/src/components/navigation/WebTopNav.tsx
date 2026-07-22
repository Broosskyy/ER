import { Ionicons } from '@expo/vector-icons';
import { Link, usePathname } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { colorRoles, colors } from '@/design/colors';
import { componentSize } from '@/design/layout';
import { spacing, spacingRoles } from '@/design/spacing';
import { fontSize, textRoles } from '@/design/typography';

type TabIconName = keyof typeof Ionicons.glyphMap;

interface WebNavItem {
  href: '/' | '/search' | '/saved' | '/profile';
  label: string;
  icon: TabIconName;
  iconFocused: TabIconName;
  isActive: (pathname: string) => boolean;
}

const NAV_ITEMS: WebNavItem[] = [
  {
    href: '/',
    label: 'Home',
    icon: 'home-outline',
    iconFocused: 'home',
    isActive: (pathname) => pathname === '/' || pathname === '/index',
  },
  {
    href: '/search',
    label: 'Events',
    icon: 'calendar-outline',
    iconFocused: 'calendar',
    isActive: (pathname) => pathname.startsWith('/search'),
  },
  {
    href: '/saved',
    label: 'Saved',
    icon: 'heart-outline',
    iconFocused: 'heart',
    isActive: (pathname) => pathname.startsWith('/saved'),
  },
  {
    href: '/profile',
    label: 'Profile',
    icon: 'person-outline',
    iconFocused: 'person',
    isActive: (pathname) => pathname.startsWith('/profile'),
  },
];

export function WebTopNav() {
  const pathname = usePathname();

  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        <View style={styles.brandRow}>
          <Ionicons name="diamond" size={componentSize.iconSm} color={colors.primary} />
          <AppText style={styles.brand}>ETERNAL RΛVE</AppText>
        </View>

        <View style={styles.navItems}>
          {NAV_ITEMS.map((item) => {
            const active = item.isActive(pathname);

            return (
              <Link key={item.href} href={item.href} asChild>
                <Pressable
                  accessibilityRole="link"
                  style={({ pressed }) => [
                    styles.navItem,
                    active && styles.navItemActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons
                    name={active ? item.iconFocused : item.icon}
                    size={componentSize.iconSm}
                    color={active ? colorRoles.bottomNavActive : colorRoles.bottomNavInactive}
                  />
                  <AppText style={active ? styles.navLabelActive : styles.navLabel}>
                    {item.label}
                  </AppText>
                </Pressable>
              </Link>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    borderBottomColor: colorRoles.bottomNavBorder,
    backgroundColor: colorRoles.headerBackground,
  },
  inner: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingVertical: spacing.md,
    gap: spacing.lg,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  brand: {
    ...textRoles.sectionTitle,
    fontSize: fontSize.md,
    letterSpacing: 1.5,
  },
  navItems: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
  },
  navItemActive: {
    backgroundColor: colors.surface,
  },
  navLabel: {
    ...textRoles.metadata,
    color: colorRoles.bottomNavInactive,
  },
  navLabelActive: {
    color: colorRoles.bottomNavActive,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
});
