/* Calculated Moon horizon events, shared by milestones and lunar availability advice. */
(function(root){
'use strict';
const finite=v=>typeof v==='number'&&Number.isFinite(v);
function events(start,end,lat,lon,astro){
 const begin=+start,finish=+end;
 if(![begin,finish,lat,lon].every(finite)||finish<=begin||Math.abs(lat)>90||Math.abs(lon)>180)return [];
 const first=new Date(begin);first.setUTCHours(0,0,0,0);const out=[],seen=new Set();
 for(let day=+first;day<finish;day+=86400000){
  const times=astro.getMoonTimes(new Date(day),lat,lon,true);
  for(const key of ['rise','set']){const date=times[key],t=+date,id=key+'|'+t;
   if(date&&finite(t)&&t>=begin&&t<finish&&!seen.has(id)){seen.add(id);out.push({date:new Date(t),kind:key,label:key==='rise'?'Moonrise':'Moonset',icon:key==='rise'?'☽':'☾',sub:key==='rise'?'The Moon rises above the calculated horizon':'The Moon sets below the calculated horizon'});}
  }
 }
 return out.sort((a,b)=>+a.date-+b.date);
}
function at(date,list,lat,lon,astro){
 const t=+date;if(!finite(t)||![lat,lon].every(finite))return {above:null,nextRise:null,nextSet:null};
 const previous=list.filter(e=>+e.date<=t).at(-1),next=list.find(e=>+e.date>t);
 const altitude=astro.getMoonPosition(date,lat,lon).altitude*180/Math.PI;
 // Match SunCalc.getMoonTimes' 0.133° apparent-altitude horizon convention.
 const above=previous?previous.kind==='rise':next?next.kind==='set':finite(altitude)?altitude>=.133:null;
 return {above,time:new Date(t),nextRise:list.find(e=>e.kind==='rise'&&+e.date>t)?.date??null,nextSet:list.find(e=>e.kind==='set'&&+e.date>t)?.date??null};
}
function isUp(h){return typeof h?.moonAvailability?.above==='boolean'?h.moonAvailability.above:finite(h?.moonAlt)?h.moonAlt>=.133:null}
root.NightwatchMoon={events,at,isUp};
})(typeof window!=='undefined'?window:globalThis);
