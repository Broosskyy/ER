import { defaultHttpClient } from '@/features/endpoints/http/default-http-client';

async function probe(url: string) {
  const response = await defaultHttpClient.fetch(url, {
    headers: { 'User-Agent': 'EternalRave-SourceBot/1.0 (+https://eternalrave.app)' },
  });
  const text = await response.text();
  const eventLinks = [...text.matchAll(/ticketkings\.de\/event\/[^"'\s]+/gi)].map((m) => m[0]);
  const shopLinks = [...text.matchAll(/https?:\/\/[a-z0-9-]+\.ticket\.io\/?/gi)].map((m) => m[0]);
  const pageLinks = [...text.matchAll(/all-events\/page\/\d+/gi)].map((m) => m[0]);
  console.log(
    JSON.stringify(
      {
        url,
        status: response.status,
        bytes: text.length,
        ticketKingsEvents: eventLinks.length,
        uniqueTicketKingsEvents: new Set(eventLinks).size,
        pageLinks: [...new Set(pageLinks)],
        ticketIoShops: [...new Set(shopLinks)],
      },
      null,
      2,
    ),
  );
}

async function main() {
  await probe('https://ticketkings.de/all-events/');
  await probe('https://ticketkings.de/all-events/page/2/');
  await probe('https://ticketkings.de/events/liste/');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
