/* Planet panel rendering. Availability and atmospheric quality remain independent. */
(function(root){
'use strict';
const $=id=>document.getElementById(id),escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),forecasts=new WeakMap();
let context,body='Jupiter',minimum=20,formKey='';
try{const saved=localStorage.getItem('nightwatch-planet');if(NightwatchPlanets.bodies.includes(saved))body=saved;const altitude=localStorage.getItem('nightwatch-planet-minimum');if(altitude!==null&&[0,10,20,30,40].includes(Number(altitude)))minimum=Number(altitude)}catch{}
$('planet-body').value=body;$('planet-minimum').value=String(minimum);
const degrees=n=>typeof n==='number'&&Number.isFinite(n)?n.toFixed(1)+'°':'null';
function readHeight(state){try{const raw=localStorage.getItem(NightwatchPlanets.elevationKey(state.lat,state.lon));if(raw!==null){const n=Number(raw);if(raw.trim()&&NightwatchPlanets.validHeight(n))return n}}catch{}return null}
function render(state,horizon,selected,format,onSelect,onAnalyze,units,onStop){
 context={state,horizon,selected,format,onSelect,onAnalyze,units,onStop};
 const localTime=date=>format(date,{weekday:'short',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
 const manual=readHeight(state),height=NightwatchPlanets.elevation(state.observerHeightM,manual),unit=units==='imperial'?'ft':'m',toDisplay=n=>units==='imperial'?n/.3048:n;
 const key=[state.lat,state.lon,units].join('|');
 if(key!==formKey){$('planet-height-status').textContent='';$('planet-height').value=manual===null?'':String(Number(toDisplay(manual).toFixed(6)));formKey=key;}
 $('planet-height-unit').textContent=unit;$('planet-height').setAttribute('aria-label','Measured site elevation above sea level in '+unit);
 $('planet-height-source').textContent=height.source==='manual'?'User-entered site measurement: '+toDisplay(height.value).toFixed(1)+' '+unit:height.source==='modeled'?'Modeled elevation: '+toDisplay(height.value).toFixed(1)+' '+unit+' · Open-Meteo · approximate':'Site elevation unavailable · using a 0 '+unit+' sea-level reference, not a site measurement.';
 $('planet-reference').textContent='Coordinates '+state.lat.toFixed(5)+', '+state.lon.toFixed(5)+' · Calculated horizon · Astronomy Engine 2.1.19 · local terrain and obstructions are not modeled.';
 $('planet-time').textContent=body+' · '+localTime(state.hours[selected].date)+' · '+state.zone+' · '+state.name;
 $('planet-analyze').disabled=!!state.imagingRunning||!state.hours.slice(0,horizon).some(NightwatchImaging.isNight);
 $('planet-stop').hidden=!state.imagingRunning;
 $('planet-progress').textContent=$('imaging-progress').textContent;
 let data;
 try{
  let cached=forecasts.get(state);
  if(!cached||cached.key!==height.value+'|'+height.source){cached={key:height.value+'|'+height.source,model:NightwatchPlanets.create({...state,observerHeightM:height.source==='reference'?null:height.value},root.Astronomy,root.SunCalc)};forecasts.set(state,cached);}
  data=cached.model.planet(body);
 }catch{data={samples:[],events:[],error:'Planet ephemeris unavailable. Weather forecasts remain available.'}}
 const hours=state.hours.slice(0,horizon).map(NightwatchImagingUI.input),samples=data.samples.slice(0,horizon),sample=data.samples[selected],status=NightwatchPlanets.availability(sample,hours[selected],minimum),rating=NightwatchImaging.analyze(hours[selected]).find(r=>r.id==='planetary');
 $('planet-availability').textContent=status.label;$('planet-availability').dataset.status=status.code;
 $('planet-reason').textContent=data.error||status.reason;
 $('planet-geometry-time').textContent=sample?'Geometry at '+localTime(new Date(sample.time))+' · '+state.zone:'Geometry time: null';
 $('planet-altitude').textContent=degrees(sample?.altitude);$('planet-azimuth').textContent=sample?degrees(sample.azimuth)+' · '+sample.direction:'null';$('planet-sun').textContent=degrees(sample?.solarElevation);
 $('planet-atmosphere').textContent=rating.rating+(rating.score===null?'':' · '+rating.score+'/100*');$('planet-atmosphere').dataset.quality=rating.band;
 const limit=+state.now+horizon*3600000,t=sample?+sample.time:Math.max(+state.hours[selected].date,+state.now);
 for(const kind of ['rise','set']){const e=data.events.find(e=>e.kind===kind&&+e.date>t&&+e.date<limit);$('planet-'+kind).textContent=e?localTime(new Date(e.date)):'null · no crossing in selected range';}
 const groups=NightwatchPlanets.windows(hours,samples,minimum);
 $('planet-window-title').textContent='Best '+body+' samples · next '+horizon+' hours';
 $('planet-windows').innerHTML=groups.length?groups.map(g=>{const quality=NightwatchImaging.band(g.average),label={good:'Good',fair:'Fair',marginal:'Marginal',poor:'Poor'}[quality]||'Unavailable';return '<li data-quality="'+quality+'"><button data-planet-hour="'+g.indices[0]+'">'+escape(localTime(new Date(g.start)))+(g.end!==g.start?' through '+escape(localTime(new Date(g.end))):'')+'</button><span class="planet-window-rating planet-quality" data-quality="'+quality+'">'+label+' · atmosphere '+g.average+'/100*</span><span>'+g.scores.length+' hourly sample'+(g.scores.length===1?'':'s')+' · peak sampled altitude '+degrees(g.maxAltitude)+'</span></li>'}).join(''):'<li>No samples meet nighttime availability, your '+minimum+'° altitude preference, and Fair/Good atmospheric conditions with complete weather data. Analyze nighttime conditions or adjust the planning preference.</li>';
 $('planet-hours').innerHTML=hours.map((h,i)=>{const p=samples[i],a=NightwatchPlanets.availability(p,h,minimum),r=NightwatchImaging.analyze(h).find(r=>r.id==='planetary');return '<button class="planet-sample '+(i===selected?'selected':'')+'" data-status="'+a.code+'" data-planet-hour="'+i+'" aria-pressed="'+(i===selected)+'"><span>'+escape(localTime(h.date))+'</span><strong>'+escape(a.label)+'</strong><span>'+degrees(p?.altitude)+(p?' · '+p.direction:'')+'</span><small class="planet-quality" data-quality="'+r.band+'">Atmosphere: '+r.rating+(r.score===null?'':' '+r.score+'/100*')+'</small></button>'}).join('');
}
function refresh(){if(context){const c=context;render(c.state,c.horizon,c.selected,c.format,c.onSelect,c.onAnalyze,c.units,c.onStop)}}
$('planet-body').onchange=e=>{body=e.target.value;try{localStorage.setItem('nightwatch-planet',body)}catch{}refresh()};
$('planet-minimum').onchange=e=>{minimum=Number(e.target.value);try{localStorage.setItem('nightwatch-planet-minimum',String(minimum))}catch{}refresh()};
$('planet-analyze').onclick=()=>context?.onAnalyze();
$('planet-stop').onclick=()=>context?.onStop?.();
$('planet-panel').addEventListener('click',e=>{const button=e.target.closest('[data-planet-hour]');if(button&&context)context.onSelect(Number(button.dataset.planetHour))});
$('planet-height-form').onsubmit=e=>{
 e.preventDefault();if(!context)return;const input=$('planet-height').value.trim(),n=Number(input),meters=context.units==='imperial'?n*.3048:n;
 if(!input||!NightwatchPlanets.validHeight(meters)){$('planet-height-status').textContent='Enter a measured elevation between −500 and 10,000 m (−1,640.42 to 32,808.40 ft), or use the modeled elevation.';return;}
 try{localStorage.setItem(NightwatchPlanets.elevationKey(context.state.lat,context.state.lon),String(meters));formKey='';refresh();$('planet-height-status').textContent='Site measurement saved for these coordinates in this browser.'}catch{$('planet-height-status').textContent='Browser storage is unavailable; measurement could not be saved.'}
};
$('planet-height-reset').onclick=()=>{if(!context)return;try{localStorage.removeItem(NightwatchPlanets.elevationKey(context.state.lat,context.state.lon));formKey='';refresh();$('planet-height-status').textContent='Site measurement cleared; using available modeled elevation or the labeled sea-level reference.'}catch{$('planet-height-status').textContent='Browser storage is unavailable.'}};
root.NightwatchPlanetUI={render};
})(window);
