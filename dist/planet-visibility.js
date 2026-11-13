/* Pure planet geometry, availability and window selection; never changes atmospheric scores. */
(function(root){
'use strict';
const bodies=['Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune'],finite=v=>typeof v==='number'&&Number.isFinite(v),day=86400000;
function validHeight(n){return finite(n)&&n>=-500&&n<=10000}
function elevationKey(lat,lon){return 'nightwatch-site-elevation|'+lat.toFixed(6)+'|'+lon.toFixed(6)}
function elevation(modeled,manual){return validHeight(manual)?{value:manual,source:'manual'}:validHeight(modeled)?{value:modeled,source:'modeled'}:{value:0,source:'reference'}}
function compass(azimuth){return finite(azimuth)?['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'][Math.floor(((azimuth%360+360)%360+11.25)/22.5)%16]:null}
function position(A,body,date,observer){
 const eq=A.Equator(body,date,observer,true,true),apparent=A.Horizon(date,observer,eq.ra,eq.dec,'normal'),geometric=A.Horizon(date,observer,eq.ra,eq.dec,null);
 if(![apparent.altitude,apparent.azimuth,geometric.altitude].every(finite))throw Error('Invalid planetary coordinates.');
 return {altitude:apparent.altitude,geometricAltitude:geometric.altitude,azimuth:apparent.azimuth,direction:compass(apparent.azimuth)};
}
function events(A,body,observer,start,end){
 const result=[];
 for(const direction of [1,-1]){let cursor=+start;
  for(let count=0;count<32&&cursor<+end;count++){
   const event=A.SearchRiseSet(body,observer,direction,new Date(cursor),(+end-cursor)/day);
   if(!event)break;const t=+event.date;
   if(!finite(t)||t<cursor)throw Error('Invalid planetary rise/set time.');
   if(t>=+end)break;
   result.push({date:new Date(t),kind:direction===1?'rise':'set'});cursor=t+1000;
  }
 }
 return result.sort((a,b)=>+a.date-+b.date);
}
function create(state,A,S){
 if(!A||!S||!finite(state.lat)||Math.abs(state.lat)>90||!finite(state.lon)||Math.abs(state.lon)>180||!Number.isFinite(+state.now)||!state.hours?.length)throw Error('Planet ephemeris inputs unavailable.');
 const height=finite(state.observerHeightM)?state.observerHeightM:0,observer=new A.Observer(state.lat,state.lon,height),start=+state.hours[0].date,end=Math.max(+state.now+3*day,+state.hours.at(-1).date+3600000),cache=new Map(),solarCache=new Map();
 function planet(body){
  if(!bodies.includes(body))throw Error('Unsupported planet.');
  if(cache.has(body))return cache.get(body);
  let data;
  try{
   const crossings=events(A,body,observer,new Date(start-day),new Date(end));
   const samples=state.hours.map((h,index)=>{
    const time=new Date(Math.max(+h.date,+state.now)),t=+time,geometry=position(A,body,time,observer);
    if(!solarCache.has(t)){const sunEq=A.Equator('Sun',time,observer,true,true);solarCache.set(t,{solar:NightwatchObservability.solarAt(time,state.lat,state.lon,S),sun:S.getPosition(time,state.lat,state.lon).altitude*180/Math.PI,solarElevation:A.Horizon(time,observer,sunEq.ra,sunEq.dec,null).altitude});}
    const previous=crossings.filter(e=>+e.date<=t).at(-1),next=crossings.find(e=>+e.date>t);
    const aboveHorizon=previous?previous.kind==='rise':next?next.kind==='set':geometry.altitude>=0;
    return {index,date:h.date,time,...geometry,...solarCache.get(t),aboveHorizon};
   });
   data={body,samples,events:crossings,error:null};
  }catch{data={body,samples:[],events:[],error:'Planetary calculations unavailable for this location/date.'}}
  cache.set(body,data);return data;
 }
 return {planet,height,referenceHeight:!finite(state.observerHeightM),start:new Date(start),end:new Date(end)};
}
function availability(sample,h,minimumAltitude=20){
 const policy=NightwatchObservability.evaluate(sample?{...h,solar:sample.solar,sun:sample.sun}:h);
 const result=(code,label,eligible,meetsPreference,reason)=>({code,label,eligible,meetsPreference,reason});
 if(policy.eligible===false)return result('daylight','Daylight — Not observable',false,false,policy.reason);
 if(policy.eligible!==true||!sample||![sample.altitude,sample.azimuth].every(finite)||typeof sample.aboveHorizon!=='boolean')return result('unknown','Availability unknown',null,false,'Calculated geometry or solar eligibility is unavailable.');
 if(!finite(minimumAltitude)||minimumAltitude<0||minimumAltitude>90)return result('unknown','Availability unknown',null,false,'Invalid minimum-altitude preference.');
 if(!sample.aboveHorizon)return result('below','Below horizon',false,false,'Target is below the calculated horizon.');
 if(sample.altitude<minimumAltitude)return result('low','Low altitude',true,false,'Above the calculated horizon, below your '+minimumAltitude+'° planning preference.');
 return result('above','Above calculated horizon',true,true,'Meets your '+minimumAltitude+'° minimum-altitude planning preference.');
}
function windows(hours,samples,minimumAltitude=20){
 const groups=[];let group=null;
 for(let i=0;i<hours.length;i++){
  const h=hours[i],sample=samples[i],status=availability(sample,h,minimumAltitude),rating=NightwatchImaging.analyze(h).find(r=>r.id==='planetary'),t=+h.date;
  if(!finite(t)||status.eligible!==true||!status.meetsPreference||rating.score===null||rating.score<NightwatchImaging.config.bands.fair){group=null;continue;}
  if(!group||t-group.end!==3600000){group={start:t,end:t,indices:[],scores:[],altitudes:[]};groups.push(group)}
  group.end=t;group.indices.push(h.index??i);group.scores.push(rating.score);group.altitudes.push(sample.altitude);
 }
 return groups.map(g=>({...g,average:Math.round(g.scores.reduce((a,b)=>a+b,0)/g.scores.length),maxAltitude:Math.max(...g.altitudes)})).sort((a,b)=>b.average-a.average||b.maxAltitude-a.maxAltitude||a.start-b.start).slice(0,3);
}
root.NightwatchPlanets={validHeight,elevationKey,elevation,bodies,compass,position,events,create,availability,windows};
})(typeof window!=='undefined'?window:globalThis);
