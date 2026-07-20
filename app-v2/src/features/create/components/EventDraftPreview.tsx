import { Image, Linking, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { colors, colorRoles } from '@/design/colors';
import { spacing } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import type { AdminEventRecord } from '@/data/types/records';
import type { EventDraftLinkLabels } from '@/features/create/mappers/event-draft-mapper';
import { parseContributorDescription } from '@/features/create/utils/event-draft-description';
import {
  formatIsoToDateInput,
  formatIsoToTimeInput,
} from '@/features/create/utils/event-draft-date-time';
import { isPersistableImageUrl } from '@/features/create/utils/event-image-url';

export interface EventDraftPreviewLabels {
  cover: string;
  flyer: string;
  date: string;
  time: string;
  venue: string;
  genre: string;
  description: string;
  links: string;
  ticket: string;
  website: string;
  instagram: string;
  facebook: string;
  noCover: string;
  status: string;
  venueSuggestion: string;
}

export interface EventDraftPreviewProps {
  record: AdminEventRecord;
  venueLabel: string;
  venueIsSuggestion?: boolean;
  genreLabel?: string;
  statusLabel: string;
  linkLabels: EventDraftLinkLabels;
  labels: EventDraftPreviewLabels;
}

function resolvePreviewLinks(
  record: AdminEventRecord,
  linkLabels: EventDraftLinkLabels,
): {
  description: string;
  websiteUrl: string;
  instagramUrl: string;
  facebookUrl: string;
} {
  if (record.websiteUrl || record.instagramUrl || record.facebookUrl) {
    return {
      description: record.description,
      websiteUrl: record.websiteUrl ?? '',
      instagramUrl: record.instagramUrl ?? '',
      facebookUrl: record.facebookUrl ?? '',
    };
  }

  const legacy = parseContributorDescription(record.description, linkLabels);
  return {
    description: legacy.description,
    websiteUrl: legacy.websiteUrl,
    instagramUrl: legacy.instagramUrl,
    facebookUrl: legacy.facebookUrl,
  };
}

export function EventDraftPreview({
  record,
  venueLabel,
  venueIsSuggestion,
  genreLabel,
  statusLabel,
  linkLabels,
  labels,
}: EventDraftPreviewProps) {
  const parsed = resolvePreviewLinks(record, linkLabels);
  const coverUri = isPersistableImageUrl(record.imageUrl) ? record.imageUrl : undefined;
  const flyerUri = isPersistableImageUrl(record.flyerUrl) ? record.flyerUrl : undefined;
  const date = formatIsoToDateInput(record.startDate);
  const time = formatIsoToTimeInput(record.startDate);
  const endTime = record.endDate ? formatIsoToTimeInput(record.endDate) : undefined;

  return (
    <View style={styles.container}>
      {coverUri ? (
        <Image
          accessibilityLabel={labels.cover}
          source={{ uri: coverUri }}
          style={styles.cover}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.coverPlaceholder}>
          <AppText style={styles.placeholderText}>{labels.noCover}</AppText>
        </View>
      )}

      <AppText accessibilityRole="header" style={styles.title}>
        {record.title}
      </AppText>

      <View style={styles.statusChip}>
        <AppText style={styles.statusText}>
          {labels.status}: {statusLabel}
        </AppText>
      </View>

      <View style={styles.metaBlock}>
        <AppText style={styles.metaLabel}>{labels.date}</AppText>
        <AppText style={styles.metaValue}>{date}</AppText>
        <AppText style={styles.metaLabel}>{labels.time}</AppText>
        <AppText style={styles.metaValue}>{endTime ? `${time} – ${endTime}` : time}</AppText>
        <AppText style={styles.metaLabel}>{labels.venue}</AppText>
        <AppText style={styles.metaValue}>
          {venueLabel}
          {venueIsSuggestion ? ` (${labels.venueSuggestion})` : ''}
        </AppText>
        {genreLabel ? (
          <>
            <AppText style={styles.metaLabel}>{labels.genre}</AppText>
            <AppText style={styles.metaValue}>{genreLabel}</AppText>
          </>
        ) : null}
      </View>

      {parsed.description ? (
        <View style={styles.section}>
          <AppText style={styles.sectionTitle}>{labels.description}</AppText>
          <AppText style={styles.body}>{parsed.description}</AppText>
        </View>
      ) : null}

      {record.ticketUrl || parsed.websiteUrl || parsed.instagramUrl || parsed.facebookUrl ? (
        <View style={styles.section}>
          <AppText style={styles.sectionTitle}>{labels.links}</AppText>
          {record.ticketUrl ? <PreviewLink label={labels.ticket} url={record.ticketUrl} /> : null}
          {parsed.websiteUrl ? <PreviewLink label={labels.website} url={parsed.websiteUrl} /> : null}
          {parsed.instagramUrl ? (
            <PreviewLink label={labels.instagram} url={parsed.instagramUrl} />
          ) : null}
          {parsed.facebookUrl ? (
            <PreviewLink label={labels.facebook} url={parsed.facebookUrl} />
          ) : null}
        </View>
      ) : null}

      {flyerUri ? (
        <View style={styles.section}>
          <AppText style={styles.sectionTitle}>{labels.flyer}</AppText>
          <Image
            accessibilityLabel={labels.flyer}
            source={{ uri: flyerUri }}
            style={styles.flyer}
            resizeMode="contain"
          />
        </View>
      ) : null}
    </View>
  );
}

function PreviewLink({ label, url }: { label: string; url: string }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${label}: ${url}`}
      onPress={() => void Linking.openURL(url)}
    >
      <AppText style={styles.link}>
        {label}: {url}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  cover: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
  },
  coverPlaceholder: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    ...textRoles.metadata,
    color: colorRoles.emptyStateDescription,
  },
  title: {
    ...textRoles.screenTitle,
    color: colors.textPrimary,
  },
  statusChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusText: {
    ...textRoles.metadata,
    color: colors.textPrimary,
  },
  metaBlock: {
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  metaLabel: {
    ...textRoles.metadata,
    color: colors.textSecondary,
  },
  metaValue: {
    ...textRoles.cardTitle,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...textRoles.cardTitle,
    color: colors.textPrimary,
  },
  body: {
    ...textRoles.body,
    color: colors.textPrimary,
  },
  link: {
    ...textRoles.body,
    color: colors.primary,
  },
  flyer: {
    width: '100%',
    height: 280,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
});
