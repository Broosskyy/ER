import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { stripDescriptionBoilerplate } from '@/features/import/unified-website/description-boilerplate';
import { extractEventDescription } from '@/features/import/unified-website/description-extraction';
import { extractDetailPage } from '@/features/import/unified-website/detail-extraction';
import { extractTicketUrl } from '@/features/import/unified-website/ticket-extraction';
import { discoverEventUrlsFromListPage } from '@/features/import/unified-website/list-discovery';
import { bootshausProviderAdapter } from '@/features/import/unified-website/provider-adapters';

const R3HAB_FIXTURE = join(
  process.cwd(),
  'docs/real-data/_phase4823_live_evidence/live-official-website-98.html',
);

function loadR3habHtml(): string {
  try {
    return readFileSync(R3HAB_FIXTURE, 'utf8');
  } catch {
    return `
      <a href="https://bootshaus-club.ticket.io/C7JPnatZ/" class="button secondary fluid">Tickets</a>
      <div class="event-description-content">
        <p>On September 4th, BOOTSHAUS presents R3HAB on the MAINFLOOR.</p>
        <p>R3HAB</p><p>▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔</p>
        <p>Einlass ab 18 Jahren</p><p>Bootshaus Mobile App:</p>
      </div>
      <button class="event-description-toggle"></button>
    `;
  }
}

describe('unified-website description extraction', () => {
  it('prefers event-description-content over og:description', () => {
    const html = loadR3habHtml();
    const result = extractEventDescription(html);
    expect(result.source).toBe('event_description_content');
    expect(result.description).toContain('September 4th');
    expect(result.description).not.toContain('Bootshaus Mobile App');
    expect(result.description).not.toContain('bit.ly');
  });

  it('strips venue footer boilerplate without removing lineup', () => {
    const { text } = stripDescriptionBoilerplate(
      'MAINFLOOR:\nR3HAB\nLA FUENTE\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\nEinlass ab 18 Jahren\nBootshaus Mobile App',
    );
    expect(text).toContain('R3HAB');
    expect(text).toContain('LA FUENTE');
    expect(text).not.toContain('Einlass ab 18');
    expect(text).not.toContain('Mobile App');
  });
});

describe('unified-website ticket extraction', () => {
  it('prefers explicit HTML ticket CTA over shop root nav link', () => {
    const html = loadR3habHtml();
    const ticket = extractTicketUrl(html, 'https://bootshaus.tv/events/r3hab');
    expect(ticket.strategy).toBe('html_ticket_cta');
    expect(ticket.url).toMatch(/bootshaus-club\.ticket\.io\/C7JPnatZ/);
    expect(ticket.url).not.toMatch(/bit\.ly/);
  });

  it('never returns promotional bit.ly links', () => {
    const html = '<a href="https://bit.ly/Bootshaus-App">App</a>';
    const ticket = extractTicketUrl(html);
    expect(ticket.url).toBeUndefined();
    expect(ticket.strategy).toBe('none');
  });
});

describe('unified-website detail extraction', () => {
  it('extracts genres from provider adapter on bootshaus pages', () => {
    const html = loadR3habHtml();
    const detail = extractDetailPage(html, 'https://bootshaus.tv/events/r3hab');
    expect(detail.genres?.length).toBeGreaterThan(0);
    expect(detail.description?.source).toBe('event_description_content');
  });
});

describe('unified-website list discovery', () => {
  it('discovers bootshaus event URLs from list HTML', () => {
    const listHtml = `
      <a href="https://bootshaus.tv/events/test-event">Event</a>
      <a href="https://bootshaus.tv/events/other-event/">Other</a>
    `;
    const config = bootshausProviderAdapter.listDiscovery!;
    const result = discoverEventUrlsFromListPage(
      listHtml,
      config.listPageUrl,
      config.eventLinkPattern,
      config.strategy,
    );
    expect(result.discoveredUrls).toContain('https://bootshaus.tv/events/test-event');
    expect(result.discoveredUrls).toContain('https://bootshaus.tv/events/other-event');
  });
});
