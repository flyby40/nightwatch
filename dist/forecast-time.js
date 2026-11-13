/* Calendar-hour boundaries in the forecast location's IANA timezone, never the device timezone. */
(function(root){
'use strict';
const minute=60000;
function periods(now,timeZone,count=72){
 const stamp=+now;
 if(!Number.isFinite(stamp)||!Number.isInteger(count)||count<1)throw new RangeError('Invalid forecast time or period count.');
 const formatter=new Intl.DateTimeFormat('en-GB',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 function local(t){const p=Object.fromEntries(formatter.formatToParts(new Date(t)).map(p=>[p.type,p.value]));return {key:[p.year,p.month,p.day,p.hour].join('-'),minute:Number(p.minute)}}
 const anchor=Math.floor(stamp/minute)*minute,key=local(anchor).key;
 let first=anchor;
 // Search actual instants, preserving the correct occurrence of a repeated DST hour.
 // A partial hour after a non-hour DST jump starts at its first existing minute.
 for(let t=anchor;t>=anchor-180*minute;t-=minute){const p=local(t);if(p.key!==key)break;first=t;if(p.minute===0)break;}
 const result=[new Date(first)];
 while(result.length<count){const previous=+result.at(-1),priorKey=local(previous).key;let next=null;
  for(let t=previous+minute;t<=previous+180*minute;t+=minute){const p=local(t);if(p.key!==priorKey||p.minute===0){next=t;break;}}
  if(next===null)throw new RangeError('Could not determine next local calendar hour.');
  result.push(new Date(next));
 }
 return result;
}
root.NightwatchTime={periods};
})(typeof window!=='undefined'?window:globalThis);
