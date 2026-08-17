import type { TicketOfferRole } from './types';

const LOCKER_PATTERN = /\blocker\b|\bschließfach\b/i;
const INSURANCE_PATTERN = /\binsurance\b|\bversicherung\b/i;
const SHIPPING_PATTERN = /\bshipping\b|\bversand\b|\bpostage\b/i;
const PARKING_PATTERN = /\bparking\b|\bparken\b|\bparkticket\b/i;
const MERCH_PATTERN = /\bmerch\b|\bmerchandise\b|\bt-?shirt\b/i;
const DONATION_PATTERN = /\bdonation\b|\bspende\b/i;
const VIP_PATTERN = /\bvip\b|\bbalcony\b|\blounge\b|\bpremium\b/i;
const EARLY_ENTRY_PATTERN = /\bearly\s*(?:bird|entry)\b|\bfrüherer?\s*einlass\b/i;
const GROUP_PATTERN = /\bgroup\b|\bgruppen\b|\b5er\b|\b10er\b/i;
const FEE_PATTERN = /\bbooking fee\b|\bservice fee\b|\bgebühr\b|\bhardticket\b|\bgift packaging\b|\bcoupon\b/i;

export function classifyTicketOfferRole(label: string): TicketOfferRole {
  const text = label.trim();
  if (!text) {
    return 'unknown_addon';
  }
  if (LOCKER_PATTERN.test(text)) {
    return 'locker';
  }
  if (INSURANCE_PATTERN.test(text)) {
    return 'insurance';
  }
  if (SHIPPING_PATTERN.test(text)) {
    return 'shipping';
  }
  if (PARKING_PATTERN.test(text)) {
    return 'parking';
  }
  if (MERCH_PATTERN.test(text)) {
    return 'merchandise';
  }
  if (DONATION_PATTERN.test(text)) {
    return 'donation';
  }
  if (FEE_PATTERN.test(text)) {
    return 'unknown_addon';
  }
  if (VIP_PATTERN.test(text)) {
    return 'vip_admission';
  }
  if (EARLY_ENTRY_PATTERN.test(text)) {
    return 'early_entry';
  }
  if (GROUP_PATTERN.test(text)) {
    return 'group_admission';
  }
  return 'admission';
}

export function isAdmissionOfferRole(role: TicketOfferRole): boolean {
  return (
    role === 'admission' ||
    role === 'vip_admission' ||
    role === 'early_entry' ||
    role === 'group_admission'
  );
}
