/* Imaging suitability heuristics, version 1. Pure calculations; no network or DOM. */
(function(root){
'use strict';
const config={
 bands:{good:70,fair:55,marginal:40},
 // CMC: 0 cloudy, 1 very bad, 2 poor, 3 average/medium, 4 good, 5 excellent.
 indices:[0,15,35,60,82,100],
 cmcCloudFactor:[.25,1,1,1,1,1],
 curves:{
  cloud:[[0,100],[10,95],[30,70],[60,30],[100,0]],
  wind:[[0,100],[5,95],[15,75],[25,40],[40,10],[60,0]],
  humidity:[[0,100],[60,100],[80,80],[90,50],[100,20]],
  spread:[[0,15],[1,30],[3,65],[6,90],[10,100]],
  darkness:[[-18,100],[-12,55],[-6,15],[0,0]],
  cloudFactor:[[0,1],[20,.9],[50,.55],[80,.2],[100,.05]],
  detailFactor:[[0,.1],[1,.2],[2,.4],[3,.65],[4,.9],[5,1]],
  transparencyFactor:[[0,.15],[1,.3],[2,.5],[3,.75],[4,.95],[5,1]],
  nightFactor:[[-18,1],[-12,.8],[-6,.4],[0,.15],[15,.05]]
 },
 categories:{
  wide:{label:'Wide-field star fields & clusters',weights:{seeing:5,transparency:20,cloud:25,wind:15,moon:10,humidity:5,spread:5,darkness:15},moonTolerance:0,moonFloor:.8},
  broadband:{label:'Broadband deep sky · galaxies & reflection nebulae',weights:{seeing:5,transparency:30,cloud:25,wind:10,moon:10,humidity:5,spread:5,darkness:10},moonTolerance:0,moonFloor:.65,transparencyFactor:true},
  narrowband:{label:'Narrowband emission nebulae',weights:{seeing:5,transparency:25,cloud:30,wind:15,moon:5,humidity:5,spread:5,darkness:10},moonTolerance:.8,moonFloor:.97},
  planetary:{label:'High-resolution planetary',weights:{seeing:55,transparency:5,cloud:15,wind:15,moon:0,humidity:5,spread:5,darkness:0},moonTolerance:1,detailFactor:true},
  lunar:{label:'Lunar imaging',weights:{seeing:50,transparency:5,cloud:20,wind:15,moon:0,humidity:5,spread:5,darkness:0},moonTolerance:1,detailFactor:true,moonRequired:true}
 }
};
const valid=v=>typeof v==='number'&&Number.isFinite(v);
function curve(points,x){if(x<=points[0][0])return points[0][1];for(let i=1;i<points.length;i++){const [a,b]=points[i-1],[c,d]=points[i];if(x<=c)return b+(d-b)*(x-a)/(c-a)}return points.at(-1)[1]}
function band(score,c=config){return !valid(score)?'unavailable':score>=c.bands.good?'good':score>=c.bands.fair?'fair':score>=c.bands.marginal?'marginal':'poor'}
const labels={good:'Good',fair:'Fair',marginal:'Marginal',poor:'Poor',unavailable:'Insufficient data'};
function analyze(h={},c=config){
 h=h||{};
 const ranges={seeing:[0,5],transparency:[0,5],cloud:[0,100],wind:[0,Infinity],humidity:[0,100],temp:[-Infinity,Infinity],dew:[-Infinity,Infinity],moonIllum:[0,1],moonAlt:[-90,90],sun:[-90,90]};
 const missing=Object.keys(ranges).filter(k=>!valid(h[k])||h[k]<ranges[k][0]||h[k]>ranges[k][1]||(['seeing','transparency'].includes(k)&&!Number.isInteger(h[k])));
 return Object.entries(c.categories).map(([id,spec])=>{
  const base={id,label:spec.label,missing:[...missing],confidence:missing.length?'insufficient':'complete'};
  if(missing.length)return {...base,score:null,band:'unavailable',rating:labels.unavailable,explanation:'Missing or invalid '+missing.join(', ')+'. No suitability rating is inferred.'};
  const components={seeing:c.indices[h.seeing],transparency:c.indices[h.transparency],cloud:curve(c.curves.cloud,h.cloud),wind:curve(c.curves.wind,h.wind),humidity:curve(c.curves.humidity,h.humidity),spread:curve(c.curves.spread,h.temp-h.dew),darkness:curve(c.curves.darkness,h.sun),moon:100-(h.moonAlt>0?h.moonIllum*100:0)*(1-spec.moonTolerance)};
  const total=Object.values(spec.weights).reduce((a,b)=>a+b,0);
  let raw=Object.entries(spec.weights).reduce((sum,[key,weight])=>sum+components[key]*weight,0)/total;
  raw*=curve(c.curves.cloudFactor,h.cloud)*c.cmcCloudFactor[h.seeing]*c.cmcCloudFactor[h.transparency];
  if(spec.moonFloor!==undefined)raw*=1-(1-spec.moonFloor)*(h.moonAlt>0?h.moonIllum:0);
  if(spec.detailFactor)raw*=curve(c.curves.detailFactor,h.seeing);
  if(spec.transparencyFactor)raw*=curve(c.curves.transparencyFactor,h.transparency);
  if(!spec.detailFactor)raw*=curve(c.curves.nightFactor,h.sun);
  const reasons=[];
  if(spec.moonRequired&&h.moonAlt<=0){raw=0;reasons.push('Moon is below the horizon; lunar imaging is unavailable.');}
  if(h.cloud>=30)reasons.push('Cloud cover limits usable exposures.');
  if(h.seeing===0||h.transparency===0)reasons.push('CMC indicates a cloudy sky.');
  if(h.seeing>0&&h.seeing<=2)reasons.push(spec.detailFactor?'Poor seeing limits fine detail.':'Poor seeing has less impact at wide image scales.');
  if(h.transparency>0&&h.transparency<=2)reasons.push('Poor transparency reduces faint-object contrast.');
  if(h.wind>=15)reasons.push('Wind can disturb tracking and sharpness.');
  if(h.humidity>=85||h.temp-h.dew<=3)reasons.push('Humidity or a small dew-point spread raises dew/frost risk; use dew protection.');
  if(!spec.detailFactor&&h.sun>-18)reasons.push('Twilight or daylight reduces deep-sky contrast.');
  if(!spec.detailFactor&&h.moonAlt>0&&h.moonIllum>=.4)reasons.push(id==='narrowband'?'Narrowband is more tolerant of moonlight; clouds and haze still matter.':'Moonlight reduces faint-object contrast.');
  if(!reasons.length)reasons.push(spec.detailFactor?'Steady seeing and low cloud favor fine detail.':h.sun<=-18&&(h.moonAlt<=0||h.moonIllum<.2)?'Excellent darkness and clear air favor deep-sky imaging.':'Clear air favors imaging; check target position.');
  if(id==='planetary')reasons.push('Planet visibility and altitude are not evaluated.');
  if(id==='lunar'&&h.moonAlt>0&&h.moonAlt<20){raw*=.8;reasons.push('Low Moon altitude may soften detail.');}
  const score=Math.round(Math.max(0,Math.min(100,raw))),quality=band(score,c);
  return {...base,score,band:quality,rating:labels[quality],explanation:reasons.join(' '),components};
 });
}
// Windows contain consecutive forecast samples, not guaranteed continuous conditions.
function windows(hours,id,c=config){
 const groups=[];let group=null;
 for(const h of hours){const r=analyze(h,c).find(r=>r.id===id),t=+h.date;if(!valid(t)||r.score===null||r.score<c.bands.fair){group=null;continue;}
  if(!group||t-group.end!==3600000){group={start:t,end:t,scores:[],indices:[]};groups.push(group)}
  group.end=t;group.scores.push(r.score);group.indices.push(h.index);
 }
 return groups.map(g=>({...g,average:Math.round(g.scores.reduce((a,b)=>a+b,0)/g.scores.length)})).sort((a,b)=>b.average-a.average||b.scores.length-a.scores.length||a.start-b.start).slice(0,3);
}
root.NightwatchImaging={config,analyze,windows,curve,band};
})(typeof window!=='undefined'?window:globalThis);
