const JSON_LD_SCRIPT_PATTERN =
  /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

function readJsonLdPerformerName(performer: unknown): string | undefined {
  if (!performer) {
    return undefined;
  }
  if (typeof performer === 'string') {
    const name = performer.trim();
    return name && !/^organization$/i.test(name) ? name : undefined;
  }
  if (typeof performer === 'object') {
    const record = performer as Record<string, unknown>;
    const typeValue = record['@type'];
    const types = Array.isArray(typeValue)
      ? typeValue.map(String)
      : typeValue
        ? [String(typeValue)]
        : [];
    if (types.some((type) => /organization/i.test(type))) {
      return undefined;
    }
    const name = record.name ? String(record.name).trim() : '';
    return name && !/^organization$/i.test(name) ? name : undefined;
  }
  return undefined;
}

function readJsonLdPerformerNames(performers: unknown): string[] | undefined {
  if (!performers) {
    return undefined;
  }
  const list = Array.isArray(performers) ? performers : [performers];
  const names = list
    .map((performer) => readJsonLdPerformerName(performer))
    .filter((name): name is string => Boolean(name));
  return names.length > 0 ? names : undefined;
}

export function extractJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  let match: RegExpExecArray | null;
  const pattern = new RegExp(JSON_LD_SCRIPT_PATTERN.source, 'gi');
  while ((match = pattern.exec(html)) !== null) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      // skip invalid JSON-LD blocks
    }
  }
  return blocks;
}

export function collectJsonLdNodes(node: unknown): Record<string, unknown>[] {
  if (!node || typeof node !== 'object') return [];
  const record = node as Record<string, unknown>;
  const typeValue = record['@type'];
  const types = Array.isArray(typeValue)
    ? typeValue.map(String)
    : typeValue
      ? [String(typeValue)]
      : [];

  const eventTypes = ['Event', 'MusicEvent', 'Festival'];
  const isEvent = types.some((type) => eventTypes.some((eventType) => type.includes(eventType)));

  const results: Record<string, unknown>[] = [];
  if (isEvent) {
    results.push(record);
  }

  if (Array.isArray(record['@graph'])) {
    for (const item of record['@graph']) {
      results.push(...collectJsonLdNodes(item));
    }
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      results.push(...collectJsonLdNodes(item));
    }
  }

  return results;
}

export function parseJsonLdEvent(node: Record<string, unknown>, baseUrl?: string): {
  externalId: string;
  fields: Record<string, unknown>;
} {
  const location = node.location as Record<string, unknown> | string | undefined;
  let venueName: string | undefined;
  let venueAddress: string | undefined;
  let cityName: string | undefined;
  let latitude: number | undefined;
  let longitude: number | undefined;

  if (location && typeof location === 'object') {
    venueName = String(location.name ?? '');
    const address = location.address;
    if (typeof address === 'string') {
      venueAddress = address;
    } else if (address && typeof address === 'object') {
      const addr = address as Record<string, unknown>;
      venueAddress = [
        addr.streetAddress,
        addr.postalCode,
        addr.addressLocality,
        addr.addressCountry,
      ]
        .filter(Boolean)
        .map(String)
        .join(', ');
      cityName = addr.addressLocality ? String(addr.addressLocality) : undefined;
    }
    const geo = location.geo as Record<string, unknown> | undefined;
    if (geo) {
      latitude = geo.latitude !== undefined ? Number(geo.latitude) : undefined;
      longitude = geo.longitude !== undefined ? Number(geo.longitude) : undefined;
    }
  }

  const performers = node.performer;
  const artistNames = readJsonLdPerformerNames(performers);

  const offers = node.offers as Record<string, unknown> | Record<string, unknown>[] | undefined;
  let ticketUrl: string | undefined;
  if (offers) {
    const offer = Array.isArray(offers) ? offers[0] : offers;
    if (offer?.url) ticketUrl = String(offer.url);
  }

  const image = node.image;
  const imageUrl = Array.isArray(image) ? String(image[0] ?? '') : image ? String(image) : undefined;

  const externalId = String(node['@id'] ?? node.url ?? node.name ?? cryptoRandomId());

  return {
    externalId,
    fields: {
      title: node.name,
      description: node.description,
      startDate: node.startDate,
      endDate: node.endDate,
      venueName,
      venueAddress,
      cityName,
      latitude,
      longitude,
      artistNames,
      ticketUrl,
      eventUrl: node.url,
      imageUrl,
      minimumAge: node.typicalAgeRange,
      organizerName:
        typeof node.organizer === 'object' && node.organizer
          ? (node.organizer as Record<string, unknown>).name
          : node.organizer,
      sourceMetadata: node,
      baseUrl,
    },
  };
}

function cryptoRandomId(): string {
  return `jsonld-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
