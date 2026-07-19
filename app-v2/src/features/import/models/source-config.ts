export interface FeedFieldMapping {
  titleField?: string;
  descriptionField?: string;
  urlField?: string;
  imageField?: string;
  dateField?: string;
  externalIdField?: string;
}

export interface CsvFieldMapping {
  externalId?: string;
  title?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  venueName?: string;
  venueAddress?: string;
  cityName?: string;
  countryCode?: string;
  artistNames?: string;
  genreNames?: string;
  ticketUrl?: string;
  eventUrl?: string;
  imageUrl?: string;
  minimumAge?: string;
  organizerName?: string;
}

export interface CsvSourceConfig {
  delimiter?: ',' | ';' | '\t';
  hasHeader?: boolean;
  dateFormat?: string;
  fieldMapping: CsvFieldMapping;
}

export interface ApiJsonSourceConfig {
  resultsPath?: string;
  fieldMapping: CsvFieldMapping;
  queryParams?: Record<string, string>;
  /** Header names only — values resolved from environment at runtime */
  headerNames?: string[];
}

export interface FeedSourceConfig extends FeedFieldMapping {
  feedUrl?: string;
}

export interface IcalSourceConfig {
  maxRecurrenceInstances?: number;
}

export interface JsonLdSourceConfig {
  pageUrl?: string;
}

export interface ImportSourceConfig {
  feed?: FeedSourceConfig;
  csv?: CsvSourceConfig;
  api?: ApiJsonSourceConfig;
  ical?: IcalSourceConfig;
  jsonLd?: JsonLdSourceConfig;
}
