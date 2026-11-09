/* Nightwatch planning heuristic. Inferred, uncalibrated; not a provider forecast. */
(function(root){
'use strict';
function inferViewingScore(h){
 if(!h||![h.cloud,h.humidity,h.wind,h.sun,h.moonAlt,h.moonIllum].every(v=>typeof v==='number'&&Number.isFinite(v)))return null;
 if(h.cloud<0||h.cloud>100||h.humidity<0||h.humidity>100||h.wind<0||h.moonIllum<0||h.moonIllum>1)return null;
 if(h.sun>=0)return 0;
 const cloud=100-h.cloud;
 const humidity=100-Math.max(0,h.humidity-40)*1.4;
 const wind=Math.max(0,100-h.wind*3);
 const moon=100-(h.moonAlt>0?h.moonIllum*100:0);
 const raw=cloud*.60+humidity*.15+wind*.10+moon*.15;
 const darkness=h.sun<-18?1:h.sun<-12?.65:.25;
 return Math.round(Math.max(0,Math.min(100,raw))*darkness);
}
function band(n){return typeof n!=='number'||!Number.isFinite(n)?'unavailable':n>=70?'good':n>=55?'fair':n>=40?'marginal':'poor'}
const labels={good:'Good',fair:'Fair',marginal:'Marginal',poor:'Poor',unavailable:null};
root.NightwatchScore={infer:inferViewingScore,band,quality:n=>labels[band(n)]};
})(typeof window!=='undefined'?window:globalThis);
