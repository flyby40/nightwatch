/* Leaflet + public ECCC GeoMet imagery. Observations and forecasts stay separate. */
(function (root) {
'use strict';
const endpoint = 'https://geo.weather.gc.ca/geomet/';
const names = { forecast: 'RDPS_10km_TotalCloudCover', east: 'GOES-East_2km_NightIR', west: 'GOES-West_2km_NightIR' };
const $ = id => document.getElementById(id);
const metadata = new Map(), images = new Map();
let map, marker, overlay, overlayURL, pending = 0, timer, playTimer, playing = false, context, mode = 'satellite', frameIndex = -1, satelliteMeta, recent = [], observer, visible = false, refreshTimer;
function interval(text, defaultTime, reference = null) {
  const [startText, endText, duration] = text.trim().split('/');
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?$/.exec(duration || '');
  const start = Date.parse(startText), end = Date.parse(endText), latest = Date.parse(defaultTime);
  const step = match ? (Number(match[1] || 0) * 60 + Number(match[2] || 0)) * 60000 : NaN;
  if (![start, end, latest, step].every(Number.isFinite) || step <= 0 || end < start || latest < start || latest > end || (latest - start) % step !== 0) throw Error('Provider time metadata is unavailable.');
  return { start, end, step, latest, reference };
}
function exactTime(meta, date) { const t = +date; return Number.isFinite(t) && t >= meta.start && t <= meta.end && (t - meta.start) % meta.step === 0; }
function recentTimes(meta, count = 6) { const out = []; for (let t = meta.latest; t >= meta.start && out.length < count; t -= meta.step) out.unshift(t); return out; }
function satelliteFor(lon) { const distance = center => Math.abs(((lon - center + 540) % 360) - 180); return distance(-137) < distance(-75) ? names.west : names.east; }
function iso(t) { return new Date(t).toISOString().replace('.000Z', 'Z'); }
function time(t) { return new Intl.DateTimeFormat('en-US', { timeZone: context?.zone || 'UTC', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(t)); }
function base(params) { return endpoint + '?' + new URLSearchParams({ SERVICE: 'WMS', VERSION: '1.3.0', ...params }); }
async function getMetadata(layer, force = false) {
  const entry = metadata.get(layer), maxAge = layer === names.forecast ? 1800000 : 120000;
  if (!force && entry && Date.now() - entry.created < maxAge) return entry.promise;
  const promise = (async () => {
    const response = await fetch(base({ REQUEST: 'GetCapabilities', LAYERS: layer }), { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw Error('Cloud map service is unavailable.');
    const doc = new DOMParser().parseFromString(await response.text(), 'application/xml');
    if (doc.querySelector('parsererror')) throw Error('Invalid cloud map metadata.');
    const node = Array.from(doc.getElementsByTagNameNS('*', 'Layer')).find(n => Array.from(n.children).some(c => c.localName === 'Name' && c.textContent === layer));
    if (!node) throw Error('Cloud map layer is unavailable.');
    const dims = Array.from(node.children).filter(n => n.localName === 'Dimension');
    const times = dims.find(n => n.getAttribute('name') === 'time');
    const reference = dims.find(n => n.getAttribute('name') === 'reference_time')?.getAttribute('default') || null;
    if (!times || (layer === names.forecast && !Number.isFinite(Date.parse(reference)))) throw Error('Forecast run or image times are unavailable.');
    return { ...interval(times.textContent, times.getAttribute('default'), reference), layer };
  })();
  metadata.set(layer, { promise, created: Date.now() });
  promise.catch(() => { if (metadata.get(layer)?.promise === promise) metadata.delete(layer); });
  return promise;
}
function imageRequest(layer, valid, reference, extent, size) {
  const params = { REQUEST: 'GetMap', LAYERS: layer, STYLES: layer === names.forecast ? 'CLOUD' : '', CRS: 'EPSG:3857', BBOX: extent.join(','), WIDTH: String(size.x), HEIGHT: String(size.y), FORMAT: 'image/png', TRANSPARENT: 'TRUE', TIME: iso(valid) };
  if (reference) params.DIM_REFERENCE_TIME = reference;
  return base(params);
}
function clearOverlay() { if (overlay && map) map.removeLayer(overlay); overlay = null; if (overlayURL) URL.revokeObjectURL(overlayURL); overlayURL = null; }
function stop() { playing = false; clearTimeout(playTimer); if ($('map-play')) { $('map-play').textContent = '▶ Animate recent images'; $('map-play').setAttribute('aria-pressed', 'false'); } }
function message(value) { if ($('map-status').textContent !== value) $('map-status').textContent = value; }
function setTimeControls() {
  const sat = mode === 'satellite';
  $('satellite-controls').hidden = !sat;
  $('map-play').disabled = !sat || recent.length < 2;
  $('map-frame').disabled = !sat || !recent.length;
  $('map-frame').max = String(Math.max(0, recent.length - 1));
  $('map-frame').value = String(Math.max(0, frameIndex));
  $('map-legend').hidden = mode !== 'forecast';
}
function viewport() {
  const bounds = map.getBounds(), limit = 20037508.342789244;
  const a = root.L.CRS.EPSG3857.project(bounds.getSouthWest()), b = root.L.CRS.EPSG3857.project(bounds.getNorthEast());
  const extent = [Math.max(-limit, a.x), Math.max(-limit, a.y), Math.min(limit, b.x), Math.min(limit, b.y)];
  if (extent[0] >= extent[2] || extent[1] >= extent[3]) throw Error('Pan the map back to the selected location.');
  const imageBounds = root.L.latLngBounds(root.L.CRS.EPSG3857.unproject(root.L.point(extent[0], extent[1])), root.L.CRS.EPSG3857.unproject(root.L.point(extent[2], extent[3])));
  const pixels = map.getSize(), scale = Math.min(1, 1024 / pixels.x, 600 / pixels.y);
  return { extent, bounds: imageBounds, size: { x: Math.max(1, Math.round(pixels.x * scale)), y: Math.max(1, Math.round(pixels.y * scale)) } };
}
async function imageBlob(url) {
  if (images.has(url)) return images.get(url);
  const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
  if (!response.ok || !response.headers.get('Content-Type')?.toLowerCase().startsWith('image/png')) throw Error('Cloud imagery is unavailable for this frame.');
  const blob = await response.blob(); if (!blob.size) throw Error('Cloud image is empty.');
  images.set(url, blob); if (images.size > 12) images.delete(images.keys().next().value);
  return blob;
}
async function paint(force = false) {
  if (!map || !context) return false;
  const token = ++pending;
  if (mode === 'none') { clearOverlay(); $('map-time').textContent = 'Location map · cloud overlay off'; message('Location marker follows your selected forecast location.'); setTimeControls(); return true; }
  if (!playing) message('Loading ' + (mode === 'forecast' ? 'CMC forecast clouds…' : 'satellite imagery…'));
  $('map-time').textContent = 'Loading timestamped imagery…';
  try {
    const requestedMode = mode;
    const meta = await getMetadata(mode === 'forecast' ? names.forecast : satelliteFor(context.lon), force);
    if (token !== pending) return false;
    let valid;
    if (mode === 'forecast') {
      valid = +context.date;
      if (!exactTime(meta, valid)) throw Error('CMC cloud forecast is null for this exact hour; no replacement frame is used.');
    } else {
      satelliteMeta = meta; recent = recentTimes(meta);
      if (force || frameIndex < 0 || frameIndex >= recent.length) frameIndex = recent.length - 1;
      valid = recent[frameIndex];
    }
    setTimeControls();
    const view = viewport(), url = imageRequest(meta.layer, valid, meta.reference, view.extent, view.size);
    const blob = await imageBlob(url);
    if (token !== pending || requestedMode !== mode) return false;
    const objectURL = URL.createObjectURL(blob);
    const next = root.L.imageOverlay(objectURL, view.bounds, { opacity: Number($('map-opacity').value) / 100, interactive: false });
    try { await new Promise((resolve, reject) => { next.once('load', resolve); next.once('error', () => reject(Error('The cloud image could not be displayed.'))); next.addTo(map); }); }
    catch (error) { map.removeLayer(next); URL.revokeObjectURL(objectURL); throw error; }
    if (token !== pending) { map.removeLayer(next); URL.revokeObjectURL(objectURL); return false; }
    clearOverlay(); overlay = next; overlayURL = objectURL;
    if (mode === 'forecast') {
      $('map-time').textContent = 'FORECAST · Valid ' + time(valid) + ' · CMC model run ' + time(meta.reference);
      $('map-legend-image').src = base({ REQUEST: 'GetLegendGraphic', LAYER: names.forecast, STYLE: 'CLOUD', FORMAT: 'image/png', SLD_VERSION: '1.1.0' });
      message('CMC RDPS total cloud cover · ~10 km model grid · follows the selected chart hour. Blank areas can mean no coverage; they do not confirm clear skies.');
    } else {
      const stale = Date.now() - valid > 7200000;
      $('map-time').textContent = 'OBSERVED IR · Captured ' + time(valid) + (stale ? ' · Older imagery: over 2 hours old' : '') + ' · Frame ' + (frameIndex + 1) + '/' + recent.length;
      message((meta.layer.includes('West') ? 'GOES-West' : 'GOES-East') + ' infrared imagery via ECCC · thermal patterns, not a cloud-cover percentage. Processing delay and satellite coverage apply. Blank areas are not confirmed clear sky.');
    }
    return true;
  } catch (error) {
    if (token === pending) { clearOverlay(); stop(); $('map-time').textContent = 'Cloud overlay: null'; message(error.message + ' The location map remains available.'); }
    return false;
  }
}
async function animate() {
  if (!playing || mode !== 'satellite' || document.hidden) { stop(); return; }
  frameIndex = (frameIndex + 1) % recent.length;
  const ok = await paint();
  if (ok && playing) playTimer = setTimeout(animate, 1000); else stop();
}
function schedule() { clearTimeout(timer); timer = setTimeout(() => paint(), 350); }
function init() {
  if (map || !context) return;
  if (!root.L) { message('The map library could not load. Refresh to try again; other forecasts remain available.'); return; }
  map = root.L.map('cloud-map', { scrollWheelZoom: false, minZoom: 2, maxZoom: 12, maxBounds: [[-85.0511, -180], [85.0511, 180]], maxBoundsViscosity: 1 });
  root.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 12, noWrap: true, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).on('tileerror', () => { $('map-basemap-status').textContent = 'Some base-map tiles could not load; use recenter or refresh.'; }).addTo(map);
  map.attributionControl.addAttribution('<a href="https://weather.gc.ca/astro/index_e.html">ECCC/CMC</a> · <a href="https://www.star.nesdis.noaa.gov/GOES/">NOAA GOES</a>');
  root.L.control.scale({ imperial: true, metric: true }).addTo(map);
  $('map-layer').onchange = () => { stop(); mode = $('map-layer').value; frameIndex = -1; clearOverlay(); setTimeControls(); paint(); };
  $('map-opacity').oninput = () => { $('map-opacity-value').textContent = $('map-opacity').value + '%'; overlay?.setOpacity(Number($('map-opacity').value) / 100); };
  $('map-center').onclick = () => { map.setView([Math.max(-85, Math.min(85, context.lat)), context.lon], 7); schedule(); };
  $('map-refresh').onclick = () => { stop(); frameIndex = -1; images.clear(); $('map-basemap-status').textContent = ''; paint(true); };
  $('map-frame').oninput = () => { stop(); frameIndex = Number($('map-frame').value); schedule(); };
  $('map-play').onclick = () => { if (playing) stop(); else if (recent.length > 1) { playing = true; $('map-play').textContent = 'Ⅱ Pause animation'; $('map-play').setAttribute('aria-pressed', 'true'); animate(); } };
  map.on('movestart', stop); map.on('moveend', schedule); map.on('resize', schedule);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  refreshTimer = setInterval(() => { if (visible && !document.hidden && mode === 'satellite' && !playing) { frameIndex = -1; paint(true); } }, 600000);
  locate(); setTimeControls(); paint();
}
function locate() {
  if (!map || !context) return;
  if (marker) map.removeLayer(marker);
  if (Math.abs(context.lat) <= 85.0511) {
    const label = document.createElement('span'); label.textContent = context.name + ' · ' + context.lat.toFixed(4) + ', ' + context.lon.toFixed(4);
    marker = root.L.circleMarker([context.lat, context.lon], { radius: 8, color: '#14221b', weight: 3, fillColor: '#c2e8aa', fillOpacity: 1 }).bindTooltip(label, { direction: 'top' }).addTo(map);
  } else { marker = null; message('This map projection cannot display the selected polar location.'); }
  map.setView([Math.max(-85, Math.min(85, context.lat)), context.lon], 7, { animate: false });
}
function update(next) {
  if (!next || ![next.lat, next.lon].every(Number.isFinite)) return;
  const moved = !context || context.lat !== next.lat || context.lon !== next.lon;
  const changedHour = !context || +context.date !== +next.date;
  context = { ...next, date: new Date(next.date) };
  $('map-location').textContent = next.name + ' · ' + next.lat.toFixed(4) + ', ' + next.lon.toFixed(4);
  if (!map) {
    if (!observer && 'IntersectionObserver' in root) { observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; if (visible) init(); else stop(); }, { rootMargin: '200px' }); observer.observe($('cloud-map-panel')); }
    else if (!('IntersectionObserver' in root)) { visible = true; init(); }
    return;
  }
  if (moved) { stop(); pending++; frameIndex = -1; clearOverlay(); locate(); schedule(); }
  else if (changedHour && mode === 'forecast') { stop(); schedule(); }
}
root.NightwatchMap = { update, interval, exactTime, recentTimes, satelliteFor, imageRequest };
})(typeof window !== 'undefined' ? window : globalThis);
