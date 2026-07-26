import { AppTextInput, type AppTextInputProps } from './AppTextInput';
import { textInputMetrics } from './text-input-styles';
import type { StyleProp, TextStyle } from 'react-native';

export type MultilineInputProps = Omit<AppTextInputProps, 'multiline' | 'numberOfLines'> & {
  numberOfLines?: number;
  inputStyle?: StyleProp<TextStyle>;
};

/**
 * Multiline form field — extends AppTextInput with multiline layout tokens.
 */
export function MultilineInput({
  numberOfLines = 4,
  inputStyle,
  ...rest
}: MultilineInputProps) {
  return (
    <AppTextInput
      multiline
      numberOfLines={numberOfLines}
      textAlignVertical="top"
      inputStyle={[
        {
          minHeight: textInputMetrics.multilineMinHeight,
        },
        inputStyle,
      ]}
      {...rest}
    />
  );
}
