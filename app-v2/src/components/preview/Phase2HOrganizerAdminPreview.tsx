import { View } from 'react-native';

import { Section } from '@/components/layout/Section';
import { Stack } from '@/components/layout/Stack';
import {
  AdminDashboardHeader,
  AdminMetricGrid,
  AdminQueueTabs,
} from '@/components/admin/AdminDashboardComponents';
import {
  AdminDecisionBar,
  AdminReviewCard,
  ReviewReasonField,
  ReviewTimeline,
} from '@/components/admin/AdminReviewComponents';
import {
  AuditEmptyState,
  AuditLogFilterBar,
  AuditLogItem,
} from '@/components/admin/AuditComponents';
import {
  CanonicalEventSummary,
  DuplicateCandidateCard,
  DuplicateComparisonRow,
  EventSourceCard,
  SourceAttributionRow,
  SourceHealthRow,
} from '@/components/admin/SourceDuplicateComponents';
import {
  DraftEmptyState,
  DraftMoreMenu,
  DraftProgress,
  EventDraftCard,
} from '@/components/organizer/DraftComponents';
import {
  IntegrationCard,
  IntegrationEmptyState,
  IntegrationSyncRow,
} from '@/components/organizer/IntegrationComponents';
import {
  OrganizerActivityItem,
  OrganizerDashboardHeader,
  OrganizerMetricGrid,
  OrganizerQuickAction,
} from '@/components/organizer/OrganizerDashboard';
import {
  OrganizerProfileEditorHeader,
  OrganizerProfileSectionCard,
  ProfileCompletionCard,
  SocialLinkRow,
} from '@/components/organizer/ProfileComponents';
import {
  StatisticBreakdownRow,
  StatisticEmptyState,
  StatisticPeriodSelector,
  StatisticSummaryCard,
  StatisticTrendBlock,
} from '@/components/organizer/StatisticsComponents';
import {
  SubmissionFieldSummary,
  SubmissionFooterActions,
  SubmissionProgress,
  SubmissionReviewCard,
  SubmissionSection,
  SubmissionStatusBanner,
  SubmissionStepHeader,
} from '@/components/organizer/SubmissionComponents';
import {
  PendingInviteRow,
  RemoveTeamMemberDialog,
  TeamInviteCard,
  TeamMemberManagementRow,
  TeamRoleBadge,
} from '@/components/organizer/TeamComponents';
import {
  VerificationProgress,
  VerificationRequirementCard,
  VerificationReviewState,
} from '@/components/organizer/VerificationComponents';

import {
  adminMetrics,
  adminQueueTabs,
  auditEntries,
  canonicalEvent,
  duplicateCandidate,
  duplicateComparisons,
  externalTicketIntegration,
  industrialRebirthDraft,
  organizerActivities,
  organizerMetrics,
  organizerQuickActions,
  organizerVerificationReview,
  pausedSource,
  pendingEventReview,
  pendingInvite,
  profileCompletion,
  residentAdvisorSource,
  reviewTimeline,
  sourceAttributions,
  sourceHealth,
  statisticBreakdowns,
  statisticSummaries,
  submissionFieldSummary,
  submissionReviewIncomplete,
  submissionReviewReady,
  submissionSteps,
  teamMembers,
  ticketIntegration,
  unverifiedDashboard,
  verificationRequirements,
  viewsTrend,
  voidDashboard,
  voidSocialLinks,
} from './phase-2h-fixtures';
import { PreviewThemeFrame } from './PreviewThemeFrame';

function OrganizerShowcase() {
  return (
    <Stack gap="xl">
      <OrganizerDashboardHeader
        dashboard={voidDashboard}
        primaryActionLabel="Event erstellen"
        secondaryActionLabel="Profil"
        onPrimaryAction={() => undefined}
        onSecondaryAction={() => undefined}
      />
      <OrganizerDashboardHeader dashboard={unverifiedDashboard} />
      <OrganizerMetricGrid metrics={organizerMetrics} />
      <Stack direction="horizontal" gap="md" style={{ flexWrap: 'wrap' }}>
        {organizerQuickActions.map((action) => (
          <OrganizerQuickAction key={action.id} action={action} onPress={() => undefined} />
        ))}
      </Stack>
      {organizerActivities.map((activity) => (
        <OrganizerActivityItem key={activity.id} activity={activity} />
      ))}
    </Stack>
  );
}

function SubmissionShowcase() {
  return (
    <Stack gap="xl">
      <SubmissionProgress steps={submissionSteps} />
      <SubmissionStepHeader
        stepIndex={2}
        totalSteps={5}
        title="Event Details"
        description="Beschreibung, Genre und Altersbeschränkung"
        helpLabel="Hilfe"
        onHelpPress={() => undefined}
      />
      <SubmissionSection title="Event Informationen" description="Pflichtfelder für die Veröffentlichung" required>
        <SubmissionFieldSummary fields={submissionFieldSummary} />
      </SubmissionSection>
      <SubmissionReviewCard review={submissionReviewReady} onEditPress={() => undefined} />
      <SubmissionReviewCard review={submissionReviewIncomplete} onEditPress={() => undefined} />
      <SubmissionStatusBanner status="changes_requested" message="Bitte Ticketlink und Line-up ergänzen." />
      <SubmissionFooterActions
        onBack={() => undefined}
        onNext={() => undefined}
        onSaveDraft={() => undefined}
        onPreview={() => undefined}
      />
    </Stack>
  );
}

function DraftsShowcase() {
  return (
    <Stack gap="xl">
      <EventDraftCard draft={industrialRebirthDraft} onContinuePress={() => undefined} onMorePress={() => undefined} />
      <DraftProgress currentStep={4} totalSteps={5} />
      <DraftMoreMenu onRename={() => undefined} onDuplicate={() => undefined} onDelete={() => undefined} />
      <DraftEmptyState onCreatePress={() => undefined} />
    </Stack>
  );
}

function StatisticsShowcase() {
  return (
    <Stack gap="xl">
      {statisticSummaries.map((stat) => (
        <StatisticSummaryCard key={stat.id} statistic={stat} />
      ))}
      <StatisticTrendBlock trend={viewsTrend} />
      {statisticBreakdowns.map((row) => (
        <StatisticBreakdownRow key={row.id} row={row} />
      ))}
      <StatisticPeriodSelector periods={['7d', '30d', '90d']} selected="7d" onSelect={() => undefined} />
      <StatisticEmptyState />
    </Stack>
  );
}

function ProfileTeamShowcase() {
  return (
    <Stack gap="xl">
      <OrganizerProfileEditorHeader
        name="VOID Events"
        verificationStatus="verified"
        completionPercent={72}
        onPreviewPress={() => undefined}
      />
      <ProfileCompletionCard completion={profileCompletion} onCtaPress={() => undefined} />
      <OrganizerProfileSectionCard title="Basisinformationen" description="Name, Beschreibung, Kontakt">
        {voidSocialLinks[0] ? (
          <SocialLinkRow link={voidSocialLinks[0]} onEditPress={() => undefined} />
        ) : null}
      </OrganizerProfileSectionCard>
      {voidSocialLinks.map((link) => (
        <SocialLinkRow key={link.id} link={link} onEditPress={() => undefined} onRemovePress={() => undefined} />
      ))}
      <TeamRoleBadge role="owner" />
      <TeamRoleBadge role="editor" />
      {teamMembers.map((member) => (
        <TeamMemberManagementRow key={member.id} member={member} onMenuPress={() => undefined} />
      ))}
      <TeamInviteCard onSendPress={() => undefined} />
      <PendingInviteRow invite={pendingInvite} onRevokePress={() => undefined} />
      <RemoveTeamMemberDialog visible={false} memberName="Lena Krause" onConfirm={() => undefined} onCancel={() => undefined} />
    </Stack>
  );
}

function IntegrationsVerificationShowcase() {
  return (
    <Stack gap="xl">
      <IntegrationCard integration={ticketIntegration} onDisconnectPress={() => undefined} onConfigurePress={() => undefined} />
      <IntegrationCard integration={externalTicketIntegration} onConnectPress={() => undefined} onConfigurePress={() => undefined} />
      <IntegrationSyncRow lastSyncLabel="Heute, 09:27" importedEventsLabel="42" warningLabel="Token läuft in 3 Tagen ab" />
      <IntegrationEmptyState onAddPress={() => undefined} />
      <VerificationProgress status="under_review" completedSteps={3} totalSteps={5} />
      {verificationRequirements.map((req) => (
        <VerificationRequirementCard key={req.id} requirement={req} onActionPress={() => undefined} />
      ))}
      <VerificationReviewState status="under_review" description="VOID Events wird derzeit geprüft." />
      <VerificationReviewState status="not_started" actionLabel="Verifizierung starten" onActionPress={() => undefined} />
    </Stack>
  );
}

function AdminShowcase() {
  return (
    <Stack gap="xl">
      <AdminDashboardHeader
        title="Hallo Max!"
        description="Hier ist, was auf der Plattform passiert."
        periodLabel="07. Jun – 13. Jun 2026"
        searchValue=""
        onSearchChange={() => undefined}
        onFilterPress={() => undefined}
      />
      <AdminMetricGrid metrics={adminMetrics} />
      <AdminQueueTabs tabs={adminQueueTabs} onTabPress={() => undefined} />
      <AdminReviewCard
        review={pendingEventReview}
        onPreviewPress={() => undefined}
        onApprovePress={() => undefined}
        onRequestChangesPress={() => undefined}
        onRejectPress={() => undefined}
      />
      <AdminReviewCard review={organizerVerificationReview} />
      <AdminDecisionBar onApprovePress={() => undefined} onRequestChangesPress={() => undefined} onRejectPress={() => undefined} />
      <ReviewReasonField label="Ablehnungsgrund" value="" onChangeText={() => undefined} />
      <ReviewTimeline timeline={reviewTimeline} />
    </Stack>
  );
}

function SourcesAuditShowcase() {
  return (
    <Stack gap="xl">
      <EventSourceCard source={residentAdvisorSource} onSyncPress={() => undefined} onConfigurePress={() => undefined} />
      <EventSourceCard source={pausedSource} onSyncPress={() => undefined} onConfigurePress={() => undefined} />
      <SourceHealthRow health={sourceHealth} />
      <DuplicateCandidateCard
        candidate={duplicateCandidate}
        onComparePress={() => undefined}
        onMergePress={() => undefined}
        onNotDuplicatePress={() => undefined}
      />
      {duplicateComparisons.map((comparison) => (
        <DuplicateComparisonRow key={comparison.fieldLabel} comparison={comparison} />
      ))}
      <CanonicalEventSummary event={canonicalEvent} />
      {sourceAttributions.map((attribution) => (
        <SourceAttributionRow key={attribution.sourceLabel} attribution={attribution} />
      ))}
      <AuditLogFilterBar
        filters={[
          { id: 'all', label: 'Alle', active: true },
          { id: 'events', label: 'Events' },
          { id: 'sources', label: 'Quellen' },
        ]}
        onFilterPress={() => undefined}
      />
      {auditEntries.map((entry) => (
        <AuditLogItem key={entry.id} entry={entry} />
      ))}
      <AuditEmptyState />
    </Stack>
  );
}

function Phase2HShowcase() {
  return (
    <Stack gap="xxl">
      <Section title="Organizer Dashboard">
        <OrganizerShowcase />
      </Section>
      <Section title="Submission Wizard">
        <SubmissionShowcase />
      </Section>
      <Section title="Drafts">
        <DraftsShowcase />
      </Section>
      <Section title="Statistics">
        <StatisticsShowcase />
      </Section>
      <Section title="Profile & Team">
        <ProfileTeamShowcase />
      </Section>
      <Section title="Integrations & Verification">
        <IntegrationsVerificationShowcase />
      </Section>
      <Section title="Admin">
        <AdminShowcase />
      </Section>
      <Section title="Sources, Duplicates & Audit">
        <SourcesAuditShowcase />
      </Section>
    </Stack>
  );
}

export function Phase2HOrganizerAdminPreview() {
  return (
    <Section
      title="Sprint 2A Phase 2H – Organizer & Admin Components"
      subtitle="UI-only organizer dashboard, submission, admin review, sources, and audit presentation"
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        <PreviewThemeFrame mode="light" label="Light">
          <Phase2HShowcase />
        </PreviewThemeFrame>
        <PreviewThemeFrame mode="dark" label="Dark">
          <Phase2HShowcase />
        </PreviewThemeFrame>
      </View>
    </Section>
  );
}
