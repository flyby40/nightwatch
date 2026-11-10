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
 assert.match(mixed.planetary.explanation,/poor seeing/i);assert.equal(results({transparency:1}).broadband.rating,'Poor');
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
 for(const cat of Object.values(A.config.categories))assert.equal(Object.values(cat.weights).reduce((a,b)=>a+b,0),1);
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

// Neutral modifiers isolate the matrix, without allowing weather to inflate the atmosphere.
const neutral={...excellent,wind:0,moonIllum:0};
for(const [seeing,transparency,expected] of [
 [1,2,['Fair','Poor','Poor','Poor','Poor']],
 [5,5,['Good','Good','Good','Good','Good']],
 [5,1,['Marginal','Poor','Poor','Good','Good']],
 [1,5,['Good','Good','Good','Poor','Poor']],
 [3,3,['Good','Fair','Good','Fair','Fair']]
])test(`matrix seeing ${seeing} / transparency ${transparency}`,()=>{
 const out=A.analyze({...neutral,seeing,transparency});
 assert.deepEqual(out.map(r=>r.rating),expected);
 for(const r of out){const spec=A.config.categories[r.id];assert.equal(r.atmospheric,spec.seeing[seeing]*spec.weights.seeing+spec.transparency[transparency]*spec.weights.transparency);assert.equal(r.score,Math.round(r.atmospheric));}
});
test('matrix ranges and atmospheric weights retain the proposed foundation',()=>{
 const expected={wide:[[2,5],[2,5],.25],broadband:[[2,5],[4,5],.2],narrowband:[[2,5],[3,5],.2],planetary:[[4,5],[2,5],.85],lunar:[[4,5],[2,5],.85]};
 for(const [id,[seeing,transparency,weight]] of Object.entries(expected)){const spec=A.config.categories[id];assert.deepEqual(spec.preferred.seeing,seeing);assert.deepEqual(spec.preferred.transparency,transparency);assert.equal(spec.weights.seeing,weight);}
 assert.equal(A.config.categories.broadband.preferred.seeingIdeal,3);
});
test('outside preferred ranges remains graded; modifiers never improve atmospheric quality',()=>{
 for(let seeing=0;seeing<=5;seeing++)for(let transparency=0;transparency<=5;transparency++){
  for(const r of A.analyze({...neutral,seeing,transparency,cloud:35,wind:20,humidity:90,dew:14,moonIllum:.8})){
   assert(r.score<=Math.round(r.atmospheric));assert(Object.values(r.modifiers).every(v=>v>=0&&v<=1));
  }
 }
 assert(A.analyze({...neutral,seeing:2,transparency:5}).find(r=>r.id==='planetary').score>0);
 for(const cat of Object.values(A.config.categories))for(const key of ['seeing','transparency']){
  assert.equal(cat[key].length,6);for(let i=1;i<6;i++)assert(cat[key][i]>=cat[key][i-1]);
 }
});

test('explanations identify category-specific dominant limitations for seeing 1 / transparency 2',()=>{
 const out=results({seeing:1,transparency:2,moonAlt:-20});
 assert.equal(new Set(Object.values(out).map(r=>r.explanation)).size,5);
 assert.match(out.wide.explanation,/wide-field imaging remains possible/);
 assert.match(out.broadband.explanation,/Poor transparency significantly reduces faint-object contrast/);
 assert.match(out.narrowband.explanation,/Narrowband filtering.*poor transparency still reduces signal/);
 assert.equal(out.planetary.dominantLimitation,'seeing');
 assert.match(out.planetary.explanation,/Very poor seeing severely limits fine planetary detail/);
 assert.equal(out.lunar.dominantLimitation,'visibility');
 assert.match(out.lunar.explanation,/unavailable regardless of atmospheric quality/);
});
test('environmental explanations reflect the greatest recoverable score loss',()=>{
 for(const [over,driver,text]of [
  [{cloud:90},'cloud',/Cloud cover/],
  [{wind:55},'wind',/Wind/],
  [{humidity:100,dew:15},'dew',/Dew\/frost/],
  [{sun:10},'night',/Twilight or daylight/],
  [{moonIllum:1},'moon',/Moonlight/]
 ]){const r=results(over).broadband;assert.equal(r.dominantLimitation,driver);assert.match(r.explanation,text);}
 assert.equal(results({seeing:0,transparency:0,cloud:100}).planetary.dominantLimitation,'cmcCloud');
 assert.doesNotMatch(results({seeing:0,transparency:0,cloud:100}).planetary.explanation,/favor/);
 const missing=results({seeing:null,moonAlt:-20}).lunar;assert.equal(missing.score,null);assert.match(missing.explanation,/unavailable regardless.*confidence is incomplete/);
});
