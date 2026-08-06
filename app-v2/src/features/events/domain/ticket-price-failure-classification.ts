export type TicketPriceFailureClass =
  | 'PUBLIC_PRICE_NOT_EXTRACTED'
  | 'PRICE_LOST_DURING_NORMALIZATION'
  | 'PRICE_REJECTED_DURING_MERGE'
  | 'PRICE_NOT_PERSISTED'
  | 'PRICE_MISSING_FROM_CANONICAL_READ'
  | 'PRICE_MISSING_FROM_API'
  | 'PRICE_MISSING_FROM_VIEW_MODEL'
  | 'PRICE_HIDDEN_BY_UI'
  | 'PUBLIC_DETAIL_EXTERNALLY_BLOCKED'
  | 'PUBLIC_PAGE_CONFIRMED_NO_PRICE'
  | 'REVIEW_REQUIRED'
  | 'source_has_no_price';

export interface TicketPriceTraceInput {
  hasPublicPurchaseUrl: boolean;
  sourcePriceText?: string;
  sourcePriceAmount?: number;
  sourceTicketOffersCount?: number;
  normalizedPriceText?: string;
  persistedPriceText?: string;
  canonicalPriceText?: string;
  apiPriceText?: string;
  viewModelPriceText?: string;
  detailBlocked?: boolean;
  publicSurfacesInspected?: boolean;
  publicPageConfirmedNoPrice?: boolean;
}

export function classifyTicketPriceFailure(input: TicketPriceTraceInput): TicketPriceFailureClass | undefined {
  const hasCanonicalPrice = Boolean(input.canonicalPriceText?.trim() || input.persistedPriceText?.trim());
  const hasSourcePrice = Boolean(
    input.sourcePriceText?.trim() ||
      input.sourcePriceAmount !== undefined ||
      (input.sourceTicketOffersCount ?? 0) > 0,
  );
  const hasUiPrice = Boolean(input.viewModelPriceText?.trim());

  if (!input.hasPublicPurchaseUrl) {
    return undefined;
  }
  if (hasUiPrice) {
    return undefined;
  }
  if (input.publicPageConfirmedNoPrice && input.publicSurfacesInspected) {
    return 'PUBLIC_PAGE_CONFIRMED_NO_PRICE';
  }
  if (input.detailBlocked && !hasSourcePrice && !input.publicSurfacesInspected) {
    return 'PUBLIC_DETAIL_EXTERNALLY_BLOCKED';
  }
  if (hasSourcePrice && !input.normalizedPriceText?.trim()) {
    return 'PRICE_LOST_DURING_NORMALIZATION';
  }
  if (input.normalizedPriceText?.trim() && !input.persistedPriceText?.trim()) {
    return 'PRICE_NOT_PERSISTED';
  }
  if (input.persistedPriceText?.trim() && !input.canonicalPriceText?.trim()) {
    return 'PRICE_MISSING_FROM_CANONICAL_READ';
  }
  if (input.canonicalPriceText?.trim() && !input.apiPriceText?.trim()) {
    return 'PRICE_MISSING_FROM_API';
  }
  if (input.apiPriceText?.trim() && !input.viewModelPriceText?.trim()) {
    return 'PRICE_MISSING_FROM_VIEW_MODEL';
  }
  if (hasSourcePrice && hasCanonicalPrice && !hasUiPrice) {
    return 'PRICE_HIDDEN_BY_UI';
  }
  if (!hasSourcePrice && input.publicSurfacesInspected) {
    return input.publicPageConfirmedNoPrice ? 'PUBLIC_PAGE_CONFIRMED_NO_PRICE' : 'PUBLIC_PRICE_NOT_EXTRACTED';
  }
  if (!hasSourcePrice) {
    return 'PUBLIC_PRICE_NOT_EXTRACTED';
  }
  return 'REVIEW_REQUIRED';
}
