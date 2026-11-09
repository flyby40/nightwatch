/* Known local sky readings; no inferred Bortle/SQM conversion or automatic API. */
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
root.LocalSky={key,parse,read,save,clear,mapURL:(lat,lon)=>'https://lightpollutionmap.app/?'+new URLSearchParams({lat:String(lat),lng:String(lon),zoom:'11'})};
})(typeof window!=='undefined'?window:globalThis);
