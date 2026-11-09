const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../dist/viewing-score.js'), 'utf8'), context);
const { infer, quality } = context.NightwatchScore;
const clear = { cloud: 0, humidity: 40, wind: 0, sun: -20, moonAlt: -10, moonIllum: 1 };
test('score follows the original weights', () => {
 assert.equal(infer(clear), 100);
 assert.equal(infer({ ...clear, cloud: 100 }), 40);
 assert.equal(infer({ ...clear, humidity: 100 }), 87);
 assert.equal(infer({ ...clear, wind: 40 }), 90);
 assert.equal(infer({ ...clear, moonAlt: 10 }), 85);
 assert.equal(infer({ ...clear, moonAlt: 10, moonIllum: 0 }), 100);
});
test('solar altitude gates daylight and twilight', () => {
 assert.equal(infer({ ...clear, sun: 0 }), 0);
 assert.equal(infer({ ...clear, sun: -6 }), 25);
 assert.equal(infer({ ...clear, sun: -12 }), 25);
 assert.equal(infer({ ...clear, sun: -15 }), 65);
 assert.equal(infer({ ...clear, sun: -18 }), 65);
 assert.equal(infer({ ...clear, sun: -18.01 }), 100);
});
test('missing inputs remain null including during daylight', () => {
 for (const key of Object.keys(clear)) {
  for (const missing of [null, undefined, NaN, '0']) {
   assert.equal(infer({ ...clear, [key]: missing }), null);
  }
 }
 assert.equal(infer({ ...clear, sun: 1, cloud: null }), null);
 assert.equal(infer({ ...clear, cloud: -1 }), null);
 assert.equal(infer({ ...clear, moonIllum: 2 }), null);
 assert.equal(infer({ ...clear, humidity: 0 }), 100);
});
test('quality thresholds remain explicit', () => {
 assert.equal(quality(70), 'Good');
 assert.equal(quality(69), 'Fair');
 assert.equal(quality(40), 'Fair');
 assert.equal(quality(39), 'Poor');
 assert.equal(quality(null), null);
});
