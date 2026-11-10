// Replay unmodified, freshly captured provider responses through the real app and CMC parser.
// Run capture-imaging-forecast.py first. No synthetic weather or CMC.point override here.
const fs=require('node:fs'),assert=require('node:assert/strict');const {chromium}=require('playwright');
(async()=>{
 const snapshot=JSON.parse(fs.readFileSync(process.argv[2]||'/tmp/nightwatch-live-chicago.json','utf8'));
 const b=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const page=await b.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.setFixedTime(new Date(snapshot.capturedAt));
  await page.addInitScript(()=>localStorage.setItem('nightwatch-location',JSON.stringify({lat:41.8781,lon:-87.6298,name:'Chicago, Illinois'})));
  await page.route('https://api.open-meteo.com/**',r=>r.fulfill({json:snapshot.weather}));
  await page.route('https://geo.weather.gc.ca/**',r=>{
   const params=new URL(r.request().url()).searchParams,request=params.get('REQUEST'),layer=params.get('LAYERS');
   const field=layer==='RDPS_10km_SeeingIndex'?'seeing':layer==='RDPS_10km_SkyTransparencyIndex'?'transparency':null;
   if(!field)return r.abort();
   if(request==='GetCapabilities')return r.fulfill({body:snapshot.capabilities[field],contentType:'application/xml'});
   if(request==='GetFeatureInfo')return r.fulfill({json:Date.parse(params.get('TIME'))===Date.parse(snapshot.selectedTime)?snapshot.points[field]:{layer,features:[]}});
   return r.abort();
  });
  await page.route('https://nightwatch-sky-api.**/**',r=>r.abort());
  await page.goto('http://127.0.0.1:4173');await page.waitForSelector('.imaging-card');
  const index=await page.evaluate(t=>state.hours.findIndex(h=>+h.date===Date.parse(t)),snapshot.selectedTime);assert(index>=0);
  await page.locator('#imaging-hours [data-imaging-hour="'+index+'"]').click();
  await page.waitForFunction(()=>!!state.hours[selected].cmc);
  const actual=await page.evaluate(()=>{const h=NightwatchImagingUI.input(state.hours[selected],selected);return {date:h.date.toISOString(),seeing:h.seeing,transparency:h.transparency,cloud:h.cloud,wind:h.wind,humidity:h.humidity,temp:h.temp,dew:h.dew,score:h.score,expectedScore:NightwatchScore.infer(h),ratings:NightwatchImaging.analyze(h).map(r=>({category:r.label,rating:r.rating,score:r.score}))}});
  for(const field of ['seeing','transparency']){const raw=snapshot.points[field];const data=await page.evaluate(({raw,field,time})=>{const layer=field==='seeing'?'RDPS_10km_SeeingIndex':'RDPS_10km_SkyTransparencyIndex';const reference=raw.features?.[0]?.properties?.dim_reference_time;return CMC.parsePoint(raw,layer,time,reference)}, {raw,field,time:snapshot.selectedTime});assert.equal(actual[field],data?.value??null);}
  const wi=snapshot.weather.hourly.time.indexOf(Date.parse(snapshot.selectedTime)/1000);
  for(const [field,key]of Object.entries({cloud:'cloud_cover',wind:'wind_speed_10m',humidity:'relative_humidity_2m',temp:'temperature_2m',dew:'dew_point_2m'}))assert.equal(actual[field],wi<0?null:snapshot.weather.hourly[key][wi]);
  assert.equal(actual.score,actual.expectedScore);assert.match(await page.locator('#imaging-time').textContent(),/America\/Chicago/);
  await page.evaluate(captured=>{const p=document.createElement('p');p.textContent='CHICAGO · ACTUAL API SNAPSHOT · Captured '+captured+' · Selected hour below';p.style.cssText='color:#e7d878;font-size:13px;line-height:1.8';document.querySelector('#imaging-panel').prepend(p)},snapshot.capturedAt);
  fs.mkdirSync('docs/screenshots',{recursive:true});await page.locator('#imaging-panel').screenshot({path:'docs/screenshots/imaging-chicago-live-desktop.png'});
  await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.locator('#imaging-panel').screenshot({path:'docs/screenshots/imaging-chicago-live-iphone.png'});
  assert.deepEqual(errors,[]);console.log(JSON.stringify({capturedAt:snapshot.capturedAt,...actual},null,2));console.log('Real Chicago API snapshot matches displayed CMC/weather values and unchanged observing score.');
 }finally{await b.close()}
})().catch(e=>{console.error(e);process.exit(1)});
