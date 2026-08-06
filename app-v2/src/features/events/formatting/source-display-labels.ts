const SOURCE_ID_LABELS: Record<string, string> = {
  'source-bootshaus-koeln': 'Bootshaus',
  'source-bootshaus-ticket-io': 'Ticket.io',
  'source-affenkaefig': 'Affenkäfig',
  'source-affenkaefig-ticket-kings': 'Ticket Kings',
  'source-ticket-io-protontheclub': 'Ticket.io',
  'source-ticket-io-lehmannclub': 'Ticket.io',
  'source-ticket-io-area51events': 'Ticket.io',
  'source-ticket-io-technodampfer': 'Ticket.io',
  'source-ticket-io-hmg-concerts': 'Ticket.io',
  demo: 'Eternal Rave Demo',
  manual: 'Manueller Import',
  'local-json': 'Lokale Quelle',
};

function labelFromTicketUrl(ticketUrl: string | undefined): string | undefined {
  if (!ticketUrl) {
    return undefined;
  }

  const host = ticketUrl.toLowerCase();
  if (host.includes('ticket.io')) {
    return 'Ticket.io';
  }
  if (host.includes('ticketkings') || host.includes('ticket-kings')) {
    return 'Ticket Kings';
  }
  if (host.includes('bootshaus')) {
    return 'Bootshaus Tickets';
  }
  if (host.includes('residentadvisor.net') || host.includes('ra.co')) {
    return 'Resident Advisor';
  }
  if (host.includes('eventbrite')) {
    return 'Eventbrite';
  }
  if (host.includes('dice.fm')) {
    return 'Dice';
  }
  if (host.includes('universe.com')) {
    return 'Universe';
  }

  return undefined;
}

export function getSourceDisplayLabel(source: string, ticketUrl?: string): string {
  if (SOURCE_ID_LABELS[source]) {
    return SOURCE_ID_LABELS[source];
  }

  if (source.startsWith('source-ticket-io-') || source.includes('ticket-io')) {
    return 'Ticket.io';
  }
  if (source.startsWith('source-ticket-king')) {
    return 'Ticket Kings';
  }
  if (source.includes('bootshaus')) {
    return 'Bootshaus';
  }
  if (source.includes('affenkaefig')) {
    return 'Affenkäfig';
  }

  const fromUrl = labelFromTicketUrl(ticketUrl);
  if (fromUrl) {
    return fromUrl;
  }

  return 'Externe Quelle';
}
