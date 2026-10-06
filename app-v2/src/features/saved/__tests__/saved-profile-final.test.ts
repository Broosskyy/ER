import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { SavedEvent } from '@/features/saved/types/saved-event';

const savedScreenSource = readFileSync(join(process.cwd(), 'app/(tabs)/saved.tsx'), 'utf8');
const profileScreenSource = readFileSync(join(process.cwd(), 'app/(tabs)/profile.tsx'), 'utf8');
const homeHeaderSource = readFileSync(
  join(process.cwd(), 'src/features/home/components/HomeHeader.tsx'),
  'utf8',
);
const savedPresentationSource = readFileSync(
  join(process.cwd(), 'src/features/saved/utils/saved-presentation.ts'),
  'utf8',
);
const presentationSource = readFileSync(
  join(process.cwd(), 'src/features/events/status/event-status-resolver.ts'),
  'utf8',
);
const profileEditSource = readFileSync(join(process.cwd(), 'app/profile/edit.tsx'), 'utf8');
const profileContentSource = readFileSync(
  join(process.cwd(), 'src/features/profile/components/ProfileScreenContent.tsx'),
  'utf8',
);
const settingsIndexSource = readFileSync(join(process.cwd(), 'app/settings/index.tsx'), 'utf8');

const REFERENCE_DATE = '2026-05-24T12:00:00.000Z';

function createSavedEvent(overrides: Partial<SavedEvent['event']> = {}): SavedEvent {
  return {
    eventId: 'sample',
    savedAt: REFERENCE_DATE,
    event: {
      id: 'sample',
      slug: 'sample',
      title: 'Sample Event',
      description: '',
      image: 0,
      date: '24 MAI',
      startTime: '23:00',
      venue: 'Bootshaus',
      city: 'Köln',
      genres: ['Techno'],
      artists: [],
      source: 'demo',
      sourceLabel: 'Demo',
      startsAt: '2026-05-24T23:00:00',
      startDateTime: '2026-05-24T23:00:00',
      timezone: 'Europe/Berlin',
      status: 'published',
      ...overrides,
    },
  };
}

describe('saved presentation contracts', () => {
  it('defines postponed demo status and saved-at formatting helpers', () => {
    expect(presentationSource).toContain('klangkuenstler-berghain');
    expect(savedPresentationSource).toContain('formatSavedAtLabel');
    expect(savedPresentationSource).toContain('resolveEventPresentation');
  });

  it('builds saved event fixtures for filter tests', () => {
    const upcoming = createSavedEvent({ id: 'upcoming', startDateTime: '2026-05-25T23:00:00' });
    const past = createSavedEvent({ id: 'past', startDateTime: '2026-04-10T22:00:00' });
    expect(upcoming.event.id).toBe('upcoming');
    expect(past.event.id).toBe('past');
  });
});

describe('saved and profile screen wiring', () => {
  it('uses compact premium cards, filters, and toast feedback on saved', () => {
    expect(savedScreenSource).toContain('SavedFilterBar');
    expect(savedScreenSource).toContain('SavedEventCard');
    expect(savedScreenSource).toContain('useToast');
    expect(savedScreenSource).toContain('Gespeichert');
  });

  it('renders profile content and settings entry points', () => {
    expect(profileScreenSource).toContain('ProfileScreenContent');
  });

  it('connects home activity icon to the activity route', () => {
    expect(homeHeaderSource).toContain("router.push('/activity')");
    expect(homeHeaderSource).toContain('home-activity-button');
  });

  it('supports profile edit unsaved changes and settings navigation', () => {
    expect(profileEditSource).toContain('Ungespeicherte Änderungen');
    expect(profileEditSource).toContain('Weiter bearbeiten');
    expect(profileContentSource).toContain("router.push('/settings/account')");
    expect(profileContentSource).toContain('PROFILE_ORGANIZER_ROUTE');
    expect(profileContentSource).toContain('Alert.alert');
    expect(settingsIndexSource).toContain('Einstellungen');
  });
});
