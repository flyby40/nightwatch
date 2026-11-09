const {test}=require('node:test');const assert=require('node:assert/strict');
require('../dist/imaging-advisor.js');require('../dist/viewing-score.js');require('../dist/cmc.js');
const A=global.NightwatchImaging;
const excellent={seeing:5,transparency:5,cloud:0,wind:2,humidity:40,temp:15,dew:3,moonIllum:.05,moonAlt:35,sun:-25};
const results=over=>Object.fromEntries(A.analyze({...excellent,...over}).map(r=>[r.id,r]));
test('excellent inputs favor all five categories and severe weather is poor',()=>{
 assert.equal(A.analyze(excellent).length,5);assert(A.analyze(excellent).every(r=>r.rating==='Good'));
 assert(Object.values(results({seeing:1,transparency:1,cloud:85,wind:40,humidity:98,dew:14,moonIllum:1})).every(r=>r.rating==='Poor'));
});
test('poor seeing limits detail while wide fields remain useful; poor transparency limits broadband',()=>{
 const mixed=results({seeing:1});assert.equal(mixed.wide.rating,'Good');assert.equal(mixed.planetary.rating,'Poor');assert.equal(mixed.lunar.rating,'Poor');
 assert.match(mixed.planetary.explanation,/Poor seeing/);assert.equal(results({transparency:1}).broadband.rating,'Poor');
});
test('narrowband tolerates moonlight better; lunar requires Moon above horizon',()=>{
 const dark=results({moonIllum:0}),bright=results({moonIllum:1});assert(dark.broadband.score-bright.broadband.score>dark.narrowband.score-bright.narrowband.score);
 assert.equal(bright.broadband.rating,'Fair');assert.equal(bright.narrowband.rating,'Good');
 const below=results({moonAlt:-1,moonIllum:1});assert.equal(below.lunar.score,0);assert.match(below.lunar.explanation,/below the horizon/);assert.equal(below.broadband.score,dark.broadband.score);
 assert(results({moonAlt:5}).lunar.score<results({moonAlt:45}).lunar.score);
});
test('missing, invalid and fractional indices stay insufficient; valid zero is poor, never missing',()=>{
 for(const key of Object.keys(excellent))for(const value of [null,undefined,NaN,'5'])assert(Object.values(results({[key]:value})).every(r=>r.score===null&&r.rating==='Insufficient data'));
 for(const value of [-1,6,2.5])assert.equal(results({seeing:value}).wide.score,null);
 assert(Object.values(results({seeing:0,transparency:0,cloud:0})).every(r=>r.rating==='Poor'&&r.confidence==='complete'));
 assert.equal(results({seeing:0}).wide.rating,'Poor');assert.equal(results({transparency:0}).wide.rating,'Poor');
});
test('penalties vary smoothly and respond to wind, humidity and dew spread; daylight limits deep sky',()=>{
 for(const field of ['cloud','wind','humidity']){const base=results({[field]:50}),worse=results({[field]:51});assert(worse.wide.score<=base.wide.score);}
 assert(results({temp:15,dew:14}).wide.score<results({temp:15,dew:0}).wide.score);
 assert.equal(results({sun:20}).broadband.rating,'Poor');assert.equal(results({sun:20}).planetary.score,results({sun:-25}).planetary.score);
 assert.equal(A.curve([[0,0],[10,100]],5),50);
});
test('configurable tables do not mutate inputs or change the original observing score',()=>{
 const h=Object.freeze({...excellent});const before=NightwatchScore.infer(h);A.analyze(h);assert.equal(NightwatchScore.infer(h),before);
 const custom=structuredClone(A.config);custom.bands.good=101;assert.equal(A.analyze(h,custom)[0].rating,'Fair');
 for(const cat of Object.values(A.config.categories))assert.equal(Object.values(cat.weights).reduce((a,b)=>a+b,0),100);
});
test('windows group only consecutive complete fair/good samples and never bridge missing hours',()=>{
 const t=Date.UTC(2026,10,10,0);const hs=Array.from({length:6},(_,index)=>({...excellent,index,date:new Date(t+index*3600000)}));hs[2].seeing=null;hs[5].cloud=100;
 const wins=A.windows(hs,'wide');assert.equal(wins.length,2);assert.deepEqual(wins.map(w=>w.indices),[[0,1],[3,4]]);assert.equal(wins[0].end,t+3600000);
 assert.deepEqual(A.windows(hs.map(h=>({...h,seeing:null})),'wide'),[]);
});
test('existing CMC parser preserves exact integer 0..5 and rejects nodata and mismatched times/runs',()=>{
 const time='2026-11-10T01:00:00Z',reference='2026-11-09T18:00:00Z';
 for(const layer of ['RDPS_10km_SeeingIndex','RDPS_10km_SkyTransparencyIndex']){
  const data=value=>({layer,features:[{properties:{value,time,dim_reference_time:reference,class:'Provider class'}}]});
  for(let n=0;n<=5;n++)assert.equal(CMC.parsePoint(data(n),layer,time,reference).value,n);
  for(const n of [null,-9999,-1,6,1.5,'5'])assert.equal(CMC.parsePoint(data(n),layer,time,reference),null);
  assert.equal(CMC.parsePoint(data(5),layer,'2026-11-10T02:00:00Z',reference),null);
  assert.equal(CMC.parsePoint(data(5),layer,time,'2026-11-09T12:00:00Z'),null);
 }
});
