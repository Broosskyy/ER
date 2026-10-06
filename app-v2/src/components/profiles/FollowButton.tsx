import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { AppIcon } from '@/components/primitives/AppIcon';
import { AppText } from '@/components/layout/AppText';
import { layout } from '@/design/layout';
import { borderWidth } from '@/design/radii';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

import type { FollowState } from './view-models';

export interface FollowButtonProps {
  state: FollowState;
  onPress?: () => void;
}

/** Stateful-looking control only; parents own all follow state and callbacks. */
export function FollowButton({ state, onPress }: FollowButtonProps) {
  const { theme } = useTheme();
  const disabled = state === 'loading' || state === 'disabled';
  const active = state === 'following' || state === 'requested';
  const label = state === 'following' ? 'Folge ich' : state === 'requested' ? 'Angefragt' : 'Folgen';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: active, busy: state === 'loading' }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: active ? theme.colors.accentMuted : theme.colors.surface,
          borderColor: active ? theme.colors.accent : theme.colors.borderStrong,
          opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
          borderRadius: theme.radiusRoles.button,
        },
      ]}
    >
      {state === 'loading' ? <ActivityIndicator size="small" color={theme.colors.accent} /> : (
        <>
          <AppIcon name={active ? 'checkmark-outline' : 'person-add-outline'} size="sm" color={theme.colors.accent} />
          <AppText role="button" color={theme.colors.accent}>{label}</AppText>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: layout.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderWidth: borderWidth.hairline,
  },
});
