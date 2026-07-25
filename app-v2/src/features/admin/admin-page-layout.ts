import { Platform, StyleSheet } from 'react-native';

import { spacing } from '@/design/spacing';

/**
 * Shared flex/scroll styles for admin pages inside AdminShell.
 * Ensures nested ScrollView/FlatList can shrink and scroll on web.
 */
export const adminPageLayoutStyles = StyleSheet.create({
  page: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    alignSelf: 'stretch',
  },
  flexScroll: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    alignSelf: 'stretch',
  },
  listRegion: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    alignSelf: 'stretch',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xl,
  },
});

export const adminShellLayoutStyles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    ...Platform.select({
      web: {
        height: '100%',
      },
    }),
  },
  mainColumn: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    ...Platform.select({
      web: {
        minHeight: 0,
      },
    }),
  },
  content: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    overflow: 'hidden',
    ...Platform.select({
      web: {
        display: 'flex',
        flexDirection: 'column',
        overflowX: 'hidden',
      },
    }),
  },
});
