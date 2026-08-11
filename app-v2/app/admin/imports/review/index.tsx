import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AppScreen } from '@/components/layout/AppScreen';
import { AppText } from '@/components/layout/AppText';
import { SafeAreaContainer } from '@/components/layout/SafeAreaContainer';
import { colors, colorRoles } from '@/design/colors';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { getErrorMessage } from '@/core/errors/app-error';
import type { ImportRecord } from '@/features/import/models/types';
import {
  importAdminRepository,
  importRecordRepository,
} from '@/data/repositories/registry';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoadingState,
} from '@/features/admin/components/AdminStates';
import { adminPageLayoutStyles } from '@/features/admin/admin-page-layout';
import { useAdminRole } from '@/features/import/admin/use-admin-role';
import {
  AdminDraftReviewController,
  buildAdminDraftReviewQueueViewModel,
  type CompactDraftReviewCard,
} from '@/features/import/clean-import-core/admin-draft-review';
import { mapImportRecordToDraft } from '@/features/import/clean-import-core/import-draft-record-mapper';
import { ImportRecordDraftReviewPersistence } from '@/features/import/clean-import-core/draft-review-persistence';
import type {
  ImportDraft,
  ReviewTrack,
} from '@/features/import/clean-import-core/import-draft';

const TRACK_LABELS: Record<ReviewTrack, string> = {
  auto_ready: 'Automatisch bereit',
  quick_review: 'Kurz prüfen',
  conflict_review: 'Konflikte',
};

const reviewController = new AdminDraftReviewController(
  new ImportRecordDraftReviewPersistence(
    importRecordRepository,
    importAdminRepository,
    'import_records_only',
  ),
);

export default function ReviewQueueScreen() {
  const router = useRouter();
  const { session, can } = useAdminRole();
  const [drafts, setDrafts] = useState<ImportDraft[]>([]);
  const [selectedDraftIds, setSelectedDraftIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await importAdminRepository.listRecords({
        page: 1,
        pageSize: 200,
        sortBy: 'newest',
        includeRawPayload: true,
      });
      setDrafts(
        (result.items as ImportRecord[])
          .map(mapImportRecordToDraft)
          .filter((draft): draft is ImportDraft => draft !== null),
      );
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timeout);
  }, [load]);

  const viewModel = buildAdminDraftReviewQueueViewModel(
    drafts,
    selectedDraftIds,
  );

  const toggleSelected = (draftId: string) => {
    setSelectedDraftIds((current) =>
      current.includes(draftId)
        ? current.filter((id) => id !== draftId)
        : [...current, draftId],
    );
  };

  const selectAllSafe = () => {
    setSelectedDraftIds(reviewController.selectAllSafe(drafts));
  };

  const batchApprove = async () => {
    if (!session || !can('records:approve')) return;
    setActing(true);
    setError(null);
    try {
      await reviewController.batchApprove(
        drafts,
        selectedDraftIds,
        session.user.id,
      );
      setSelectedDraftIds([]);
      await load();
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setActing(false);
    }
  };

  if (loading && drafts.length === 0) {
    return <AdminLoadingState label="Loading review queue…" />;
  }

  if (error && drafts.length === 0) {
    return <AdminErrorState message={error} onRetry={load} />;
  }

  return (
    <AppScreen>
      <SafeAreaContainer style={styles.container}>
        <View style={styles.header}>
          <SecondaryButton label="Back" onPress={() => router.back()} />
          <AppText style={styles.title}>Import-Ausnahmen</AppText>
        </View>
        <View style={styles.batchActions}>
          <SecondaryButton
            label="Alle sicheren auswählen"
            onPress={selectAllSafe}
            disabled={acting || viewModel.autoReadyCount === 0}
          />
          {can('records:approve') ? (
            <PrimaryButton
              label={`Stapel bestätigen (${selectedDraftIds.length})`}
              onPress={batchApprove}
              disabled={acting || selectedDraftIds.length === 0}
            />
          ) : null}
        </View>
        {error ? <AppText style={styles.error}>{error}</AppText> : null}
        <View style={adminPageLayoutStyles.listRegion}>
          <ScrollView
            style={adminPageLayoutStyles.flexScroll}
            contentContainerStyle={styles.list}
          >
          {drafts.length === 0 ? (
            <AdminEmptyState
              title="Review queue is empty"
              description="No records need review right now."
            />
          ) : null}
          {(
            [
              'auto_ready',
              'quick_review',
              'conflict_review',
            ] as ReviewTrack[]
          ).map((track) => {
            const cards = viewModel.groups[track];
            return (
              <View key={track} style={styles.section}>
                <AppText style={styles.sectionTitle}>
                  {TRACK_LABELS[track]} ({cards.length})
                </AppText>
                {cards.map((card) => (
                  <DraftCard
                    key={card.draftId}
                    card={card}
                    selectable={card.reviewTrack === 'auto_ready'}
                    onToggle={() => toggleSelected(card.draftId)}
                    onOpen={() => {
                      const draft = drafts.find(
                        (entry) => entry.id === card.draftId,
                      );
                      if (draft?.persistenceRecordId) {
                        router.push(
                          `/admin/imports/review/${draft.persistenceRecordId}`,
                        );
                      }
                    }}
                  />
                ))}
              </View>
            );
          })}
          </ScrollView>
        </View>
      </SafeAreaContainer>
    </AppScreen>
  );
}

function DraftCard({
  card,
  selectable,
  onToggle,
  onOpen,
}: {
  card: CompactDraftReviewCard;
  selectable: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  return (
    <View style={styles.row}>
      {selectable ? (
        <Pressable style={styles.selectRow} onPress={onToggle}>
          <View
            style={[styles.checkbox, card.selected && styles.checkboxSelected]}
          />
          <AppText style={styles.selectLabel}>
            {card.selected ? 'Ausgewählt' : 'Auswählen'}
          </AppText>
        </Pressable>
      ) : null}
      <Pressable onPress={onOpen} style={styles.cardBody}>
        {card.imageUrl ? (
          <Image source={{ uri: card.imageUrl }} style={styles.image} />
        ) : null}
        <AppText style={styles.rowTitle}>{card.title}</AppText>
        <AppText style={styles.meta}>{card.dateTime}</AppText>
        <AppText style={styles.meta}>{card.venue}</AppText>
        <AppText style={styles.meta}>
          Genres: {card.genres.join(', ') || 'fehlen'}
        </AppText>
        <AppText style={styles.meta}>
          Line-up: {card.lineup.join(', ') || 'fehlt'}
        </AppText>
        <AppText style={styles.meta}>
          Tickets: {card.ticketStatus}
          {card.ticketPrice ? ` · ${card.ticketPrice}` : ''}
        </AppText>
        <AppText style={styles.meta}>
          Quelle: {card.sourceLabel} · Eingang: {card.submissionLabel}
        </AppText>
        <AppText style={styles.reason}>
          Review: {card.reviewReason}
        </AppText>
        {card.highlightedChanges.map((change) => (
          <AppText key={change} style={styles.change}>
            {change}
          </AppText>
        ))}
        {card.recommendedDuplicateAction ? (
          <AppText style={styles.dup}>
            Empfehlung: {card.recommendedDuplicateAction}
          </AppText>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacingRoles.screenHorizontal,
  },
  title: { ...textRoles.screenTitle, flex: 1 },
  batchActions: {
    paddingHorizontal: spacingRoles.screenHorizontal,
    gap: spacing.sm,
  },
  error: {
    ...textRoles.metadata,
    color: colors.live,
    paddingHorizontal: spacingRoles.screenHorizontal,
  },
  list: { padding: spacingRoles.screenHorizontal },
  section: { gap: spacing.sm, marginBottom: spacing.lg },
  sectionTitle: { ...textRoles.sectionTitle },
  row: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  selectLabel: { ...textRoles.metadata },
  cardBody: { gap: spacing.xs },
  image: { width: '100%', height: 140, borderRadius: 8 },
  rowTitle: { ...textRoles.sectionTitle },
  meta: { ...textRoles.metadata, color: colorRoles.emptyStateDescription },
  reason: { ...textRoles.metadata, color: colors.warning },
  change: { ...textRoles.metadata, color: colors.primary },
  dup: { ...textRoles.metadata, color: colors.warning },
});
