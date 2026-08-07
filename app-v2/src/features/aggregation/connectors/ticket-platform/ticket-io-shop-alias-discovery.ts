import {
  collectJsonLdNodes,
  extractJsonLdBlocks,
  parseJsonLdEvent,
} from '@/features/import/adapters/parsers/json-ld-parser';
import {
  buildShopRootEventUrl,
  extractTicketIoEventSlug,
  extractTicketIoShopSlug,
  isTicketIoShopRootUrl,
  normalizeTicketIoEventUrl,
  normalizeTicketIoListUrl,
  ticketIoUrlsShareEventSlug,
} from './ticket-io-url';
import type { TicketIoTicketOffer } from './ticket-io-detail-parser';
import type { TicketIoDetailFetchStatus } from './ticket-io-list-card-evidence';
import type { TicketIoListRowContext } from './ticket-io-list-enrichment';

export type TicketIoShopDiscoveryMethod =
  | 'official_iframe_embed'
  | 'official_first_party_ticket_link'
  | 'official_embedded_ticket_io_shop'
  | 'ticket_hub_url_config'
  | 'observed_redirect_relationship'
  | 'none';

export interface TicketIoSlugBindingProof {
  eventSlug: string;
  listContextSlug: string;
  parsedEventSlug?: string;
  linkedEventUrl?: string;
  publicTicketPageUrl?: string;
  listPriceOverviewText?: string;
  shopRootHost?: string;
  linkedEventHost?: string;
  redirectFinalHost?: string;
  allFieldsFromSameSlugCard: boolean;
  notes?: string[];
}

export type TicketIoAliasEvidenceSource =
  | 'official_event_link'
  | 'list_card_link'
  | 'observed_redirect_chain'
  | 'same_host'
  | 'none';

export interface TicketIoRedirectObservation {
  linkedEventUrl: string;
  redirectFinalUrl: string;
}

export interface TicketIoPerSlugAliasProof {
  valid: boolean;
  reason: string;
  eventSlug: string;
  shopRootHost?: string;
  linkedEventUrl?: string;
  redirectFinalUrl?: string;
  redirectFinalHost?: string;
  existingCanonicalHost?: string;
  evidenceSource: TicketIoAliasEvidenceSource;
  slugBindingProof?: TicketIoSlugBindingProof;
}

/** @deprecated Use TicketIoPerSlugAliasProof */
export type TicketIoHostAliasProof = TicketIoPerSlugAliasProof;

export interface TicketIoShopDiscoveryResult {
  discovered: boolean;
  discoveredShopRoot?: string;
  shopDiscoveryMethod: TicketIoShopDiscoveryMethod;
  sourceOfficialPageUrl?: string;
  redirectOrEmbedRelationship?: string;
  candidateUrls: string[];
}

export interface TicketIoAdmissionSnapshot {
  priceText?: string;
  ticketOffers?: TicketIoTicketOffer[];
  admissionSnapshotSource: 'list_card' | 'detail' | 'none';
  replacedPreviousSnapshot: boolean;
}

const IFRAME_SRC_PATTERN = /<iframe[^>]+src=["']([^"']+)["']/gi;
const ANCHOR_PATTERN = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
const HREF_PATTERN = /href=["']([^"']+)["']/i;

function normalizeObservedUrl(url: string, baseUrl?: string): string | undefined {
  const trimmed = url.trim().replace(/&amp;/g, '&');
  if (!trimmed || trimmed.startsWith('javascript:') || trimmed.startsWith('#')) {
    return undefined;
  }
  try {
    return new URL(trimmed, baseUrl).href;
  } catch {
    return undefined;
  }
}

function ticketPurposeLabel(text: string, attrs: string): boolean {
  const combined = `${text} ${attrs}`;
  return /\b(tickets?|ticket-?shop|karten|vorverkauf)\b/i.test(combined);
}

function shopRootFromTicketIoUrl(url: string): string | undefined {
  const shopSlug = extractTicketIoShopSlug(url);
  if (!shopSlug) {
    return undefined;
  }
  if (isTicketIoShopRootUrl(url)) {
    return normalizeTicketIoListUrl(shopSlug);
  }
  const eventSlug = extractTicketIoEventSlug(url);
  if (eventSlug) {
    return normalizeTicketIoListUrl(shopSlug);
  }
  return undefined;
}

function extractIframeTicketShopRoots(html: string, baseUrl?: string): string[] {
  const roots = new Set<string>();
  let match: RegExpExecArray | null;
  const pattern = new RegExp(IFRAME_SRC_PATTERN.source, 'gi');
  while ((match = pattern.exec(html)) !== null) {
    const absolute = normalizeObservedUrl(match[1] ?? '', baseUrl);
    if (!absolute) {
      continue;
    }
    const root = shopRootFromTicketIoUrl(absolute);
    if (root) {
      roots.add(root);
    }
  }
  return [...roots];
}

function extractFirstPartyTicketPurposeLinks(html: string, baseUrl?: string): string[] {
  const urls: string[] = [];
  let match: RegExpExecArray | null;
  const pattern = new RegExp(ANCHOR_PATTERN.source, 'gi');
  while ((match = pattern.exec(html)) !== null) {
    const attrs = match[1] ?? '';
    const label = (match[2] ?? '').replace(/<[^>]+>/g, ' ').trim();
    if (!ticketPurposeLabel(label, attrs)) {
      continue;
    }
    const href = attrs.match(HREF_PATTERN)?.[1];
    const absolute = href ? normalizeObservedUrl(href, baseUrl) : undefined;
    if (absolute) {
      urls.push(absolute);
    }
  }
  return urls;
}

function extractEmbeddedTicketIoShopRoots(html: string): string[] {
  const roots = new Set<string>();
  for (const rawUrl of html.match(/https?:\/\/[a-z0-9-]+\.ticket\.io\/?/gi) ?? []) {
    const root = shopRootFromTicketIoUrl(rawUrl);
    if (root) {
      roots.add(root);
    }
  }
  return [...roots];
}

function hostnameFromUrl(url: string | undefined): string | undefined {
  if (!url?.trim()) {
    return undefined;
  }
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

/** Discovers a Ticket.io shop root only from observed official-page evidence (never guessed). */
export function discoverTicketIoShopRoot(input: {
  officialPageHtml?: string;
  officialPageUrl?: string;
  firstPartyHopPageHtml?: string;
  ticketHubUrl?: string;
}): TicketIoShopDiscoveryResult {
  const candidateUrls: string[] = [];
  const roots = new Map<string, TicketIoShopDiscoveryMethod>();
  const methodPriority: Record<TicketIoShopDiscoveryMethod, number> = {
    ticket_hub_url_config: 5,
    official_iframe_embed: 4,
    official_first_party_ticket_link: 3,
    observed_redirect_relationship: 2,
    official_embedded_ticket_io_shop: 1,
    none: 0,
  };

  const registerRoot = (root: string, method: TicketIoShopDiscoveryMethod) => {
    const existing = roots.get(root);
    if (!existing || methodPriority[method] > methodPriority[existing]) {
      roots.set(root, method);
    }
  };

  const register = (url: string | undefined, method: TicketIoShopDiscoveryMethod) => {
    if (!url) {
      return;
    }
    candidateUrls.push(url);
    const root = shopRootFromTicketIoUrl(url);
    if (root) {
      registerRoot(root, method);
    }
  };

  if (input.ticketHubUrl?.trim()) {
    register(input.ticketHubUrl.trim(), 'ticket_hub_url_config');
  }

  if (input.officialPageHtml?.trim()) {
    for (const root of extractIframeTicketShopRoots(input.officialPageHtml, input.officialPageUrl)) {
      registerRoot(root, 'official_iframe_embed');
      candidateUrls.push(root);
    }
    for (const link of extractFirstPartyTicketPurposeLinks(
      input.officialPageHtml,
      input.officialPageUrl,
    )) {
      register(link, 'official_first_party_ticket_link');
    }
    for (const root of extractEmbeddedTicketIoShopRoots(input.officialPageHtml)) {
      registerRoot(root, 'official_embedded_ticket_io_shop');
      candidateUrls.push(root);
    }
  }

  if (input.firstPartyHopPageHtml?.trim()) {
    for (const root of extractIframeTicketShopRoots(
      input.firstPartyHopPageHtml,
      input.officialPageUrl,
    )) {
      registerRoot(root, 'official_iframe_embed');
      candidateUrls.push(root);
    }
    for (const root of extractEmbeddedTicketIoShopRoots(input.firstPartyHopPageHtml)) {
      registerRoot(root, 'official_embedded_ticket_io_shop');
      candidateUrls.push(root);
    }
  }

  const [discoveredShopRoot, shopDiscoveryMethod] = [...roots.entries()][0] ?? [undefined, 'none' as const];

  return {
    discovered: Boolean(discoveredShopRoot),
    discoveredShopRoot,
    shopDiscoveryMethod,
    sourceOfficialPageUrl: input.officialPageUrl,
    redirectOrEmbedRelationship: discoveredShopRoot
      ? `${shopDiscoveryMethod}:${discoveredShopRoot}`
      : undefined,
    candidateUrls: [...new Set(candidateUrls)],
  };
}

export function buildSlugBindingProof(input: {
  listContext: TicketIoListRowContext;
  shopRootUrl?: string;
  redirectFinalUrl?: string;
}): TicketIoSlugBindingProof {
  const eventSlug = input.listContext.eventSlug;
  const linkedEventUrl =
    input.listContext.linkedEventUrl ??
    (input.shopRootUrl ? buildShopRootEventUrl(input.shopRootUrl, eventSlug) : undefined);
  const parsedEventSlug = linkedEventUrl
    ? extractTicketIoEventSlug(linkedEventUrl)
    : input.listContext.publicTicketPageUrl
      ? extractTicketIoEventSlug(input.listContext.publicTicketPageUrl)
      : undefined;
  const notes: string[] = [];
  if (input.listContext.priceOverviewText) {
    notes.push('price_from_same_card_overview_row');
  }
  if (linkedEventUrl) {
    notes.push('linked_event_url_from_same_card');
  }
  return {
    eventSlug,
    listContextSlug: eventSlug,
    parsedEventSlug,
    linkedEventUrl,
    publicTicketPageUrl: input.listContext.publicTicketPageUrl,
    listPriceOverviewText: input.listContext.priceOverviewText,
    shopRootHost: hostnameFromUrl(input.shopRootUrl),
    linkedEventHost: hostnameFromUrl(linkedEventUrl),
    redirectFinalHost: hostnameFromUrl(input.redirectFinalUrl),
    allFieldsFromSameSlugCard:
      Boolean(parsedEventSlug) &&
      parsedEventSlug === eventSlug &&
      Boolean(input.listContext.listRowTitle) &&
      Boolean(input.listContext.eventDate) &&
      Boolean(input.listContext.venueName),
    notes,
  };
}

function urlsEquivalentForSlug(left: string | undefined, right: string | undefined, eventSlug: string): boolean {
  if (!left?.trim() || !right?.trim()) {
    return false;
  }
  return (
    ticketIoUrlsShareEventSlug(left, right, eventSlug) &&
    normalizeTicketIoEventUrl(left) === normalizeTicketIoEventUrl(right)
  );
}

function isCanonicalOnlyEvidenceUrl(
  url: string | undefined,
  existingCanonicalUrl: string | undefined,
): boolean {
  if (!url?.trim() || !existingCanonicalUrl?.trim()) {
    return false;
  }
  return normalizeTicketIoEventUrl(url) === normalizeTicketIoEventUrl(existingCanonicalUrl);
}

function invalidPerSlugProof(
  reason: string,
  eventSlug: string,
  partial: Partial<TicketIoPerSlugAliasProof> & { slugBindingProof?: TicketIoSlugBindingProof },
): TicketIoPerSlugAliasProof {
  return {
    valid: false,
    reason,
    eventSlug,
    evidenceSource: 'none',
    ...partial,
  };
}

/** Validates per-event-slug alias proof; never reuses evidence across slugs or from canonical alone. */
export function proveTicketIoHostAlias(input: {
  listCard: TicketIoListRowContext;
  shopRootUrl?: string;
  existingCanonicalUrl?: string;
  officialEventLinkUrl?: string;
  redirectObservation?: TicketIoRedirectObservation;
}): TicketIoPerSlugAliasProof {
  const eventSlug = input.listCard.eventSlug;
  const shopRootHost = hostnameFromUrl(input.shopRootUrl);
  const existingCanonicalHost = hostnameFromUrl(input.existingCanonicalUrl);
  const linkedFromCard =
    input.listCard.linkedEventUrl ??
    (input.shopRootUrl ? buildShopRootEventUrl(input.shopRootUrl, eventSlug) : undefined);

  let redirectFinalUrl: string | undefined;
  let redirectFinalHost: string | undefined;
  const expectedLinkedUrl = linkedFromCard ? normalizeTicketIoEventUrl(linkedFromCard) : undefined;
  if (input.redirectObservation && expectedLinkedUrl) {
    const observedLinkedUrl = normalizeTicketIoEventUrl(input.redirectObservation.linkedEventUrl);
    const observedFinalUrl = normalizeTicketIoEventUrl(input.redirectObservation.redirectFinalUrl);
    const linkedSlug = extractTicketIoEventSlug(observedLinkedUrl);
    const finalSlug = extractTicketIoEventSlug(observedFinalUrl);
    if (observedLinkedUrl === expectedLinkedUrl && linkedSlug === eventSlug && finalSlug !== eventSlug) {
      return invalidPerSlugProof('redirect_slug_mismatch', eventSlug, {
        shopRootHost,
        existingCanonicalHost,
        linkedEventUrl: expectedLinkedUrl,
        slugBindingProof: buildSlugBindingProof({
          listContext: input.listCard,
          shopRootUrl: input.shopRootUrl,
        }),
      });
    }
    if (
      linkedSlug === eventSlug &&
      finalSlug === eventSlug &&
      observedLinkedUrl === expectedLinkedUrl
    ) {
      redirectFinalUrl = observedFinalUrl;
      redirectFinalHost = hostnameFromUrl(redirectFinalUrl);
    }
  }

  const slugBindingProof = buildSlugBindingProof({
    listContext: input.listCard,
    shopRootUrl: input.shopRootUrl,
    redirectFinalUrl,
  });

  if (!eventSlug || !shopRootHost) {
    return invalidPerSlugProof('missing_shop_root_or_slug', eventSlug, {
      shopRootHost,
      existingCanonicalHost,
      slugBindingProof,
    });
  }

  if (!slugBindingProof.allFieldsFromSameSlugCard) {
    return invalidPerSlugProof('list_card_identity_incomplete', eventSlug, {
      shopRootHost,
      existingCanonicalHost,
      linkedEventUrl: linkedFromCard,
      redirectFinalUrl,
      redirectFinalHost,
      slugBindingProof,
    });
  }

  const officialLink =
    input.officialEventLinkUrl &&
    extractTicketIoEventSlug(input.officialEventLinkUrl) === eventSlug &&
    !isCanonicalOnlyEvidenceUrl(input.officialEventLinkUrl, input.existingCanonicalUrl)
      ? normalizeTicketIoEventUrl(input.officialEventLinkUrl)
      : undefined;

  const linkedEventUrl = linkedFromCard ? normalizeTicketIoEventUrl(linkedFromCard) : undefined;
  const linkedEventHost = hostnameFromUrl(linkedEventUrl);
  const effectiveFinalHost =
    redirectFinalHost ?? hostnameFromUrl(officialLink) ?? linkedEventHost;

  if (!linkedEventUrl || extractTicketIoEventSlug(linkedEventUrl) !== eventSlug) {
    return invalidPerSlugProof('missing_slug_bound_list_card_link', eventSlug, {
      shopRootHost,
      existingCanonicalHost,
      slugBindingProof,
    });
  }

  if (shopRootHost === effectiveFinalHost) {
    return {
      valid: true,
      reason: 'same_host_no_alias_required',
      eventSlug,
      shopRootHost,
      linkedEventUrl,
      redirectFinalUrl,
      redirectFinalHost,
      existingCanonicalHost,
      evidenceSource: 'same_host',
      slugBindingProof,
    };
  }

  let evidenceSource: TicketIoAliasEvidenceSource = 'none';
  if (redirectFinalUrl && redirectFinalHost && linkedEventUrl) {
    evidenceSource = 'observed_redirect_chain';
  } else if (officialLink) {
    evidenceSource = 'official_event_link';
  }

  if (evidenceSource === 'none') {
    return invalidPerSlugProof('missing_observed_slug_relationship', eventSlug, {
      shopRootHost,
      linkedEventUrl,
      redirectFinalUrl,
      redirectFinalHost: effectiveFinalHost,
      existingCanonicalHost,
      slugBindingProof,
    });
  }

  if (
    existingCanonicalHost &&
    effectiveFinalHost === existingCanonicalHost &&
    evidenceSource !== 'observed_redirect_chain' &&
    evidenceSource !== 'official_event_link'
  ) {
    return invalidPerSlugProof('canonical_host_not_independent_evidence', eventSlug, {
      shopRootHost,
      linkedEventUrl,
      redirectFinalUrl,
      redirectFinalHost: effectiveFinalHost,
      existingCanonicalHost,
      evidenceSource,
      slugBindingProof,
    });
  }

  return {
    valid: true,
    reason: 'observed_slug_relationship_for_event',
    eventSlug,
    shopRootHost,
    linkedEventUrl,
    redirectFinalUrl,
    redirectFinalHost: effectiveFinalHost,
    existingCanonicalHost,
    evidenceSource,
    slugBindingProof,
  };
}

/** Replaces any previous admission snapshot atomically with the freshest observed list/detail evidence. */
export function resolveTicketAdmissionSnapshot(input: {
  listCard?: Pick<TicketIoListRowContext, 'priceText' | 'soldOut' | 'priceOverviewText'>;
  listCardOffers?: TicketIoTicketOffer[];
  detail?: {
    priceText?: string;
    ticketOffers?: TicketIoTicketOffer[];
    detailFetchStatus?: TicketIoDetailFetchStatus;
  };
  previousSnapshot?: {
    priceText?: string;
    ticketOffers?: TicketIoTicketOffer[];
  };
}): TicketIoAdmissionSnapshot {
  const hadPrevious = Boolean(
    input.previousSnapshot?.priceText?.trim() || input.previousSnapshot?.ticketOffers?.length,
  );
  const listPriceText = input.listCard?.soldOut
    ? 'Ausverkauft'
    : input.listCard?.priceText?.trim();
  const detailUsable = input.detail?.detailFetchStatus === 'ok';

  if (listPriceText) {
    const detailOffers =
      detailUsable && input.detail?.ticketOffers?.length
        ? input.detail.ticketOffers
        : input.listCardOffers;
    return {
      priceText: listPriceText,
      ticketOffers: detailOffers,
      admissionSnapshotSource: detailOffers?.length ? 'detail' : 'list_card',
      replacedPreviousSnapshot: hadPrevious,
    };
  }

  if (detailUsable && (input.detail?.priceText || input.detail?.ticketOffers?.length)) {
    return {
      priceText: input.detail.priceText,
      ticketOffers: input.detail.ticketOffers,
      admissionSnapshotSource: 'detail',
      replacedPreviousSnapshot: hadPrevious,
    };
  }

  return {
    admissionSnapshotSource: 'none',
    replacedPreviousSnapshot: hadPrevious,
  };
}

export function parseTicketIoListCardJsonLdBinding(
  rowHtml: string,
  eventSlug: string,
  shopRootUrl?: string,
): Pick<
  TicketIoListRowContext,
  'listRowTitle' | 'eventDate' | 'venueName' | 'publicTicketPageUrl'
> {
  for (const block of extractJsonLdBlocks(rowHtml)) {
    for (const node of collectJsonLdNodes(block)) {
      const parsed = parseJsonLdEvent(node);
      const fields = parsed.fields;
      const offerUrl =
        fields.ticketUrl != null
          ? String(fields.ticketUrl)
          : fields.eventUrl != null
            ? String(fields.eventUrl)
            : parsed.externalId;
      const parsedSlug = offerUrl ? extractTicketIoEventSlug(offerUrl) : undefined;
      if (parsedSlug && parsedSlug !== eventSlug) {
        continue;
      }
      return {
        listRowTitle: fields.title ? String(fields.title).trim() : undefined,
        eventDate: fields.startDate ? String(fields.startDate) : undefined,
        venueName: fields.venueName ? String(fields.venueName).trim() : undefined,
        publicTicketPageUrl: offerUrl
          ? normalizeObservedUrl(offerUrl, shopRootUrl)
          : shopRootUrl
            ? normalizeObservedUrl(`/${eventSlug}/`, shopRootUrl)
            : undefined,
      };
    }
  }
  return {};
}
