import { useState } from 'react';

import { DestructiveButton } from '@/components/buttons/DestructiveButton';
import { GhostButton } from '@/components/buttons/GhostButton';
import { IconButton } from '@/components/buttons/IconButton';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { Card } from '@/components/cards/CardFoundation';
import { Banner } from '@/components/feedback/Banner';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Toast } from '@/components/feedback/Toast';
import { ToastProvider, useToast } from '@/components/feedback/ToastProvider';
import { AppTextInput } from '@/components/inputs/AppTextInput';
import { SearchField } from '@/components/inputs/SearchField';
import { Container } from '@/components/layout/Container';
import { ListSeparator } from '@/components/layout/ListSeparator';
import { Section } from '@/components/layout/Section';
import { Stack } from '@/components/layout/Stack';
import { Surface } from '@/components/layout/Surface';
import { AppText } from '@/components/layout/AppText';
import { AppModal } from '@/components/overlay/AppModal';
import { BottomSheet } from '@/components/overlay/BottomSheet';
import { Dialog } from '@/components/overlay/Dialog';
import { spacing } from '@/design/spacing';

import { PreviewStateLabel, PreviewThemeFrame } from './PreviewThemeFrame';

function InputShowcase() {
  const [search, setSearch] = useState('Techno');

  return (
    <Stack gap="md">
      <AppTextInput label="Default" placeholder="Event title" />
      <AppTextInput label="Focus" placeholder="Tap to focus" autoFocus />
      <AppTextInput
        label="Error"
        placeholder="Venue"
        errorText="Venue is required"
        defaultValue=" "
      />
      <AppTextInput
        label="Success"
        placeholder="City"
        successText="Location verified"
        defaultValue="Köln"
      />
      <AppTextInput label="Disabled" placeholder="Locked" disabled />
      <AppTextInput label="Readonly" value="Cologne Arena" readOnly />
      <AppTextInput
        label="Secure"
        placeholder="Password"
        secureTextEntry
        prefixIcon="lock-closed-outline"
      />
      <AppTextInput
        label="Multiline"
        placeholder="Description"
        multiline
        numberOfLines={4}
      />
      <SearchField
        placeholder="SearchField"
        value={search}
        onChangeText={setSearch}
        onClear={() => setSearch('')}
      />
      <SearchField placeholder="Search loading" loading />
      <SearchField placeholder="Search disabled" disabled />
    </Stack>
  );
}

function ButtonShowcase() {
  return (
    <Stack gap="sm">
      <PreviewStateLabel label="DestructiveButton" />
      <DestructiveButton label="Delete" onPress={() => undefined} />
      <DestructiveButton label="Disabled" disabled onPress={() => undefined} />
      <DestructiveButton label="Loading" loading onPress={() => undefined} />
      <PreviewStateLabel label="IconButton sizes" />
      <Stack direction="horizontal" gap="sm" align="center">
        <IconButton icon="heart-outline" size="sm" accessibilityLabel="Small" onPress={() => undefined} />
        <IconButton icon="heart-outline" size="md" accessibilityLabel="Medium" onPress={() => undefined} />
        <IconButton icon="heart-outline" size="lg" accessibilityLabel="Large" onPress={() => undefined} />
      </Stack>
      <PreviewStateLabel label="IconButton states" />
      <Stack direction="horizontal" gap="sm" align="center">
        <IconButton icon="share-outline" accessibilityLabel="Default" onPress={() => undefined} />
        <IconButton icon="share-outline" disabled accessibilityLabel="Disabled" onPress={() => undefined} />
        <IconButton icon="share-outline" loading accessibilityLabel="Loading" onPress={() => undefined} />
      </Stack>
    </Stack>
  );
}

function FeedbackShowcase() {
  const { showToast } = useToast();

  return (
    <Stack gap="md">
      <Stack direction="horizontal" gap="sm" style={{ flexWrap: 'wrap' }}>
        <Skeleton shape="card" style={{ flex: 1 }} />
        <Stack gap="sm" style={{ flex: 1 }}>
          <Skeleton shape="text" />
          <Skeleton shape="rectangle" width="70%" />
          <Skeleton shape="circle" />
        </Stack>
      </Stack>
      <Toast message="Saved to favorites" variant="success" onClose={() => undefined} />
      <Toast message="Check your connection" variant="warning" onClose={() => undefined} />
      <Banner
        title="Beta access"
        text="Some features are still rolling out."
        variant="info"
        dismissible
        actionLabel="Learn more"
        onAction={() => undefined}
      />
      <Banner title="Synced" text="Your changes are live." variant="success" />
      <EmptyState
        title="No events yet"
        description="Try another city or adjust your filters."
        icon="calendar-outline"
        primaryAction={<PrimaryButton label="Explore" onPress={() => undefined} />}
        secondaryAction={<GhostButton label="Reset filters" onPress={() => undefined} />}
      />
      <SecondaryButton
        label="Show toast"
        onPress={() => showToast('Event saved', { variant: 'success' })}
      />
    </Stack>
  );
}

function LayoutShowcase() {
  return (
    <Stack gap="md">
      <Surface variant="default">
        <AppText role="label">Surface default</AppText>
      </Surface>
      <Surface variant="subtle">
        <AppText role="label">Surface subtle</AppText>
      </Surface>
      <Surface variant="elevated">
        <AppText role="label">Surface elevated</AppText>
      </Surface>
      <Card elevated onPress={() => undefined}>
        <AppText role="cardTitle">Card pressable</AppText>
        <AppText role="cardSubtitle">Neutral card foundation</AppText>
      </Card>
      <Card disabled onPress={() => undefined}>
        <AppText role="cardTitle">Card disabled</AppText>
      </Card>
      <Container fullWidth>
        <AppText role="body">Container full width</AppText>
      </Container>
      <Stack direction="horizontal" gap="md" align="center">
        <AppText role="body">Left</AppText>
        <ListSeparator orientation="vertical" style={{ height: spacing.lg }} />
        <AppText role="body">Right</AppText>
      </Stack>
      <ListSeparator inset="lg" />
    </Stack>
  );
}

function OverlayShowcase() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);

  return (
    <Stack gap="sm">
      <Stack direction="horizontal" gap="sm" style={{ flexWrap: 'wrap' }}>
        <SecondaryButton label="Open BottomSheet" onPress={() => setSheetOpen(true)} />
        <SecondaryButton label="Open Modal" onPress={() => setModalOpen(true)} />
        <SecondaryButton label="Open Dialog" onPress={() => setDialogOpen(true)} />
        <SecondaryButton label="Open Alert" onPress={() => setAlertOpen(true)} />
      </Stack>

      <BottomSheet visible={sheetOpen} title="Filter" onClose={() => setSheetOpen(false)}>
        <AppText role="body">Sheet content scrolls independently from actions.</AppText>
      </BottomSheet>

      <AppModal visible={modalOpen} title="Details" onClose={() => setModalOpen(false)}>
        <AppText role="bodyMuted">Centered modal with close action and escape handling on web.</AppText>
      </AppModal>

      <Dialog
        visible={dialogOpen}
        title="Remove event?"
        message="This action cannot be undone."
        mode="destructive"
        confirmLabel="Remove"
        onCancel={() => setDialogOpen(false)}
        onConfirm={() => setDialogOpen(false)}
      />

      <Dialog
        visible={alertOpen}
        title="Saved"
        message="Your draft was saved successfully."
        mode="alert"
        confirmLabel="OK"
        onCancel={() => setAlertOpen(false)}
        onConfirm={() => setAlertOpen(false)}
      />
    </Stack>
  );
}

function Phase1BContent() {
  return (
    <Section
      title="Sprint 2A Phase 1B – Foundation Components"
      subtitle="Inputs, buttons, feedback, layout, and overlays — Light/Dark via theme switcher above"
    >
      <Section title="AppTextInput & SearchField">
        <Stack direction="horizontal" gap="md" align="stretch" style={{ flexWrap: 'wrap' }}>
          <PreviewThemeFrame mode="light" label="Light">
            <InputShowcase />
          </PreviewThemeFrame>
          <PreviewThemeFrame mode="dark" label="Dark">
            <InputShowcase />
          </PreviewThemeFrame>
        </Stack>
      </Section>

      <Section title="DestructiveButton & IconButton">
        <Stack direction="horizontal" gap="md" align="stretch" style={{ flexWrap: 'wrap' }}>
          <PreviewThemeFrame mode="light" label="Light">
            <ButtonShowcase />
          </PreviewThemeFrame>
          <PreviewThemeFrame mode="dark" label="Dark">
            <ButtonShowcase />
          </PreviewThemeFrame>
        </Stack>
      </Section>

      <Section title="Skeleton, Banner, Toast, EmptyState">
        <Stack direction="horizontal" gap="md" align="stretch" style={{ flexWrap: 'wrap' }}>
          <PreviewThemeFrame mode="light" label="Light">
            <FeedbackShowcase />
          </PreviewThemeFrame>
          <PreviewThemeFrame mode="dark" label="Dark">
            <FeedbackShowcase />
          </PreviewThemeFrame>
        </Stack>
      </Section>

      <Section title="Surface, Card, Container, ListSeparator">
        <Stack direction="horizontal" gap="md" align="stretch" style={{ flexWrap: 'wrap' }}>
          <PreviewThemeFrame mode="light" label="Light">
            <LayoutShowcase />
          </PreviewThemeFrame>
          <PreviewThemeFrame mode="dark" label="Dark">
            <LayoutShowcase />
          </PreviewThemeFrame>
        </Stack>
      </Section>

      <Section title="Modal, Dialog, BottomSheet">
        <OverlayShowcase />
      </Section>
    </Section>
  );
}

export function Phase1BFoundationPreview() {
  return (
    <ToastProvider>
      <Phase1BContent />
    </ToastProvider>
  );
}
