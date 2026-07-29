import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInput as TextInputType } from 'react-native';

import { componentSize } from '@/design/layout';
import { radiusRoles } from '@/design/radii';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { useTheme } from '@/design/theme';

export interface SearchInputProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  testID?: string;
  autoFocus?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
}

export interface SearchInputHandle {
  focus: () => void;
  blur: () => void;
}

export const SearchInput = forwardRef<SearchInputHandle, SearchInputProps>(function SearchInput(
  {
    value,
    onChangeText,
    placeholder = 'Events, Künstler oder Locations suchen…',
    testID = 'events-search-input',
    autoFocus = false,
    onFocus,
    onBlur,
  },
  ref,
) {
  const { theme } = useTheme();
  const inputRef = useRef<TextInputType>(null);
  const hasValue = value.trim().length > 0;

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    blur: () => inputRef.current?.blur(),
  }));

  useEffect(() => {
    if (!autoFocus) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    return () => cancelAnimationFrame(frame);
  }, [autoFocus]);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.borderSubtle,
        },
      ]}
      pointerEvents="box-none"
    >
      <Ionicons
        name="search"
        size={componentSize.iconMd}
        color={theme.colors.textMuted}
        style={styles.icon}
      />
      <TextInput
        ref={inputRef}
        accessibilityRole="search"
        accessibilityLabel="Search events"
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="never"
        editable
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        returnKeyType="search"
        style={[styles.input, { color: theme.colors.textPrimary }]}
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
      />
      {hasValue ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={8}
          onPress={() => onChangeText('')}
          style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}
          testID="events-search-clear"
        >
          <Ionicons name="close-circle" size={componentSize.iconSm} color={theme.colors.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: componentSize.searchScreenFieldHeight,
    marginHorizontal: spacingRoles.screenHorizontal,
    marginBottom: spacing.md,
    paddingHorizontal: spacingRoles.searchPaddingHorizontal,
    borderRadius: radiusRoles.searchField,
    borderWidth: 1,
  },
  icon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    ...textRoles.searchInput,
    paddingVertical: 0,
    minHeight: 24,
    ...(process.env.EXPO_OS === 'web'
      ? ({
          outlineStyle: 'none',
        } as object)
      : null),
  },
  clearButton: {
    marginLeft: spacing.sm,
    padding: spacing.xs,
  },
  pressed: {
    opacity: 0.85,
  },
});
