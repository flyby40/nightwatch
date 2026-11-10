/* Rendering only. Inputs and forecast selection are owned by app.js. */
(function(root){
'use strict';
let context,category='wide';
const $=id=>document.getElementById(id),escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function input(h,index){return {...h,index,seeing:h.cmc?.seeing?.data?.value??null,transparency:h.cmc?.transparency?.data?.value??null}}
function render(state,horizon,selected,format,onSelect){
 context={state,horizon,selected,format,onSelect};
 const hours=state.hours.slice(0,horizon).map(input),h=hours[selected],ratings=NightwatchImaging.analyze(h);
 $('imaging-time').textContent='Selected hour: '+format(h.date)+' · '+state.zone+' · '+state.name;
 const indexText=v=>Number.isInteger(v)&&v>=0&&v<=5?v+'/5 ('+NightwatchImaging.config.indexLabels[v]+')':'null (unavailable)';
 $('imaging-inputs').textContent='CMC seeing: '+indexText(h.seeing)+' · Transparency: '+indexText(h.transparency);
 const preferred=id=>{const p=NightwatchImaging.config.categories[id].preferred;return 'Preferred seeing '+p.seeing.join('–')+(p.seeingIdeal?' (ideally '+p.seeingIdeal+'+)':'')+' · transparency '+p.transparency.join('–');};
 $('imaging-cards').innerHTML=ratings.map(r=>'<article class="imaging-card imaging-'+r.band+'"><h3>'+escape(r.label)+'</h3><div class="imaging-rating">'+r.rating+(r.score===null?'':' <small>'+r.score+'/100*</small>')+'</div><p>'+escape(r.explanation)+'</p><p class="imaging-preferences">'+preferred(r.id)+'</p><small>Data coverage: '+(r.confidence==='complete'?'complete · heuristic rating':'incomplete · confidence insufficient')+'</small></article>').join('');
 const done=hours.filter(h=>h.cmc).length,complete=hours.filter(h=>NightwatchImaging.analyze(h)[0].score!==null).length;
 $('imaging-progress').textContent=(state.imagingRunning?'Analyzing CMC hourly forecasts… ':'')+done+'/'+horizon+' hours checked · '+complete+' with complete inputs. Missing hours are not ranked.';
 $('imaging-analyze').disabled=!!state.imagingRunning;$('imaging-cancel').hidden=!state.imagingRunning;
 const groups=NightwatchImaging.windows(hours,category);
 $('imaging-window-title').textContent='Most favorable dark samples · next '+horizon+' hours · '+NightwatchImaging.config.categories[category].label;
 $('imaging-windows').innerHTML=groups.length?groups.map(g=>'<li><button data-imaging-hour="'+g.indices[0]+'">'+escape(format(new Date(g.start)))+(g.end!==g.start?' through '+escape(format(new Date(g.end))):'')+'</button><span>'+g.scores.length+' hourly sample'+(g.scores.length===1?'':'s')+' · average '+g.average+'/100*</span></li>').join(''):'<li>No Fair or Good astronomical-dark samples with complete data in the selected '+horizon+'-hour forecast. Analyze the forecast, or try another category or time range.</li>';
 $('imaging-hours').innerHTML=hours.map((h,i)=>{const r=NightwatchImaging.analyze(h).find(r=>r.id===category);return '<button class="imaging-sample imaging-'+r.band+(i===selected?' selected':'')+'" data-imaging-hour="'+i+'" aria-pressed="'+(i===selected)+'"><span>'+escape(format(h.date))+'</span><strong>'+r.rating+'</strong><small>'+(r.score===null?'null · missing inputs':r.score+'/100*')+'</small><small>Seeing '+(h.seeing??'null')+' · Trans. '+(h.transparency??'null')+'</small></button>'}).join('');
}
$('imaging-category').onchange=e=>{category=e.target.value;if(context){const {state,horizon,selected,format,onSelect}=context;render(state,horizon,selected,format,onSelect)}};
$('imaging-panel').addEventListener('click',e=>{const button=e.target.closest('[data-imaging-hour]');if(button&&context)context.onSelect(Number(button.dataset.imagingHour))});
root.NightwatchImagingUI={render,input};
})(window);
