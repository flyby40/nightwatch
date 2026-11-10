/* Imaging suitability heuristics, version 1. Pure calculations; no network or DOM. */
(function(root){
'use strict';
const config={
 bands:{good:70,fair:55,marginal:40},
 indexLabels:['Cloudy','Very poor','Poor','Average','Good','Excellent'],
 // Utilities for provider indices 0,1,2,3,4,5. Each category has two distinct curves.
 categories:{
  wide:{label:'Wide-field star fields & clusters',preferred:{seeing:[2,5],transparency:[2,5]},weights:{seeing:.25,transparency:.75},seeing:[0,35,70,85,95,100],transparency:[0,20,65,82,95,100],moonFloor:.8},
  broadband:{label:'Broadband deep sky · galaxies & reflection nebulae',preferred:{seeing:[2,5],seeingIdeal:3,transparency:[4,5]},weights:{seeing:.2,transparency:.8},seeing:[0,25,60,85,95,100],transparency:[0,5,20,55,85,100],moonFloor:.6},
  narrowband:{label:'Narrowband emission nebulae',preferred:{seeing:[2,5],transparency:[3,5]},weights:{seeing:.2,transparency:.8},seeing:[0,35,70,85,95,100],transparency:[0,10,40,75,92,100],moonFloor:.95},
  planetary:{label:'High-resolution planetary',preferred:{seeing:[4,5],transparency:[2,5]},weights:{seeing:.85,transparency:.15},seeing:[0,5,20,55,85,100],transparency:[0,40,70,85,95,100],detail:true},
  lunar:{label:'High-resolution lunar',preferred:{seeing:[4,5],transparency:[2,5]},weights:{seeing:.85,transparency:.15},seeing:[0,5,20,55,85,100],transparency:[0,40,70,85,95,100],detail:true,moonRequired:true}
 },
 // Modifiers can only reduce atmospheric suitability. They add no 100-point baseline.
 curves:{
  cloud:[[0,1],[20,.9],[50,.55],[80,.2],[100,.05]],
  wind:[[0,1],[5,.98],[15,.85],[25,.6],[40,.25],[60,.1]],
  humidity:[[0,1],[60,1],[80,.95],[90,.85],[100,.65]],
  spread:[[0,.6],[1,.7],[3,.85],[6,.97],[10,1]],
  night:[[-18,1],[-12,.8],[-6,.4],[0,.15],[15,.05]]
 },
 cmcCloudFactor:[.1,1,1,1,1,1],lowMoonAltitude:20,lowMoonFactor:.8
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
  const components={seeing:spec.seeing[h.seeing],transparency:spec.transparency[h.transparency]};
  const atmospheric=components.seeing*spec.weights.seeing+components.transparency*spec.weights.transparency;
  const modifiers={cloud:curve(c.curves.cloud,h.cloud),wind:curve(c.curves.wind,h.wind),dew:Math.min(curve(c.curves.humidity,h.humidity),curve(c.curves.spread,h.temp-h.dew)),cmcCloud:c.cmcCloudFactor[h.seeing]*c.cmcCloudFactor[h.transparency],night:spec.detail?1:curve(c.curves.night,h.sun),moon:spec.moonFloor===undefined||h.moonAlt<=0?1:1-(1-spec.moonFloor)*h.moonIllum,moonAltitude:spec.moonRequired&&h.moonAlt>0&&h.moonAlt<c.lowMoonAltitude?c.lowMoonFactor:1};
  let raw=atmospheric*Object.values(modifiers).reduce((a,b)=>a*b,1);
  const reasons=[];
  if(spec.moonRequired&&h.moonAlt<=0){raw=0;reasons.push('Moon is below the horizon; lunar imaging is unavailable.');}
  if(h.cloud>=30)reasons.push('Cloud cover limits usable exposures.');
  if(h.seeing===0||h.transparency===0)reasons.push('CMC indicates a cloudy sky.');
  if(h.seeing>0&&h.seeing<=2)reasons.push(spec.detail?(h.seeing===1?'Very poor seeing limits fine detail.':'Poor seeing limits fine detail.'):'Poor seeing reduces sharpness; wider image scales are more tolerant.');
  if(h.transparency>0&&h.transparency<=2)reasons.push(spec.detail?'Poor transparency reduces contrast; seeing remains the main detail limitation.':'Poor transparency reduces faint-object contrast.');
  if(h.seeing===3&&spec.detail)reasons.push('Average seeing limits fine detail; seeing 4–5 is preferred.');
  if(h.transparency===3&&id==='broadband')reasons.push('Average transparency limits broadband contrast; transparency 4–5 is preferred.');
  if(h.wind>=15)reasons.push('Wind can disturb tracking and sharpness.');
  if(h.humidity>=85||h.temp-h.dew<=3)reasons.push('Humidity or a small dew-point spread raises dew/frost risk; use dew protection.');
  if(!spec.detail&&h.sun>-18)reasons.push('Twilight or daylight reduces deep-sky contrast.');
  if(!spec.detail&&h.moonAlt>0&&h.moonIllum>=.4)reasons.push(id==='narrowband'?'Narrowband is more tolerant of moonlight; clouds and haze still matter.':'Moonlight reduces faint-object contrast.');
  if(!reasons.length)reasons.push(spec.detail?'Good or excellent seeing and low cloud favor fine detail.':h.sun<=-18&&(h.moonAlt<=0||h.moonIllum<.2)?'Excellent darkness and clear air favor deep-sky imaging.':'Clear air favors imaging; check target position.');
  if(id==='planetary')reasons.push('Planet visibility and altitude are not evaluated.');
  if(modifiers.moonAltitude<1)reasons.push('Low Moon altitude may soften detail.');
  const score=Math.round(Math.max(0,Math.min(100,raw))),quality=band(score,c);
  return {...base,score,band:quality,rating:labels[quality],explanation:reasons.join(' '),components,atmospheric,modifiers};
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
