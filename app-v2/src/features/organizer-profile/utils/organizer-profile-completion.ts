import type { ProfileCompletionViewModel } from '@/components/organizer/view-models';

import type { OrganizerProfileRecord } from '../types/organizer-profile';

const COMPLETION_FIELDS: {
  id: string;
  label: string;
  isComplete: (profile: OrganizerProfileRecord) => boolean;
}[] = [
  { id: 'name', label: 'Name hinzufügen', isComplete: (profile) => Boolean(profile.name.trim()) },
  { id: 'description', label: 'Beschreibung ergänzen', isComplete: (profile) => Boolean(profile.description.trim()) },
  { id: 'location', label: 'Standort angeben', isComplete: (profile) => Boolean(profile.location.trim()) },
  { id: 'logo', label: 'Logo hochladen', isComplete: (profile) => Boolean(profile.logoUri?.trim()) },
  { id: 'banner', label: 'Banner hochladen', isComplete: (profile) => Boolean(profile.bannerUri?.trim()) },
  { id: 'website', label: 'Website verlinken', isComplete: (profile) => Boolean(profile.website.trim()) },
  { id: 'contact', label: 'Kontaktinformationen ergänzen', isComplete: (profile) =>
    Boolean(profile.contactEmail.trim() || profile.contactPhone.trim()) },
  { id: 'social', label: 'Social Links hinzufügen', isComplete: (profile) => profile.socialLinks.length > 0 },
];

export function calculateOrganizerProfileCompletion(profile: OrganizerProfileRecord): number {
  const completed = COMPLETION_FIELDS.filter((field) => field.isComplete(profile)).length;
  return Math.round((completed / COMPLETION_FIELDS.length) * 100);
}

export function buildOrganizerProfileCompletion(
  profile: OrganizerProfileRecord,
): ProfileCompletionViewModel {
  const percent = calculateOrganizerProfileCompletion(profile);
  const openItems = COMPLETION_FIELDS.filter((field) => !field.isComplete(profile)).map(
    (field) => field.label,
  );

  return {
    percent,
    statusLabel:
      percent >= 100
        ? 'Profil vollständig'
        : percent >= 70
          ? 'Profil fast vollständig'
          : 'Profil unvollständig',
    openItems,
    ctaLabel: percent >= 100 ? undefined : 'Profil vervollständigen',
    accessibilityLabel: `Organizer-Profil ${percent} Prozent vollständig`,
  };
}
