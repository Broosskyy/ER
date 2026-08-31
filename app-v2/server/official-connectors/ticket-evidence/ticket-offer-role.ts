import type { TicketOfferClassification, TicketOfferRole } from './types';

export interface ClassifyTicketOfferInput {
  label: string;
  description?: string;
  category?: string;
}

const REQUIRES_BASE_TICKET_PATTERN =
  /\bonly valid in combination\b|\bnur gültig in kombination\b|\brequires(?:\s+an?)?\s+(?:base|main|event)\s+ticket\b|\bticket not included\b|\bohne eintritt\b|\bnot included\b|\badd-?on only\b|\bzusatz(?:ticket|produkt)?\b|\bin kombination mit\b/i;

const LOCKER_PATTERN = /\blocker\b|\bschließfach\b/i;
const INSURANCE_PATTERN = /\binsurance\b|\bversicherung\b/i;
const SHIPPING_PATTERN = /\bshipping\b|\bversand\b|\bpostage\b/i;
const PARKING_PATTERN = /\bparking\b|\bparken\b|\bparkticket\b|\bparkplatz\b|\bpark\s*ticket\b/i;
const SHUTTLE_PATTERN = /\bshuttle\b|\bbus\s*transfer\b|\btransfer\s*ticket\b/i;
const MERCH_PATTERN = /\bmerch\b|\bmerchandise\b|\bt-?shirt\b|\bhoodie\b|\bcap\b/i;
const DONATION_PATTERN = /\bdonation\b|\bspende\b/i;
const VIP_PATTERN = /\bvip\b|\bbalcony\b|\blounge\b|\bpremium\s*deck\b/i;
const TABLE_PATTERN = /\btable\b|\btisch\b|\breservation\b|\breservierung\b|\blounge\s*table\b/i;
const GROUP_PATTERN = /\bgroup\b|\bgruppen\b|\b5er\b|\b10er\b/i;
const CAMPING_PATTERN = /\bcamping\b|\bstellplatz\b/i;
const UPGRADE_PATTERN =
  /\bupgrade\b|\bpriority\s+upgrade\b|\bdeck\s*upgrade\b|\bvip\s*upgrade\b|\bfrüherer?\s*einlass\b|\bearly\s*entry\b/i;
const POWER_PATTERN = /\bpower\s*bank\b|\bpowerstation\b|\bpower\s*station\b|\bcharging\b/i;
const FOOD_PATTERN = /\bgetränke\b|\bdrink\b|\bfood\b|\bsupermarkt\b|\bvorbestellung\b|\bmeal\b/i;
const FEE_PATTERN = /\bbooking fee\b|\bservice fee\b|\bgebühr\b|\bhardticket\b|\bgift packaging\b|\bcoupon\b/i;

const POSITIVE_ADMISSION_PATTERNS: RegExp[] = [
  /\bgeneral\s+admission\b/i,
  /\bphase\s*(?:[1-9]|[ivx]+|one|two|three|four|five|six|seven|eight|nine|ten)\b/i,
  /\b(?:final|finale)\s+phase\b/i,
  /\bearly\s+bird\b/i,
  /\bfirst\s+release\b/i,
  /\bsecond\s+release\b/i,
  /\bfinal\s+release\b/i,
  /\bday\s*ticket\b/i,
  /\btages\s*ticket\b/i,
  /\bweekend\s+\d+\s+days?\b/i,
  /\bfull\s+weekend\b/i,
  /\bweekend\s+ticket\b/i,
  /\b(?:fri|sat|sun|friday|saturday|sunday)\b.*\b(?:day\s*ticket|combi)\b/i,
  /\bcombi\b|\bkombiticket\b/i,
  /\bstandard\s+ticket\b/i,
  /\be-?ticket\b/i,
  /\bregular(?:\s+ticket)?\b/i,
  /\bfestival\s+ticket\b/i,
  /\bgeneral\s+admission\b/i,
];

function combinedOfferText(input: ClassifyTicketOfferInput): string {
  return [input.label, input.category, input.description].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

export function isGenericPlaceholderOfferLabel(label: string): boolean {
  return /^(admission|ticket|eintritt|angebot|offer)$/i.test(label.replace(/\s+/g, ' ').trim());
}

export function normalizeOfferRole(role?: TicketOfferRole | string): TicketOfferRole {
  switch (role) {
    case 'admission':
      return 'regular_admission';
    case 'table_reservation':
      return 'table';
    case 'unknown_addon':
      return 'unknown';
    case 'early_entry':
      return 'upgrade';
    case 'shipping':
      return 'other_addon';
    default:
      return (role as TicketOfferRole) ?? 'unknown';
  }
}

export function classifyTicketOffer(input: ClassifyTicketOfferInput): TicketOfferClassification {
  const text = combinedOfferText(input);
  if (!text) {
    return {
      role: 'unknown',
      grantsEventEntry: false,
      requiresBaseTicket: false,
      rejectionReason: 'empty_label',
    };
  }

  const requiresBaseTicket = REQUIRES_BASE_TICKET_PATTERN.test(text);
  const category = input.category?.trim() || undefined;

  const classify = (role: TicketOfferRole, grantsEventEntry: boolean, rejectionReason?: string): TicketOfferClassification => ({
    role,
    grantsEventEntry,
    requiresBaseTicket,
    category,
    rejectionReason,
  });

  if (LOCKER_PATTERN.test(text)) {
    return classify('locker', false, 'locker');
  }
  if (INSURANCE_PATTERN.test(text)) {
    return classify('insurance', false, 'insurance');
  }
  if (SHIPPING_PATTERN.test(text)) {
    return classify('other_addon', false, 'shipping');
  }
  if (PARKING_PATTERN.test(text)) {
    return classify('parking', false, 'parking');
  }
  if (SHUTTLE_PATTERN.test(text)) {
    return classify('shuttle', false, 'shuttle');
  }
  if (POWER_PATTERN.test(text)) {
    return classify('power_or_equipment', false, 'power_or_equipment');
  }
  if (FOOD_PATTERN.test(text)) {
    return classify('food_or_beverage', false, 'food_or_beverage');
  }
  if (MERCH_PATTERN.test(text)) {
    return classify('merchandise', false, 'merchandise');
  }
  if (DONATION_PATTERN.test(text)) {
    return classify('donation', false, 'donation');
  }
  if (FEE_PATTERN.test(text)) {
    return classify('other_addon', false, 'fee');
  }
  if (TABLE_PATTERN.test(text)) {
    return classify('table', false, 'table');
  }
  if (UPGRADE_PATTERN.test(text)) {
    return classify('upgrade', false, 'upgrade');
  }
  if (CAMPING_PATTERN.test(text) && !/\b(?:ticket|admission|eintritt|entry)\b/i.test(text)) {
    return classify('camping', false, 'camping_only');
  }
  if (VIP_PATTERN.test(text)) {
    return classify('vip_admission', true, 'vip_admission');
  }
  if (GROUP_PATTERN.test(text)) {
    return classify('group_admission', true, 'group_admission');
  }

  const positiveAdmission = POSITIVE_ADMISSION_PATTERNS.some((pattern) => pattern.test(text));
  if (positiveAdmission && !requiresBaseTicket) {
    return classify('regular_admission', true);
  }

  return classify('unknown', false, 'unknown_without_admission_evidence');
}

export function classifyTicketOfferRole(label: string, options?: Omit<ClassifyTicketOfferInput, 'label'>): TicketOfferRole {
  return classifyTicketOffer({ label, ...options }).role;
}

export function isRegularAdmissionOfferRole(role: TicketOfferRole | string | undefined): boolean {
  return normalizeOfferRole(role) === 'regular_admission';
}

export function isAdmissionOfferRole(role: TicketOfferRole | string | undefined): boolean {
  const normalized = normalizeOfferRole(role);
  return normalized === 'regular_admission' || normalized === 'vip_admission' || normalized === 'group_admission';
}

export function isSelectableRegularAdmission(classification: TicketOfferClassification): boolean {
  return (
    classification.role === 'regular_admission' &&
    classification.grantsEventEntry &&
    !classification.requiresBaseTicket
  );
}

export function rejectionReasonForRole(role: TicketOfferRole): string {
  switch (normalizeOfferRole(role)) {
    case 'parking':
      return 'parking';
    case 'shuttle':
      return 'shuttle';
    case 'locker':
      return 'locker';
    case 'upgrade':
      return 'upgrade';
    case 'camping':
      return 'camping_only';
    case 'merchandise':
      return 'merchandise';
    case 'power_or_equipment':
      return 'power_or_equipment';
    case 'food_or_beverage':
      return 'food_or_beverage';
    case 'vip_admission':
      return 'vip_admission';
    case 'table':
      return 'table';
    case 'group_admission':
      return 'group_admission';
    case 'unknown':
      return 'unknown_without_admission_evidence';
    default:
      return 'other_addon';
  }
}
