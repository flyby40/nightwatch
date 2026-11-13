const {test}=require('node:test'),assert=require('node:assert/strict'),S=require('../dist/suncalc.js');require('../dist/moon-events.js');const M=global.NightwatchMoon;
test('all Moon crossings in 24/48/72h are chronological, unique and bounded',()=>{
 for(const [lat,lon]of [[41.8781,-87.6298],[35.6762,139.6503],[-33.8688,151.2093]])for(const hours of [24,48,72]){
  const start=new Date('2026-11-13T00:30:00Z'),end=new Date(+start+hours*3600000),events=M.events(start,end,lat,lon,S);
  assert.equal(new Set(events.map(e=>e.kind+'|'+(+e.date))).size,events.length);
  for(let i=0;i<events.length;i++){const e=events[i];assert(+e.date>=+start&&+e.date<+end);if(i)assert(+e.date>=+events[i-1].date);assert(['Moonrise','Moonset'].includes(e.label));}
  if(hours===72)assert(events.filter(e=>e.kind==='rise').length>=2);
 }
});
test('availability switches exactly at the same Moon event instants shown in milestones',()=>{
 const lat=41.8781,lon=-87.6298,events=M.events(new Date('2026-11-12T00:00:00Z'),new Date('2026-11-16T00:00:00Z'),lat,lon,S);
 for(const e of events){assert.equal(M.at(new Date(+e.date-1),events,lat,lon,S).above,e.kind!=='rise');assert.equal(M.at(e.date,events,lat,lon,S).above,e.kind==='rise');}
});
test('UTC day scans work across local midnight and DST without a device timezone dependency',()=>{
 const start=new Date('2026-11-01T05:30:00Z'),end=new Date(+start+72*3600000),events=M.events(start,end,41.8781,-87.6298,S);
 for(const e of events){const single=M.events(e.date,new Date(+e.date+1),41.8781,-87.6298,S);assert.equal(single.length,1);assert.equal(single[0].kind,e.kind);}
});
test('no crossing leaves null next times and retains calculated always-up/down visibility',()=>{
 const fake={getMoonTimes:()=>({alwaysUp:true}),getMoonPosition:()=>({altitude:1})},start=new Date('2026-11-13T00:00:00Z'),end=new Date(+start+86400000);
 const list=M.events(start,end,80,0,fake);assert.deepEqual(list,[]);const status=M.at(start,list,80,0,fake);assert.equal(status.above,true);assert.equal(status.nextRise,null);assert.equal(status.nextSet,null);
 assert.equal(M.at(start,[],80,0,{getMoonPosition:()=>({altitude:-1})}).above,false);
 assert.deepEqual(M.events(new Date(NaN),end,41,-87,fake),[]);
});
