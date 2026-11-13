const {test}=require('node:test'),assert=require('node:assert/strict');require('../dist/observability.js');const SunCalc=require('../dist/suncalc.js'),O=global.NightwatchObservability;
test('sunrise and sunset define exact eligibility boundaries, independently of weather',()=>{
 const date=new Date('2026-11-13T18:00:00Z'),times=SunCalc.getTimes(date,41.8781,-87.6298);
 for(const [stamp,daylight]of [[+times.sunrise-1,false],[+times.sunrise,true],[+times.sunset-1,true],[+times.sunset,false]]){
  const solar=O.solarAt(new Date(stamp),41.8781,-87.6298,SunCalc);assert.equal(solar.daylight,daylight);assert.equal(O.evaluate({solar,sun:-1}).eligible,!daylight);
 }
});
test('polar periods and date-line locations never require invented sunrise or sunset',()=>{
 for(const [date,lat,lon,daylight]of [['2026-06-21T12:00:00Z',80,0,true],['2026-12-21T12:00:00Z',80,0,false]])assert.equal(O.solarAt(new Date(date),lat,lon,SunCalc).daylight,daylight);
 for(const lon of [-170,170]){const t=new Date('2026-11-13T12:00:00Z'),solar=O.solarAt(t,10,lon,SunCalc);assert.equal(solar.daylight,SunCalc.getPosition(t,10,lon).altitude*180/Math.PI>=-.833);}
});
test('daylight overrides even visible targets; unknown visibility is never ranked as observable',()=>{
 assert.equal(O.evaluate({sun:20,moonAlt:60,planetAlt:60},'lunar').status,'daylight');
 assert.equal(O.evaluate({sun:-10,moonAlt:30},'lunar').eligible,true);
 assert.equal(O.evaluate({sun:-10,planetAlt:30},'planetary').eligible,true);
 assert.equal(O.evaluate({sun:-10},'planetary').eligible,null);
 assert.equal(O.evaluate({sun:-10,moonAlt:-1},'lunar').eligible,false);
 assert.equal(O.evaluate({sun:null}).eligible,null);
});
