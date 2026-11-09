// DarkSkySites key is supplied only through the Worker environment.
const SOURCE = 'https://darkskysites.com/api/sqm';
const ORIGIN = 'https://flyby40.github.io';
const numeric = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const text = v => typeof v === 'string' ? v.slice(0, 250) : null;
export function normalize(data, lat, lng) {
  if (!data || !numeric(data.latitude, -90, 90) || !numeric(data.longitude, -180, 180) || Math.abs(data.latitude - lat) > 0.00001 || Math.abs(data.longitude - lng) > 0.00001) throw Error('Location mismatch');
  const quality = {
    status: text(data.quality?.status),
    method: text(data.quality?.method),
    coverageVerified: data.quality?.coverageVerified === true,
    flags: Array.isArray(data.quality?.flags) ? data.quality.flags.filter(v => typeof v === 'string').slice(0, 20).map(text) : []
  };
  // Do not turn an unverified zero raster sample into a pristine-sky claim.
  const usable = quality.status === 'screened';
  return {
    latitude: data.latitude, longitude: data.longitude,
    sqm: usable && numeric(data.sqm, 0, 30) ? data.sqm : null,
    bortleClass: usable && numeric(data.bortleClass, 1, 9) && Number.isInteger(data.bortleClass) ? data.bortleClass : null,
    bortleDescription: text(data.bortleDescription),
    dataset: {
      id: text(data.dataset?.id),
      year: Number.isInteger(data.dataset?.year) ? data.dataset.year : null,
      month: Number.isInteger(data.dataset?.month) && data.dataset.month >= 1 && data.dataset.month <= 12 ? data.dataset.month : null,
      fallbackUsed: typeof data.dataset?.fallbackUsed === 'boolean' ? data.dataset.fallbackUsed : null,
      fallbackFrom: text(data.dataset?.fallbackFrom), fallbackReason: text(data.dataset?.fallbackReason)
    },
    quality, attribution: 'DarkSkySites.com', fetchedAt: new Date().toISOString(),
    notice: usable ? 'Provider-modeled zenith brightness and provider-derived Bortle class; not a live measurement.' : 'Provider quality status is not screened; numeric values remain null.'
  };
}
function reply(body, status, origin, extra = {}) {
  return new Response(JSON.stringify(body), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'Vary': 'Origin',
    ...(origin ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Max-Age': '86400' } : {}), ...extra
  } });
}
export function createHandler({ fetcher = fetch, cache = null, logger = () => {} } = {}) {
  return async function handle(request, env, ctx = {}) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const allowedOrigin = env.ALLOWED_ORIGIN || ORIGIN;
    if (origin !== allowedOrigin) return reply({ sqm: null, bortleClass: null, error: 'Origin not allowed.' }, 403, null);
    if (url.pathname !== '/api/sky') return reply({ error: 'Not found.' }, 404, origin);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Max-Age': '86400', 'Vary': 'Origin' } });
    if (request.method !== 'GET') return reply({ error: 'Method not allowed.' }, 405, origin, { Allow: 'GET, OPTIONS' });
    const latText = url.searchParams.get('lat'), lngText = url.searchParams.get('lng');
    if (!latText?.trim() || !lngText?.trim() || url.searchParams.getAll('lat').length !== 1 || url.searchParams.getAll('lng').length !== 1 || [...url.searchParams.keys()].some(k => !['lat', 'lng'].includes(k))) return reply({ sqm: null, bortleClass: null, error: 'Only lat and lng are accepted.' }, 400, origin);
    const lat = Number(latText), lng = Number(lngText);
    if (!numeric(lat, -90, 90) || !numeric(lng, -180, 180)) return reply({ sqm: null, bortleClass: null, error: 'Invalid coordinates.' }, 400, origin);
    if (!env.DARKSKYSITES_API_KEY || !env.SKY_RATE_LIMITER) return reply({ sqm: null, bortleClass: null, error: 'Sky lookup is not configured yet.' }, 503, origin);
    let stage = 'rate_limit';
    try {
      const limit = await env.SKY_RATE_LIMITER.limit({ key: request.headers.get('CF-Connecting-IP') || 'unknown' });
      if (!limit.success) return reply({ sqm: null, bortleClass: null, error: 'Too many lookups; try again shortly.' }, 429, origin, { 'Retry-After': '60' });
      const cacheURL = new URL('/cache/v1/sky', url.origin);
      cacheURL.search = new URLSearchParams({ lat: String(lat), lng: String(lng) }).toString();
      const cacheKey = new Request(cacheURL);
      stage = 'cache_read';
      if (cache) {
        const hit = await cache.match(cacheKey);
        if (hit) return reply(await hit.json(), 200, origin);
      }
      const upstream = new URL(SOURCE);
      upstream.search = new URLSearchParams({ lat: String(lat), lng: String(lng) }).toString();
      stage = 'provider_fetch';
      const response = await fetcher(upstream, { headers: { 'x-api-key': env.DARKSKYSITES_API_KEY, Accept: 'application/json' }, redirect: 'manual', signal: AbortSignal.timeout(15000) });
      if (!response.ok) {
        logger({ event: 'sky_provider_error', status: response.status });
        const status = response.status === 429 ? 429 : response.status === 404 ? 404 : 502;
        const error = response.status === 429 ? 'DarkSkySites quota or rate limit reached.' : response.status === 404 ? 'No usable DarkSkySites dataset at this location.' : 'DarkSkySites is unavailable or its credential needs attention.';
        return reply({ sqm: null, bortleClass: null, error }, status, origin, status === 429 ? { 'Retry-After': '60' } : {});
      }
      stage = 'provider_parse';
      const data = await response.json();
      stage = 'provider_validate';
      const result = normalize(data, lat, lng);
      if (cache && result.dataset.id && result.quality.status === 'screened') {
        const cached = new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' } });
        const put = cache.put(cacheKey, cached).catch(() => {});
        if (ctx.waitUntil) ctx.waitUntil(put); else await put;
      }
      return reply(result, 200, origin);
    } catch (error) {
      logger({ event: 'sky_lookup_failed', stage, errorType: error instanceof Error ? error.name : 'unknown' });
      // Never forward upstream error bodies, tokens, or exception details.
      return reply({ sqm: null, bortleClass: null, error: 'Sky lookup failed or timed out; values remain null.' }, 502, origin);
    }
  };
}
export default { fetch(request, env, ctx) { return createHandler({ cache: typeof caches === 'undefined' ? null : caches.default, logger: event => console.error(JSON.stringify(event)) })(request, env, ctx); } };
