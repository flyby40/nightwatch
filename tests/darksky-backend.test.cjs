const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const modulePromise = import(pathToFileURL(path.join(__dirname, '../backend/worker.mjs')));
const origin = 'https://flyby40.github.io';
const sample = () => ({ latitude: 35.1983, longitude: -111.6513, sqm: 21.2, bortleClass: 4, bortleDescription: 'Rural/suburban transition', dataset: { id: '08_2026', year: 2026, month: 8, fallbackUsed: true, fallbackFrom: '09_2026', fallbackReason: 'missing_tile' }, quality: { status: 'screened', coverageVerified: false, method: 'seasonal_temporal_v1', flags: [] }, attribution: 'darkskysites.com' });
const env = () => ({ DARKSKYSITES_API_KEY: 'test-only-secret', SKY_RATE_LIMITER: { limit: async () => ({ success: true }) } });
const request = (query = 'lat=35.1983&lng=-111.6513', headers = {}) => new Request('https://worker.example/api/sky?' + query, { headers: { Origin: origin, ...headers } });
test('passes exact coordinates and sends credential only to the fixed upstream header', async () => {
 const { createHandler } = await modulePromise;
 const handler = createHandler({ fetcher: async (url, options) => {
  assert.equal(url.origin + url.pathname, 'https://darkskysites.com/api/sqm');
  assert.equal(url.searchParams.get('lat'), '35.1983');
  assert.equal(url.searchParams.get('lng'), '-111.6513');
  assert(!url.href.includes('secret'));
  assert.equal(options.headers['x-api-key'], 'test-only-secret');
  assert.equal(options.redirect, 'error');
  return Response.json(sample());
 } });
 const response = await handler(request(), env());
 assert.equal(response.status, 200);
 assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
 const result = await response.json();
 assert.equal(result.sqm, 21.2);
 assert.equal(result.bortleClass, 4);
 assert.equal(result.dataset.id, '08_2026');
 assert.equal(result.dataset.fallbackUsed, true);
 assert.equal(result.quality.coverageVerified, false);
 assert.equal(result.attribution, 'DarkSkySites.com');
 assert(!JSON.stringify(result).includes('test-only-secret'));
});
test('rejects invalid coordinates and disallowed origins before calling upstream', async () => {
 const { createHandler } = await modulePromise;
 let calls = 0;
 const handler = createHandler({ fetcher: async () => { calls++; throw Error('should not fetch'); } });
 for (const q of ['lat=&lng=2', 'lat=NaN&lng=2', 'lat=91&lng=0', 'lat=0&lng=-181', 'lat=0&lng=0&key=secret', 'lat=0&lat=1&lng=0']) assert.equal((await handler(request(q), env())).status, 400);
 assert.equal((await handler(request(undefined, { Origin: 'https://other.example' }), env())).status, 403);
 assert.equal((await handler(new Request('https://worker.example/api/sky?lat=0&lng=0'), env())).status, 403);
 assert.equal(calls, 0);
});
test('missing config, quota exhaustion, and provider errors stay null without leaking errors', async () => {
 const { createHandler } = await modulePromise;
 assert.equal((await createHandler()(request(), {})).status, 503);
 const throttled = env(); throttled.SKY_RATE_LIMITER.limit = async () => ({ success: false });
 const blocked = await createHandler()(request(), throttled);
 assert.equal(blocked.status, 429);
 assert.equal(blocked.headers.get('Retry-After'), '60');
 for (const status of [401, 403, 404, 429, 500]) {
  const response = await createHandler({ fetcher: async () => new Response('private upstream details test-only-secret', { status }) })(request(), env());
  const body = await response.text();
  assert.equal(JSON.parse(body).sqm, null);
  assert.equal(JSON.parse(body).bortleClass, null);
  assert(!body.includes('test-only-secret'));
  assert(!body.includes('private upstream details'));
 }
 const response = await createHandler({ fetcher: async () => { throw Error('secret exception'); } })(request(), env());
 assert.equal(response.status, 502);
 assert(!(await response.text()).includes('secret exception'));
});
test('does not infer missing or unverified values or accept mismatched coordinates', async () => {
 const { normalize } = await modulePromise;
 const data = sample(); data.sqm = null;
 assert.equal(normalize(data, 35.1983, -111.6513).sqm, null);
 assert.equal(normalize(data, 35.1983, -111.6513).bortleClass, 4);
 data.quality.status = 'unverified_zero';
 assert.equal(normalize(data, 35.1983, -111.6513).bortleClass, null);
 data.sqm = 22;
 assert.equal(normalize(data, 35.1983, -111.6513).sqm, null);
 assert.throws(() => normalize(data, 36, -111.6513));
});
test('uses cache for the exact location without repeating upstream requests', async () => {
 const { createHandler } = await modulePromise;
 const storage = new Map(); let calls = 0;
 const cache = { match: async r => storage.get(r.url)?.clone(), put: async (r, v) => { storage.set(r.url, v.clone()); } };
 const handler = createHandler({ cache, fetcher: async () => { calls++; return Response.json(sample()); } });
 assert.equal((await handler(request(), env())).status, 200);
 assert.equal((await handler(request(), env())).status, 200);
 assert.equal(calls, 1);
 assert.equal(storage.size, 1);
});
