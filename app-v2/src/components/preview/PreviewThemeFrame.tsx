import { ReactNode, useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { darkTheme } from '@/design/theme/dark';
import { lightTheme } from '@/design/theme/light';
import { ThemeContext } from '@/design/theme/ThemeProvider';
import type { ResolvedThemeMode } from '@/design/theme/types';
import { spacing } from '@/design/spacing';

interface PreviewThemeFrameProps {
  mode: ResolvedThemeMode;
  label: string;
  children: ReactNode;
}

/** Local theme override for side-by-side light/dark primitive previews. */
export function PreviewThemeFrame({ mode, label, children }: PreviewThemeFrameProps) {
  const theme = mode === 'light' ? lightTheme : darkTheme;

  const value = useMemo(
    () => ({
      theme,
      mode,
      resolvedMode: mode,
      setMode: () => undefined,
    }),
    [mode, theme],
  );

  return (
    <ThemeContext.Provider value={value}>
      <View
        style={[
          styles.frame,
          {
            backgroundColor: theme.colors.background,
            borderColor: theme.colors.borderSubtle,
          },
        ]}
      >
        <AppText role="caption">{label}</AppText>
        {children}
      </View>
    </ThemeContext.Provider>
  );
}

export function PreviewStateLabel({ label }: { label: string }) {
  return <AppText role="caption">{label}</AppText>;
}

export const isWebPreview = Platform.OS === 'web';

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    minWidth: 140,
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
  },
});
