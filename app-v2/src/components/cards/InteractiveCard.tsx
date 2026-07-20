import { ReactNode } from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

export type InteractiveCardActionsPlacement = 'overlay' | 'trailing';

export interface InteractiveCardProps {
  onPress: () => void;
  accessibilityLabel?: string;
  children: ReactNode;
  actions?: ReactNode;
  actionsPlacement?: InteractiveCardActionsPlacement;
  style?: StyleProp<ViewStyle>;
  pressableStyle?: StyleProp<ViewStyle>;
  pressedStyle?: StyleProp<ViewStyle>;
  actionsStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Tappable card with optional action controls rendered as siblings of the main press target.
 * Avoids nested interactive elements on React Native Web (e.g. button inside button).
 */
export function InteractiveCard({
  onPress,
  accessibilityLabel,
  children,
  actions,
  actionsPlacement = 'overlay',
  style,
  pressableStyle,
  pressedStyle,
  actionsStyle,
  testID,
}: InteractiveCardProps) {
  const trailing = actionsPlacement === 'trailing';

  return (
    <View
      testID={testID}
      style={[styles.container, trailing && styles.containerTrailing, style]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [
          styles.pressable,
          trailing && styles.pressableTrailing,
          pressableStyle,
          pressed && (pressedStyle ?? styles.pressed),
        ]}
      >
        {children}
      </Pressable>

      {actions ? (
        <View
          pointerEvents="box-none"
          style={[
            trailing ? styles.actionsTrailing : styles.actionsOverlay,
            actionsStyle,
          ]}
        >
          {actions}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  containerTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pressable: {
    flexGrow: 1,
    flexShrink: 1,
  },
  pressableTrailing: {
    flex: 1,
    minWidth: 0,
  },
  pressed: {
    opacity: 0.94,
  },
  actionsOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1,
  },
  actionsTrailing: {
    flexShrink: 0,
    zIndex: 1,
  },
});
