#!/usr/bin/env node
/**
 * One-off candidate analysis for Sprint 12. Manual use only.
 */
const candidates = [
  { name: 'Bootshaus', url: 'https://www.bootshaus.tv/events/' },
  { name: 'Bootshaus alt', url: 'https://bootshaus-club.de/events/' },
  { name: 'Affenkäfig', url: 'https://www.affenkaefig.de/' },
  { name: 'Grelle Forelle', url: 'https://grelleforelle.com/events/' },
  { name: '://about blank', url: 'https://about-blank.de/events/' },
  { name: 'Odonien', url: 'https://odonien.de/termine/' },
  { name: 'Gewölbe', url: 'https://gewoelbe.net/termine/' },
  { name: 'Artheater', url: 'https://artheater.de/programm/' },
  { name: 'O-Ton', url: 'https://www.o-ton.org/termine/' },
  { name: 'Ritter Butzke', url: 'https://www.ritterbutzke.com/events/' },
];

const UA = 'EternalRave-SourceBot/1.0 (+https://eternalrave.app; source-research)';

async function analyze(candidate) {
  const result = {
    name: candidate.name,
    url: candidate.url,
    ok: false,
    status: null,
    finalUrl: null,
    contentType: null,
    size: 0,
    jsonLd: false,
    schemaEvent: false,
    nextData: false,
    embeddedJson: false,
    eventLinks: 0,
    jsRendered: false,
    robotsDisallow: null,
    error: null,
  };

  try {
    const response = await fetch(candidate.url, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/json' },
      redirect: 'follow',
      signal: AbortSignal.timeout(20000),
    });
    result.status = response.status;
    result.finalUrl = response.url;
    result.contentType = response.headers.get('content-type');
    const html = await response.text();
    result.size = html.length;
    result.ok = response.ok;
    result.jsonLd = /application\/ld\+json/i.test(html);
    result.schemaEvent = /"@type"\s*:\s*"(MusicEvent|Event|Festival)"/i.test(html);
    result.nextData = /__NEXT_DATA__/i.test(html);
    result.embeddedJson = /<script[^>]+type=["']application\/json["']/i.test(html);
    result.eventLinks = (html.match(/\/event[s]?\//gi) ?? []).length;
    result.jsRendered = /<div[^>]+id=["']root["'][^>]*>\s*<\/div>/i.test(html) || /enable javascript/i.test(html);

    const robotsUrl = new URL('/robots.txt', response.url).toString();
    try {
      const robots = await fetch(robotsUrl, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) });
      if (robots.ok) {
        const text = await robots.text();
        const disallow = text.split('\n').filter((l) => /disallow/i.test(l)).slice(0, 5);
        result.robotsDisallow = disallow.length ? disallow.join(' | ') : 'none listed';
      }
    } catch {
      result.robotsDisallow = 'unavailable';
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }

  return result;
}

const results = [];
for (const candidate of candidates) {
  results.push(await analyze(candidate));
  await new Promise((r) => setTimeout(r, 500));
}

console.log(JSON.stringify(results, null, 2));
