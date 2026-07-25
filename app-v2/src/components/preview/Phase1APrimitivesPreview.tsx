import { View } from 'react-native';

import { TextButton } from '@/components/buttons/TextButton';
import { resolveTextButtonStyle } from '@/components/buttons/text-button-styles';
import { Badge } from '@/components/feedback/Badge';
import { Section } from '@/components/layout/Section';
import { Stack } from '@/components/layout/Stack';
import { AppText } from '@/components/layout/AppText';
import { AppIcon } from '@/components/primitives/AppIcon';
import { Divider } from '@/components/primitives/Divider';
import { Spacer } from '@/components/primitives/Spacer';
import { useTheme } from '@/design/theme';
import { darkTheme } from '@/design/theme/dark';
import { lightTheme } from '@/design/theme/light';
import { spacing } from '@/design/spacing';

import { isWebPreview, PreviewStateLabel, PreviewThemeFrame } from './PreviewThemeFrame';

function TextButtonStateRow({ mode }: { mode: 'light' | 'dark' }) {
  const theme = mode === 'light' ? lightTheme : darkTheme;
  const pressedPrimary = resolveTextButtonStyle(theme, {
    variant: 'primary',
    pressed: true,
    hovered: false,
    disabled: false,
  });
  const hoveredGhost = resolveTextButtonStyle(theme, {
    variant: 'ghost',
    pressed: false,
    hovered: true,
    disabled: false,
  });

  return (
    <Stack gap="sm">
      <PreviewStateLabel label="Default" />
      <Stack direction="horizontal" gap="md" align="center" style={{ flexWrap: 'wrap' }}>
        <TextButton label="Primary" variant="primary" onPress={() => undefined} />
        <TextButton label="Secondary" variant="secondary" onPress={() => undefined} />
        <TextButton label="Ghost" variant="ghost" onPress={() => undefined} />
      </Stack>

      <PreviewStateLabel label="Disabled" />
      <Stack direction="horizontal" gap="md" align="center" style={{ flexWrap: 'wrap' }}>
        <TextButton label="Primary" variant="primary" disabled onPress={() => undefined} />
        <TextButton label="Ghost" variant="ghost" disabled onPress={() => undefined} />
      </Stack>

      <PreviewStateLabel label="Loading" />
      <TextButton label="Primary" variant="primary" loading onPress={() => undefined} />

      <PreviewStateLabel label="Pressed (resolved)" />
      <AppText role="button" color={pressedPrimary.labelColor}>
        Primary pressed
      </AppText>

      {isWebPreview ? (
        <>
          <PreviewStateLabel label="Hover (resolved, web)" />
          <View
            style={{
              alignSelf: 'flex-start',
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              backgroundColor: hoveredGhost.backgroundColor,
              borderRadius: 8,
            }}
          >
            <AppText role="button" color={hoveredGhost.labelColor}>
              Ghost hover
            </AppText>
          </View>
        </>
      ) : null}
    </Stack>
  );
}

function PrimitiveShowcase() {
  return (
    <Stack gap="md">
      <Stack direction="horizontal" gap="md" align="center" style={{ flexWrap: 'wrap' }}>
        <AppIcon name="heart-outline" size="sm" colorRole="default" />
        <AppIcon name="heart" size="md" colorRole="accent" />
        <AppIcon name="calendar" size="lg" colorRole="muted" />
        <AppIcon name="checkmark-circle" size="md" colorRole="success" />
      </Stack>

      <AppText role="body">Spacer md below</AppText>
      <Spacer size="md" />
      <Divider inset="sm" />

      <Stack direction="horizontal" gap="sm" style={{ flexWrap: 'wrap' }}>
        <Badge label="Default" status="default" />
        <Badge label="Aktiv" status="success" />
        <Badge label="Pending" status="warning" />
        <Badge label="Live" status="error" />
        <Badge label="Info" status="info" />
      </Stack>
    </Stack>
  );
}

export function Phase1APrimitivesPreview() {
  const { theme } = useTheme();

  return (
    <Section
      title="Phase 1A – Core Primitives"
      subtitle="Mockup-aligned building blocks — each panel is a fixed Light or Dark theme"
    >
      <Section title="AppIcon · Spacer · Divider · Badge" subtitle="Light and Dark">
        <Stack direction="horizontal" gap="md" align="stretch">
          <PreviewThemeFrame mode="light" label="Light">
            <PrimitiveShowcase />
          </PreviewThemeFrame>
          <PreviewThemeFrame mode="dark" label="Dark">
            <PrimitiveShowcase />
          </PreviewThemeFrame>
        </Stack>
      </Section>

      <Section title="Stack & Section" subtitle="Token gaps from spacing roles">
        <Section title="Tonight" subtitle="Raves in deiner Nähe">
          <Stack gap="sm">
            <AppText role="body">Vertical stack content</AppText>
            <AppText role="bodyMuted">Muted secondary line</AppText>
          </Stack>
        </Section>
        <Stack direction="horizontal" gap="md" justify="between" align="center">
          <AppText role="label">Start</AppText>
          <Divider orientation="vertical" style={{ height: 24 }} />
          <AppText role="label">End</AppText>
        </Stack>
      </Section>

      <Section title="TextButton" subtitle="Primary · Secondary · Ghost — all interaction states">
        <Stack direction="horizontal" gap="md" align="stretch">
          <PreviewThemeFrame mode="light" label="Light">
            <TextButtonStateRow mode="light" />
          </PreviewThemeFrame>
          <PreviewThemeFrame mode="dark" label="Dark">
            <TextButtonStateRow mode="dark" />
          </PreviewThemeFrame>
        </Stack>
      </Section>

      <View
        style={{
          padding: spacing.md,
          borderRadius: theme.radii.md,
          borderWidth: 1,
          borderColor: theme.colors.borderSubtle,
          gap: spacing.sm,
        }}
      >
        <AppText role="label">Active theme context</AppText>
        <AppText role="bodyMuted">
          Use the mode switcher above to preview primitives inside the live app theme.
        </AppText>
      </View>
    </Section>
  );
}
