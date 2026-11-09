/* Local sky readings and requests to our server-side DarkSkySites proxy. */
(function(root){
'use strict';
const key=(lat,lon)=>'nightwatch-sky:'+lat.toFixed(6)+','+lon.toFixed(6);
function parse(bortleText,sqmText){
 const b=String(bortleText??'').trim(),s=String(sqmText??'').trim();
 const bortle=b===''?null:Number(b),sqm=s===''?null:Number(s);
 if(bortle!==null&&(!Number.isInteger(bortle)||bortle<1||bortle>9))throw Error('Bortle class must be a whole number from 1 to 9, or blank.');
 if(sqm!==null&&(!Number.isFinite(sqm)||sqm<0||sqm>30))throw Error('Sky brightness must be between 0 and 30 mag/arcsec², or blank.');
 return {bortle,sqm};
}
function read(lat,lon){try{const data=JSON.parse(localStorage.getItem(key(lat,lon)));if(!data)return {bortle:null,sqm:null};return parse(data.bortle,data.sqm)}catch{return {bortle:null,sqm:null}}}
function save(lat,lon,b,s){const data=parse(b,s);localStorage.setItem(key(lat,lon),JSON.stringify(data));return data}
function clear(lat,lon){localStorage.removeItem(key(lat,lon))}
let configPromise;const lookups=new Map();
async function config(){if(!configPromise)configPromise=(async()=>{const response=await fetch(new URL('config.json',document.baseURI),{cache:'no-cache',signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error('Sky lookup configuration is unavailable.');const data=await response.json();if(data.darkSkyApi===null||data.darkSkyApi==='')return null;const url=new URL(data.darkSkyApi);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/api/sky')throw Error('Sky lookup endpoint is invalid.');return url.href})();return configPromise}
async function lookup(lat,lon){const endpoint=await config();if(!endpoint)return {configured:false,data:null,message:'Automatic lookup is not connected yet. Add known readings or use the map.'};const location=lat+','+lon;const cached=lookups.get(location);if(cached&&Date.now()-cached.created<86400000)return cached.promise;const promise=(async()=>{const url=new URL(endpoint);url.search=new URLSearchParams({lat:String(lat),lng:String(lon)}).toString();const response=await fetch(url,{signal:AbortSignal.timeout(22000),credentials:'omit'});const data=await response.json();if(!response.ok)throw Error(typeof data.error==='string'?data.error:'DarkSkySites lookup is unavailable.');if(data.attribution!=='DarkSkySites.com'||typeof data.latitude!=='number'||typeof data.longitude!=='number'||Math.abs(data.latitude-lat)>0.00001||Math.abs(data.longitude-lon)>0.00001)throw Error('Sky lookup returned invalid location data.');if(data.quality?.status!=='screened'){data.sqm=null;data.bortleClass=null;}if(typeof data.sqm!=='number'||!Number.isFinite(data.sqm)||data.sqm<0||data.sqm>30)data.sqm=null;if(!Number.isInteger(data.bortleClass)||data.bortleClass<1||data.bortleClass>9)data.bortleClass=null;return {configured:true,data,message:null}})();lookups.set(location,{promise,created:Date.now()});promise.catch(()=>lookups.delete(location));if(lookups.size>50)lookups.delete(lookups.keys().next().value);return promise}
root.LocalSky={key,parse,read,save,clear,lookup,mapURL:(lat,lon)=>'https://lightpollutionmap.app/?'+new URLSearchParams({lat:String(lat),lng:String(lon),zoom:'11'})};
})(typeof window!=='undefined'?window:globalThis);
