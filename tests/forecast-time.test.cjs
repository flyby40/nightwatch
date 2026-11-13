const {test}=require('node:test'),assert=require('node:assert/strict');
require('../dist/forecast-time.js');const periods=global.NightwatchTime.periods;
const first=(time,zone='America/Chicago')=>periods(new Date(time),zone,1)[0].toISOString();
test('keeps the current Chicago hour at :00, :01, :30 and :59, and advances at the next :00',()=>{
 for(const time of ['02:00:00.000','02:01:00.000','02:30:00.000','02:59:59.999'])assert.equal(first('2026-11-14T'+time+'Z'),'2026-11-14T02:00:00.000Z');
 assert.equal(first('2026-11-14T03:00:00Z'),'2026-11-14T03:00:00.000Z');
});
test('uses location calendar hours for half-hour and quarter-hour zones rather than UTC flooring',()=>{
 assert.equal(first('2026-11-13T14:50:45Z','Asia/Kolkata'),'2026-11-13T14:30:00.000Z');
 assert.equal(first('2026-11-13T14:50:45Z','Asia/Kathmandu'),'2026-11-13T14:15:00.000Z');
 assert.equal(first('2026-11-13T14:50:45Z','America/St_Johns'),'2026-11-13T14:30:00.000Z');
});
test('Chicago DST fall-back retains the correct occurrence of the repeated hour',()=>{
 assert.equal(first('2026-11-01T06:59:59Z'),'2026-11-01T06:00:00.000Z');
 assert.equal(first('2026-11-01T07:30:00Z'),'2026-11-01T07:00:00.000Z');
 assert.deepEqual(periods(new Date('2026-11-01T06:30:00Z'),'America/Chicago',4).map(d=>d.toISOString()),['2026-11-01T06:00:00.000Z','2026-11-01T07:00:00.000Z','2026-11-01T08:00:00.000Z','2026-11-01T09:00:00.000Z']);
});
test('Chicago DST spring-forward skips nonexistent 2AM without losing the current hour',()=>{
 assert.equal(first('2026-03-08T08:01:00Z'),'2026-03-08T08:00:00.000Z');
 const dates=periods(new Date('2026-03-08T07:30:00Z'),'America/Chicago',3);
 const fmt=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Chicago',hour:'2-digit',hourCycle:'h23'});
 assert.deepEqual(dates.map(d=>fmt.format(d)),['01','03','04']);
});
test('midnight and non-hour DST shifts retain real local calendar boundaries',()=>{
 assert.equal(first('2026-11-14T06:30:00Z'),'2026-11-14T06:00:00.000Z');
 // Lord Howe springs from 1:59 to 2:30; the partial 2AM hour starts at 2:30.
 assert.equal(first('2026-10-03T15:45:00Z','Australia/Lord_Howe'),'2026-10-03T15:30:00.000Z');
 assert.deepEqual(periods(new Date('2026-10-03T14:45:00Z'),'Australia/Lord_Howe',3).map(d=>d.toISOString()),['2026-10-03T14:30:00.000Z','2026-10-03T15:30:00.000Z','2026-10-03T16:00:00.000Z']);
 // Fall-back repeats 1:30–1:59; its calendar hour began at the original 1:00.
 assert.equal(first('2026-04-04T15:15:00Z','Australia/Lord_Howe'),'2026-04-04T14:00:00.000Z');
});
test('72 periods stay chronological and unique across daylight-saving and midnight boundaries',()=>{
 for(const zone of ['America/Chicago','Asia/Kathmandu','Australia/Lord_Howe'])for(const now of ['2026-11-01T06:59:59Z','2026-03-08T07:30:00Z','2026-10-03T14:45:00Z']){
  const ds=periods(new Date(now),zone);assert.equal(ds.length,72);assert.equal(new Set(ds.map(Number)).size,72);assert(+ds[0]<=Date.parse(now));
  for(let i=1;i<ds.length;i++)assert(+ds[i]>+ds[i-1]);
  for(const n of [24,48,72])assert.equal(ds.slice(0,n).length,n);
 }
});
