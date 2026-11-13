// Optional UI regression: serve dist on 4173. Synthetic weather, real pinned-library planet geometry.
const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  let reportedElevation=241;
  async function fixture(page){
   await page.clock.setFixedTime(new Date('2026-11-14T02:30:00Z'));
   await page.addInitScript(()=>{if(!localStorage.getItem('nightwatch-location'))localStorage.setItem('nightwatch-location',JSON.stringify({lat:41.8781,lon:-87.6298,name:'Chicago · explicit test forecast'}))});
   await page.route('https://api.open-meteo.com/**',r=>{const latitude=Number(new URL(r.request().url()).searchParams.get('latitude')),hourly={time:[],temperature_2m:[],dew_point_2m:[],relative_humidity_2m:[],cloud_cover:[],wind_speed_10m:[],precipitation_probability:[],precipitation:[]};for(let i=0;i<120;i++){hourly.time.push(Date.UTC(2026,10,13,i)/1000);hourly.temperature_2m.push(10);hourly.dew_point_2m.push(-2);hourly.relative_humidity_2m.push(40);hourly.cloud_cover.push(0);hourly.wind_speed_10m.push(0);hourly.precipitation_probability.push(0);hourly.precipitation.push(0)}return r.fulfill({json:{elevation:reportedElevation===null?null:latitude===41.8781?reportedElevation:2140,timezone:latitude===41.8781?'America/Chicago':'America/Phoenix',hourly}})});
   await page.route('**/cmc.js',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync('dist/cmc.js','utf8')+`\nCMC.point=async(field,lat,lon,date)=>{await new Promise(r=>setTimeout(r,25));if(date.getUTCHours()===10)return {data:null,reason:'Explicit missing CMC fixture'};return {data:{value:5,label:'Synthetic excellent index',time:date.toISOString(),reference:'2026-11-13T18:00:00Z',coordinates:[lon,lat]}};};`}));
   await page.route('https://geo.weather.gc.ca/**',r=>r.abort());await page.route('https://nightwatch-sky-api.**/**',r=>r.abort());
  }
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await fixture(page);
  await page.goto('http://127.0.0.1:4173');await page.waitForSelector('.planet-sample');
  assert.match(await page.locator('#planet-height-source').textContent(),/Modeled elevation/);assert.equal(await page.locator('.planet-sample').count(),24);
  for(const body of ['Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune']){
   await page.locator('#planet-body').selectOption(body);assert.match(await page.locator('#planet-time').textContent(),new RegExp(body));
   const expected=await page.evaluate(body=>{const t=new Date(Math.max(+state.now,+state.hours[selected].date)),obs=new Astronomy.Observer(state.lat,state.lon,state.observerHeightM),eq=Astronomy.Equator(body,t,obs,true,true);return Astronomy.Horizon(t,obs,eq.ra,eq.dec,'normal').altitude.toFixed(1)+'°'},body);
   assert.equal(await page.locator('#planet-altitude').textContent(),expected);
  }
  await page.locator('#planet-body').selectOption('Jupiter');assert.match(await page.locator('#planet-availability').textContent(),/Below horizon/);assert.notEqual(await page.locator('#planet-rise').textContent(),'null · no crossing in selected range');
  await page.locator('#planet-analyze').click();await page.locator('#planet-stop').click();assert.equal(await page.evaluate(()=>state.imagingRunning),false);
  await page.locator('#planet-analyze').click();await page.waitForFunction(()=>!state.imagingRunning);
  const low=page.locator('.planet-sample[data-status="low"]').first();assert(await low.count());await low.click();
  const atmospheric=await page.locator('#planet-atmosphere').textContent(),overall=await page.locator('#score').textContent();assert.match(atmospheric,/Good/);
  await page.locator('#planet-minimum').selectOption('0');assert.match(await page.locator('#planet-availability').textContent(),/Above calculated horizon/);assert.equal(await page.locator('#planet-atmosphere').textContent(),atmospheric);assert.equal(await page.locator('#score').textContent(),overall);
  await page.locator('#planet-minimum').selectOption('20');assert.match(await page.locator('#planet-availability').textContent(),/Low altitude/);
  for(const range of [24,48,72,24]){
   await page.locator('[data-range="'+range+'"]').click();assert.equal(await page.locator('.planet-sample').count(),range);assert.match(await page.locator('#planet-window-title').textContent(),new RegExp('next '+range+' hours'));
   const valid=await page.evaluate(()=>{const model=NightwatchPlanets.create(state,Astronomy,SunCalc).planet('Jupiter');return [...document.querySelectorAll('#planet-windows [data-planet-hour]')].every(e=>{const i=Number(e.dataset.planetHour),h=NightwatchImagingUI.input(state.hours[i],i),status=NightwatchPlanets.availability(model.samples[i],h,20),r=NightwatchImaging.analyze(h).find(r=>r.id==='planetary');return i<horizon&&status.eligible&&status.meetsPreference&&r.score>=55})});assert(valid);
  }
  await page.locator('.planet-sample[data-status="daylight"]').first().click();assert.match(await page.locator('#planet-availability').textContent(),/Daylight.*Not observable/);assert.match(await page.locator('#planet-atmosphere').textContent(),/Not observable/);
  await page.locator('.planet-elevation summary').click();await page.locator('#planet-height').fill('1000');await page.locator('#planet-height-form button[type="submit"]').click();assert.match(await page.locator('#planet-height-source').textContent(),/User-entered.*1000\.0 ft/);
  assert.equal(await page.evaluate(()=>Number(localStorage.getItem(NightwatchPlanets.elevationKey(state.lat,state.lon)))),304.8);
  await page.locator('#units').selectOption('metric');assert.equal(await page.locator('#planet-height').inputValue(),'304.8');assert.match(await page.locator('#planet-height-source').textContent(),/304\.8 m/);
  await page.locator('#planet-height').fill('');await page.locator('#planet-height-form button[type="submit"]').click();assert.match(await page.locator('#planet-height-status').textContent(),/Enter a measured elevation/);
  await page.locator('#planet-height').fill('-501');await page.locator('#planet-height-form button[type="submit"]').click();assert.match(await page.locator('#planet-height-status').textContent(),/Enter a measured elevation/);
  await page.reload();await page.waitForSelector('.planet-sample');assert.match(await page.locator('#planet-height-source').textContent(),/User-entered.*304\.8 m/);
  await page.evaluate(()=>load(35.1983,-111.6513,'Flagstaff · second test location'));assert.match(await page.locator('#planet-height-source').textContent(),/Modeled elevation/);
  await page.evaluate(()=>load(41.8781,-87.6298,'Chicago · explicit test forecast'));assert.match(await page.locator('#planet-height-source').textContent(),/User-entered.*304\.8 m/);
  await page.locator('#units').selectOption('imperial');await page.locator('#planet-analyze').click();await page.waitForFunction(()=>!state.imagingRunning);await page.locator('.planet-sample[data-status="above"]').first().click();
  // Atmospheric grades use the same colors everywhere, independent of target availability.
  const savedCMC=await page.evaluate(()=>JSON.stringify(state.hours[selected].cmc));
  for(const [seeing,transparency,quality,color]of [[1,2,'poor','rgb(242, 139, 136)'],[3,1,'marginal','rgb(242, 178, 120)'],[3,3,'fair','rgb(231, 216, 120)'],[5,5,'good','rgb(188, 234, 161)']]){
   await page.evaluate(({seeing,transparency})=>{const h=state.hours[selected];h.cmc.seeing.data.value=seeing;h.cmc.transparency.data.value=transparency;renderCMC();renderImaging()},{seeing,transparency});
   const label=page.locator('.planet-sample.selected .planet-quality');assert.equal(await label.getAttribute('data-quality'),quality);assert.equal(await label.evaluate(e=>getComputedStyle(e).color),color);assert.equal(await page.locator('#planet-atmosphere').evaluate(e=>getComputedStyle(e).color),color);
  }
  await page.evaluate(saved=>{state.hours[selected].cmc=JSON.parse(saved);for(const h of state.hours.slice(0,horizon)){if([8,9].includes(h.date.getUTCHours())&&h.cmc?.seeing?.data&&h.cmc?.transparency?.data){h.cmc.seeing.data.value=3;h.cmc.transparency.data.value=3}}renderCMC();renderImaging()},savedCMC);
  assert((await page.locator('#planet-windows li[data-quality="fair"]').count())>0);assert((await page.locator('#planet-windows li[data-quality="good"]').count())>0);
  assert.equal(await page.locator('#planet-windows li[data-quality="fair"] .planet-window-rating').first().evaluate(e=>getComputedStyle(e).color),'rgb(231, 216, 120)');assert.match(await page.locator('#planet-windows li[data-quality="fair"]').first().textContent(),/Fair/);
  if(!await page.locator('#planet-height').isVisible())await page.locator('.planet-elevation summary').click();
  await page.evaluate(()=>{const p=document.createElement('p');p.textContent='TEST FORECAST · Synthetic weather/site measurement · Calculated planet geometry';p.style.cssText='color:#e7d878;font-size:13px;line-height:1.8';document.querySelector('#planet-panel').prepend(p)});
  fs.mkdirSync('docs/screenshots',{recursive:true});await page.locator('#planet-panel').screenshot({path:'docs/screenshots/planet-desktop.png'});
  for(const width of [320,390,430]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));if(width===390)await page.locator('#planet-panel').screenshot({path:'docs/screenshots/planet-iphone.png'});}
  if(!await page.locator('#planet-height-reset').isVisible())await page.locator('.planet-elevation summary').click();await page.locator('#planet-height').fill('-100');await page.locator('#planet-height-form button[type="submit"]').click();assert.match(await page.locator('#planet-height-source').textContent(),/User-entered.*-100\.0 ft/);
  await page.locator('#planet-height').fill('0');await page.locator('#planet-height-form button[type="submit"]').click();assert.match(await page.locator('#planet-height-source').textContent(),/User-entered.*0\.0 ft/);
  await page.locator('#planet-height-reset').click();assert.match(await page.locator('#planet-height-source').textContent(),/Modeled elevation/);
  reportedElevation=null;await page.evaluate(()=>load(41.8781,-87.6298,'Chicago · missing elevation fixture'));assert.match(await page.locator('#planet-height-source').textContent(),/Site elevation unavailable.*sea-level reference/);
  assert.deepEqual(errors,[]);
  const failed=await browser.newPage(),failErrors=[];failed.on('pageerror',e=>failErrors.push(e.message));await fixture(failed);await failed.route('**/vendor/astronomy-engine/astronomy.browser.min.js',r=>r.abort());await failed.goto('http://127.0.0.1:4173');await failed.waitForSelector('.hour');assert.match(await failed.locator('#planet-reason').textContent(),/Planet ephemeris unavailable/);assert.equal(await failed.locator('#planet-altitude').textContent(),'null');assert.deepEqual(failErrors,[]);await failed.close();
  console.log('Planet UI checks passed: seven bodies, exact geometry, rise/set, 24/48/72 scopes, daylight/low/below/above, separate scores, site override/conversion/persistence/reset/fallback, mobile widths and failed-library isolation.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
