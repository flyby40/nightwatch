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
