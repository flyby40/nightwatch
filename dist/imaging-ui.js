/* Rendering only. Inputs and forecast selection are owned by app.js. */
(function(root){
'use strict';
let context,category='wide';
const $=id=>document.getElementById(id),escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function input(h,index){return {...h,index,seeing:h.cmc?.seeing?.data?.value??null,transparency:h.cmc?.transparency?.data?.value??null}}
function render(state,horizon,selected,format,onSelect){
 context={state,horizon,selected,format,onSelect};
 const allHours=state.hours.slice(0,horizon).map(input),h=allHours[selected],hours=allHours.filter(NightwatchImaging.isNight),selectedDark=NightwatchImaging.isNight(h),ratings=selectedDark?NightwatchImaging.analyze(h):[];
 $('imaging-time').textContent='Selected hour: '+format(h.date)+' · '+state.zone+' · '+state.name;
 const indexText=v=>Number.isInteger(v)&&v>=0&&v<=5?v+'/5 ('+NightwatchImaging.config.indexLabels[v]+')':'null (unavailable)';
 $('imaging-inputs').textContent=selectedDark?'CMC seeing: '+indexText(h.seeing)+' · Transparency: '+indexText(h.transparency):hours.length?'The selected weather hour is Not observable in daylight. Choose a nighttime hour below to view imaging advice.':'No nighttime hours in the selected '+horizon+'-hour forecast. Try a longer forecast range.';
 const preferred=id=>{const p=NightwatchImaging.config.categories[id].preferred;return 'Preferred seeing '+p.seeing.join('–')+(p.seeingIdeal?' (ideally '+p.seeingIdeal+'+)':'')+' · transparency '+p.transparency.join('–');};
 $('imaging-cards').innerHTML=ratings.map(r=>'<article class="imaging-card imaging-'+r.band+'"><h3>'+escape(r.label)+'</h3><div class="imaging-rating">'+r.rating+(r.score===null?'':' <small>'+r.score+'/100*</small>')+'</div><p>'+escape(r.explanation)+'</p>'+(r.targetNote?'<p class="imaging-target-note">'+escape(r.targetNote)+'</p>':'')+'<p class="imaging-preferences">'+preferred(r.id)+'</p><small>Data coverage: '+(r.confidence==='ineligible'?'ineligible · '+escape(r.eligibility.reason):r.confidence==='complete'?'complete · heuristic rating':'incomplete · confidence insufficient')+'</small></article>').join('');
 const done=hours.filter(h=>h.cmc).length,complete=hours.filter(h=>NightwatchImaging.analyze(h)[0].score!==null).length;
 $('imaging-progress').textContent=(state.imagingRunning?'Analyzing CMC hourly forecasts… ':'')+done+'/'+hours.length+' nighttime hours checked in the next '+horizon+' hours · '+complete+' with complete inputs. Missing hours are not ranked.';
 $('imaging-analyze').disabled=!!state.imagingRunning||!hours.length;$('imaging-analyze').textContent='Analyze nighttime hours · next '+horizon+' hours';$('imaging-cancel').hidden=!state.imagingRunning;
 const targetNote=NightwatchImaging.config.categories[category].targetNote;
 $('imaging-target-note').textContent=targetNote||'';$('imaging-target-note').hidden=!targetNote;
 const groups=NightwatchImaging.windows(hours,category);
 $('imaging-window-title').textContent='Most favorable nighttime samples · next '+horizon+' hours · '+NightwatchImaging.config.categories[category].label;
 $('imaging-windows').innerHTML=groups.length?groups.map(g=>'<li><button data-imaging-hour="'+g.indices[0]+'">'+escape(format(new Date(g.start)))+(g.end!==g.start?' through '+escape(format(new Date(g.end))):'')+'</button><span>'+g.scores.length+' hourly sample'+(g.scores.length===1?'':'s')+' · average '+g.average+'/100*</span></li>').join(''):'<li>No Fair or Good nighttime samples with complete data in the selected '+horizon+'-hour forecast. Analyze the forecast, or try another category or time range.</li>';
 $('imaging-hours').innerHTML=hours.length?hours.map(h=>{const r=NightwatchImaging.analyze(h).find(r=>r.id===category);return '<button class="imaging-sample imaging-'+r.band+(h.index===selected?' selected':'')+'" data-imaging-hour="'+h.index+'" aria-pressed="'+(h.index===selected)+'"><span>'+escape(format(h.date))+'</span><strong>'+r.rating+'</strong><small>'+(r.score===null?(r.eligibility.eligible===false?r.eligibility.reason:'Incomplete weather data'):r.score+'/100*')+'</small><small>Seeing '+(h.seeing??'null')+' · Trans. '+(h.transparency??'null')+'</small></button>'}).join(''):'<p class="imaging-note">No nighttime imaging periods in this forecast range.</p>';
}
$('imaging-category').onchange=e=>{category=e.target.value;if(context){const {state,horizon,selected,format,onSelect}=context;render(state,horizon,selected,format,onSelect)}};
$('imaging-panel').addEventListener('click',e=>{const button=e.target.closest('[data-imaging-hour]');if(button&&context)context.onSelect(Number(button.dataset.imagingHour))});
root.NightwatchImagingUI={render,input};
})(window);
