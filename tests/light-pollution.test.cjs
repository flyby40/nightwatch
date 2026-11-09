const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const storage = new Map();
const context = vm.createContext({ URLSearchParams, localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,v), removeItem: k => storage.delete(k) } });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../dist/light-pollution.js'), 'utf8'), context);
const sky = context.LocalSky;
test('unavailable values stay null, with no SQM/Bortle conversion', () => {
 assert.equal(sky.read(35, -111).bortle, null);
 const data = sky.save(35, -111, '', '21.2');
 assert.equal(data.bortle, null);
 assert.equal(data.sqm, 21.2);
 assert.equal(sky.read(35, -111).sqm, 21.2);
 assert.equal(sky.read(36, -111).sqm, null);
 sky.clear(35, -111);
 assert.equal(sky.read(35, -111).sqm, null);
});
test('validates reported values and preserves numeric zero', () => {
 assert.equal(sky.parse('1', '0').sqm, 0);
 for (const b of ['0','10','2.5','abc']) assert.throws(() => sky.parse(b, ''));
 for (const s of ['-1','31','NaN']) assert.throws(() => sky.parse('', s));
 assert.equal(sky.parse('', '').sqm, null);
});
test('map link uses selected coordinates in the correct order', () => {
 const url = new URL(sky.mapURL(35.1983,-111.6513));
 assert.equal(url.searchParams.get('lat'), '35.1983');
 assert.equal(url.searchParams.get('lng'), '-111.6513');
});
function makeClient(endpoint, result, status = 200) {
 let calls = 0;
 const client = vm.createContext({ URL, URLSearchParams, AbortSignal, document: { baseURI: 'https://flyby40.github.io/nightwatch/' }, fetch: async url => {
  if (String(url).endsWith('/config.json')) return { ok: true, json: async () => ({ darkSkyApi: endpoint }) };
  calls++; const parsed = new URL(url);
  assert.equal(parsed.searchParams.get('lat'), '35.1983');
  assert.equal(parsed.searchParams.get('lng'), '-111.6513');
  return { ok: status === 200, json: async () => structuredClone(result) };
 } });
 vm.runInContext(fs.readFileSync(path.join(__dirname, '../dist/light-pollution.js'), 'utf8'), client);
 return { sky: client.LocalSky, calls: () => calls };
}
test('automatic client waits for an endpoint and never sends a secret from browser code', async () => {
 const client = makeClient(null);
 const result = await client.sky.lookup(35.1983, -111.6513);
 assert.equal(result.configured, false);
 assert.equal(result.data, null);
 assert.equal(client.calls(), 0);
 const keyed = makeClient('https://worker.example/api/sky?key=bad');
 await assert.rejects(keyed.sky.lookup(35.1983, -111.6513));
 assert.equal(keyed.calls(), 0);
});
test('automatic client uses provider values without conversions and caches a location', async () => {
 const data = { latitude: 35.1983, longitude: -111.6513, sqm: 21.2, bortleClass: 4, quality: { status: 'screened' }, attribution: 'DarkSkySites.com' };
 const client = makeClient('https://worker.example/api/sky', data);
 assert.equal((await client.sky.lookup(35.1983,-111.6513)).data.sqm,21.2);
 assert.equal((await client.sky.lookup(35.1983,-111.6513)).data.bortleClass,4);
 assert.equal(client.calls(),1);
 const missing = makeClient('https://worker.example/api/sky', { ...data, sqm: null });
 assert.equal((await missing.sky.lookup(35.1983,-111.6513)).data.sqm,null);
});
test('automatic client rejects location mismatch and suppresses unverified model values', async () => {
 const data = { latitude: 35.1983, longitude: -111.6513, sqm: 22, bortleClass: 1, quality: { status: 'unverified_zero' }, attribution: 'DarkSkySites.com' };
 const client = makeClient('https://worker.example/api/sky', data);
 const result = await client.sky.lookup(35.1983,-111.6513);
 assert.equal(result.data.sqm,null);assert.equal(result.data.bortleClass,null);
 const wrong = makeClient('https://worker.example/api/sky',{...data,latitude:34});
 await assert.rejects(wrong.sky.lookup(35.1983,-111.6513));
 const failure = makeClient('https://worker.example/api/sky',{error:'Quota reached'},429);
 await assert.rejects(failure.sky.lookup(35.1983,-111.6513),/Quota reached/);
});
