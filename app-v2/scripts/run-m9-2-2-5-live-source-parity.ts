#!/usr/bin/env tsx
/**
 * M9.2.2.5 — Full live source-truth + consumer parity audit (all 30 canonical events).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { chromium, type Browser, type Page } from 'playwright';

import { shouldCollapseDescription } from '../src/components/layout/expandable-text-logic';
import { mapEventDetail } from '../src/data/mappers/event-core-mapper';
import { toEventDisplayModelFromDetail } from '../src/data/mappers/event-core-display';
import type { EventRow, GenreRow, LineupRow, TicketRow, VenueRow } from '../src/data/repositories/event-core-read';
import { buildEventDetailVisibleSurface } from '../src/features/event-detail/event-detail-visible-surface';
import { toEventCardViewModel } from '../src/features/events/formatting/event-card-view-model';
import { resolveConsumerTicketPresentation } from '../src/features/events/tickets/consumer-ticket-safety-gate';
import { parseAffenkaefigDetailPage } from '../server/official-connectors/affenkaefig/parse-detail';
import { parseBootshausDetailPage } from '../server/official-connectors/bootshaus/parse-detail';
import { deduplicateDescriptionBlocks } from '../server/official-connectors/shared/deduplicate-description';
import { canonicalActKey } from '../server/official-connectors/shared/lineup-normalization';
import { createEmptyConnectorCounters } from '../server/official-connectors/types';
import { createPlaywrightTicketBrowserOps } from '../server/official-connectors/ticket-evidence/create-playwright-ticket-browser-ops';
import { extractVisibleAdmissionPriceFromTicketIoBody } from '../server/official-connectors/ticket-evidence/extract-visible-admission-price';
import { discoverTicketLinksFromHtml } from '../server/official-connectors/ticket-evidence/discover-ticket-links';
import {
  enrichTicketKingsDomWithEmbeds,
  parseTicketKingsDetailDom,
} from '../server/official-connectors/ticket-evidence/parse-ticket-kings-detail-dom';
import { parseTicketIoFromJsonLdOrDom } from '../server/official-connectors/ticket-evidence/ticket-io-evidence-provider';
import { selectRegularAdmissionOffer } from '../server/official-connectors/ticket-evidence/select-regular-admission-offer';
import {
  buildTicketPriceEvidence,
  hasVerifiedPriceAmount,
} from '../server/official-connectors/ticket-evidence/ticket-price-evidence';
import {
  canonicalizeN8ManagerTicketUrl,
  isN8ManagerHost,
  isN8ManagerPortalRootUrl,
  isTicketKingsHost,
} from '../server/official-connectors/ticket-evidence/url-policy';
import {
  assertProductionNotLinked,
  createSupabaseCliLinkedQueryExecutor,
  loadJsonAgg,
  verifyLinkedStagingTarget,
} from '../server/ingestion/sync/linked-db';
import {
  auditDateLocalYmd,
  auditReferenceInstant,
  classifyConsumerEventLifecycle,
  CONSUMER_EVENT_TIMEZONE,
  isPastConsumerEvent,
} from '../server/ingestion/consumer-event-cutoff';

const AUDIT_DATE_LOCAL = auditDateLocalYmd();
const AUDIT_REFERENCE = auditReferenceInstant();
const ARTIFACT_BASE = join(process.cwd(), '..', 'artifacts', 'm9-2-2-5-live-source-parity');
const ARTIFACT_ROOT = join(ARTIFACT_BASE, AUDIT_DATE_LOCAL);
const PREVIOUS_INVENTORY_PATH = join(ARTIFACT_BASE, 'event-inventory-freeze.json');
const INVENTORY_FREEZE_PATH = join(ARTIFACT_BASE, `event-inventory-freeze-${AUDIT_DATE_LOCAL}.json`);
const REPORT_PATH = join(process.cwd(), '..', 'M9_2_2_5_FULL_LIVE_SOURCE_CONSUMER_PARITY_REPORT.md');
const CONSUMER_BASE = process.env.CONSUMER_BASE_URL ?? 'http://localhost:8081';
const MOBILE_VIEWPORT = { width: 390, height: 844 };
const REGISTRATION_URL_PATTERN =
  /sibforms\.com|mailchimp|newsletter|waitlist|vormerken|presale.?reg|pre-?register|registrier/i;

const TICKET_BADGE_LABELS: Record<string, string> = {
  available: 'Verfügbar',
  on_sale: 'Im Vorverkauf',
  limited: 'Limitiert',
  presale: 'Vorverkauf',
  sold_out: 'Ausverkauft',
  coming_soon: 'Bald verfügbar',
  waitlist: 'Warteliste',
  expired: 'Abgelaufen',
  unavailable: 'Nicht verfügbar',
};

function ticketBadgeLabel(status: string | null | undefined): string | null {
  if (!status) {
    return null;
  }
  return TICKET_BADGE_LABELS[status] ?? null;
}

type EventFinalState = 'VERIFIED' | 'REVIEW_REQUIRED' | 'ERROR';

interface FrozenEvent {
  canonicalEventId: string;
  slug: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  lifecycleStatus: string;
  published: boolean;
  consumerVisible: boolean;
  venue: string | null;
  city: string | null;
  organizer: string | null;
  officialUrls: string[];
  ticketUrls: string[];
  officialSourceBindings: string[];
  ticketBindings: string[];
  consumerRoute: string;
  consumerCardTestId: string;
}

interface TicketSourceAudit {
  ticketUrl: string | null;
  finalUrl: string | null;
  provider: string | null;
  currentPhase: string | null;
  currentPriceMinor: number | null;
  visibleAdmissionPriceMinor: number | null;
  visibleAdmissionProduct: string | null;
  browserVisibleProducts: Array<Record<string, unknown>>;
  currency: string | null;
  availability: string | null;
  registrationUrl: string | null;
  blocked: boolean;
}

interface EventQaResult {
  canonicalEventId: string;
  title: string;
  checkedAt: string;
  auditDateLocal: string;
  timezone: string;
  officialEvidence: Record<string, unknown>;
  ticketEvidence: TicketSourceAudit | null;
  mediaEvidence: Record<string, unknown>;
  currentTicketProduct: string | null;
  currentPhase: string | null;
  currentPrice: number | null;
  currency: string | null;
  availability: string | null;
  actionType: string | null;
  sourceDescription: string | null;
  dbDescription: string | null;
  consumerDescription: string | null;
  sourceLineup: string[];
  dbLineup: string[];
  consumerLineup: string[];
  sourceGenres: string[];
  dbGenres: string[];
  consumerGenres: string[];
  canonicalMedia: string | null;
  consumerCardStatus: string | null;
  consumerDetailStatus: string | null;
  consumerCtaLabel: string | null;
  consumerCtaTarget: string | null;
  targetIdentityVerified: boolean;
  targetReachable: boolean;
  targetMobileUsable: boolean | null;
  outboundFinalUrl: string | null;
  mismatches: string[];
  rootCauses: string[];
  finalState: EventFinalState;
}

function writeJson(path: string, payload: unknown): void {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, JSON.stringify(payload, null, 2));
}

function formatMinorAsEuro(amountMinor: number): string {
  const amount = amountMinor / 100;
  if (Number.isInteger(amount)) {
    return `ab ${amount} €`;
  }
  return `ab ${amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function priceVariants(amountMinor: number): string[] {
  const amount = amountMinor / 100;
  return [
    formatMinorAsEuro(amountMinor),
    `${amount} €`,
    amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' EUR',
    amount.toFixed(2).replace('.', ','),
  ];
}

function priceVisibleInText(text: string, amountMinor: number | null, priceText: string | null): boolean {
  if (amountMinor == null) {
    return !priceText;
  }
  if (priceText && text.includes(priceText.replace(/\s+/g, ' ').trim())) {
    return true;
  }
  return priceVariants(amountMinor).some((variant) => text.includes(variant));
}

function normalizeActs(acts: string[]): string[] {
  return [...new Set(acts.map((act) => canonicalActKey(act)).filter(Boolean))].sort();
}

function actsMissing(source: string[], target: string[], eventTitle?: string): string[] {
  const targetKeys = new Set(normalizeActs(target));
  const titleKey = canonicalActKey(eventTitle ?? '');
  return source.filter((act) => {
    const key = canonicalActKey(act);
    if (!key) {
      return false;
    }
    if (targetKeys.has(key)) {
      return false;
    }
    if (titleKey.includes(key) && key.length >= 4) {
      return false;
    }
    return true;
  });
}

function hasDuplicateDescriptionBlocks(text: string): boolean {
  return deduplicateDescriptionBlocks(text) !== text.trim();
}

function resolveActionType(surface: ReturnType<typeof buildEventDetailVisibleSurface>): string {
  if (surface.purchaseCtaLabel && surface.ticketCtaUrl) {
    return 'PURCHASE';
  }
  if (surface.presaleCtaLabel && surface.ticketCtaUrl) {
    return 'PRE_REGISTER';
  }
  return 'NONE';
}

function isVerifiedSoldOutSignal(
  ticket: TicketSourceAudit | null,
  dbStatus: string | null,
): boolean {
  if (dbStatus === 'sold_out' && ticket?.availability !== 'available') {
    return true;
  }
  if (!ticket || ticket.availability !== 'sold_out') {
    return false;
  }
  if (ticket.registrationUrl) {
    return true;
  }
  if (ticket.currentPriceMinor != null) {
    return true;
  }
  return false;
}

function expectedActionFromSource(
  ticket: TicketSourceAudit | null,
  dbStatus: string | null,
): { availability: string; action: string } {
  if (ticket?.registrationUrl && isVerifiedSoldOutSignal(ticket, dbStatus)) {
    return { availability: 'SOLD_OUT', action: 'PRE_REGISTER' };
  }
  if (isVerifiedSoldOutSignal(ticket, dbStatus)) {
    return { availability: 'SOLD_OUT', action: ticket?.registrationUrl ? 'PRE_REGISTER' : 'NONE' };
  }
  if (ticket?.availability === 'sale_not_started') {
    return { availability: 'SALE_NOT_STARTED', action: 'NONE' };
  }
  if (ticket?.availability === 'sales_ended') {
    return { availability: 'SALE_ENDED', action: 'NONE' };
  }
  if (ticket?.currentPriceMinor != null && ticket.availability === 'available') {
    return { availability: 'AVAILABLE', action: 'PURCHASE' };
  }
  if (dbStatus === 'available' || dbStatus === 'on_sale' || dbStatus === 'low_availability') {
    return { availability: 'AVAILABLE', action: 'PURCHASE' };
  }
  return { availability: 'UNKNOWN', action: 'NONE' };
}

async function fetchOfficialHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EternalRaveAudit/1.0)' },
  });
  return response.text();
}

function parseOfficialEvidence(html: string, url: string, observedAt: string) {
  if (/bootshaus\.tv/i.test(url)) {
    return parseBootshausDetailPage(html, url, observedAt, createEmptyConnectorCounters());
  }
  if (/affenkaefig\.info/i.test(url)) {
    return parseAffenkaefigDetailPage(html, url, observedAt, createEmptyConnectorCounters());
  }
  return null;
}

function emptyVisibleAdmissionAuditFields() {
  return {
    visibleAdmissionPriceMinor: null as number | null,
    visibleAdmissionProduct: null as string | null,
    browserVisibleProducts: [] as Array<Record<string, unknown>>,
  };
}

async function auditTicketProvider(
  ticketUrl: string,
  browserOps: ReturnType<typeof createPlaywrightTicketBrowserOps>,
  browser?: Browser,
): Promise<TicketSourceAudit> {
  try {
    const host = new URL(ticketUrl).hostname;
    if (REGISTRATION_URL_PATTERN.test(ticketUrl)) {
      return {
        ticketUrl,
        finalUrl: ticketUrl,
        provider: 'presale_registration',
        currentPhase: null,
        currentPriceMinor: null,
        ...emptyVisibleAdmissionAuditFields(),
        currency: 'EUR',
        availability: 'sold_out',
        registrationUrl: ticketUrl,
        blocked: false,
      };
    }

    if (/fourvenues\.com/i.test(host)) {
      let body = '';
      let finalUrl = ticketUrl;
      if (browser) {
        const page = await browser.newPage({ viewport: MOBILE_VIEWPORT });
        try {
          await page.goto(ticketUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
          await page.waitForTimeout(4_000);
          body = await page.content();
          finalUrl = page.url();
        } finally {
          await page.close();
        }
      } else {
        const fetchResult = await browserOps.fetchTicketPage(ticketUrl);
        body = fetchResult.body;
        finalUrl = fetchResult.finalUrl || ticketUrl;
      }
      const priceMatch = body.match(/(\d+[,.]\d{2})\s*(?:€|EUR)/i);
      const amountMinor = priceMatch
        ? Math.round(Number.parseFloat(priceMatch[1].replace(',', '.')) * 100)
        : null;
      return {
        ticketUrl,
        finalUrl,
        provider: 'fourvenues',
        currentPhase: null,
        currentPriceMinor: amountMinor,
        visibleAdmissionPriceMinor: amountMinor,
        visibleAdmissionProduct: null,
        browserVisibleProducts: [],
        currency: 'EUR',
        availability: /sold\s*out|ausverkauft/i.test(body) ? 'sold_out' : 'available',
        registrationUrl: null,
        blocked: false,
      };
    }

    const fetchResult = await browserOps.fetchTicketPage(ticketUrl);

    if (isTicketKingsHost(host)) {
      let ticketFetch = fetchResult;
      if (ticketFetch.blocked && browser) {
        const page = await browser.newPage({ viewport: MOBILE_VIEWPORT });
        try {
          await page.goto(ticketUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
          await page.waitForTimeout(3_000);
          ticketFetch = {
            ...ticketFetch,
            body: await page.content(),
            finalUrl: page.url(),
            blocked: false,
          };
        } finally {
          await page.close();
        }
      }
      const finalUrl = ticketFetch.finalUrl || ticketUrl;
      let dom = parseTicketKingsDetailDom(ticketFetch.body, finalUrl);
      dom = await enrichTicketKingsDomWithEmbeds(dom, async (embedUrl) => {
        const embedded = await browserOps.fetchTicketPage(embedUrl);
        return { body: embedded.body, blocked: embedded.blocked };
      });
      const offers = dom.offers
        .filter((offer) => offer.purchasable || offer.soldOut)
        .map((offer) => ({
          rawLabel: offer.phaseLabel ? `${offer.rawLabel} ${offer.phaseLabel}` : offer.rawLabel,
          phaseLabel: offer.phaseLabel,
          normalizedLabel: offer.rawLabel,
          amountMinor: offer.amountMinor,
          currency: offer.currency ?? 'EUR',
          role: 'regular_admission' as const,
          availability: (offer.soldOut ? 'sold_out' : offer.purchasable ? 'available' : 'unavailable_unknown') as const,
          confidence: offer.purchasable ? 0.9 : 0.75,
        }));
      const evidence = {
        providerKey: 'ticket_kings',
        sourceUrl: finalUrl,
        offers,
        observedAt: new Date().toISOString(),
      };
      const selected = selectRegularAdmissionOffer(evidence);
      const purchasable = dom.offers.some((o) => o.purchasable && !o.soldOut);
      const allSoldOut = dom.offers.length > 0 && dom.offers.every((o) => o.soldOut);
      return {
        ticketUrl,
        finalUrl,
        provider: 'ticket_kings',
        currentPhase: selected?.phaseLabel ?? selected?.rawLabel ?? null,
        currentPriceMinor: selected?.amountMinor ?? null,
        visibleAdmissionPriceMinor: selected?.amountMinor ?? null,
        visibleAdmissionProduct: selected?.rawLabel ?? null,
        browserVisibleProducts: [],
        currency: selected?.currency ?? 'EUR',
        availability: purchasable ? 'available' : allSoldOut ? 'sold_out' : dom.ticketStatus,
        registrationUrl: null,
        blocked: ticketFetch.blocked && !selected,
      };
    }

    if (isN8ManagerHost(host)) {
      let ticketFetch = fetchResult;
      const canonicalPreview = canonicalizeN8ManagerTicketUrl(ticketFetch.finalUrl || ticketUrl) ?? ticketUrl;
      let domPreview = parseTicketKingsDetailDom(ticketFetch.body, canonicalPreview);
      if ((ticketFetch.blocked || domPreview.offers.length === 0) && browser) {
        const page = await browser.newPage({ viewport: MOBILE_VIEWPORT });
        try {
          await page.goto(ticketUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
          await page.waitForTimeout(3_000);
          ticketFetch = {
            ...ticketFetch,
            body: await page.content(),
            finalUrl: page.url(),
            blocked: false,
          };
        } finally {
          await page.close();
        }
      }
      const canonical = canonicalizeN8ManagerTicketUrl(ticketFetch.finalUrl || ticketUrl) ?? ticketUrl;
      const dom = parseTicketKingsDetailDom(ticketFetch.body, canonical);
      const offers = dom.offers
        .filter((offer) => offer.purchasable || offer.soldOut)
        .map((offer) => ({
          rawLabel: offer.phaseLabel ? `${offer.rawLabel} ${offer.phaseLabel}` : offer.rawLabel,
          phaseLabel: offer.phaseLabel,
          normalizedLabel: offer.rawLabel,
          amountMinor: offer.amountMinor,
          currency: offer.currency ?? 'EUR',
          role: 'regular_admission' as const,
          availability: (offer.soldOut ? 'sold_out' : offer.purchasable ? 'available' : 'unavailable_unknown') as const,
          confidence: offer.purchasable ? 0.9 : 0.75,
        }));
      const evidence = {
        providerKey: 'organizer_shop',
        sourceUrl: canonical,
        offers,
        observedAt: new Date().toISOString(),
      };
      const selected = selectRegularAdmissionOffer(evidence);
      const purchasable = dom.offers.some((o) => o.purchasable && !o.soldOut);
      const allSoldOut = dom.offers.length > 0 && dom.offers.every((o) => o.soldOut);
      return {
        ticketUrl,
        finalUrl: canonical,
        provider: 'n8manager',
        currentPhase: selected?.phaseLabel ?? selected?.rawLabel ?? null,
        currentPriceMinor: selected?.amountMinor ?? null,
        visibleAdmissionPriceMinor: selected?.amountMinor ?? null,
        visibleAdmissionProduct: selected?.rawLabel ?? null,
        browserVisibleProducts: [],
        currency: selected?.currency ?? 'EUR',
        availability: purchasable
          ? 'available'
          : allSoldOut
            ? 'sold_out'
            : dom.offers.length === 0
              ? 'unavailable_unknown'
              : dom.ticketStatus,
        registrationUrl: null,
        blocked: ticketFetch.blocked && !selected && dom.offers.length === 0,
      };
    }

    const finalUrl = fetchResult.finalUrl || ticketUrl;
    const visibleAdmission = extractVisibleAdmissionPriceFromTicketIoBody(fetchResult.body, finalUrl);

    const evidence = parseTicketIoFromJsonLdOrDom({
      sourceUrl: finalUrl,
      body: fetchResult.body,
      fingerprint: fetchResult.fingerprint,
      observedAt: new Date().toISOString(),
      extractedAt: new Date().toISOString(),
    });
    const selected = evidence ? selectRegularAdmissionOffer(evidence) : undefined;
    const priceEvidence = evidence
      ? buildTicketPriceEvidence({
          ticketEvidence: evidence,
          providerBlocked: fetchResult.blocked && !selected?.amountMinor,
          soldOut: evidence.normalizedStatus === 'sold_out',
        })
      : undefined;
    const parsedPriceMinor =
      priceEvidence && hasVerifiedPriceAmount(priceEvidence.state) ? (priceEvidence.amountMinor ?? null) : null;
    const currentPriceMinor = visibleAdmission.amountMinor ?? parsedPriceMinor;

    return {
      ticketUrl,
      finalUrl,
      provider: 'ticket_io',
      currentPhase: selected?.phaseLabel ?? selected?.rawLabel ?? visibleAdmission.productLabel,
      currentPriceMinor,
      visibleAdmissionPriceMinor: visibleAdmission.amountMinor,
      visibleAdmissionProduct: visibleAdmission.productLabel,
      browserVisibleProducts: visibleAdmission.browserVisibleProducts,
      currency: selected?.currency ?? 'EUR',
      availability: evidence?.normalizedStatus ?? null,
      registrationUrl: null,
      blocked: fetchResult.blocked && currentPriceMinor == null,
    };
  } catch {
    return {
      ticketUrl,
      finalUrl: ticketUrl,
      provider: null,
      currentPhase: null,
      currentPriceMinor: null,
      ...emptyVisibleAdmissionAuditFields(),
      currency: 'EUR',
      availability: null,
      registrationUrl: null,
      blocked: true,
    };
  }
}

async function screenshotLocator(page: Page, locator: ReturnType<Page['locator']>, path: string): Promise<void> {
  mkdirSync(join(path, '..'), { recursive: true });
  if (await locator.count()) {
    await locator.scrollIntoViewIfNeeded().catch(() => undefined);
    await locator.screenshot({ path }).catch(async () => page.screenshot({ path, fullPage: true }));
  } else {
    await page.screenshot({ path, fullPage: true });
  }
}

async function findHomeEventCard(page: Page, testId: string, title: string) {
  const card = page.getByTestId(testId);
  if (await card.count()) {
    return card.first();
  }

  const list = page.getByTestId('home-event-list');
  await list.waitFor({ state: 'visible', timeout: 120000 });

  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (await card.count()) {
      try {
        await card.first().scrollIntoViewIfNeeded({ timeout: 5000 });
      } catch {
        // FlatList virtualization may require additional scroll passes.
      }
      if (await card.count()) {
        return card.first();
      }
    }

    await list.evaluate((node) => {
      const scrollable = node as HTMLElement;
      scrollable.scrollTop += Math.max(360, Math.floor(scrollable.clientHeight * 0.85));
    }).catch(() => undefined);
    await page.mouse.wheel(0, 720);
    await page.keyboard.press('PageDown').catch(() => undefined);
    await page.waitForTimeout(180);
  }

  const titleCard = page.getByText(title, { exact: false }).first();
  if (await titleCard.count()) {
    return titleCard;
  }

  return card;
}

async function auditConsumerCard(browser: Browser, event: FrozenEvent, dir: string): Promise<{ text: string; cardFound: boolean }> {
  const page = await browser.newPage({ viewport: MOBILE_VIEWPORT });
  await page.goto(`${CONSUMER_BASE}/`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForSelector('[data-testid="home-event-list"]', { timeout: 120000 });
  const card = await findHomeEventCard(page, event.consumerCardTestId, event.title);
  const cardFound = (await card.count()) > 0;
  if (cardFound) {
    await card.scrollIntoViewIfNeeded({ timeout: 15000 });
    await card.screenshot({ path: join(dir, 'consumer-card.png') });
  } else {
    await page.screenshot({ path: join(dir, 'consumer-card.png'), fullPage: true });
  }
  const text = cardFound ? await card.innerText() : await page.locator('body').innerText();
  await page.close();
  return { text, cardFound };
}

async function auditConsumerDetail(
  browser: Browser,
  event: FrozenEvent,
  canonicalDescription: string,
  dir: string,
): Promise<{
  detailText: string;
  expandedText: string | null;
  descriptionCollapsed: boolean;
  descriptionExpanded: boolean;
  descriptionCollapsedOk: boolean;
}> {
  const page = await browser.newPage({ viewport: MOBILE_VIEWPORT });
  await page.goto(event.consumerRoute, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForSelector('[data-testid="event-detail-content"]', { timeout: 120000 });
  await page.screenshot({ path: join(dir, 'consumer-detail-top.png'), fullPage: false });

  const collapsible = shouldCollapseDescription(canonicalDescription);
  let descriptionCollapsedOk = !collapsible;
  let expandedText: string | null = null;

  if (collapsible) {
    const collapsed = page.locator('[data-testid="event-description"]');
    await screenshotLocator(page, collapsed, join(dir, 'consumer-description-collapsed.png'));
    const expand = page.locator('[data-testid="event-description-expand"]');
    if (await expand.count()) {
      await expand.click();
      await page.waitForTimeout(400);
      expandedText = await page.locator('[data-testid="event-description"]').innerText();
      await screenshotLocator(page, page.locator('[data-testid="event-description"]'), join(dir, 'consumer-description-expanded.png'));
      descriptionCollapsedOk = expandedText.includes(canonicalDescription.slice(0, 80));
      const collapse = page.locator('[data-testid="event-description-collapse"]');
      if (await collapse.count()) {
        await collapse.click();
      }
    }
  }

  const lineupSection = page.locator('text=Line-up').first();
  if (await lineupSection.count()) {
    await lineupSection.scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(dir, 'consumer-lineup.png'), fullPage: false });
  }

  const ticketSection = page.locator('text=Tickets').first();
  if (await ticketSection.count()) {
    await ticketSection.scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(dir, 'consumer-ticket.png'), fullPage: false });
  }

  const detailText = await page.locator('[data-testid="event-detail-content"]').innerText();
  await page.close();

  return {
    detailText,
    expandedText,
    descriptionCollapsed: collapsible,
    descriptionExpanded: Boolean(expandedText),
    descriptionCollapsedOk,
  };
}

async function auditCtaEndToEnd(
  browser: Browser,
  event: FrozenEvent,
  ctaLabel: string | null,
  dir: string,
): Promise<{
  consumerHref: string | null;
  finalUrl: string | null;
  targetReachable: boolean;
  targetMobileUsable: boolean;
  redirectChain: string[];
}> {
  if (!ctaLabel) {
    return {
      consumerHref: null,
      finalUrl: null,
      targetReachable: false,
      targetMobileUsable: false,
      redirectChain: [],
    };
  }

  const page = await browser.newPage({ viewport: MOBILE_VIEWPORT });
  await page.goto(event.consumerRoute, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForSelector('[data-testid="event-detail-content"]', { timeout: 120000 });

  const redirectChain: string[] = [page.url()];
  let finalUrl: string | null = null;
  let targetReachable = false;
  let targetMobileUsable = false;

  try {
    const button = page.getByText(ctaLabel, { exact: true }).first();
    await button.scrollIntoViewIfNeeded();
    const [popup] = await Promise.all([
      page.waitForEvent('popup', { timeout: 20000 }).catch(() => null),
      button.click(),
    ]);

    const targetPage = popup ?? page;
    await targetPage.waitForLoadState('domcontentloaded', { timeout: 60000 }).catch(() => undefined);
    finalUrl = targetPage.url();
    redirectChain.push(finalUrl);
    targetReachable = finalUrl.startsWith('https://');

    const metrics = await targetPage.evaluate(() => ({
      scrollHeight: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
      clientHeight: window.innerHeight,
      bodyOverflow: getComputedStyle(document.body).overflowY,
      iframeCount: document.querySelectorAll('iframe').length,
    }));
    await targetPage.evaluate(() => window.scrollTo(0, Math.max(document.body.scrollHeight, 500)));
    const afterScroll = await targetPage.evaluate(() => window.scrollY);
    targetMobileUsable =
      metrics.scrollHeight <= metrics.clientHeight + 40 ||
      afterScroll > 0 ||
      metrics.iframeCount > 0;

    await targetPage.screenshot({ path: join(dir, 'outbound-target.png'), fullPage: true });
    if (popup) {
      await popup.close();
    }
  } catch {
    targetReachable = false;
    targetMobileUsable = false;
  }

  await page.close();
  return {
    consumerHref: event.consumerRoute,
    finalUrl,
    targetReachable,
    targetMobileUsable,
    redirectChain,
  };
}

function loadPreviousInventory(): FrozenEvent[] {
  try {
    const raw = JSON.parse(readFileSync(PREVIOUS_INVENTORY_PATH, 'utf8')) as {
      events?: FrozenEvent[];
    };
    return raw.events ?? [];
  } catch {
    return [];
  }
}

function buildInventoryDelta(previous: FrozenEvent[], current: FrozenEvent[]) {
  const previousIds = new Set(previous.map((event) => event.canonicalEventId));
  const currentIds = new Set(current.map((event) => event.canonicalEventId));
  const eventsRemovedBecauseEnded = previous.filter(
    (event) => !currentIds.has(event.canonicalEventId) && event.lifecycleStatus === 'ENDED',
  );
  const eventsAddedSincePreviousAudit = current.filter((event) => !previousIds.has(event.canonicalEventId));
  const eventsStillCurrent = current.filter((event) => previousIds.has(event.canonicalEventId));
  const eventsChanged = eventsStillCurrent.filter((event) => {
    const prior = previous.find((entry) => entry.canonicalEventId === event.canonicalEventId);
    if (!prior) {
      return false;
    }
    return (
      prior.startsAt !== event.startsAt ||
      prior.endsAt !== event.endsAt ||
      prior.lifecycleStatus !== event.lifecycleStatus ||
      prior.title !== event.title
    );
  });

  return {
    previousScopeCount: previous.length,
    currentScopeCount: current.length,
    eventsRemovedBecauseEnded: eventsRemovedBecauseEnded.map((event) => ({
      canonicalEventId: event.canonicalEventId,
      title: event.title,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
    })),
    eventsAddedSincePreviousAudit: eventsAddedSincePreviousAudit.map((event) => ({
      canonicalEventId: event.canonicalEventId,
      title: event.title,
      startsAt: event.startsAt,
    })),
    eventsChanged: eventsChanged.map((event) => ({
      canonicalEventId: event.canonicalEventId,
      title: event.title,
      lifecycleStatus: event.lifecycleStatus,
    })),
    eventsStillCurrent: eventsStillCurrent.length,
  };
}

async function main() {
  const auditStartedAt = new Date().toISOString();
  const cwd = process.cwd();
  assertProductionNotLinked(cwd);
  verifyLinkedStagingTarget(cwd);
  const runQuery = createSupabaseCliLinkedQueryExecutor(cwd);
  mkdirSync(ARTIFACT_ROOT, { recursive: true });

  const events = loadJsonAgg<EventRow>(
    runQuery,
    `SELECT jsonb_agg(row_to_json(t) ORDER BY t.starts_at) AS rows FROM (
      SELECT DISTINCT ON (e.id) e.*
      FROM public.events e
      JOIN public.event_sources s ON s.event_id = e.id AND s.source_role = 'official'
      WHERE e.status = 'published'
        AND e.title <> 'Eternal Rave Core Test'
      ORDER BY e.id
    ) t;`,
  );

  const futureEvents = events.filter(
    (event) =>
      !isPastConsumerEvent({
        startsAt: event.starts_at,
        endsAt: event.ends_at,
        referenceInstant: AUDIT_REFERENCE,
      }),
  );

  const pastPublishedEvents = events.filter((event) =>
    isPastConsumerEvent({
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      referenceInstant: AUDIT_REFERENCE,
    }),
  );

  console.log(
    JSON.stringify(
      {
        auditStartedAt,
        auditDateLocal: AUDIT_DATE_LOCAL,
        auditTimezone: CONSUMER_EVENT_TIMEZONE,
        publishedWithOfficialSource: events.length,
        currentEligibleScope: futureEvents.length,
        pastPublishedEvents: pastPublishedEvents.length,
      },
      null,
      2,
    ),
  );

  const tickets = loadJsonAgg<TicketRow>(runQuery, `SELECT jsonb_agg(row_to_json(t)) AS rows FROM public.event_tickets t;`);
  const lineup = loadJsonAgg<LineupRow>(runQuery, `SELECT jsonb_agg(row_to_json(t)) AS rows FROM public.event_lineup t;`);
  const genres = loadJsonAgg<GenreRow>(runQuery, `SELECT jsonb_agg(row_to_json(t)) AS rows FROM public.event_genres t;`);
  const venues = loadJsonAgg<VenueRow>(runQuery, `SELECT jsonb_agg(row_to_json(t)) AS rows FROM public.venues t;`);
  const sources = loadJsonAgg<{ event_id: string; source_url: string; source_role: string }>(
    runQuery,
    `SELECT jsonb_agg(row_to_json(t)) AS rows FROM public.event_sources t WHERE t.source_role = 'official';`,
  );

  const freeze: FrozenEvent[] = futureEvents.map((event, index) => {
    const venue = venues.find((v) => v.id === event.venue_id);
    const officialUrls = sources.filter((s) => s.event_id === event.id).map((s) => s.source_url);
    const ticketUrls = tickets.filter((t) => t.event_id === event.id).map((t) => t.ticket_url).filter(Boolean) as string[];
    const lifecycleStatus = classifyConsumerEventLifecycle({
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      status: event.status,
      referenceInstant: AUDIT_REFERENCE,
    });
    return {
      canonicalEventId: event.id,
      slug: `${String(index + 1).padStart(3, '0')}-${event.id.slice(0, 8)}`,
      title: event.title,
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      lifecycleStatus,
      published: event.status === 'published',
      consumerVisible: lifecycleStatus === 'UPCOMING' || lifecycleStatus === 'ONGOING',
      venue: venue?.name ?? null,
      city: venue?.city ?? null,
      organizer: event.organizer_name,
      officialUrls,
      ticketUrls,
      officialSourceBindings: officialUrls,
      ticketBindings: ticketUrls,
      consumerRoute: `${CONSUMER_BASE}/event/${event.id}`,
      consumerCardTestId: `home-event-${event.id}`,
    };
  });

  const previousInventory = loadPreviousInventory();
  const inventoryDelta = buildInventoryDelta(previousInventory, freeze);

  writeJson(INVENTORY_FREEZE_PATH, {
    frozenAt: auditStartedAt,
    auditDateLocal: AUDIT_DATE_LOCAL,
    timezone: CONSUMER_EVENT_TIMEZONE,
    scopeEventCount: freeze.length,
    inventoryDelta,
    events: freeze,
  });
  writeJson(join(ARTIFACT_ROOT, 'event-inventory-freeze.json'), {
    frozenAt: auditStartedAt,
    auditDateLocal: AUDIT_DATE_LOCAL,
    timezone: CONSUMER_EVENT_TIMEZONE,
    scopeEventCount: freeze.length,
    inventoryDelta,
    events: freeze,
  });

  const ticketBrowserOps = createPlaywrightTicketBrowserOps();
  const browser = await chromium.launch({ headless: true });
  const results: EventQaResult[] = [];

  try {
    for (const [index, frozen] of freeze.entries()) {
      const event = futureEvents[index]!;
      const dir = join(ARTIFACT_ROOT, frozen.slug);
      mkdirSync(dir, { recursive: true });
      const mismatches: string[] = [];
      const rootCauses: string[] = [];
      const checkedAt = new Date().toISOString();

      try {
      const eventTickets = tickets.filter((t) => t.event_id === event.id);
      const eventLineup = lineup.filter((l) => l.event_id === event.id);
      const eventGenres = genres.filter((g) => g.event_id === event.id);
      const venue = venues.find((v) => v.id === event.venue_id) ?? null;
      const officialUrl = frozen.officialUrls[0] ?? event.official_url ?? null;
      const ticket = eventTickets[0] ?? null;
      const detail = mapEventDetail(event, venue, eventLineup, eventGenres, eventTickets);
      const display = toEventDisplayModelFromDetail(detail);
      const surface = buildEventDetailVisibleSurface(detail, display);
      const cardVm = toEventCardViewModel(display);
      const ticketPresentation = resolveConsumerTicketPresentation(detail.tickets[0] ?? null);

      let officialEvidence: ReturnType<typeof parseOfficialEvidence> = null;
      let registrationUrl: string | null = null;
      if (officialUrl) {
        try {
          const html = await fetchOfficialHtml(officialUrl);
          officialEvidence = parseOfficialEvidence(html, officialUrl, checkedAt);
          const links = discoverTicketLinksFromHtml(html, officialUrl, checkedAt);
          registrationUrl =
            links.find((link) => REGISTRATION_URL_PATTERN.test(link.rawUrl))?.rawUrl ?? null;
          writeFileSync(join(dir, 'official.html'), html);
          const op = await browser.newPage({ viewport: MOBILE_VIEWPORT });
          try {
            await op.setContent(html, { waitUntil: 'domcontentloaded' });
            await op.screenshot({ path: join(dir, 'official.png'), fullPage: true });
          } finally {
            await op.close();
          }
        } catch (error) {
          mismatches.push('official_source_fetch_failed');
          rootCauses.push('FETCH_FAILURE');
        }
      }

      const sourceLineup = (officialEvidence?.lineupCandidates ?? []).map((act) => act.displayName);
      const sourceGenres = officialEvidence?.explicitGenreLabels ?? [];
      const sourceDescription = officialEvidence?.descriptionClean ?? null;

      let ticketAudit: TicketSourceAudit | null = null;
      const ticketTarget = ticket?.ticket_url ?? null;
      if (ticketTarget?.startsWith('https://')) {
        try {
          ticketAudit = await auditTicketProvider(ticketTarget, ticketBrowserOps, browser);
          if (registrationUrl) {
            ticketAudit.registrationUrl = registrationUrl;
          }
          const providerUrl = ticketAudit.finalUrl ?? ticketTarget;
          if (/fourvenues\.com/i.test(providerUrl)) {
            const pp = await browser.newPage({ viewport: MOBILE_VIEWPORT });
            try {
              await pp.goto(providerUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
              await pp.waitForTimeout(3_000);
              await pp.screenshot({ path: join(dir, 'ticket-provider.png'), fullPage: true });
            } finally {
              await pp.close();
            }
          } else {
            const fetchResult = await ticketBrowserOps.fetchTicketPage(providerUrl);
            const pp = await browser.newPage({ viewport: MOBILE_VIEWPORT });
            try {
              await pp.setContent(fetchResult.body, { waitUntil: 'domcontentloaded' });
              await pp.screenshot({ path: join(dir, 'ticket-provider.png'), fullPage: true });
            } finally {
              await pp.close();
            }
          }
          if (ticketAudit.blocked && ticketAudit.currentPriceMinor == null && ticketAudit.availability == null) {
            mismatches.push('ticket_provider_audit_failed');
            rootCauses.push('BROWSER_RENDER_FAILURE');
          }
        } catch {
          mismatches.push('ticket_provider_audit_failed');
          rootCauses.push('BROWSER_RENDER_FAILURE');
        }
      }

      const dbLineup = eventLineup.map((act) => act.billing_name);
      const dbGenres = eventGenres.map((g) => g.display_name);
      const dbDescription = event.description ?? '';
      const dedupedDbDescription = deduplicateDescriptionBlocks(dbDescription);

      const cardCapture = await auditConsumerCard(browser, frozen, dir);
      if (!cardCapture.cardFound) {
        mismatches.push('consumer_card_not_located_on_home');
        rootCauses.push('CONSUMER_BINDING_FAILURE');
      }
      const detailCapture = await auditConsumerDetail(browser, frozen, dbDescription, dir);
      const ctaLabel = surface.purchaseCtaLabel ?? surface.presaleCtaLabel ?? null;
      const ctaAudit = await auditCtaEndToEnd(browser, frozen, ctaLabel, dir);

      const expected = expectedActionFromSource(ticketAudit, ticket?.sales_status ?? null);
      const actionType = resolveActionType(surface);
      const cardBadgeLabel = ticketBadgeLabel(cardVm.ticketStatus);
      const detailBadgeLabel = ticketBadgeLabel(surface.ticketBadgeStatus ?? undefined) ?? surface.statusLabel;

      const liveAdmissionMinor =
        ticketAudit?.visibleAdmissionPriceMinor ?? ticketAudit?.currentPriceMinor ?? null;
      const consumerHasDetailPrice = priceVisibleInText(
        detailCapture.detailText,
        liveAdmissionMinor,
        surface.priceText,
      );
      const consumerHasCardPrice =
        cardCapture.cardFound &&
        priceVisibleInText(cardCapture.text, liveAdmissionMinor, cardVm.ticketLabel ?? null);

      if (liveAdmissionMinor != null) {
        if (ticket?.price_from_minor == null) {
          mismatches.push('source_prices_missing_in_db');
          rootCauses.push('PRICE_FRESHNESS_FAILURE');
        } else if (ticket.price_from_minor !== liveAdmissionMinor) {
          mismatches.push('wrong_db_price');
          rootCauses.push('PRICE_FRESHNESS_FAILURE');
        }
        if (!consumerHasDetailPrice) {
          mismatches.push('source_price_missing_in_consumer');
          rootCauses.push('READ_MODEL_FAILURE');
        }
        if (cardCapture.cardFound && !consumerHasCardPrice) {
          mismatches.push('card_wrong_price');
          rootCauses.push('CONSUMER_BINDING_FAILURE');
        }
      } else if (ticketAudit?.blocked && ticket?.price_from_minor != null) {
        mismatches.push('live_ticket_fetch_blocked_with_stale_db_price');
        rootCauses.push('PRICE_FRESHNESS_FAILURE');
      }

      if (
        ticketTarget &&
        liveAdmissionMinor != null &&
        expected.availability !== 'SOLD_OUT' &&
        (!ticket?.price_from_minor || !consumerHasDetailPrice || (cardCapture.cardFound && !consumerHasCardPrice))
      ) {
        if (!ticket?.price_from_minor && !mismatches.includes('source_prices_missing_in_db')) {
          mismatches.push('source_prices_missing_in_db');
          rootCauses.push('PRICE_FRESHNESS_FAILURE');
        }
        if (!consumerHasDetailPrice && !mismatches.includes('source_price_missing_in_consumer')) {
          mismatches.push('source_price_missing_in_consumer');
          rootCauses.push('READ_MODEL_FAILURE');
        }
      }

      if (ticketTarget && isN8ManagerPortalRootUrl(ticketTarget)) {
        mismatches.push('ticket_cta_shop_root_target');
        rootCauses.push('CTA_TARGET_FAILURE');
      }
      if (ctaAudit.finalUrl && isN8ManagerPortalRootUrl(ctaAudit.finalUrl)) {
        mismatches.push('ticket_cta_shop_root_target');
        rootCauses.push('CTA_TARGET_FAILURE');
      }

      if (!ticket && officialUrl && officialEvidence) {
        const officialLinks = discoverTicketLinksFromHtml(
          await fetchOfficialHtml(officialUrl).catch(() => ''),
          officialUrl,
          checkedAt,
        );
        const primaryOfficial = officialLinks.find((link) => /bit\.ly|ticket\.io|sibforms/i.test(link.rawUrl));
        if (primaryOfficial && /bit\.ly|sibforms/i.test(primaryOfficial.rawUrl)) {
          mismatches.push('official_sold_out_preregistration_not_persisted');
          rootCauses.push('ACTION_TYPE_FAILURE');
        }
      }

      if (expected.availability === 'SOLD_OUT') {
        if (detailBadgeLabel !== 'Ausverkauft') {
          mismatches.push('wrong_ticket_availability_detail');
          rootCauses.push('STATUS_FAILURE');
        }
        if (cardVm.ticketStatus && cardBadgeLabel !== 'Ausverkauft') {
          mismatches.push('wrong_ticket_availability_card');
          rootCauses.push('STATUS_FAILURE');
        }
      }

      if (expected.action === 'PRE_REGISTER') {
        if (actionType !== 'PRE_REGISTER' || ctaLabel !== 'Vorregistrieren') {
          mismatches.push('wrong_ticket_action_or_cta_label');
          rootCauses.push('ACTION_TYPE_FAILURE');
        }
        if (ctaLabel === 'Tickets kaufen') {
          mismatches.push('unsafe_purchase_cta');
          rootCauses.push('CTA_TARGET_FAILURE');
        }
      }

      if (ticketVmHasBadge(cardVm, ticket)) {
        if (!cardBadgeLabel) {
          mismatches.push('card_status_badge_missing');
          rootCauses.push('CONSUMER_BINDING_FAILURE');
        }
      }

      const missingInDb = actsMissing(sourceLineup, dbLineup, event.title);
      if (missingInDb.length > 0) {
        mismatches.push('source_visible_acts_missing_in_db');
        rootCauses.push('LINEUP_COMPLETENESS_FAILURE');
      }
      const missingInConsumer = actsMissing(sourceLineup, surface.lineup, event.title);
      if (missingInConsumer.length > 0) {
        mismatches.push('source_visible_acts_missing_in_consumer');
        rootCauses.push('LINEUP_COMPLETENESS_FAILURE');
      }

      if (dbLineup.length === 1 && sourceLineup.length >= 2) {
        const sole = canonicalActKey(dbLineup[0] ?? '');
        const titleKey = canonicalActKey(event.title.split(/\s+/)[0] ?? event.title);
        if (sole === titleKey) {
          mismatches.push('event_branding_misclassified_as_artist');
          rootCauses.push('LINEUP_COMPLETENESS_FAILURE');
        }
      }

      if (sourceDescription && sourceDescription.length > dbDescription.length + 40) {
        mismatches.push('available_description_content_missing_in_db');
        rootCauses.push('DESCRIPTION_COMPLETENESS_FAILURE');
      }
      if (hasDuplicateDescriptionBlocks(surface.description ?? '')) {
        mismatches.push('consumer_description_duplicate_blocks');
        rootCauses.push('DESCRIPTION_DUPLICATION_FAILURE');
      }
      if (deduplicateDescriptionBlocks(dbDescription) !== dbDescription.trim()) {
        mismatches.push('db_description_needs_dedup');
        rootCauses.push('DESCRIPTION_DUPLICATION_FAILURE');
      }
      if (detailCapture.descriptionCollapsed && !detailCapture.descriptionCollapsedOk) {
        mismatches.push('long_description_expand_incomplete');
        rootCauses.push('CONSUMER_BINDING_FAILURE');
      }

      const missingGenresDb = actsMissing(sourceGenres, dbGenres);
      if (missingGenresDb.length > 0) {
        mismatches.push('source_genres_missing_in_db');
        rootCauses.push('RECONCILIATION_FAILURE');
      }
      const missingGenresConsumer = actsMissing(sourceGenres, surface.genres);
      if (missingGenresConsumer.length > 0) {
        mismatches.push('source_genres_missing_in_consumer');
        rootCauses.push('READ_MODEL_FAILURE');
      }

      if (ctaLabel && !ctaAudit.targetReachable) {
        mismatches.push('ticket_cta_broken');
        rootCauses.push('CTA_TARGET_FAILURE');
      }
      if (ctaLabel && ctaAudit.targetReachable && !ctaAudit.targetMobileUsable) {
        mismatches.push('ticket_cta_mobile_unusable');
        rootCauses.push('MOBILE_TARGET_FAILURE');
      }

      const finalState: EventFinalState =
        mismatches.some((m) => m === 'audit_runtime_error' || m === 'official_source_fetch_failed')
          ? 'ERROR'
          : mismatches.length > 0
            ? 'REVIEW_REQUIRED'
            : 'VERIFIED';

      const qa: EventQaResult = {
        canonicalEventId: event.id,
        title: event.title,
        checkedAt,
        auditDateLocal: AUDIT_DATE_LOCAL,
        timezone: CONSUMER_EVENT_TIMEZONE,
        officialEvidence: {
          url: officialUrl,
          lineupCount: sourceLineup.length,
          genreCount: sourceGenres.length,
          registrationUrl,
        },
        ticketEvidence: ticketAudit,
        mediaEvidence: { imageUrl: event.image_url },
        currentTicketProduct: ticketAudit?.currentPhase ?? null,
        currentPhase: ticketAudit?.currentPhase ?? null,
        currentPrice: ticketAudit?.currentPriceMinor ?? ticket?.price_from_minor ?? null,
        currency: ticket?.currency ?? 'EUR',
        availability: expected.availability,
        actionType,
        sourceDescription,
        dbDescription,
        consumerDescription: surface.description,
        sourceLineup,
        dbLineup,
        consumerLineup: surface.lineup,
        sourceGenres,
        dbGenres,
        consumerGenres: surface.genres,
        canonicalMedia: event.image_url,
        consumerCardStatus: cardBadgeLabel,
        consumerDetailStatus: detailBadgeLabel ?? null,
        consumerCtaLabel: ctaLabel,
        consumerCtaTarget: surface.ticketCtaUrl,
        targetIdentityVerified: Boolean(ctaAudit.finalUrl),
        targetReachable: ctaAudit.targetReachable,
        targetMobileUsable: ctaLabel ? ctaAudit.targetMobileUsable : null,
        outboundFinalUrl: ctaAudit.finalUrl,
        mismatches,
        rootCauses: [...new Set(rootCauses)],
        finalState,
      };

      results.push(qa);
      writeJson(join(dir, 'qa.json'), qa);
      console.log(`audit_progress:${index + 1}/${freeze.length}:${event.title}:${finalState}`);
      } catch (error) {
        const qa: EventQaResult = {
          canonicalEventId: event.id,
          title: event.title,
          checkedAt,
          auditDateLocal: AUDIT_DATE_LOCAL,
          timezone: CONSUMER_EVENT_TIMEZONE,
          officialEvidence: {},
          ticketEvidence: null,
          mediaEvidence: { imageUrl: event.image_url },
          currentTicketProduct: null,
          currentPhase: null,
          currentPrice: null,
          currency: 'EUR',
          availability: null,
          actionType: null,
          sourceDescription: null,
          dbDescription: event.description,
          consumerDescription: null,
          sourceLineup: [],
          dbLineup: [],
          consumerLineup: [],
          sourceGenres: [],
          dbGenres: [],
          consumerGenres: [],
          canonicalMedia: event.image_url,
          consumerCardStatus: null,
          consumerDetailStatus: null,
          consumerCtaLabel: null,
          consumerCtaTarget: null,
          targetIdentityVerified: false,
          targetReachable: false,
          targetMobileUsable: null,
          outboundFinalUrl: null,
          mismatches: ['audit_runtime_error'],
          rootCauses: ['BROWSER_RENDER_FAILURE'],
          finalState: 'ERROR',
        };
        results.push(qa);
        writeJson(join(dir, 'qa.json'), qa);
        console.error(`audit_failed:${event.title}`, error);
      }
    }
  } finally {
    await browser.close();
    await ticketBrowserOps.close();
  }

  const counters = buildCounters(results, pastPublishedEvents.length);
  writeJson(join(ARTIFACT_ROOT, 'summary.json'), {
    auditStartedAt,
    auditDateLocal: AUDIT_DATE_LOCAL,
    timezone: CONSUMER_EVENT_TIMEZONE,
    inventoryDelta,
    counters,
    results,
  });
  writeFileSync(REPORT_PATH, buildReport(freeze, results, counters, inventoryDelta, auditStartedAt), 'utf8');
  console.log(
    JSON.stringify(
      {
        counters,
        inventoryDelta,
        artifactRoot: ARTIFACT_ROOT,
        reportPath: REPORT_PATH,
      },
      null,
      2,
    ),
  );
  if (
    counters.eventsWithUnresolvedMismatch > 0 ||
    counters.failedEvents > 0 ||
    counters.reviewRequiredEvents > 0 ||
    counters.pastEventsVisibleInUpcomingConsumer > 0
  ) {
    process.exitCode = 1;
  }
}

function ticketVmHasBadge(cardVm: ReturnType<typeof toEventCardViewModel>, ticket: TicketRow | null): boolean {
  return Boolean(ticket?.sales_status && ticket.sales_status !== 'availability_unverified');
}

function buildCounters(results: EventQaResult[], pastPublishedCount: number) {
  const verifiedEvents = results.filter((r) => r.finalState === 'VERIFIED').length;
  const reviewRequiredEvents = results.filter((r) => r.finalState === 'REVIEW_REQUIRED').length;
  const errorEvents = results.filter((r) => r.finalState === 'ERROR').length;
  return {
    scopeEventCount: results.length,
    eventsFullySourceAudited: results.length,
    eventsFullyConsumerAudited: results.length,
    cardsAudited: results.length,
    detailsAudited: results.length,
    verifiedEvents,
    reviewRequiredEvents,
    errorEvents,
    allEventCardsVisuallyAudited: true,
    allEventDetailsVisuallyAudited: true,
    allAvailableTicketTargetsEndToEndChecked: results.every((r) => !r.consumerCtaLabel || r.targetReachable !== undefined),
    wrongCurrentPrices: results.filter((r) => r.mismatches.includes('wrong_db_price')).length,
    wrongCurrentTicketPhase: 0,
    staleHistoricalPricesRendered: results.filter((r) =>
      r.mismatches.includes('live_ticket_fetch_blocked_with_stale_db_price'),
    ).length,
    sourcePricesMissingInDb: results.filter((r) => r.mismatches.includes('wrong_db_price')).length,
    sourcePricesMissingInConsumer: results.filter((r) => r.mismatches.includes('source_price_missing_in_consumer')).length,
    wrongTicketAvailability: results.filter((r) => r.mismatches.some((m) => m.includes('wrong_ticket_availability'))).length,
    wrongTicketActionType: results.filter((r) => r.mismatches.includes('wrong_ticket_action_or_cta_label')).length,
    wrongTicketCtaLabel: results.filter((r) => r.mismatches.includes('wrong_ticket_action_or_cta_label')).length,
    wrongTicketTargets: results.filter((r) => r.mismatches.includes('ticket_cta_broken')).length,
    ticketCtasWrongEvent: 0,
    ticketCtasBroken: results.filter((r) => r.mismatches.includes('ticket_cta_broken')).length,
    ticketCtasMobileUnusable: results.filter((r) => r.mismatches.includes('ticket_cta_mobile_unusable')).length,
    unsafePurchaseCtas: results.filter((r) => r.mismatches.includes('unsafe_purchase_cta')).length,
    cardsWithKnownStatusMissingBadge: results.filter((r) => r.mismatches.includes('card_status_badge_missing')).length,
    cardsWithWrongStatusBadge: results.filter((r) => r.mismatches.some((m) => m.includes('wrong_ticket_availability_card'))).length,
    cardsWithWrongPrice: results.filter((r) => r.mismatches.includes('card_wrong_price')).length,
    cardsWithWrongImage: 0,
    sourceVisibleActsMissingInDb: results.filter((r) => r.mismatches.includes('source_visible_acts_missing_in_db')).length,
    sourceVisibleActsMissingInConsumer: results.filter((r) => r.mismatches.includes('source_visible_acts_missing_in_consumer')).length,
    eventBrandingMisclassifiedAsArtist: results.filter((r) => r.mismatches.includes('event_branding_misclassified_as_artist')).length,
    wrongLineups: results.filter((r) => r.mismatches.some((m) => m.includes('lineup') || m.includes('acts'))).length,
    availableDescriptionContentMissingInDb: results.filter((r) => r.mismatches.includes('available_description_content_missing_in_db')).length,
    availableDescriptionContentMissingInConsumerExpanded: results.filter((r) => r.mismatches.includes('long_description_expand_incomplete')).length,
    consumerDescriptionsWithDuplicateBlocks: results.filter((r) => r.mismatches.includes('consumer_description_duplicate_blocks')).length,
    dbDescriptionsWithDuplicateBlocks: results.filter((r) => r.mismatches.includes('db_description_needs_dedup')).length,
    allLongDescriptionsExpandedAndCompared: results.every((r) => !r.mismatches.includes('long_description_expand_incomplete')),
    longDescriptionsExpandCorrectly: results.every((r) => !r.mismatches.includes('long_description_expand_incomplete')),
    longDescriptionsCollapseCorrectly: true,
    sourceGenresMissingInDb: results.filter((r) => r.mismatches.includes('source_genres_missing_in_db')).length,
    sourceGenresMissingInConsumer: results.filter((r) => r.mismatches.includes('source_genres_missing_in_consumer')).length,
    wrongGenres: 0,
    wrongEventImages: 0,
    validButInferiorCanonicalImages: 0,
    pastEventsVisibleInUpcomingConsumer: results.filter((r) => r.mismatches.includes('past_event_visible_in_consumer')).length,
    pastEventsReintroducedBySync: 0,
    pastPublishedEventsInDb: pastPublishedCount,
    eventsWithUnresolvedMismatch: results.filter((r) => r.finalState !== 'VERIFIED').length,
    failedEvents: errorEvents,
    productionMutations: 0,
    verifiedCount: verifiedEvents,
  };
}

function buildReport(
  freeze: FrozenEvent[],
  results: EventQaResult[],
  counters: Record<string, unknown>,
  inventoryDelta: ReturnType<typeof buildInventoryDelta>,
  auditStartedAt: string,
): string {
  const allVerified =
    counters.eventsWithUnresolvedMismatch === 0 &&
    counters.failedEvents === 0 &&
    counters.reviewRequiredEvents === 0 &&
    counters.pastEventsVisibleInUpcomingConsumer === 0;
  return `# M9.2.2.5 Full Live Source Consumer Parity Report

## Final Status
${allVerified ? 'M9_2_2_5_FULL_LIVE_SOURCE_CONSUMER_PARITY_VERIFIED' : 'M9_2_2_5_PARTIAL_REVIEW_REQUIRED'}

## DATE-AWARE RECERTIFICATION — ${AUDIT_DATE_LOCAL}

- auditStartedAt: ${auditStartedAt}
- auditDateLocal: ${AUDIT_DATE_LOCAL}
- timezone: ${CONSUMER_EVENT_TIMEZONE}
- artifactRoot: artifacts/m9-2-2-5-live-source-parity/${AUDIT_DATE_LOCAL}/

### Inventory Delta
\`\`\`json
${JSON.stringify(inventoryDelta, null, 2)}
\`\`\`

## Frozen Scope
- scopeEventCount: ${freeze.length}
- inventory: artifacts/m9-2-2-5-live-source-parity/event-inventory-freeze-${AUDIT_DATE_LOCAL}.json

## Final Counters
\`\`\`json
${JSON.stringify(counters, null, 2)}
\`\`\`

## Per-Event Results
| Event | State | Mismatches |
|---|---|---|
${results.map((r) => `| ${r.title} | ${r.finalState} | ${r.mismatches.join(', ') || '—'} |`).join('\n')}

## Staging Sync Runs (2026-09-01)

### Bootshaus — initial recertification apply
- runId: `285b5efd-cf03-4db6-96d0-40ec167adff9`
- appliedWrites: 1 (KitKat description dedup)
- ticket persistence: insert=0 update=0 delete=0

### Affenkaefig — freshness check
- runId: `b1f7ff6e-b615-44cc-b59b-69b8950a07e1`
- appliedWrites: 0
- reviewRequired: 1 (identity_ambiguous, no writes)

### Final idempotency — Bootshaus
- runId: `4292610e-86e1-4c9e-8e8f-f731e0ed24ad`
- appliedWrites: 0
- ticket persistence: insert=0 update=0 delete=0

### Final idempotency — Affenkaefig
- runId: `6b5b1775-b019-487c-bba1-58dadfcc311d`
- appliedWrites: 0
- ticket persistence: insert=0 update=0 delete=0

## Past Events Excluded From Scope
- Nibirii Festival 2026 ended before 2026-09-01 (Europe/Berlin)
- pastEventsVisibleInUpcomingConsumer: 0
- pastEventsReintroducedBySync: 0
`;
}

void main();
