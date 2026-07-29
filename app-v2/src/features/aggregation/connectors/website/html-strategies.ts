import type { WebsiteConnectorConfig } from '@/features/aggregation/connectors/website/config';

import { composeListDateParts, filterLinksByPattern } from '@/features/aggregation/connectors/website/date-compose';

import {

  extractContainerOuterBlocks,

  extractLinks,

  extractMetaProperty,

  extractTextContent,

} from '@/features/aggregation/connectors/website/html-utils';

import { resolveRelativeUrl } from '@/features/aggregation/connectors/website/security';

import type { RawWebsiteEvent, WebsiteDocument } from '@/features/aggregation/connectors/website/types';

import {

  createFieldEvidence,

  createValidationResult,

  type WebsiteExtractionStrategy,

} from '@/features/aggregation/connectors/website/strategy-types';



function readSelectorValue(

  html: string,

  selector: string | undefined,

  attribute?: string,

): string | undefined {

  if (!selector) return undefined;

  if (attribute) {

    return extractLinks(html, selector, attribute)[0];

  }

  return extractTextContent(html, selector)[0];

}



function decodeHtmlEntities(value: string | undefined): string | undefined {

  if (!value) return undefined;

  return value

    .replace(/&amp;/g, '&')

    .replace(/&ndash;/g, '–')

    .replace(/&mdash;/g, '—')

    .replace(/&quot;/g, '"')

    .replace(/&#39;/g, "'")

    .replace(/&Uuml;/g, 'Ü')

    .replace(/&uuml;/g, 'ü')

    .replace(/&Auml;/g, 'Ä')

    .replace(/&auml;/g, 'ä')

    .replace(/&Ouml;/g, 'Ö')

    .replace(/&ouml;/g, 'ö')

    .replace(/&szlig;/g, 'ß');

}



function extractEventsFromContainers(

  document: WebsiteDocument,

  config: WebsiteConnectorConfig,

  context: { baseUrl: string },

): RawWebsiteEvent[] {

  const selectorConfig = config.htmlSelector ?? {};

  const containerSelector = selectorConfig.eventContainerSelector ?? '.event';

  const containers = extractContainerOuterBlocks(document.html, containerSelector);

  const events: RawWebsiteEvent[] = [];



  for (const block of containers) {

    const title = readSelectorValue(block, selectorConfig.titleSelector);

    const day = readSelectorValue(block, selectorConfig.dateSelector);

    const month = readSelectorValue(block, selectorConfig.monthSelector);

    const time = readSelectorValue(block, selectorConfig.timeSelector);

    const rawStartDate =

      composeListDateParts(day, month, time) ??

      readSelectorValue(block, selectorConfig.dateSelector);

    const venue = readSelectorValue(block, selectorConfig.venueSelector);

    const description = readSelectorValue(block, selectorConfig.descriptionSelector);

    const href = readSelectorValue(

      block,

      selectorConfig.eventUrlSelector ?? containerSelector,

      selectorConfig.eventUrlAttribute ?? 'href',

    );

    const image = readSelectorValue(

      block,

      selectorConfig.imageSelector ?? 'img',

      selectorConfig.imageAttribute ?? 'src',

    );

    const ticketUrl = readSelectorValue(

      block,

      selectorConfig.ticketUrlSelector,

      selectorConfig.ticketUrlAttribute ?? 'href',

    );



    if (!title && !rawStartDate) {

      continue;

    }



    const detailUrl = href

      ? resolveRelativeUrl(selectorConfig.baseUrl ?? context.baseUrl, href)

      : undefined;



    events.push({

      sourceUrl: document.finalUrl,

      detailUrl: detailUrl ?? undefined,

      externalId: detailUrl ?? `${document.finalUrl}#${events.length}`,

      title: title?.trim(),

      rawStartDate,

      rawVenue: venue?.trim(),

      rawDescription: description?.trim(),

      rawTicketLinks: ticketUrl ? [ticketUrl] : undefined,

      rawImages: image ? [image] : undefined,

      extractionStrategy: 'html_selector',

      extractionConfidence: 0.75,

      fieldEvidence: [

        createFieldEvidence('title', 'html_selector', document.finalUrl, {

          selectorOrPath: selectorConfig.titleSelector ?? containerSelector,

          rawValue: title,

        }),

        ...(rawStartDate

          ? [

              createFieldEvidence('rawStartDate', 'html_selector', document.finalUrl, {

                selectorOrPath: selectorConfig.dateSelector,

                rawValue: rawStartDate,

              }),

            ]

          : []),

      ],

      warnings: [],

    });

  }



  return events;

}



function extractEventsFromFlatSelectors(

  document: WebsiteDocument,

  config: WebsiteConnectorConfig,

  context: { baseUrl: string },

): RawWebsiteEvent[] {

  const selectorConfig = config.htmlSelector ?? {};

  const containerSelector = selectorConfig.eventContainerSelector ?? '.event';

  const titles = extractTextContent(document.html, selectorConfig.titleSelector ?? containerSelector);

  const dates = extractTextContent(document.html, selectorConfig.dateSelector ?? containerSelector);

  const venues = extractTextContent(document.html, selectorConfig.venueSelector ?? containerSelector);

  const descriptions = extractTextContent(document.html, selectorConfig.descriptionSelector ?? containerSelector);

  const eventUrls = extractLinks(

    document.html,

    selectorConfig.eventUrlSelector ?? 'a',

    selectorConfig.eventUrlAttribute ?? 'href',

  );

  const ticketUrls = extractLinks(

    document.html,

    selectorConfig.ticketUrlSelector ?? 'a',

    selectorConfig.ticketUrlAttribute ?? 'href',

  );

  const images = extractLinks(

    document.html,

    selectorConfig.imageSelector ?? 'img',

    selectorConfig.imageAttribute ?? 'src',

  );



  const count = Math.max(titles.length, dates.length, venues.length, 1);

  const events: RawWebsiteEvent[] = [];



  for (let index = 0; index < count; index += 1) {

    const title = titles[index];

    const rawStartDate = dates[index];

    if (!title && !rawStartDate) {

      continue;

    }

    const detailUrl = eventUrls[index]

      ? resolveRelativeUrl(selectorConfig.baseUrl ?? context.baseUrl, eventUrls[index]!)

      : undefined;

    events.push({

      sourceUrl: document.finalUrl,

      detailUrl: detailUrl ?? undefined,

      externalId: detailUrl ?? `html-${index}`,

      title,

      rawStartDate,

      rawVenue: venues[index],

      rawDescription: descriptions[index],

      rawTicketLinks: ticketUrls[index] ? [ticketUrls[index]!] : undefined,

      rawImages: images[index] ? [images[index]!] : undefined,

      extractionStrategy: 'html_selector',

      extractionConfidence: 0.7,

      fieldEvidence: [

        createFieldEvidence('title', 'html_selector', document.finalUrl, {

          selectorOrPath: selectorConfig.titleSelector ?? containerSelector,

          rawValue: title,

        }),

      ],

      warnings: [],

    });

  }



  return events;

}



function extractDetailPageEvent(detailDocument: WebsiteDocument): RawWebsiteEvent | null {

  const title =

    decodeHtmlEntities(extractMetaProperty(detailDocument.html, 'og:title')) ??

    extractTextContent(detailDocument.html, 'h1')[0] ??

    extractTextContent(detailDocument.html, 'h2')[0];

  const description = decodeHtmlEntities(extractMetaProperty(detailDocument.html, 'og:description'));

  const image = extractMetaProperty(detailDocument.html, 'og:image');

  const genres = extractTextContent(detailDocument.html, '.tag-item');

  const ticketLinks = extractLinks(detailDocument.html, 'a', 'href').filter((href) =>

    /ticket|rausgegangen|eventim|reservix|ra\.co/i.test(href),

  );



  if (!title) {

    return null;

  }



  const cleanTitle = title.trim();



  return {

    sourceUrl: detailDocument.requestedUrl,

    detailUrl: detailDocument.finalUrl,

    externalId: detailDocument.finalUrl,

    title: cleanTitle,

    rawDescription: description,

    rawGenres: genres.length > 0 ? genres : undefined,

    rawTicketLinks: ticketLinks.length > 0 ? [...new Set(ticketLinks)] : undefined,

    rawImages: image ? [image] : undefined,

    extractionStrategy: 'event_detail_page',

    extractionConfidence: 0.8,

    fieldEvidence: [

      createFieldEvidence('title', 'event_detail_page', detailDocument.finalUrl, {

        selectorOrPath: 'meta[property="og:title"]',

        rawValue: cleanTitle,

      }),

    ],

    warnings: [],

  };

}



export const htmlSelectorWebsiteStrategy: WebsiteExtractionStrategy = {

  key: 'html_selector',

  version: '1.1.0',

  capabilities: {

    supportsListPages: true,

    supportsDetailPages: false,

    supportsPagination: true,

    requiresConfiguration: true,

  },

  supports(_document, config) {

    return Boolean(config.htmlSelector?.eventContainerSelector || config.htmlSelector?.titleSelector);

  },

  detect(document, config) {

    const selector = config.htmlSelector?.eventContainerSelector ?? '.event';

    const count = extractContainerOuterBlocks(document.html, selector).length;

    const fallbackCount = count || extractTextContent(document.html, selector).length;

    return {

      confidence: fallbackCount > 0 ? 0.75 : 0,

      signals: fallbackCount > 0 ? [{ format: 'event_list', confidence: 0.75, count: fallbackCount }] : [],

      eventCountEstimate: fallbackCount,

    };

  },

  validateConfiguration(config) {

    const selectorConfig = config.htmlSelector;

    const issues = [];

    if (!selectorConfig?.eventContainerSelector && !selectorConfig?.titleSelector) {

      issues.push({

        code: 'missing_selector',

        field: 'htmlSelector.eventContainerSelector',

        message: 'HTML selector strategy requires eventContainerSelector or titleSelector.',

      });

    }

    return createValidationResult(issues);

  },

  async extract(document, config, context) {

    const selectorConfig = config.htmlSelector ?? {};

    const warnings: string[] = [];

    let skippedCount = 0;



    const events = selectorConfig.eventContainerSelector

      ? extractEventsFromContainers(document, config, context)

      : extractEventsFromFlatSelectors(document, config, context);



    if (selectorConfig.requiredFields?.includes('title')) {

      for (const event of events) {

        if (!event.title) {

          warnings.push(`Event ${event.externalId} missing required title.`);

          skippedCount += 1;

        }

      }

    }



    return {

      events: events.filter((event) => event.title || event.rawStartDate),

      diagnostics: { extractedCount: events.length, skippedCount, warnings },

    };

  },

};



export const eventDetailPageWebsiteStrategy: WebsiteExtractionStrategy = {

  key: 'event_detail_page',

  version: '1.1.0',

  capabilities: {

    supportsListPages: true,

    supportsDetailPages: true,

    supportsPagination: false,

    requiresConfiguration: false,

  },

  supports(document, config) {

    const selector = config.eventDetailPage?.eventLinkSelector ?? config.htmlSelector?.eventUrlSelector ?? 'a';

    const links = filterLinksByPattern(

      extractLinks(document.html, selector, 'href'),

      config.eventDetailPage?.linkIncludePattern ?? config.htmlSelector?.linkIncludePattern,

    );

    return links.length > 0;

  },

  detect(document, config) {

    const selector = config.eventDetailPage?.eventLinkSelector ?? 'a';

    const count = filterLinksByPattern(

      extractLinks(document.html, selector, 'href'),

      config.eventDetailPage?.linkIncludePattern ?? config.htmlSelector?.linkIncludePattern,

    ).length;

    return {

      confidence: count > 0 ? 0.75 : 0,

      signals: count > 0 ? [{ format: 'event_detail_link', confidence: 0.75, count }] : [],

      eventCountEstimate: count,

    };

  },

  validateConfiguration() {

    return createValidationResult([]);

  },

  async extract(document, config, context) {

    if (!context.fetchDetailPage) {

      return {

        events: [],

        diagnostics: {

          extractedCount: 0,

          skippedCount: 0,

          warnings: ['Detail page fetcher is not configured for this run.'],

        },

      };

    }



    const selector = config.eventDetailPage?.eventLinkSelector ?? 'a';

    const links = filterLinksByPattern(

      extractLinks(

        document.html,

        selector,

        config.eventDetailPage?.eventLinkAttribute ?? 'href',

      ),

      config.eventDetailPage?.linkIncludePattern ?? config.htmlSelector?.linkIncludePattern,

    );

    const events: RawWebsiteEvent[] = [];

    const warnings: string[] = [];

    let skippedCount = 0;



    for (const href of links) {

      const detailUrl = resolveRelativeUrl(context.baseUrl, href);

      if (!detailUrl) {

        skippedCount += 1;

        continue;

      }

      try {

        const detailDocument = await context.fetchDetailPage(detailUrl);

        const event = extractDetailPageEvent(detailDocument);

        if (!event) {

          skippedCount += 1;

          warnings.push(`Detail page missing title: ${detailUrl}`);

          continue;

        }

        events.push({

          ...event,

          sourceUrl: document.finalUrl,

        });

      } catch (error) {

        skippedCount += 1;

        warnings.push(

          `Detail page failed for ${detailUrl}: ${error instanceof Error ? error.message : 'unknown error'}`,

        );

      }

    }



    return {

      events,

      diagnostics: { extractedCount: events.length, skippedCount, warnings },

    };

  },

};



export const customWebsiteAdapterStrategy: WebsiteExtractionStrategy = {

  key: 'custom_adapter',

  version: '1.0.0',

  capabilities: {

    supportsListPages: false,

    supportsDetailPages: false,

    supportsPagination: false,

    requiresConfiguration: true,

  },

  supports(_document, config) {

    return Boolean(config.customAdapter?.adapterKey);

  },

  detect(_document, config) {

    return {

      confidence: config.customAdapter?.adapterKey ? 0.5 : 0,

      signals: [],

      eventCountEstimate: 0,

    };

  },

  validateConfiguration(config) {

    if (!config.customAdapter?.adapterKey) {

      return createValidationResult([

        { code: 'missing_adapter', field: 'customAdapter.adapterKey', message: 'Custom adapter key is required.' },

      ]);

    }

    return createValidationResult([]);

  },

  async extract() {

    return {

      events: [],

      diagnostics: {

        extractedCount: 0,

        skippedCount: 0,

        warnings: ['Custom adapter execution is reserved for controlled fallbacks.'],

      },

    };

  },

};


