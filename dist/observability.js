/* Eligibility policy, separate from atmospheric scoring. No daytime observing in this version. */
(function(root){
'use strict';
const finite=v=>typeof v==='number'&&Number.isFinite(v);
function solarAt(date,lat,lon,astro){
 const t=+date,events=[];
 for(const delta of [-86400000,0,86400000]){const times=astro.getTimes(new Date(t+delta),lat,lon);for(const key of ['sunrise','sunset'])if(times[key]&&Number.isFinite(+times[key]))events.push({time:+times[key],kind:key});}
 events.sort((a,b)=>a.time-b.time);const previous=events.filter(e=>e.time<=t).at(-1);
 const sun=astro.getPosition(date,lat,lon).altitude*180/Math.PI;
 return {daylight:previous?previous.kind==='sunrise':finite(sun)?sun>=-.833:null,source:previous?'calculated sunrise/sunset':'polar solar altitude',sunrise:events.filter(e=>e.kind==='sunrise'&&e.time<=t).at(-1)?.time??null,sunset:events.filter(e=>e.kind==='sunset'&&e.time<=t).at(-1)?.time??null};
}
function phase(h){
 const daylight=typeof h?.solar?.daylight==='boolean'?h.solar.daylight:finite(h?.sun)?h.sun>=-.833:null;
 return daylight===null?'unknown':daylight?'daylight':finite(h.sun)&&h.sun<=-18?'darkness':'twilight';
}
function evaluate(h,category='observing',options={}){
 const period=phase(h),base={period,preferred:period==='darkness'};
 const result=(eligible,status,reason)=>({...base,eligible,status,label:eligible===false?'Not observable':eligible===null?'Insufficient data':'Observable',reason});
 if(period==='daylight')return result(false,'daylight','Daylight — outside observing hours between local sunrise and sunset.');
 if(period==='unknown')return result(null,'solar-unknown','Sunrise/sunset eligibility is unavailable.');
 if(options.requireTargetVisibility===true&&(category==='lunar'||category==='planetary')){
  const altitude=category==='lunar'?h.moonAlt:h.planetAlt,target=category==='lunar'?'Moon':'Selected planet';
  if(!finite(altitude)||altitude< -90||altitude>90)return result(null,'visibility-unknown',target+' visibility is unavailable; target altitude is required.');
  if(altitude<=0)return result(false,'target-below-horizon',target+' is below the horizon; not observable regardless of weather.');
 }
 return result(true,'eligible',period==='darkness'?'Astronomical darkness.':category==='lunar'||category==='planetary'?'Twilight; atmospheric suitability is subject to target availability.':'Twilight; astronomical darkness is preferred for deep-sky imaging.');
}
root.NightwatchObservability={solarAt,phase,evaluate};
})(typeof window!=='undefined'?window:globalThis);
