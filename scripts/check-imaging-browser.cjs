// Optional browser regression check. Requires Playwright in the development environment.
// Serve dist on port 4173 first. Screenshots explicitly use synthetic test forecasts.
const {chromium}=require('playwright');
const fs=require('node:fs');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.setFixedTime(new Date('2026-11-10T00:30:00Z'));
 await page.addInitScript(()=>localStorage.setItem('nightwatch-location',JSON.stringify({lat:41.8781,lon:-87.6298,name:'Chicago, Illinois · test location'})));
 await page.route('https://api.open-meteo.com/**',route=>{
  const hourly={time:[],temperature_2m:[],dew_point_2m:[],relative_humidity_2m:[],cloud_cover:[],wind_speed_10m:[],precipitation_probability:[],precipitation:[]};
  for(let i=0;i<120;i++){hourly.time.push(Date.UTC(2026,10,9,i)/1000);hourly.temperature_2m.push(15);hourly.dew_point_2m.push(3);hourly.relative_humidity_2m.push(40);hourly.cloud_cover.push(i%6===3?45:0);hourly.wind_speed_10m.push(2);hourly.precipitation_probability.push(0);hourly.precipitation.push(0);}
  const lat=Number(new URL(route.request().url()).searchParams.get('latitude'));
  return route.fulfill({json:{timezone:lat===41.8781?'America/Chicago':'America/Phoenix',hourly}});
 });
 await page.route('**/cmc.js',route=>route.fulfill({contentType:'text/javascript',body:fs.readFileSync('dist/cmc.js','utf8')+`\nCMC.point=async(field,lat,lon,date)=>{await new Promise(r=>setTimeout(r,40));(window.testCMCRequests??=[]).push(date.toISOString());const n=date.getUTCHours()%6;if(n===5)return {data:null,reason:'Synthetic fixture: no CMC data'};return {data:{value:date.toISOString()==='2026-11-10T07:00:00.000Z'?(field==='seeing'?1:2):(field==='seeing'?(n===3?1:5):(n===4?2:5)),label:'Synthetic test index',time:date.toISOString(),reference:'2026-11-09T18:00:00Z',coordinates:[lon,lat]}};};`}));
 await page.route('https://geo.weather.gc.ca/**',route=>route.abort());
 await page.route('https://nightwatch-sky-api.**/**',route=>route.abort());
 await page.goto('http://127.0.0.1:4173');await page.waitForSelector('#hours .hour');
 async function assertDarkTimeline(range){const expected=await page.evaluate(n=>state.hours.slice(0,n).flatMap((h,i)=>NightwatchImaging.isDark(h)?[i]:[]),range);assert.deepEqual(await page.locator('#imaging-hours .imaging-sample').evaluateAll(es=>es.map(e=>Number(e.dataset.imagingHour))),expected);assert.equal(await page.locator('#hours .hour').count(),range);return expected;}
 const dark24=await assertDarkTimeline(24);await page.locator('#imaging-hours .imaging-sample').first().click();
 await page.waitForFunction(()=>document.querySelector('#seeing').textContent!=='null');
 assert.match(await page.locator('#place').textContent(),/Chicago, Illinois/);
 assert.match(await page.locator('#imaging-time').textContent(),/America\/Chicago/);
 assert.deepEqual(await page.evaluate(()=>[state.lat,state.lon]),[41.8781,-87.6298]);
 const original=await page.locator('#score').textContent();
 await page.evaluate(()=>window.testCMCRequests=[]);
 await page.locator('#imaging-analyze').click();await page.waitForFunction(()=>!document.querySelector('#imaging-analyze').disabled);
 assert((await page.locator('#imaging-progress').textContent()).includes(dark24.length+'/'+dark24.length+' dark hours checked in the next 24 hours'));
 assert(await page.evaluate(()=>window.testCMCRequests.every(t=>state.hours.find(h=>h.date.toISOString()===t)?.sun<-18)));
 await assertDarkTimeline(24);
 assert(await page.locator('.imaging-sample.imaging-unavailable').count()>0);
 assert.equal(await page.locator('#score').textContent(),original);
 await page.locator('#imaging-category').selectOption('planetary');assert.match(await page.locator('#imaging-window-title').textContent(),/planetary/);
 await page.locator('#imaging-hours .imaging-unavailable').first().click();
 assert.match(await page.locator('#imaging-cards').textContent(),/Insufficient data/);
 const oneAM=await page.evaluate(()=>state.hours.findIndex(h=>h.date.toISOString()==='2026-11-10T07:00:00.000Z'));
 await page.locator('#imaging-hours [data-imaging-hour="'+oneAM+'"]').click();
 assert.match(await page.locator('#imaging-inputs').textContent(),/seeing: 1\/5.*Transparency: 2\/5/);
 assert.match(await page.locator('#imaging-cards .imaging-card').nth(3).textContent(),/Poor/);
 assert.deepEqual(await page.evaluate(()=>{const h=NightwatchImagingUI.input({seeing:5,transparency:5},0);return [h.seeing,h.transparency]}),[null,null]);
 assert.equal(await page.locator('#score').textContent(),await page.evaluate(()=>String(NightwatchScore.infer(state.hours[selected]))));
 await page.locator('#imaging-category').selectOption('broadband');
 await page.locator('#units').selectOption('metric');assert.match(await page.locator('#dewpoint').textContent(),/°C/);
 assert.equal(await page.locator('#imaging-cards .imaging-card').count(),5);
 await page.evaluate(()=>{const p=document.createElement('p');p.textContent='CHICAGO, ILLINOIS · TEST FORECAST · Synthetic data, not current conditions';p.style.cssText='color:#e7d878;font-size:13px';document.querySelector('#imaging-panel').prepend(p)});
 fs.mkdirSync('docs/screenshots',{recursive:true});
 await page.locator('#imaging-panel').screenshot({path:'docs/screenshots/imaging-desktop.png'});
 for(const width of [320,390,430]){
  await page.setViewportSize({width,height:844});await page.locator('#imaging-panel').scrollIntoViewIfNeeded();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`page overflow at ${width}`);
  if(width===390)await page.locator('#imaging-panel').screenshot({path:'docs/screenshots/imaging-iphone.png'});
 }
 await page.locator('[data-range="48"]').click();await assertDarkTimeline(48);
 await page.locator('#imaging-analyze').click();await page.locator('#imaging-cancel').click();assert.equal(await page.locator('#imaging-analyze').isDisabled(),false);
 await page.locator('#imaging-analyze').click();await page.locator('[data-range="72"]').click();assert.equal(await page.locator('#imaging-analyze').isDisabled(),false);await assertDarkTimeline(72);
 await page.locator('#imaging-analyze').click();await page.waitForFunction(()=>!document.querySelector('#imaging-analyze').disabled);const dark72=await assertDarkTimeline(72);assert((await page.locator('#imaging-progress').textContent()).includes(dark72.length+'/'+dark72.length+' dark hours checked in the next 72 hours'));
 // Verify displayed windows follow dark hours and the selected forecast scope in both directions.
 await page.locator('#imaging-category').selectOption('planetary');
 for(const range of [24,48,72,24]){
  await page.locator('[data-range="'+range+'"]').click();
  assert.match(await page.locator('#imaging-window-title').textContent(),new RegExp('next '+range+' hours'));
  const summary=await page.evaluate(()=>{const hs=state.hours.slice(0,horizon).map(NightwatchImagingUI.input),groups=NightwatchImaging.windows(hs,'planetary');return {valid:groups.every(g=>g.indices.every(i=>i<horizon&&state.hours[i].sun<-18)),count:groups.length,links:document.querySelectorAll('#imaging-windows [data-imaging-hour]').length}});
  assert(summary.valid);assert.equal(summary.links,summary.count);
 }
 // Daytime weather selections cannot show favorable imaging cards or leak into its timeline.
 const day=await page.evaluate(()=>state.hours.slice(0,horizon).findIndex(h=>h.sun>=0));await page.locator('#hours [data-hour="'+day+'"]').click();assert.equal(await page.locator('.imaging-card').count(),0);assert.match(await page.locator('#imaging-inputs').textContent(),/outside astronomical darkness/);await assertDarkTimeline(24);
 // A location change during analysis must not retain the old run or its selected data.
 await page.evaluate(()=>{state.hours.forEach(h=>delete h.cmc)});await page.locator('#imaging-analyze').click();await page.evaluate(()=>load(35.1983,-111.6513,'Flagstaff · location-change test'));
 await page.waitForFunction(()=>document.querySelector('#place').textContent==='Flagstaff · location-change test');assert.equal(await page.locator('#imaging-analyze').isDisabled(),false);
 // Explicit no-dark-hours fixture (e.g. a polar-day forecast): empty advisor, weather retained.
 await page.evaluate(()=>{state.hours.forEach(h=>h.sun=10);selected=0;render()});assert.equal(await page.locator('.imaging-card').count(),0);assert.equal(await page.locator('.imaging-sample').count(),0);assert(await page.locator('#imaging-analyze').isDisabled());assert.match(await page.locator('#imaging-inputs').textContent(),/No astronomical-dark hours/);assert.equal(await page.locator('#hours .hour').count(),24);
 assert.deepEqual(errors,[]);await browser.close();console.log('Chicago, Illinois browser checks passed: all categories, missing CMC, 24/48/72h, stop, location change, units, unchanged score, desktop and 320/390/430px layouts.');
})().catch(e=>{console.error(e);process.exit(1)});
