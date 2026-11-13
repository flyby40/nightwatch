// Optional integration regression. Serve dist on port 4173; requires Playwright/Chromium.
// Explicit synthetic forecast fixtures verify exact timestamp mapping, never production fallback.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
require('../dist/forecast-time.js');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const cases=[
   ['2026-11-14T02:01:00Z','America/Chicago','2026-11-14T02:00:00Z'],
   ['2026-11-14T02:30:00Z','America/Chicago','2026-11-14T02:00:00Z'],
   ['2026-11-14T02:59:59Z','America/Chicago','2026-11-14T02:00:00Z'],
   ['2026-11-14T03:00:00Z','America/Chicago','2026-11-14T03:00:00Z'],
   ['2026-11-01T06:30:00Z','America/Chicago','2026-11-01T06:00:00Z'],
   ['2026-11-01T07:30:00Z','America/Chicago','2026-11-01T07:00:00Z'],
   ['2026-03-08T08:01:00Z','America/Chicago','2026-03-08T08:00:00Z'],
   ['2026-11-13T14:50:45Z','Asia/Kathmandu','2026-11-13T14:15:00Z'],
   ['2026-11-14T06:01:00Z','America/Chicago','2026-11-14T06:00:00Z'],
   ['2026-11-14T02:30:00Z','America/Chicago','2026-11-14T02:00:00Z',true]
  ];
  for(const [now,zone,first,missing]of cases){
   const page=await browser.newPage({timezoneId:'Pacific/Honolulu',viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.clock.setFixedTime(new Date(now));
   await page.addInitScript(()=>localStorage.setItem('nightwatch-location',JSON.stringify({lat:41.8781,lon:-87.6298,name:'Explicit timeline test fixture'})));
   const dates=NightwatchTime.periods(new Date(Date.parse(now)-86400000),zone,120);
   const hourly={time:[],temperature_2m:[],dew_point_2m:[],relative_humidity_2m:[],cloud_cover:[],wind_speed_10m:[],precipitation_probability:[],precipitation:[]};
   for(let i=0;i<dates.length;i++){
    if(missing&&+dates[i]===Date.parse(first))continue;
    hourly.time.push(+dates[i]/1000);hourly.temperature_2m.push(i);hourly.dew_point_2m.push(i-10);hourly.relative_humidity_2m.push(40);hourly.cloud_cover.push(i%100);hourly.wind_speed_10m.push(5);hourly.precipitation_probability.push(i%100);hourly.precipitation.push(i/10);
   }
   await page.route('https://**/*',r=>new URL(r.request().url()).hostname==='api.open-meteo.com'?r.fulfill({json:{timezone:zone,hourly}}):r.abort());
   await page.goto('http://127.0.0.1:4173');await page.waitForSelector('.hour');
   const out=await page.evaluate(()=>({dates:state.hours.map(h=>h.date.toISOString()),first:state.hours[0],zone:state.zone,expectedScore:NightwatchScore.infer(state.hours[0])}));
   assert.equal(Date.parse(out.dates[0]),Date.parse(first));assert.equal(out.dates.length,72);assert.equal(out.zone,zone);
   const idx=hourly.time.indexOf(Date.parse(first)/1000);
   assert.equal(out.first.temp,idx<0?null:hourly.temperature_2m[idx]);assert.equal(out.first.cloud,idx<0?null:hourly.cloud_cover[idx]);assert.equal(out.first.precip,idx<0?null:hourly.precipitation[idx]);assert.equal(out.first.score,out.expectedScore);
   for(const range of [24,48,72]){
    await page.locator('[data-range="'+range+'"]').click();
    assert.equal(await page.locator('#hours .hour').count(),range);const dark=await page.evaluate(n=>state.hours.slice(0,n).flatMap((h,i)=>NightwatchImaging.isDark(h)?[i]:[]),range);assert.equal(await page.locator('#imaging-hours .imaging-sample').count(),dark.length);
    const firstLabel=await page.locator('#hours .hour').first().getAttribute('aria-label');
    const label=await page.evaluate(()=>fmt(state.hours[0].date));assert(firstLabel.includes(label));
    if(dark.length){const imagingLabel=await page.locator('#imaging-hours .imaging-sample').first().textContent();const darkLabel=await page.evaluate(i=>fmt(state.hours[i].date),dark[0]);assert(imagingLabel.includes(darkLabel));}
   }
   await page.evaluate(async()=>{const original=NightwatchMap.update;NightwatchMap.update=ctx=>{window.testMapDate=ctx.date.toISOString();return original(ctx)};await load(state.lat,state.lon,state.name)});
   assert.equal(Date.parse(await page.evaluate(()=>window.testMapDate)),Date.parse(first));
   assert.deepEqual(errors,[]);await page.close();
  }
  console.log('Current-hour browser regression passed: 10 cases; exact weather values, null gaps, 24/48/72 periods, imaging/weather/map alignment, location timezone, DST and midnight.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
