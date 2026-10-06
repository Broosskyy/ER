import { AppText } from '@/components/layout/AppText';
import type { TextRole } from '@/design/typography';
import { useTheme } from '@/design/theme';
import type { SemanticColorToken } from '@/design/ticket-semantics';
import { resolveSemanticThemeColor } from '@/design/ticket-semantics';

export interface TicketPriceLabelProps {
  label: string;
  colorToken?: SemanticColorToken;
  role?: TextRole;
  numberOfLines?: number;
}

/** Ticket price / availability label with shared semantic coloring. */
export function TicketPriceLabel({
  label,
  colorToken = 'muted',
  role = 'metadata',
  numberOfLines,
}: TicketPriceLabelProps) {
  const { theme } = useTheme();

  return (
    <AppText
      role={role}
      color={resolveSemanticThemeColor(theme.colors, colorToken)}
      numberOfLines={numberOfLines}
    >
      {label}
    </AppText>
  );
}
