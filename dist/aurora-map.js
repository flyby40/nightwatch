/* Provider-issued NOAA OVATION grid. No derived personal visibility probability. */
(function(root){
'use strict';
const source='https://services.swpc.noaa.gov/json/ovation_aurora_latest.json';
let cached;
function parse(data){
 const observation=Date.parse(data?.['Observation Time']),forecast=Date.parse(data?.['Forecast Time']);
 if(!Number.isFinite(observation)||!Number.isFinite(forecast)||!Array.isArray(data?.coordinates))throw Error('NOAA aurora data or timestamps are unavailable.');
 const grid=new Int16Array(360*181);grid.fill(-1);let count=0;
 for(const row of data.coordinates){
  if(!Array.isArray(row)||row.length<3)continue;
  const [lon,lat,value]=row;
  if(!Number.isInteger(lon)||lon<0||lon>=360||!Number.isInteger(lat)||lat< -90||lat>90||!Number.isInteger(value)||value<0||value>100)continue;
  grid[lon*181+lat+90]=value;count++;
 }
 if(!count)throw Error('NOAA aurora grid contains no valid data.');
 return {observation,forecast,grid,count};
}
function at(data,lat,lon){
 const y=Math.round(lat),x=((Math.round(lon)%360)+360)%360;
 if(y< -90||y>90)return {value:null,lat:null,lon:null};
 const value=data.grid[x*181+y+90];return {value:value>=0?value:null,lat:y,lon:x>=180?x-360:x};
}
async function load(force=false){
 if(!force&&cached&&Date.now()-cached.created<300000)return cached.promise;
 const promise=(async()=>{const r=await fetch(source,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('NOAA aurora service is unavailable.');return parse(await r.json())})();
 cached={created:Date.now(),promise};promise.catch(()=>{if(cached?.promise===promise)cached=null});return promise;
}
function color(v){return v<25?'#28ce9d':v<50?'#b8e653':v<75?'#ffe15d':'#f56650'}
function drawBlob(data,view){
 const canvas=document.createElement('canvas');canvas.width=view.size.x;canvas.height=view.size.y;const ctx=canvas.getContext('2d');if(!ctx)throw Error('Aurora map drawing is unavailable.');
 ctx.imageSmoothingEnabled=false;const [xmin,ymin,xmax,ymax]=view.extent,R=6378137;
 const px=lon=>(R*lon*Math.PI/180-xmin)/(xmax-xmin)*canvas.width;
 const py=lat=>{const clamped=Math.max(-85.05112878,Math.min(85.05112878,lat));const m=R*Math.log(Math.tan(Math.PI/4+clamped*Math.PI/360));return (ymax-m)/(ymax-ymin)*canvas.height};
 for(let x=0;x<360;x++){const lon=x>=180?x-360:x;for(const shift of [-360,0,360]){const left=px(lon-.5+shift),right=px(lon+.5+shift);if(right<0||left>canvas.width)continue;for(let lat=-85;lat<=85;lat++){const value=data.grid[x*181+lat+90];if(value<=0)continue;const top=py(lat+.5),bottom=py(lat-.5);if(bottom<0||top>canvas.height)continue;ctx.fillStyle=color(value);ctx.globalAlpha=.4+.6*value/100;ctx.fillRect(left,top,right-left,bottom-top)}}}
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Aurora image could not be created.')),'image/png'));
}
root.AuroraMap={parse,at,load,drawBlob,color,source};
})(typeof window!=='undefined'?window:globalThis);
