import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';

import { AppIcon } from '@/components/primitives/AppIcon';
import { borderWidth } from '@/design/radii';
import { useTheme } from '@/design/theme';

import {
  resolveTextInputStyle,
  searchBarMetrics,
} from './text-input-styles';

export interface SearchBarProps extends Omit<TextInputProps, 'style' | 'editable'> {
  loading?: boolean;
  disabled?: boolean;
  onClear?: () => void;
  containerStyle?: ViewStyle;
}

/**
 * Full-width search bar — mockup 53, 44px touch height with clear action.
 */
export function SearchBar({
  value,
  loading = false,
  disabled = false,
  onClear,
  containerStyle,
  onFocus,
  onBlur,
  onChangeText,
  ...rest
}: SearchBarProps) {
  const { theme } = useTheme();
  const [focused, setFocused] = useState(false);
  const resolved = resolveTextInputStyle(theme, {
    focused,
    disabled: disabled || loading,
  });
  const showClear = Boolean(value) && !disabled && !loading;

  return (
    <View
      style={[
        styles.field,
        {
          minHeight: searchBarMetrics.height,
          paddingHorizontal: searchBarMetrics.paddingHorizontal,
          borderRadius: theme.radiusRoles.searchField,
          borderWidth: borderWidth.hairline,
          backgroundColor: resolved.backgroundColor,
          borderColor: resolved.borderColor,
          opacity: resolved.opacity,
        },
        containerStyle,
      ]}
    >
      <AppIcon name="search" size="md" colorRole="muted" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        style={[styles.input, theme.typography.textRoles.searchInput, { color: resolved.textColor }]}
        placeholderTextColor={resolved.placeholderColor}
        editable={!disabled && !loading}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        accessibilityState={{ disabled: disabled || loading }}
        {...rest}
      />
      {loading ? (
        <ActivityIndicator size="small" color={theme.colors.accent} />
      ) : showClear ? (
        <Pressable
          onPress={onClear}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={8}
        >
          <AppIcon name="close-circle" size="sm" colorRole="muted" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: searchBarMetrics.paddingHorizontal / 2,
    width: '100%',
  },
  input: {
    flex: 1,
    padding: 0,
    margin: 0,
  },
});
