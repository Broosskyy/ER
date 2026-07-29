// Supabase Edge Function stub — Discovery API.
// Deploy separately; routes all discovery traffic through DiscoveryHttpAdapter.
//
// Deno.serve(async (request) => {
//   const adapter = createDiscoveryHttpAdapter();
//   const url = new URL(request.url);
//   const response = await adapter.handle({
//     method: request.method as 'GET' | 'POST',
//     path: url.pathname,
//     headers: Object.fromEntries(request.headers.entries()),
//     queryString: Object.fromEntries(url.searchParams.entries()),
//     body: request.method === 'POST' ? await request.json() : undefined,
//   });
//   return new Response(JSON.stringify(response.body), {
//     status: response.status,
//     headers: response.headers,
//   });
// });

export const DISCOVERY_API_EDGE_FUNCTION = {
  name: 'discovery-api',
  description: 'Public Discovery API v1 — events, search, entities',
  basePath: '/v1/discovery',
  env: ['SUPABASE_URL', 'SUPABASE_ANON_KEY'],
  routes: [
    'GET /v1/discovery/events/today',
    'GET /v1/discovery/events/weekend',
    'GET /v1/discovery/events/nearby',
    'GET /v1/discovery/events/trending',
    'GET /v1/discovery/events/search',
    'POST /v1/discovery/events/filter',
    'GET /v1/discovery/events/:id',
    'GET /v1/discovery/venues/:id',
    'GET /v1/discovery/venues/:id/events',
    'GET /v1/discovery/organizers/:id',
    'GET /v1/discovery/organizers/:id/events',
    'GET /v1/discovery/festivals/:id',
    'GET /v1/discovery/festivals/:id/events',
  ],
};
