import { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  TextInput,
  TextInputProps,
  StyleProp,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { AppIcon, type AppIconName } from '@/components/primitives/AppIcon';
import { useTheme } from '@/design/theme';

import {
  resolveTextInputStyle,
  textInputMetrics,
} from './text-input-styles';

export interface AppTextInputProps extends Omit<TextInputProps, 'style' | 'editable'> {
  label?: string;
  helperText?: string;
  errorText?: string;
  successText?: string;
  prefixIcon?: AppIconName;
  suffixIcon?: AppIconName;
  loading?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  containerStyle?: ViewStyle;
  inputStyle?: StyleProp<TextStyle>;
}

/**
 * Theme-aware form field — mockup 53 FormField pattern.
 */
export function AppTextInput({
  label,
  helperText,
  errorText,
  successText,
  prefixIcon,
  suffixIcon,
  loading = false,
  disabled = false,
  readOnly = false,
  multiline = false,
  secureTextEntry = false,
  containerStyle,
  inputStyle,
  onFocus,
  onBlur,
  ...rest
}: AppTextInputProps) {
  const { theme } = useTheme();
  const [focused, setFocused] = useState(false);
  const hasError = Boolean(errorText);
  const hasSuccess = Boolean(successText) && !hasError;
  const isLocked = disabled || loading;
  const resolved = resolveTextInputStyle(theme, {
    focused,
    disabled: isLocked,
    readOnly,
    error: hasError,
    success: hasSuccess,
  });
  const feedbackText = errorText ?? successText ?? helperText;
  const fieldMinHeight = multiline ? textInputMetrics.multilineMinHeight : textInputMetrics.minHeight;

  return (
    <View style={[styles.container, { gap: textInputMetrics.gap }, containerStyle]}>
      {label ? <AppText role="label">{label}</AppText> : null}
      <View
        style={[
          styles.field,
          multiline && styles.fieldMultiline,
          {
            minHeight: fieldMinHeight,
            paddingHorizontal: textInputMetrics.paddingHorizontal,
            paddingVertical: textInputMetrics.paddingVertical,
            borderRadius: theme.radiusRoles.searchField,
            borderWidth: textInputMetrics.borderWidth,
            backgroundColor: resolved.backgroundColor,
            borderColor: resolved.borderColor,
            opacity: resolved.opacity,
          },
        ]}
      >
        {prefixIcon ? <AppIcon name={prefixIcon} size="sm" colorRole="muted" /> : null}
        <TextInput
          style={[
            styles.input,
            theme.typography.textRoles.searchInput,
            { color: resolved.textColor },
            multiline && styles.inputMultiline,
            inputStyle,
          ]}
          placeholderTextColor={resolved.placeholderColor}
          editable={!isLocked && !readOnly}
          readOnly={readOnly}
          multiline={multiline}
          secureTextEntry={secureTextEntry}
          textAlignVertical={multiline ? 'top' : 'center'}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          accessibilityState={{ disabled: isLocked, selected: readOnly }}
          {...rest}
        />
        {loading ? (
          <ActivityIndicator size="small" color={theme.colors.accent} />
        ) : suffixIcon ? (
          <AppIcon name={suffixIcon} size="sm" colorRole="muted" />
        ) : null}
      </View>
      {feedbackText ? (
        <AppText role="caption" color={resolved.helperColor}>
          {feedbackText}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: textInputMetrics.gap,
  },
  fieldMultiline: {
    alignItems: 'flex-start',
  },
  input: {
    flex: 1,
    padding: 0,
    margin: 0,
  },
  inputMultiline: {
    minHeight: textInputMetrics.multilineMinHeight - textInputMetrics.paddingVertical * 2,
  },
});
