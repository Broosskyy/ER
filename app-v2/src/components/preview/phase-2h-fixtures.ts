import type {
  AdminMetricViewModel,
  AdminQueueTabViewModel,
  AdminReviewViewModel,
  AuditLogViewModel,
  CanonicalEventViewModel,
  DuplicateCandidateViewModel,
  DuplicateComparisonViewModel,
  EventSourceViewModel,
  ReviewTimelineViewModel,
  SourceAttributionViewModel,
  SourceHealthViewModel,
} from '@/components/admin/view-models';
import type {
  EventDraftViewModel,
  IntegrationViewModel,
  OrganizerActivityViewModel,
  OrganizerDashboardViewModel,
  OrganizerMetricViewModel,
  OrganizerQuickActionViewModel,
  ProfileCompletionViewModel,
  SocialLinkViewModel,
  StatisticBreakdownViewModel,
  StatisticTrendViewModel,
  StatisticViewModel,
  SubmissionFieldSummaryViewModel,
  SubmissionReviewViewModel,
  SubmissionStepViewModel,
  TeamInviteViewModel,
  TeamMemberManagementViewModel,
  VerificationRequirementViewModel,
} from '@/components/organizer/view-models';

export const voidDashboard: OrganizerDashboardViewModel = {
  organizerName: 'VOID Events',
  verificationStatus: 'verified',
  periodLabel: 'Letzte 7 Tage',
  accessibilityLabel: 'VOID Events Organizer Dashboard',
};

export const unverifiedDashboard: OrganizerDashboardViewModel = {
  organizerName: 'Köln Underground Kollektiv',
  verificationStatus: 'unverified',
  periodLabel: 'Letzte 30 Tage',
  accessibilityLabel: 'Unverifizierter Organizer Dashboard',
};

export const organizerMetrics: OrganizerMetricViewModel[] = [
  {
    id: 'events',
    kind: 'events',
    label: 'Veröffentlichte Events',
    valueLabel: '12',
    changeLabel: '↗ 2 vs. letzte 7 Tage',
    changeDirection: 'up',
    icon: 'calendar-outline',
    accessibilityLabel: '12 veröffentlichte Events',
  },
  {
    id: 'views',
    kind: 'views',
    label: 'Aufrufe',
    valueLabel: '48.7K',
    changeLabel: '↗ 18.6% vs. letzte 7 Tage',
    changeDirection: 'up',
    icon: 'eye-outline',
    accessibilityLabel: '48.7K Aufrufe',
  },
  {
    id: 'saves',
    kind: 'saves',
    label: 'Favoriten',
    valueLabel: '3.2K',
    changeLabel: '↗ 22.4%',
    changeDirection: 'up',
    icon: 'heart-outline',
    accessibilityLabel: '3.2K Favoriten',
  },
  {
    id: 'tickets',
    kind: 'ticket_clicks',
    label: 'Ticket-Klicks',
    valueLabel: '1.9K',
    changeLabel: '↗ 15.3%',
    changeDirection: 'up',
    icon: 'ticket-outline',
    accessibilityLabel: '1.9K Ticket-Klicks',
  },
];

export const organizerQuickActions: OrganizerQuickActionViewModel[] = [
  {
    id: 'create',
    kind: 'create_event',
    title: 'Event erstellen',
    description: 'Neues Event anlegen',
    icon: 'add-circle-outline',
    accessibilityLabel: 'Event erstellen',
  },
  {
    id: 'drafts',
    kind: 'continue_draft',
    title: 'Entwürfe',
    description: 'Industrial Rebirth fortsetzen',
    icon: 'document-text-outline',
    accessibilityLabel: 'Entwürfe öffnen',
  },
  {
    id: 'stats',
    kind: 'statistics',
    title: 'Statistiken',
    icon: 'bar-chart-outline',
    accessibilityLabel: 'Statistiken öffnen',
  },
];

export const organizerActivities: OrganizerActivityViewModel[] = [
  {
    id: 'a1',
    kind: 'event_published',
    title: 'Industrial Rebirth veröffentlicht',
    subtitle: 'VOID Events · Köln',
    timestampLabel: 'Vor 2 Std.',
    icon: 'checkmark-circle-outline',
    accessibilityLabel: 'Event veröffentlicht',
  },
  {
    id: 'a2',
    kind: 'verification_updated',
    title: 'Verifizierung aktualisiert',
    subtitle: 'Status: In Prüfung',
    timestampLabel: 'Gestern',
    icon: 'shield-checkmark-outline',
    accessibilityLabel: 'Verifizierung aktualisiert',
  },
];

export const submissionSteps: SubmissionStepViewModel[] = [
  { id: 's1', index: 1, label: 'Basisinfos', state: 'completed' },
  { id: 's2', index: 2, label: 'Details', state: 'active' },
  { id: 's3', index: 3, label: 'Line-up', state: 'upcoming' },
  { id: 's4', index: 4, label: 'Tickets', state: 'upcoming' },
  { id: 's5', index: 5, label: 'Vorschau', state: 'upcoming' },
];

export const submissionFieldSummary: SubmissionFieldSummaryViewModel[] = [
  { id: 'title', label: 'Titel', valueLabel: 'Industrial Rebirth', icon: 'text-outline' },
  { id: 'date', label: 'Datum', valueLabel: '14. Nov 2026 · 23:00', icon: 'calendar-outline' },
  { id: 'venue', label: 'Venue', valueLabel: 'Gewerbehof Köln', icon: 'location-outline' },
  { id: 'lineup', label: 'Line-up', valueLabel: 'Kobosil, Shlømo, VTSS', icon: 'musical-notes-outline' },
  { id: 'tickets', label: 'Tickets', valueLabel: 'Ab 18 € · Resident Advisor', icon: 'ticket-outline', missing: false },
];

export const submissionReviewReady: SubmissionReviewViewModel = {
  id: 'review-ready',
  title: 'Industrial Rebirth',
  status: 'ready_for_review',
  completenessLabel: 'Alle Pflichtfelder ausgefüllt',
  accessibilityLabel: 'Review bereit',
};

export const submissionReviewIncomplete: SubmissionReviewViewModel = {
  id: 'review-incomplete',
  title: 'Warehouse Frequencies',
  status: 'incomplete',
  warningLabel: 'Line-up und Ticketlink fehlen',
  accessibilityLabel: 'Review unvollständig',
};

export const industrialRebirthDraft: EventDraftViewModel = {
  id: 'draft-1',
  title: 'Industrial Rebirth',
  lastEditedLabel: 'Heute, 14:32',
  currentStep: 4,
  totalSteps: 5,
  status: 'draft',
  genreLabels: ['Techno', 'Hard Techno'],
  dateLabel: '14. Nov 2026',
  venueLabel: 'Gewerbehof Köln',
  accessibilityLabel: 'Entwurf Industrial Rebirth',
};

export const statisticSummaries: StatisticViewModel[] = [
  {
    id: 'views',
    label: 'Aufrufe',
    valueLabel: '48.7K',
    changeLabel: '↗ 18.6%',
    changeDirection: 'up',
    icon: 'eye-outline',
    accessibilityLabel: '48.7K Aufrufe',
  },
];

export const viewsTrend: StatisticTrendViewModel = {
  id: 'views-trend',
  title: 'Aufrufe',
  valueLabel: '48.7K',
  changeLabel: '↗ 18.6% vs. letzte 7 Tage',
  periodLabel: '7 Tage',
  points: [
    { label: '6. Jun', value: 5200 },
    { label: '8. Jun', value: 6100 },
    { label: '10. Jun', value: 7000 },
    { label: '12. Jun', value: 7800 },
  ],
  accessibilityLabel: 'Aufrufe Trend 7 Tage',
};

export const statisticBreakdowns: StatisticBreakdownViewModel[] = [
  { id: 'cologne', label: 'Köln', valueLabel: '18.4K', shareLabel: '38%', accessibilityLabel: 'Köln Aufrufe' },
  { id: 'berlin', label: 'Berlin', valueLabel: '12.1K', shareLabel: '25%', accessibilityLabel: 'Berlin Aufrufe' },
];

export const profileCompletion: ProfileCompletionViewModel = {
  percent: 72,
  statusLabel: 'Profil fast vollständig',
  openItems: ['Social Links hinzufügen', 'Branding-Logo hochladen'],
  ctaLabel: 'Profil vervollständigen',
  accessibilityLabel: 'Profil 72 Prozent vollständig',
};

export const voidSocialLinks: SocialLinkViewModel[] = [
  {
    id: 'ig',
    platform: 'instagram',
    valueLabel: '@voidevents',
    verified: true,
    accessibilityLabel: 'Instagram VOID Events',
  },
  {
    id: 'web',
    platform: 'website',
    valueLabel: 'voidevents.de',
    accessibilityLabel: 'Website VOID Events',
  },
];

export const teamMembers: TeamMemberManagementViewModel[] = [
  {
    id: 'tm1',
    name: 'Daniel Weber',
    emailLabel: 'daniel@voidevents.de',
    role: 'owner',
    statusLabel: 'Online · Zuletzt aktiv: Jetzt',
    accessibilityLabel: 'Daniel Weber Owner',
  },
  {
    id: 'tm2',
    name: 'Lena Krause',
    emailLabel: 'lena@voidevents.de',
    role: 'editor',
    statusLabel: 'Zuletzt aktiv: Vor 3 Std.',
    accessibilityLabel: 'Lena Krause Editor',
  },
];

export const pendingInvite: TeamInviteViewModel = {
  id: 'inv1',
  emailLabel: 'booking@rheinrausch.de',
  role: 'editor',
  status: 'pending',
  sentLabel: 'Vor 2 Tagen',
  accessibilityLabel: 'Offene Einladung Rheinrausch',
};

export const ticketIntegration: IntegrationViewModel = {
  id: 'int-ra',
  provider: 'ra',
  name: 'Resident Advisor Ticketing',
  description: 'Ticket-Links und Verfügbarkeit synchronisieren',
  status: 'connected',
  lastSyncLabel: 'Heute, 09:27',
  accessibilityLabel: 'Resident Advisor Integration verbunden',
};

export const externalTicketIntegration: IntegrationViewModel = {
  id: 'int-shotgun',
  provider: 'shotgun',
  name: 'Shotgun',
  description: 'Externe Ticketplattform',
  status: 'needs_attention',
  lastSyncLabel: 'Gestern, 18:14',
  accessibilityLabel: 'Shotgun Integration benötigt Aufmerksamkeit',
};

export const verificationRequirements: VerificationRequirementViewModel[] = [
  {
    id: 'org',
    kind: 'organization',
    title: 'Organisation bestätigen',
    description: 'VOID Events als offiziellen Veranstalter nachweisen',
    status: 'complete',
    accessibilityLabel: 'Organisation erledigt',
  },
  {
    id: 'social',
    kind: 'social',
    title: 'Social Account verknüpfen',
    description: '@voidevents auf Instagram',
    status: 'open',
    accessibilityLabel: 'Social Account offen',
  },
];

export const adminMetrics: AdminMetricViewModel[] = [
  {
    id: 'pending-events',
    kind: 'pending_events',
    label: 'Pending Events',
    valueLabel: '23',
    changeLabel: 'Warten auf Prüfung',
    icon: 'clipboard-outline',
    accessibilityLabel: '23 Events warten auf Prüfung',
  },
  {
    id: 'reports',
    kind: 'reports',
    label: 'Offene Reports',
    valueLabel: '17',
    changeLabel: 'Benötigen Entscheidung',
    icon: 'flag-outline',
    accessibilityLabel: '17 offene Reports',
  },
  {
    id: 'sources',
    kind: 'failed_sources',
    label: 'Fehlerhafte Quellen',
    valueLabel: '4',
    changeLabel: 'Benötigen Aufmerksamkeit',
    icon: 'warning-outline',
    accessibilityLabel: '4 fehlerhafte Quellen',
  },
];

export const adminQueueTabs: AdminQueueTabViewModel[] = [
  { id: 'events', label: 'Alle', count: 123, active: true },
  { id: 'organizers', label: 'Pending', count: 89 },
  { id: 'reports', label: 'In Prüfung', count: 21 },
  { id: 'duplicates', label: 'Genehmigt', count: 9 },
];

export const pendingEventReview: AdminReviewViewModel = {
  id: 'rev-1',
  type: 'event',
  title: 'Underground Movement',
  status: 'pending',
  locationLabel: 'Berlin, Deutschland',
  dateLabel: '28. Jun 2026 · 22:00',
  submittedByLabel: 'Eingereicht von VOID Events',
  timestampLabel: 'Vor 15 Min.',
  isNew: true,
  accessibilityLabel: 'Event Review Underground Movement',
};

export const organizerVerificationReview: AdminReviewViewModel = {
  id: 'rev-2',
  type: 'organizer',
  title: 'VOID Events Verifizierung',
  status: 'in_review',
  submittedByLabel: 'Eingereicht von Daniel Weber',
  timestampLabel: 'In Prüfung seit Vor 2 Std.',
  accessibilityLabel: 'Organizer Verifizierung VOID Events',
};

export const reviewTimeline: ReviewTimelineViewModel = {
  id: 'timeline-1',
  entries: [
    { id: 't1', label: 'Eingereicht', timestampLabel: 'Vor 15 Min.', status: 'completed', actorLabel: 'VOID Events' },
    { id: 't2', label: 'In Prüfung', timestampLabel: 'Vor 10 Min.', status: 'active', actorLabel: 'Max Admin' },
    { id: 't3', label: 'Genehmigt', timestampLabel: '—', status: 'upcoming' },
  ],
  accessibilityLabel: 'Review Timeline Underground Movement',
};

export const residentAdvisorSource: EventSourceViewModel = {
  id: 'src-ra',
  name: 'Resident Advisor',
  sourceType: 'api',
  sourceTypeLabel: 'Offizielle API',
  urlLabel: 'ra.co',
  lastImportLabel: 'Heute, 09:27',
  status: 'active',
  eventCountLabel: '4.218',
  healthLabel: 'Gesund',
  icon: 'server-outline',
  accessibilityLabel: 'Resident Advisor Quelle aktiv',
};

export const pausedSource: EventSourceViewModel = {
  id: 'src-ig',
  name: 'Instagram VOID Events',
  sourceType: 'social',
  sourceTypeLabel: 'Social Media',
  lastImportLabel: 'Gestern, 22:10',
  status: 'paused',
  eventCountLabel: '128',
  healthLabel: 'Pausiert',
  icon: 'logo-instagram',
  accessibilityLabel: 'Instagram Quelle pausiert',
};

export const sourceHealth: SourceHealthViewModel = {
  successRateLabel: '94%',
  lastSuccessLabel: 'Heute, 09:27',
  lastErrorLabel: 'Rate Limit bei Shotgun — vor 6 Std.',
  importCountLabel: '28.542',
  duplicateCountLabel: '17',
  accessibilityLabel: 'Source Health Resident Advisor',
};

export const duplicateCandidate: DuplicateCandidateViewModel = {
  id: 'dup-1',
  similarityScoreLabel: '92% Ähnlichkeit',
  events: [
    {
      id: 'e1',
      title: 'Industrial Rebirth',
      dateLabel: '14. Nov 2026',
      venueLabel: 'Gewerbehof Köln',
      cityLabel: 'Köln',
      sourceLabel: 'Resident Advisor',
      organizerLabel: 'VOID Events',
    },
    {
      id: 'e2',
      title: 'Industrial Rebirth Köln',
      dateLabel: '14. Nov 2026',
      venueLabel: 'Gewerbehof',
      cityLabel: 'Köln',
      sourceLabel: 'Shotgun',
      organizerLabel: 'VOID Events',
    },
  ],
  accessibilityLabel: 'Duplicate Candidate Industrial Rebirth',
};

export const duplicateComparisons: DuplicateComparisonViewModel[] = [
  { fieldLabel: 'Titel', state: 'different', leftValueLabel: 'Industrial Rebirth', rightValueLabel: 'Industrial Rebirth Köln' },
  { fieldLabel: 'Datum', state: 'equal', leftValueLabel: '14. Nov 2026', rightValueLabel: '14. Nov 2026' },
  { fieldLabel: 'Venue', state: 'conflict', leftValueLabel: 'Gewerbehof Köln', rightValueLabel: 'Gewerbehof' },
];

export const canonicalEvent: CanonicalEventViewModel = {
  title: 'Industrial Rebirth',
  dateLabel: '14. Nov 2026 · 23:00',
  venueLabel: 'Gewerbehof Köln',
  cityLabel: 'Köln',
  sourceLabels: ['Resident Advisor', 'VOID Events'],
  accessibilityLabel: 'Kanonische Vorschau Industrial Rebirth',
};

export const sourceAttributions: SourceAttributionViewModel[] = [
  {
    sourceLabel: 'Resident Advisor',
    valueLabel: 'Gewerbehof Köln',
    freshnessLabel: 'Aktualisiert vor 2 Std.',
    priorityLabel: 'Hoch',
    accessibilityLabel: 'RA Venue Attribution',
  },
];

export const auditEntries: AuditLogViewModel[] = [
  {
    id: 'log-1',
    actorLabel: 'Max Admin',
    actionLabel: 'Event genehmigt',
    entityLabel: 'Underground Movement',
    timestampLabel: 'Vor 10 Min.',
    previousStatusLabel: 'Pending',
    newStatusLabel: 'Genehmigt',
    icon: 'checkmark-circle-outline',
    accessibilityLabel: 'Audit Event genehmigt',
  },
  {
    id: 'log-2',
    actorLabel: 'System',
    actionLabel: 'Import-Fehler',
    entityLabel: 'Shotgun Quelle',
    timestampLabel: 'Vor 1 Std.',
    reasonLabel: 'Rate Limit überschritten',
    icon: 'warning-outline',
    accessibilityLabel: 'Audit Import Fehler',
  },
];
