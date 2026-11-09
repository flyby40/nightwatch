const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../dist/aurora-map.js'), 'utf8'), ctx);
const aurora = ctx.AuroraMap;
const payload = points => ({ 'Observation Time': '2026-11-09T19:32:00Z', 'Forecast Time': '2026-11-09T20:13:00Z', coordinates: points });
test('preserves NOAA timestamps and zero, and wraps provider longitudes correctly', () => {
 const data = aurora.parse(payload([[272,42,0],[273,42,23],[180,60,42],[0,-90,8]]));
 assert.equal(data.observation, Date.parse('2026-11-09T19:32:00Z'));
 assert.equal(data.forecast, Date.parse('2026-11-09T20:13:00Z'));
 assert.equal(aurora.at(data,42,-88).value,0);
 assert.equal(aurora.at(data,42,-87).value,23);
 assert.equal(aurora.at(data,60,180).value,42);
 assert.equal(aurora.at(data,60,-180).value,42);
});
test('uses the nearest NOAA grid point without inventing missing cells or values', () => {
 const data = aurora.parse(payload([[272,42,12],[272,43,null],[273,42,101],[274,42,2.5]]));
 assert.equal(aurora.at(data,42.2,-88.1).value,12);
 assert.equal(aurora.at(data,43,-88).value,null);
 assert.equal(aurora.at(data,42,-87).value,null);
 assert.equal(aurora.at(data,42,-86).value,null);
 assert.throws(() => aurora.parse(payload([])));
 assert.throws(() => aurora.parse({...payload([[0,0,2]]),'Forecast Time':null}));
});
