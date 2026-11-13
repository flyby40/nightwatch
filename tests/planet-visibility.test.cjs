const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const sandbox={Date};vm.runInNewContext(fs.readFileSync('dist/vendor/astronomy-engine/astronomy.browser.min.js','utf8'),sandbox);const A=sandbox.Astronomy,S=require('../dist/suncalc.js');
require('../dist/observability.js');require('../dist/moon-events.js');require('../dist/imaging-advisor.js');require('../dist/forecast-time.js');require('../dist/planet-visibility.js');const P=NightwatchPlanets;
const base={seeing:5,transparency:5,cloud:0,wind:0,humidity:40,temp:15,dew:3,moonIllum:0,moonAlt:30,sun:-25,solar:{daylight:false}};
function state(time='2026-11-14T02:30:00Z',lat=41.8781,lon=-87.6298){const now=new Date(time);return {now,lat,lon,hours:NightwatchTime.periods(now,'UTC',72).map((date,index)=>({...base,date,index}))}}
test('vendored browser library matches the pinned npm artifact hash and retains license',()=>{
 const provenance=JSON.parse(fs.readFileSync('dist/vendor/astronomy-engine/provenance.json'));assert.equal(provenance.version,'2.1.19');assert.equal(crypto.createHash('sha256').update(fs.readFileSync('dist/vendor/astronomy-engine/astronomy.browser.min.js')).digest('hex'),provenance.browserSha256);assert.match(fs.readFileSync('dist/vendor/astronomy-engine/LICENSE','utf8'),/MIT License/);
});
test('airless Jupiter coordinates agree with independent JPL Horizons fixtures within one arcminute',()=>{
 const ref=require('./fixtures/jupiter-horizons.json'),obs=new A.Observer(ref.latitude,ref.longitude,ref.heightMeters);
 for(const row of ref.rows){const p=P.position(A,'Jupiter',new Date(row.time),obs);assert(Math.abs(p.geometricAltitude-row.altitude)<1/60,JSON.stringify({p,row}));assert(Math.abs(p.azimuth-row.azimuth)<1/60);}
});
test('all seven planets calculate 72 finite chronological positions; current partial hour uses update time',()=>{
 const s=state(),model=P.create(s,A,S);
 for(const body of P.bodies){const d=model.planet(body);assert.equal(d.error,null);assert.equal(d.samples.length,72);assert.equal(+d.samples[0].time,+s.now);assert.equal(+d.samples[1].time,+s.hours[1].date);for(const p of d.samples){assert(p.altitude>=-90&&p.altitude<=90);assert(p.azimuth>=0&&p.azimuth<360);assert(Number.isFinite(p.solarElevation));assert.equal(typeof p.aboveHorizon,'boolean');}}
});
test('geometry caches by planet within a forecast and fresh forecasts use changed locations/elevations',()=>{
 let calls=0;const wrapped={...A,Equator(...args){calls++;return A.Equator(...args)}},s=state(),model=P.create(s,wrapped,S),one=model.planet('Jupiter'),count=calls;assert.equal(model.planet('Jupiter'),one);assert.equal(calls,count);
 const changed=P.create({...s,lat:-33.8688,lon:151.2093,observerHeightM:304.8},A,S);assert.equal(changed.height,304.8);assert.notEqual(changed.planet('Jupiter').samples[0].altitude,one.samples[0].altitude);
 assert.throws(()=>model.planet('Earth'),/Unsupported/);
});
test('rise/set searches are sorted and bounded; circumpolar geometry remains known without crossings',()=>{
 const s=state(),model=P.create(s,A,S),d=model.planet('Jupiter');assert(d.events.length>=4);for(let i=0;i<d.events.length;i++){assert(+d.events[i].date<+model.end);if(i)assert(+d.events[i].date>=+d.events[i-1].date);}
 for(const [lat,above]of [[85,true],[-85,false]]){const polar=P.create(state(undefined,lat,0),A,S).planet('Jupiter');assert.equal(polar.error,null);assert.equal(polar.events.length,0);assert(polar.samples.every(p=>p.aboveHorizon===above));}
});
test('daylight, below-horizon, low altitude and missing geometry are distinct from atmospheric quality',()=>{
 const h={...base},sample={altitude:30,azimuth:90,aboveHorizon:true,solar:{daylight:false},sun:-12};
 assert.equal(P.availability(sample,h,20).code,'above');assert.equal(P.availability({...sample,solar:{daylight:true}},h,20).code,'daylight');assert.equal(P.availability({...sample,aboveHorizon:false},h,20).code,'below');assert.equal(P.availability({...sample,altitude:10},h,20).code,'low');assert.equal(P.availability(null,h,20).code,'unknown');assert.equal(P.availability(sample,h,NaN).code,'unknown');
 assert.equal(P.availability({...sample,altitude:10},h,0).meetsPreference,true);assert.equal(NightwatchImaging.analyze(h).find(r=>r.id==='planetary').rating,'Good');
});
test('planet windows reject daylight, below horizon, altitude preference failures, gaps and missing weather',()=>{
 const start=Date.UTC(2026,10,14,0),hours=Array.from({length:7},(_,index)=>({...base,index,date:new Date(start+index*3600000)})),samples=hours.map(()=>({altitude:40,azimuth:120,aboveHorizon:true,sun:-25,solar:{daylight:false}}));
 samples[1].solar.daylight=true;samples[2].aboveHorizon=false;samples[3].altitude=10;hours[4].seeing=null;
 const groups=P.windows(hours,samples,20);assert.deepEqual(groups.flatMap(g=>g.indices),[0,5,6]);assert(groups.every(g=>g.average===100));assert.equal(P.windows(hours.slice(0,4),samples.slice(0,4),20).length,1);
 const original=JSON.stringify(hours);P.windows(hours,samples,0);assert.equal(JSON.stringify(hours),original);
});
test('calculation failures stay unavailable without fabricated coordinates or events',()=>{
 const model=P.create(state(),{...A,SearchRiseSet(){throw Error('fixture')}},S),d=model.planet('Jupiter');assert(d.error);assert.deepEqual(d.samples,[]);assert.deepEqual(d.events,[]);assert.equal(P.availability(d.samples[0],base).code,'unknown');
});
test('site elevations preserve zero and negative values with manual/model/reference precedence',()=>{
 assert.deepEqual(P.elevation(241,304.8),{value:304.8,source:'manual'});assert.deepEqual(P.elevation(241,0),{value:0,source:'manual'});assert.deepEqual(P.elevation(241,null),{value:241,source:'modeled'});assert.deepEqual(P.elevation(null,null),{value:0,source:'reference'});assert.equal(P.elevation(-430,null).value,-430);
 assert(!P.validHeight(NaN));assert(!P.validHeight(-501));assert(!P.validHeight(10001));assert.equal(P.elevationKey(41.8781,-87.6298),'nightwatch-site-elevation|41.878100|-87.629800');assert.notEqual(P.elevationKey(41.8781,-87.6298),P.elevationKey(41.8782,-87.6298));
});
test('timezones/DST retain identical shared UTC forecast samples and compass directions normalize',()=>{
 for(const now of ['2026-11-01T06:30:00Z','2026-11-01T07:30:00Z','2026-03-08T07:30:00Z']){const s=state(now);s.hours=NightwatchTime.periods(s.now,'America/Chicago',72).map((date,index)=>({...base,date,index}));const d=P.create(s,A,S).planet('Saturn');assert.equal(d.error,null);assert.deepEqual(d.samples.map(p=>+p.date),s.hours.map(h=>+h.date));}
 assert.equal(P.compass(0),'N');assert.equal(P.compass(90),'E');assert.equal(P.compass(180),'S');assert.equal(P.compass(270),'W');assert.equal(P.compass(360),'N');assert.equal(P.compass(null),null);
});
