/* Unit conversion and disclosed condensation screening; canonical inputs are °C. */
(function(root){
'use strict';
const valid=v=>typeof v==='number'&&Number.isFinite(v);
function preference(saved){return saved==='metric'?'metric':'imperial'}
function temperature(c,units){return valid(c)?units==='imperial'?c*9/5+32:c:null}
function wind(kmh,units){return valid(kmh)?units==='imperial'?kmh/1.609344:kmh:null}
function precipitation(mm,units){return valid(mm)&&mm>=0?units==='imperial'?mm/25.4:mm:null}
function condensation(h){
 if(!h||![h.temp,h.dew,h.humidity].every(valid)||h.humidity<0||h.humidity>100)return {available:false,kind:null};
 const moist=h.humidity>=85||h.temp-h.dew<=3;
 return {available:true,kind:moist?(h.temp<=3?'frost':'dew'):null};
}
function badge(h){const r=condensation(h);return r.kind?'<span class="condensation-flag '+r.kind+'">'+(r.kind==='frost'?'❄ Frost':'● Dew')+' possible*</span>':''}
function legend(field,units){
 // Axis limits and bar extents for the provider's stable LINEAR styles.
 // Only labels are converted; the forecast raster and provider colors stay unchanged.
 const imperial=units==='imperial';
 const spec=field==='temperature'?{unit:imperial?'°F':'°C',native:[40,30,20,10,0,-10,-20,-30,-40],width:107,height:405,crop:{x:10,y:29,w:35,h:350}}:field==='wind'?{unit:imperial?'mph':'km/h',native:[110,100,80,60,40,20,0],width:111,height:413,crop:{x:10,y:29,w:35,h:366}}:field==='precipitation'?{unit:imperial?'in':'mm',native:[100,75,60,50,40,30,25,20,15,10,7.5,5,2.5,1,.5,.25,.1],width:115,height:413,crop:{x:10,y:29,w:35,h:366},categorical:true}:null;
 if(!spec)return null;
 const high=spec.native[0],low=spec.native.at(-1);
 return {...spec,ticks:spec.native.map((n,i)=>({native:n,position:spec.categorical?i/(spec.native.length-1)*100:(high-n)/(high-low)*100,value:field==='temperature'?temperature(n,units):field==='wind'?wind(n,units):precipitation(n,units),edge:i===0?'≥':i===spec.native.length-1&&field==='temperature'?'≤':''}))};
}
root.NightwatchWeather={preference,temperature,wind,precipitation,condensation,badge,legend};
})(typeof window!=='undefined'?window:globalThis);
