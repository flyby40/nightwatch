const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const context = vm.createContext({ URLSearchParams });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../dist/cloud-map.js'), 'utf8'), context);
const map = context.NightwatchMap;
test('satellite animation uses only provider timestamps ending at the advertised latest image', () => {
 const meta = map.interval('2026-11-09T12:00:00Z/2026-11-09T18:50:00Z/PT10M', '2026-11-09T18:40:00Z');
 const frames = Array.from(map.recentTimes(meta));
 assert.equal(frames.length, 6);
 assert.equal(frames[0], Date.parse('2026-11-09T17:50:00Z'));
 assert.equal(frames.at(-1), Date.parse('2026-11-09T18:40:00Z'));
 for (const frame of frames) assert(map.exactTime(meta, frame));
 const short = map.interval('2026-11-09T18:30:00Z/2026-11-09T18:50:00Z/PT10M', '2026-11-09T18:40:00Z');
 assert.equal(map.recentTimes(short).length, 2);
});
test('forecast time selection rejects gaps and times outside the model horizon', () => {
 const meta = map.interval('2026-11-09T12:00:00Z/2026-11-13T00:00:00Z/PT1H', '2026-11-09T19:00:00Z', '2026-11-09T12:00:00Z');
 assert(map.exactTime(meta, new Date('2026-11-10T01:00:00Z')));
 assert(!map.exactTime(meta, new Date('2026-11-10T01:30:00Z')));
 assert(!map.exactTime(meta, new Date('2026-11-13T01:00:00Z')));
 assert(!map.exactTime(meta, new Date('2026-11-09T11:00:00Z')));
 assert.throws(() => map.interval('bad', '2026-11-09T19:00:00Z'));
 assert.throws(() => map.interval('2026-11-09T12:00:00Z/2026-11-09T19:00:00Z/PT0H', '2026-11-09T19:00:00Z'));
});
test('GetMap request preserves exact selected forecast hour, model run, projection and viewport', () => {
 const url = new URL(map.imageRequest('RDPS_10km_TotalCloudCover', Date.parse('2026-11-10T01:00:00Z'), '2026-11-09T12:00:00Z', [-13000000,4000000,-12000000,5000000], { x: 1000, y: 380 }));
 assert.equal(url.searchParams.get('TIME'), '2026-11-10T01:00:00Z');
 assert.equal(url.searchParams.get('DIM_REFERENCE_TIME'), '2026-11-09T12:00:00Z');
 assert.equal(url.searchParams.get('CRS'), 'EPSG:3857');
 assert.equal(url.searchParams.get('BBOX'), '-13000000,4000000,-12000000,5000000');
 assert.equal(url.searchParams.get('LAYERS'), 'RDPS_10km_TotalCloudCover');
 assert.equal(url.searchParams.get('STYLES'), 'CLOUD');
 const satellite = new URL(map.imageRequest('GOES-West_2km_NightIR', Date.parse('2026-11-09T18:40:00Z'), null, [1,2,3,4], {x:512,y:300}));
 assert(!satellite.searchParams.has('DIM_REFERENCE_TIME'));
 assert.equal(satellite.searchParams.get('TIME'), '2026-11-09T18:40:00Z');
});
test('chooses a regional satellite without moving the forecast location', () => {
 assert.equal(map.satelliteFor(-111.6513), 'GOES-West_2km_NightIR');
 assert.equal(map.satelliteFor(-87.6298), 'GOES-East_2km_NightIR');
 assert.equal(map.satelliteFor(169), 'GOES-West_2km_NightIR');
});

test('wind and temperature images use explicit native-unit gradient styles', () => {
 for (const [layer,style] of [['RDPS_10km_WindSpeed_10m','WINDSPEEDKMH-LINEAR'],['RDPS_10km_AirTemp_2m','TEMPERATURE-LINEAR']]) {
  const url = new URL(map.imageRequest(layer, Date.parse('2026-11-10T01:00:00Z'), '2026-11-09T12:00:00Z', [1,2,3,4], {x:512,y:300}));
  assert.equal(url.searchParams.get('STYLES'), style);
  assert.equal(url.searchParams.get('TIME'), '2026-11-10T01:00:00Z');
  assert.equal(url.searchParams.get('DIM_REFERENCE_TIME'), '2026-11-09T12:00:00Z');
 }
});
