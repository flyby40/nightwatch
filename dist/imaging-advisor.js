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
const isDark=h=>!!h&&valid(h.sun)&&h.sun<-18;
function curve(points,x){if(x<=points[0][0])return points[0][1];for(let i=1;i<points.length;i++){const [a,b]=points[i-1],[c,d]=points[i];if(x<=c)return b+(d-b)*(x-a)/(c-a)}return points.at(-1)[1]}
function band(score,c=config){return !valid(score)?'unavailable':score>=c.bands.good?'good':score>=c.bands.fair?'fair':score>=c.bands.marginal?'marginal':'poor'}
const labels={good:'Good',fair:'Fair',marginal:'Marginal',poor:'Poor',unavailable:'Insufficient data'};
// Explain the largest recoverable score loss, without changing any scoring rules.
function explain(id,h,spec,components,atmospheric,modifiers){
 if(spec.moonRequired&&h.moonAlt<=0)return {dominantLimitation:'visibility',explanation:'Moon is below the horizon; lunar imaging is unavailable regardless of atmospheric quality.'};
 if(h.seeing===0||h.transparency===0)return {dominantLimitation:'cmcCloud',explanation:'CMC predicts a cloudy sky, limiting '+({wide:'wide-field star images',broadband:'faint broadband exposures',narrowband:'narrowband nebula signal',planetary:'planetary detail',lunar:'lunar detail'}[id])+'.'};
 const product=Object.values(modifiers).reduce((a,b)=>a*b,1);
 const losses=[['seeing',(100-components.seeing)*spec.weights.seeing*product],['transparency',(100-components.transparency)*spec.weights.transparency*product]];
 for(const [key,factor] of Object.entries(modifiers)){
  const others=Object.entries(modifiers).filter(([name])=>name!==key).reduce((n,[,v])=>n*v,1);
  losses.push([key,atmospheric*(1-factor)*others]);
 }
 const [dominant,loss]=losses.sort((a,b)=>b[1]-a[1])[0];
 // Small departures from ideal do not warrant declaring a dominant limitation.
 if(loss<5&&atmospheric>=90&&Object.values(modifiers).every(v=>v>=.95)){const favorable={wide:'Clear skies favor wide-field star fields and clusters.',broadband:'Clear, transparent skies favor faint broadband structure.',narrowband:'Transparent skies favor emission-nebula signal through narrowband filters.',planetary:'Steady seeing favors fine planetary detail; confirm planet visibility.',lunar:'Steady seeing favors detail on the visible Moon.'};return {dominantLimitation:null,explanation:favorable[id]};}
 const seeing=h.seeing===1?'Very poor':h.seeing===2?'Poor':h.seeing===3?'Average':'Less-than-excellent';
 const transparency=h.transparency<=2?'Poor':h.transparency===3?'Average':'Less-than-excellent';
 const atmosphericText={
  wide:{seeing:'Poor atmospheric stability may enlarge stars, but wide-field imaging remains possible.',transparency:transparency+' transparency dims faint stars'+(h.seeing<=2?'; poor stability may also enlarge them': '')+', but wide-field imaging remains possible.'},
  broadband:{seeing:seeing+' seeing blurs small galaxy and nebula structure.',transparency:transparency+' transparency significantly reduces faint-object contrast.'},
  narrowband:{seeing:seeing+' seeing softens emission-nebula detail, especially at smaller image scales.',transparency:'Narrowband filtering may help with some sky-background limitations, but '+transparency.toLowerCase()+' transparency still reduces signal.'},
  planetary:{seeing:seeing+' seeing '+(h.seeing<=2?'severely limits':'limits')+' fine planetary detail.',transparency:transparency+' transparency reduces planetary contrast, even when seeing is steady.'},
  lunar:{seeing:seeing+' seeing '+(h.seeing<=2?'severely limits':'limits')+' fine lunar detail.',transparency:transparency+' transparency reduces lunar contrast despite the Moon being visible.'}
 };
 const subjects={wide:'wide-field star images',broadband:'faint broadband exposures',narrowband:'narrowband nebula exposures',planetary:'fine planetary detail',lunar:'fine lunar detail'},subject=subjects[id];
 const environmental={cloud:'Cloud cover is the main limitation for '+subject+'.',cmcCloud:'CMC predicts a cloudy sky, limiting '+subject+'.',wind:'Wind is the main risk to '+subject+(spec.detail?' through image shake.':' through tracking errors and enlarged stars.'),dew:'Dew/frost risk is the main equipment limitation for '+subject+'; use dew protection and monitor optics.',night:'Twilight or daylight is the main sky-background limitation for '+subject+'.',moon:'Moonlight is the main sky-background limitation for '+subject+(id==='narrowband'?'; narrowband filters help, but do not eliminate it.':'.'),moonAltitude:'Low Moon altitude is the main limitation to fine lunar detail.'};
 return {dominantLimitation:dominant,explanation:atmosphericText[id][dominant]||environmental[dominant]};
}
function analyze(h={},c=config){
 h=h||{};
 const ranges={seeing:[0,5],transparency:[0,5],cloud:[0,100],wind:[0,Infinity],humidity:[0,100],temp:[-Infinity,Infinity],dew:[-Infinity,Infinity],moonIllum:[0,1],moonAlt:[-90,90],sun:[-90,90]};
 const missing=Object.keys(ranges).filter(k=>!valid(h[k])||h[k]<ranges[k][0]||h[k]>ranges[k][1]||(['seeing','transparency'].includes(k)&&!Number.isInteger(h[k])));
 return Object.entries(c.categories).map(([id,spec])=>{
  const base={id,label:spec.label,missing:[...missing],confidence:missing.length?'insufficient':'complete'};
  if(missing.length)return {...base,score:null,band:'unavailable',rating:labels.unavailable,dominantLimitation:spec.moonRequired&&valid(h.moonAlt)&&h.moonAlt<=0?'visibility':'missing',explanation:(spec.moonRequired&&valid(h.moonAlt)&&h.moonAlt<=0?'Moon is below the horizon; lunar imaging is unavailable regardless of atmospheric quality. ':'')+'Missing or invalid '+missing.join(', ')+'. Atmospheric confidence is incomplete; no suitability rating is inferred.'};
  const components={seeing:spec.seeing[h.seeing],transparency:spec.transparency[h.transparency]};
  const atmospheric=components.seeing*spec.weights.seeing+components.transparency*spec.weights.transparency;
  const modifiers={cloud:curve(c.curves.cloud,h.cloud),wind:curve(c.curves.wind,h.wind),dew:Math.min(curve(c.curves.humidity,h.humidity),curve(c.curves.spread,h.temp-h.dew)),cmcCloud:c.cmcCloudFactor[h.seeing]*c.cmcCloudFactor[h.transparency],night:spec.detail?1:curve(c.curves.night,h.sun),moon:spec.moonFloor===undefined||h.moonAlt<=0?1:1-(1-spec.moonFloor)*h.moonIllum,moonAltitude:spec.moonRequired&&h.moonAlt>0&&h.moonAlt<c.lowMoonAltitude?c.lowMoonFactor:1};
  let raw=atmospheric*Object.values(modifiers).reduce((a,b)=>a*b,1);
  if(spec.moonRequired&&h.moonAlt<=0)raw=0;
  let reason=explain(id,h,spec,components,atmospheric,modifiers);
  if(!isDark(h)){raw=0;reason={dominantLimitation:h.sun>=0?'daylight':'twilight',explanation:h.sun>=0?'Daylight is outside this dark-hours imaging advisor; daytime suitability is Poor.':'Twilight is outside this advisor; choose astronomical darkness (Sun below −18°).'};}
  const score=Math.round(Math.max(0,Math.min(100,raw))),quality=band(score,c);
  return {...base,score,band:quality,rating:labels[quality],...reason,components,atmospheric,modifiers};
 });
}
// Windows contain consecutive forecast samples, not guaranteed continuous conditions.
function windows(hours,id,c=config){
 const groups=[];let group=null;
 for(const h of hours){const r=analyze(h,c).find(r=>r.id===id),t=+h.date;if(!valid(t)||!isDark(h)||r.score===null||r.score<c.bands.fair){group=null;continue;}
  if(!group||t-group.end!==3600000){group={start:t,end:t,scores:[],indices:[]};groups.push(group)}
  group.end=t;group.scores.push(r.score);group.indices.push(h.index);
 }
 return groups.map(g=>({...g,average:Math.round(g.scores.reduce((a,b)=>a+b,0)/g.scores.length)})).sort((a,b)=>b.average-a.average||b.scores.length-a.scores.length||a.start-b.start).slice(0,3);
}
root.NightwatchImaging={config,analyze,windows,curve,band,isDark};
})(typeof window!=='undefined'?window:globalThis);
