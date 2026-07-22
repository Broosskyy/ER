import { Ionicons } from '@expo/vector-icons';
import { Link, usePathname } from 'expo-router';
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AppText } from '@/components/layout/AppText';
import { colorRoles, colors } from '@/design/colors';
import { layout } from '@/design/layout';
import { spacing, spacingRoles } from '@/design/spacing';
import { fontSize, textRoles } from '@/design/typography';
import { useAdminAuth } from '@/features/admin/AdminAuthContext';
import {
  canReviewImports,
  canViewArtists,
  canViewContributorReviewQueue,
  canViewEvents,
  canViewVenues,
  canViewOrganizers,
  canViewImportJobs,
  canViewImports,
  canViewSources,
} from '@/features/admin/admin-permissions';
import { breakpoints } from '@/platform/responsive-layout';

interface AdminNavItem {
  href: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  visible: boolean;
  isActive: (pathname: string) => boolean;
}

function useAdminNavItems() {
  const { role } = useAdminAuth();

  return useMemo<AdminNavItem[]>(
    () => [
      {
        href: '/admin',
        label: 'Dashboard',
        icon: 'grid-outline',
        visible: true,
        isActive: (pathname) => pathname === '/admin' || pathname === '/admin/index',
      },
      {
        href: '/admin/events',
        label: 'Events',
        icon: 'calendar-outline',
        visible: canViewEvents(role),
        isActive: (pathname) =>
          pathname.startsWith('/admin/events') && !pathname.startsWith('/admin/events/review'),
      },
      {
        href: '/admin/events/review',
        label: 'Submissions',
        icon: 'people-outline',
        visible: canViewContributorReviewQueue(role),
        isActive: (pathname) => pathname.startsWith('/admin/events/review'),
      },
      {
        href: '/admin/artists',
        label: 'Artists',
        icon: 'musical-notes-outline',
        visible: canViewArtists(role),
        isActive: (pathname) => pathname.startsWith('/admin/artists'),
      },
      {
        href: '/admin/venues',
        label: 'Venues',
        icon: 'business-outline',
        visible: canViewVenues(role),
        isActive: (pathname) => pathname.startsWith('/admin/venues'),
      },
      {
        href: '/admin/organizers',
        label: 'Organizers',
        icon: 'people-outline',
        visible: canViewOrganizers(role),
        isActive: (pathname) => pathname.startsWith('/admin/organizers'),
      },
      {
        href: '/admin/imports',
        label: 'Imports',
        icon: 'cloud-download-outline',
        visible: canViewImports(role),
        isActive: (pathname) => pathname === '/admin/imports',
      },
      {
        href: '/admin/imports/sources',
        label: 'Sources',
        icon: 'link-outline',
        visible: canViewSources(role),
        isActive: (pathname) => pathname.startsWith('/admin/imports/sources'),
      },
      {
        href: '/admin/imports/jobs',
        label: 'Jobs',
        icon: 'time-outline',
        visible: canViewImportJobs(role),
        isActive: (pathname) => pathname.startsWith('/admin/imports/jobs'),
      },
      {
        href: '/admin/imports/review',
        label: 'Review',
        icon: 'checkmark-done-outline',
        visible: canReviewImports(role),
        isActive: (pathname) => pathname.startsWith('/admin/imports/review'),
      },
    ],
    [role],
  );
}

function NavLinks({
  pathname,
  items,
  onNavigate,
}: {
  pathname: string;
  items: AdminNavItem[];
  onNavigate?: () => void;
}) {
  return (
    <View style={styles.navList}>
      {items
        .filter((item) => item.visible)
        .map((item) => {
          const active = item.isActive(pathname);

          return (
            <Link key={item.href} href={item.href as '/admin'} asChild>
              <Pressable
                accessibilityRole="link"
                accessibilityState={{ selected: active }}
                onPress={onNavigate}
                style={({ pressed }) => [
                  styles.navItem,
                  active && styles.navItemActive,
                  pressed && styles.navItemFocused,
                ]}
              >
                <Ionicons
                  name={item.icon}
                  size={18}
                  color={active ? colors.primary : colorRoles.emptyStateDescription}
                />
                <AppText style={active ? styles.navLabelActive : styles.navLabel}>
                  {item.label}
                </AppText>
              </Pressable>
            </Link>
          );
        })}
    </View>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const { role, user, signOut } = useAdminAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navItems = useAdminNavItems();
  const isDesktop = width >= breakpoints.desktop;
  const isTablet = width >= breakpoints.tablet && width < breakpoints.desktop;

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      closeDrawer();
    }, 0);

    return () => clearTimeout(timeout);
  }, [pathname, closeDrawer]);

  useEffect(() => {
    if (!drawerOpen || Platform.OS !== 'web') {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeDrawer();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeDrawer, drawerOpen]);

  const sidebar = (
    <View style={styles.sidebar}>
      <View style={styles.brandRow}>
        <Ionicons name="diamond" size={20} color={colors.primary} />
        <AppText style={styles.brand}>Eternal Rave Admin</AppText>
      </View>
      <NavLinks pathname={pathname} items={navItems} onNavigate={closeDrawer} />
      <View style={styles.sidebarFooter}>
        <AppText style={styles.userEmail} numberOfLines={1}>
          {user?.email ?? 'Signed in'}
        </AppText>
        <AppText style={styles.userRole}>{role ?? 'unknown'}</AppText>
        <SecondaryButton label="Logout" onPress={signOut} style={styles.logoutButton} />
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      {isDesktop ? sidebar : null}

      <View style={styles.mainColumn}>
        {!isDesktop ? (
          <View style={styles.topBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open admin navigation"
              onPress={() => setDrawerOpen(true)}
              style={styles.menuButton}
            >
              <Ionicons name="menu" size={22} color={colors.textPrimary} />
            </Pressable>
            <AppText style={styles.topBarTitle}>Admin</AppText>
            <Pressable accessibilityRole="button" accessibilityLabel="Logout" onPress={signOut}>
              <Ionicons name="log-out-outline" size={22} color={colors.textPrimary} />
            </Pressable>
          </View>
        ) : null}

        <View
          style={[
            styles.content,
            isDesktop && styles.contentDesktop,
            isTablet && styles.contentTablet,
          ]}
        >
          {children}
        </View>
      </View>

      {!isDesktop ? (
        <Modal visible={drawerOpen} animationType="slide" transparent onRequestClose={closeDrawer}>
          <Pressable style={styles.drawerBackdrop} onPress={closeDrawer} accessibilityLabel="Close navigation" />
          <View style={styles.drawerPanel}>{sidebar}</View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.background,
  },
  sidebar: {
    width: 260,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.md,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  brand: {
    ...textRoles.sectionTitle,
    fontSize: fontSize.md,
  },
  navList: {
    gap: spacing.xs,
    flex: 1,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
  navItemActive: {
    backgroundColor: colors.background,
  },
  navItemFocused: {
    borderWidth: 1,
    borderColor: colors.primary,
  },
  navLabel: {
    ...textRoles.metadata,
    color: colorRoles.emptyStateDescription,
  },
  navLabelActive: {
    ...textRoles.metadata,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  sidebarFooter: {
    gap: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  userEmail: {
    ...textRoles.metadata,
    color: colors.textPrimary,
  },
  userRole: {
    ...textRoles.metadata,
    color: colorRoles.emptyStateDescription,
    textTransform: 'capitalize',
  },
  logoutButton: {
    marginTop: spacing.sm,
  },
  mainColumn: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: 56,
  },
  topBarTitle: {
    ...textRoles.sectionTitle,
  },
  menuButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    padding: spacingRoles.screenHorizontal,
    gap: spacing.lg,
  },
  contentDesktop: {
    maxWidth: layout.maxContentWidthDesktop,
    alignSelf: 'center',
    width: '100%',
  },
  contentTablet: {
    maxWidth: layout.maxContentWidthTablet,
    alignSelf: 'center',
    width: '100%',
  },
  drawerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  drawerPanel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 280,
    backgroundColor: colors.surface,
    paddingTop: spacing.lg,
  },
});
