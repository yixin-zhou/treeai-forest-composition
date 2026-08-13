const q = selector => document.querySelector(selector);

const SPECIES = [
  { key: 'spruce', modelId: 0, rasterValue: 1, name: 'Spruce', scientificName: 'Picea spp.', colour: '#1f5fbf' },
  { key: 'fir', modelId: 1, rasterValue: 2, name: 'Fir', scientificName: 'Abies alba', colour: '#7fd0ff' },
  { key: 'pine', modelId: 2, rasterValue: 3, name: 'Pine', scientificName: 'Pinus spp.', colour: '#00b894' },
  { key: 'larch', modelId: 3, rasterValue: 4, name: 'Larch', scientificName: 'Larix spp.', colour: '#7ee000' },
  { key: 'arollaPine', modelId: 4, rasterValue: 5, name: 'Arolla pine', scientificName: 'Pinus cembra', colour: '#4d8f83' },
  { key: 'beech', modelId: 5, rasterValue: 6, name: 'Beech', scientificName: 'Fagus sylvatica', colour: '#e05c00' },
  { key: 'maple', modelId: 6, rasterValue: 7, name: 'Maple', scientificName: 'Acer spp.', colour: '#ffd21f' },
  { key: 'ash', modelId: 7, rasterValue: 8, name: 'Ash', scientificName: 'Fraxinus spp.', colour: '#7b3fd4' },
  { key: 'oak', modelId: 8, rasterValue: 9, name: 'Oak', scientificName: 'Quercus spp.', colour: '#a35a00' },
  { key: 'chestnut', modelId: 9, rasterValue: 10, name: 'Chestnut', scientificName: 'Castanea sativa', colour: '#8c1d33' },
  { key: 'other', modelId: 10, rasterValue: 11, name: 'Other', scientificName: 'Other retained taxa', colour: '#76685d' }
];
const speciesLabel = species => species.name;
const PROBABILITY_NAMES = { broadleaf: 'Broadleaf basal-area proportion', ...Object.fromEntries(SPECIES.map(species => [species.key, `${speciesLabel(species)} basal-area proportion`])) };
const COLOUR_SCALES = {
  forest: ['#f3f0dd', '#c8ddb9', '#75ad7b', '#2d7458', '#0f3d30'],
  viridis: ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725'],
  cividis: ['#00204c', '#414487', '#7e7c78', '#b8b967', '#fee838'],
  blues: ['#f7fbff', '#c6dbef', '#6baed6', '#2171b5', '#08306b']
};
const SERVICES = window.SWISS_FOREST_ARCGIS_SERVICES || {};
const DOMINANT_URL = SERVICES.dominant;
const PROBABILITY_URLS = SERVICES.probabilities || {};
const CANTON_STATISTICS_URL = SERVICES.cantonStatistics;

let mapElement; let swissImageLayer; let dominantLayer; let probabilityLayer;
let ImageryTileLayer; let FeatureLayer; let MultipartColorRamp; let AlgorithmicColorRamp; let WebTileLayer; let Map; let MapView; let Graphic; let geometryEngine; let reactiveUtils;
let compareLeftMap; let compareRightMap; let compareLeftView; let compareRightView; let compareReady = false; let compareModeActive = false; let compareSyncing = false;
let activeMode = 'dominant'; let speciesKey = 'spruce'; let refreshTimer;
let inspectionLayers = {}; let inspectionRequestId = 0; let inspectionGraphic;
let inspectActive = false; let popupPoint = null; let popupWatcher; let inspectTarget = null;
let probabilityAboveDominant = true;
let compositionChart;
let statisticsChart; let statisticsData; let cantonStatisticsLayer; let cantonFeatures = []; let cantonSelectionGraphic; let nationalBoundaryGraphic;
let downloadBusy = false;

const COMPARE_LAYERS = [
  { key: 'none', label: 'Base map only' },
  { key: 'dominant', label: 'Dominant tree group' },
  { key: 'broadleaf', label: 'Broadleaf basal-area proportion' },
  ...SPECIES.map(species => ({ key: species.key, label: `${speciesLabel(species)} basal-area proportion` }))
];

function fail(message) { const box = q('#error'); box.textContent = message; box.hidden = false; }
function setStatus(message) { const target = q('#service-status'); if (target) target.textContent = message; }

function setPanel(panelName, forceOpen) {
  const panel = q('#settings-panel');
  const shouldOpen = forceOpen ?? !panel.classList.contains('open');
  panel.classList.toggle('open', shouldOpen);
  panel.setAttribute('aria-hidden', String(!shouldOpen));
  q('#settings-toggle').setAttribute('aria-expanded', String(shouldOpen));
  document.body.classList.toggle('panel-open', shouldOpen);
}

function closePanels() {
  q('#settings-panel').classList.remove('open');
  q('#settings-panel').setAttribute('aria-hidden', 'true');
  q('#settings-toggle').setAttribute('aria-expanded', 'false');
  document.body.classList.remove('panel-open');
}

function closeStatistics() {
  q('#statistics-panel').classList.remove('open');
  q('#statistics-panel').setAttribute('aria-hidden', 'true');
  q('#stats-toggle').setAttribute('aria-expanded', 'false');
  if (mapElement?.view) mapElement.view.padding = { right: 0 };
}

function closeDownload() {
  q('#download-panel').classList.remove('open');
  q('#download-panel').setAttribute('aria-hidden', 'true');
  q('#download-toggle').setAttribute('aria-expanded', 'false');
  if (mapElement?.view && !q('#statistics-panel').classList.contains('open')) mapElement.view.padding = { right: 0 };
}

function selectedProducts() { return [...document.querySelectorAll('input[name="product"]:checked')].map(input => input.value); }

function updateDownloadControls() {
  const products = document.querySelectorAll('input[name="product"]');
  const selected = selectedProducts();
  q('#download-all').checked = selected.length === products.length;
  q('#download-all').indeterminate = selected.length > 0 && selected.length < products.length;
  q('#download-selected').disabled = !selected.length || downloadBusy;
  q('#download-selected').textContent = selected.length ? `Download ${selected.length} selected product${selected.length === 1 ? '' : 's'}` : 'Download selected products';
}

function triggerDownload(url, filename) {
  const link = document.createElement('a');
  link.href = url; link.download = filename; link.target = '_blank'; link.rel = 'noopener';
  document.body.append(link); link.click(); link.remove();
}

async function downloadCantonStatistics() {
  const params = new URLSearchParams({ where: '1=1', outFields: '*', returnGeometry: 'true', f: 'geojson' });
  const response = await fetch(`${CANTON_STATISTICS_URL}/query?${params}`);
  if (!response.ok) throw new Error('Canton statistics could not be prepared.');
  const data = await response.json();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/geo+json' });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, 'swiss_forest_canton_statistics.geojson');
  window.setTimeout(() => URL.revokeObjectURL(url), 5_000);
}

async function requestTilePackage(key, label) {
  const serviceUrl = key === 'dominant' ? DOMINANT_URL : PROBABILITY_URLS[key];
  if (!serviceUrl) throw new Error(`${label} is not available.`);
  const serviceInfo = await fetch(`${serviceUrl}?f=json`).then(response => response.json());
  const levels = serviceInfo.tileInfo?.lods?.map(level => level.level).join(',');
  if (!levels) throw new Error(`${label} does not expose downloadable tile levels.`);
  const params = new URLSearchParams({ levels, exportBy: 'LevelID', tilePackage: 'true', async: 'true', storageFormat: 'CompactV2', f: 'json' });
  const submission = await fetch(`${serviceUrl}/exportTiles`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params }).then(response => response.json());
  if (submission.error) throw new Error(submission.error.message || `${label} could not be submitted.`);
  if (!submission.jobId) throw new Error(`${label} did not return an export job.`);
  return { serviceUrl, jobId: submission.jobId, label };
}

async function waitForTilePackage({ serviceUrl, jobId, label }) {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    await new Promise(resolve => window.setTimeout(resolve, 2_000));
    const status = await fetch(`${serviceUrl}/jobs/${jobId}?f=json`).then(response => response.json());
    if (status.jobStatus === 'esriJobSucceeded') {
      const result = Object.values(status.results || {})[0];
      if (!result?.paramUrl) throw new Error(`${label} was prepared, but its download address was not returned.`);
      const output = await fetch(`${serviceUrl}/jobs/${jobId}/${result.paramUrl}?f=json`).then(response => response.json());
      const url = typeof output.value === 'string' ? output.value : output.value?.url;
      if (!url) throw new Error(`${label} was prepared, but its package URL was not returned.`);
      triggerDownload(url, `${label.toLowerCase().replaceAll(' ', '_')}.tpkx`);
      return;
    }
    if (status.jobStatus === 'esriJobFailed' || status.jobStatus === 'esriJobCancelled') throw new Error(`${label} could not be packaged by ArcGIS.`);
  }
  throw new Error(`${label} is still being packaged. Please try again shortly.`);
}

async function downloadSelectedProducts() {
  const products = selectedProducts();
  if (!products.length || downloadBusy) return;
  downloadBusy = true; updateDownloadControls();
  const status = q('#download-status');
  try {
    const tileProducts = products.filter(key => key !== 'cantonStatistics');
    if (products.includes('cantonStatistics')) {
      status.textContent = 'Downloading canton statistics…';
      await downloadCantonStatistics();
    }
    const jobs = [];
    for (const key of tileProducts) {
      const label = key === 'dominant' ? 'Dominant Species' : PROBABILITY_NAMES[key];
      status.textContent = `Preparing ${jobs.length + 1} of ${tileProducts.length} raster products…`;
      jobs.push(await requestTilePackage(key, label));
    }
    for (let index = 0; index < jobs.length; index += 1) {
      status.textContent = `ArcGIS is packaging ${index + 1} of ${jobs.length} raster products…`;
      await waitForTilePackage(jobs[index]);
    }
    status.textContent = 'Your selected downloads have started.';
  } catch (error) {
    console.error(error);
    status.textContent = `Download could not be completed: ${error.message}`;
  } finally {
    downloadBusy = false; updateDownloadControls();
  }
}

function openDownload() {
  exitCompare(); closePanels(); closeStatistics();
  q('#download-panel').classList.add('open'); q('#download-panel').setAttribute('aria-hidden', 'false'); q('#download-toggle').setAttribute('aria-expanded', 'true');
  mapElement.view.padding = { right: q('#download-panel').offsetWidth };
  updateDownloadControls();
}

function statsKey(name) { return `ba_${name.toLowerCase().replaceAll(' ', '_')}`; }

function statisticRecord(feature) {
  if (!feature) return statisticsData.national;
  const attributes = feature.attributes;
  const values = Object.fromEntries(SPECIES.map(species => [species.name, Number(attributes[statsKey(species.name)])]));
  return {
    forest_pixels: Math.round(Number(attributes.forest_km2) * 1_000_000 / 900), modelled_area_km2: Number(attributes.forest_km2),
    mean_basal_area_percent: values, broadleaf_basal_area_percent: Number(attributes.broadleaf),
    leading_group: attributes.lead_group, leading_group_basal_area_percent: Number(attributes.lead_ba_pct), top_two_gap_percentage_points: Number(attributes.top2_gap_pp)
  };
}

function renderStatistics(record) {
  q('#stats-area').textContent = `${record.modelled_area_km2.toLocaleString(undefined, { maximumFractionDigits: 0 })} km²`;
  q('#stats-broadleaf').textContent = `${record.broadleaf_basal_area_percent.toFixed(1)}%`;
  q('#stats-leading').textContent = record.leading_group;
  q('#stats-leading-value').textContent = `${record.leading_group_basal_area_percent.toFixed(1)}% basal-area proportion`;
  if (!window.echarts) return;
  statisticsChart ??= window.echarts.init(q('#statistics-chart'), null, { renderer: 'svg' });
  const ranked = SPECIES.map(species => ({ ...species, value: record.mean_basal_area_percent[species.name] })).sort((a, b) => b.value - a.value);
  statisticsChart.setOption({
    animationDuration: 420, animationEasing: 'cubicOut', animationDelay: index => index * 24,
    grid: { left: 102, right: 40, top: 10, bottom: 22 },
    xAxis: { type: 'value', min: 0, max: 100, axisLabel: { color: '#75817b', fontFamily: 'DM Mono', fontSize: 10, formatter: value => `${value}%` }, axisLine: { lineStyle: { color: '#d9e1dd' } }, axisTick: { show: false }, splitLine: { lineStyle: { color: '#edf1ef', type: 'dashed' } } },
    yAxis: { type: 'category', inverse: true, data: ranked.map(item => item.name), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#43524b', fontFamily: 'DM Sans', fontSize: 12, fontWeight: 500 } },
    series: [{ type: 'bar', barWidth: 13, data: ranked.map(item => ({ value: item.value, itemStyle: { color: item.colour, borderRadius: [0, 2, 2, 0] } })), label: { show: true, position: 'right', color: '#314139', fontFamily: 'DM Mono', fontSize: 10, formatter: p => `${p.value.toFixed(1)}%` } }]
  }, { notMerge: true });
  requestAnimationFrame(() => statisticsChart.resize());
}

async function selectCanton(code) {
  const feature = cantonFeatures.find(item => item.attributes.code === code);
  renderStatistics(statisticRecord(feature));
  if (!feature) {
    if (cantonSelectionGraphic) { mapElement.view.graphics.remove(cantonSelectionGraphic); cantonSelectionGraphic = null; }
    return;
  }
  if (cantonSelectionGraphic) mapElement.view.graphics.remove(cantonSelectionGraphic);
  cantonSelectionGraphic = new Graphic({ geometry: feature.geometry, symbol: { type: 'simple-fill', color: [44, 105, 86, 0.08], outline: { color: '#173c32', width: 2 } } });
  mapElement.view.graphics.add(cantonSelectionGraphic);
  await mapElement.view.goTo(feature.geometry.extent.expand(1.22), { duration: 700, easing: 'ease-out' });
}

async function openStatistics() {
  exitCompare(); closePanels(); closeDownload();
  q('#statistics-panel').classList.add('open'); q('#statistics-panel').setAttribute('aria-hidden', 'false'); q('#stats-toggle').setAttribute('aria-expanded', 'true');
  mapElement.view.padding = { right: q('#statistics-panel').offsetWidth };
  if (!statisticsData) {
    const data = await fetch('./data/statistics.json').then(response => response.json());
    statisticsData = data;
    const result = await cantonStatisticsLayer.queryFeatures({ where: '1=1', outFields: ['*'], returnGeometry: true, orderByFields: ['canton_no'] });
    cantonFeatures = result.features;
    q('#canton-select').insertAdjacentHTML('beforeend', cantonFeatures.map(feature => `<option value="${feature.attributes.code}">${feature.attributes.canton}</option>`).join(''));
  }
  q('#canton-select').value = 'national'; renderStatistics(statisticsData.national);
}

function categoricalRenderer() {
  return { type: 'raster-colormap', colormapInfos: SPECIES.map(species => ({ value: species.rasterValue, color: species.colour, label: speciesLabel(species) })) };
}

function createLightBaseLayer() {
  // CARTO Voyager: same tile grid as Positron/light_all but denser and a shade darker.
  // Swap the style segment to change basemap: light_all | rastertiles/voyager | dark_all | light_nolabels
  return new WebTileLayer({ title: 'Light basemap', urlTemplate: 'https://basemaps.cartocdn.com/rastertiles/voyager/{level}/{col}/{row}.png', copyright: '© OpenStreetMap contributors © CARTO' });
}

function createSwissimageBaseLayer() {
  return new WebTileLayer({ title: 'swisstopo Swissimage', urlTemplate: 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{level}/{col}/{row}.jpeg', fullExtent: { xmin: 657850, ymin: 5743135, xmax: 1174424, ymax: 6072085, spatialReference: { wkid: 3857 } }, copyright: '© swisstopo' });
}

function createResultLayer(key) {
  if (key === 'none') return null;
  if (key === 'dominant') return new ImageryTileLayer({ title: 'Dominant tree group', url: DOMINANT_URL, format: 'lerc', interpolation: 'nearest', opacity: 1, renderer: categoricalRenderer() });
  return new ImageryTileLayer({ title: PROBABILITY_NAMES[key], url: PROBABILITY_URLS[key], format: 'lerc', interpolation: 'nearest', opacity: 1, renderer: probabilityRenderer() });
}

function compareLayerLabel(key) { return COMPARE_LAYERS.find(layer => layer.key === key)?.label || 'Base map only'; }

function setComparePosition(value) {
  const position = Math.max(10, Math.min(90, Number(value)));
  q('#compare-workspace').style.setProperty('--compare-position', `${position}%`);
  q('#compare-position').value = position;
}

async function rebuildCompareSide(side) {
  if (!compareReady) return;
  const target = side === 'left' ? compareLeftMap : compareRightMap;
  const basemap = q(`#compare-${side}-basemap`).value;
  const layerKey = q(`#compare-${side}-layer`).value;
  target.removeAll();
  target.add(basemap === 'swissimage' ? createSwissimageBaseLayer() : createLightBaseLayer());
  const result = createResultLayer(layerKey);
  if (result) {
    result.opacity = Number(q(`#compare-${side}-opacity`).value) / 100;
    target.add(result);
    try { await result.load(); } catch (error) { fail(`Could not load ${compareLayerLabel(layerKey)}: ${error.message}`); }
  }
  setStatus(`Comparison · left: ${compareLayerLabel(q('#compare-left-layer').value)} · right: ${compareLayerLabel(q('#compare-right-layer').value)}`);
}

async function applyComparePreset(name) {
  const presets = {
    'dominant-aerial': ['dominant', 'light', 'none', 'swissimage'],
    'spruce-beech': ['spruce', 'light', 'beech', 'light'],
    'broadleaf-dominant': ['broadleaf', 'light', 'dominant', 'light']
  };
  const preset = presets[name];
  if (!preset) return;
  ['left', 'right'].forEach((side, index) => {
    q(`#compare-${side}-layer`).value = preset[index * 2];
    q(`#compare-${side}-basemap`).value = preset[index * 2 + 1];
  });
  await Promise.all([rebuildCompareSide('left'), rebuildCompareSide('right')]);
}

async function swapCompareSides() {
  const left = { layer: q('#compare-left-layer').value, basemap: q('#compare-left-basemap').value, opacity: q('#compare-left-opacity').value };
  const right = { layer: q('#compare-right-layer').value, basemap: q('#compare-right-basemap').value, opacity: q('#compare-right-opacity').value };
  Object.entries(right).forEach(([key, value]) => { q(`#compare-left-${key}`).value = value; });
  Object.entries(left).forEach(([key, value]) => { q(`#compare-right-${key}`).value = value; });
  ['left', 'right'].forEach(side => { q(`#compare-${side}-opacity-value`).textContent = `${q(`#compare-${side}-opacity`).value}%`; });
  await Promise.all([rebuildCompareSide('left'), rebuildCompareSide('right')]);
}

async function initialiseCompareMaps() {
  if (compareReady) return;
  compareLeftMap = new Map({ basemap: null }); compareRightMap = new Map({ basemap: null });
  // Seed each map with a tiled layer before its view is created so the view can
  // resolve the shared Web Mercator spatial reference immediately.
  compareLeftMap.add(createLightBaseLayer()); compareRightMap.add(createSwissimageBaseLayer());
  compareLeftView = new MapView({ container: q('#compare-left-map'), map: compareLeftMap, center: [8.509764, 46.929471], zoom: 9, ui: { components: [] } });
  compareRightView = new MapView({ container: q('#compare-right-map'), map: compareRightMap, center: [8.509764, 46.929471], zoom: 9, ui: { components: [] } });
  [compareLeftView, compareRightView].forEach(view => view.on('click', event => inspectPixel(event.mapPoint, { x: event.x, y: event.y }, view)));
  await Promise.all([compareLeftView.when(), compareRightView.when()]);
  compareRightView.viewpoint = compareLeftView.viewpoint.clone();
  compareLeftView.watch('viewpoint', viewpoint => {
    if (!viewpoint || compareSyncing) return;
    compareSyncing = true; compareRightView.viewpoint = viewpoint.clone();
    requestAnimationFrame(() => { compareSyncing = false; });
  });
  compareReady = true;
  await Promise.all([rebuildCompareSide('left'), rebuildCompareSide('right')]);
}

async function startCompare() {
  compareModeActive = true;
  q('#compare-workspace').hidden = false; q('main').classList.add('compare-active');
  q('#standard-settings').hidden = true; q('#compare-settings').hidden = false;
  q('#compare-mode').classList.add('active'); q('#compare-mode').setAttribute('aria-pressed', 'true');
  setPanel('settings', true);
  await initialiseCompareMaps();
  if (compareLeftView && mapElement?.view) compareLeftView.viewpoint = mapElement.view.viewpoint.clone();
  setStatus(`Comparison · left: ${compareLayerLabel(q('#compare-left-layer').value)} · right: ${compareLayerLabel(q('#compare-right-layer').value)}`);
}

function exitCompare() {
  if (!compareModeActive) return;
  compareModeActive = false;
  q('#compare-workspace').hidden = true; q('main').classList.remove('compare-active');
  q('#standard-settings').hidden = false; q('#compare-settings').hidden = true; q('#compare-mode').classList.remove('active'); q('#compare-mode').setAttribute('aria-pressed', 'false');
}

function probabilityRenderer() {
  const min = Number(q('#range-min-input').value); const max = Number(q('#range-max-input').value);
  const colours = COLOUR_SCALES[q('#colour-scale').value];
  return {
    type: 'raster-stretch', stretchType: 'min-max', customStatistics: [{ min, max }],
    colorRamp: new MultipartColorRamp({ colorRamps: colours.slice(0, -1).map((fromColor, index) => new AlgorithmicColorRamp({ algorithm: 'lab-lch', fromColor, toColor: colours[index + 1] })) })
  };
}

function buildLegend() {
  q('#species-legend').innerHTML = SPECIES.map(species => `<li title="Model category ${species.modelId}"><i style="background:${species.colour}"></i><span>${species.name}</span></li>`).join('');
}

function isProbabilityMode() { return activeMode !== 'dominant'; }
function activeLayerKey() { return activeMode === 'leaftype' ? 'broadleaf' : speciesKey; }

function setMode(mode) {
  activeMode = mode;
  const probability = isProbabilityMode();
  q('#dominant-mode').classList.toggle('active', mode === 'dominant');
  q('#leaftype-mode').classList.toggle('active', mode === 'leaftype');
  q('#probability-mode').classList.toggle('active', mode === 'species');
  q('#probability-controls').hidden = !probability;
  q('#dominant-toggle').checked = !probability; if (dominantLayer) dominantLayer.visible = !probability;
  q('#probability-toggle').checked = probability;
  if (probability) activateProbability(activeLayerKey()); else { if (probabilityLayer) probabilityLayer.visible = false; updateLegend(); setStatus('Dominant tree group · 11 classes · native 30 m grid'); }
  updateLegend();
}

function updateLegend() {
  const probability = isProbabilityMode();
  const speciesMode = activeMode === 'species';
  q('#probability-select').hidden = !speciesMode;
  q('#legend-title').hidden = speciesMode;
  q('#legend-title').textContent = activeMode === 'leaftype' ? 'Broadleaf basal-area proportion' : 'Dominant tree group';
  q('#species-legend').hidden = probability;
  q('#probability-legend').hidden = !probability;
}

async function activateProbability(key) {
  const url = PROBABILITY_URLS[key];
  if (!url || !mapElement) return;
  if (probabilityLayer) mapElement.map.remove(probabilityLayer);
  const managedOpacity = Number(q('#probability-opacity').value) / 100;
  probabilityLayer = new ImageryTileLayer({ title: PROBABILITY_NAMES[key], url, format: 'lerc', interpolation: 'nearest', opacity: managedOpacity, visible: isProbabilityMode(), renderer: probabilityRenderer() });
  mapElement.map.add(probabilityLayer);
  const dominantIndex = mapElement.map.layers.indexOf(dominantLayer);
  mapElement.map.reorder(probabilityLayer, probabilityAboveDominant ? dominantIndex + 1 : Math.max(0, dominantIndex));
  try {
    await probabilityLayer.load();
    probabilityLayer.visible = isProbabilityMode();
    updateLegend();
    setStatus(`${PROBABILITY_NAMES[key]} · Float32 · native 30 m grid`);
  } catch (error) { mapElement.map.remove(probabilityLayer); probabilityLayer = null; fail(`Could not load ${PROBABILITY_NAMES[key]}: ${error.message}`); }
}

function updateRange(event) {
  const minInput = q('#range-min-input'); const maxInput = q('#range-max-input'); let min = Number(minInput.value); let max = Number(maxInput.value);
  if (min >= max) { if (event?.target === maxInput) minInput.value = min = Math.max(0, max - .01); else maxInput.value = max = Math.min(1, min + .01); }
  q('#range-min').textContent = min.toFixed(2); q('#range-max').textContent = max.toFixed(2);
  q('#ramp').style.background = `linear-gradient(90deg, ${COLOUR_SCALES[q('#colour-scale').value]})`;
}

function queueProbabilityRefresh() {
  if (!isProbabilityMode() || !probabilityLayer) return;
  clearTimeout(refreshTimer); refreshTimer = setTimeout(() => activateProbability(activeLayerKey()), 150);
}

function rasterValue(result) {
  const values = result?.pixelValue ?? result?.pixelBlock?.pixels?.[0] ?? result?.samples?.[0]?.pixelValue ?? result?.value ?? result?.processedValue;
  const value = Array.isArray(values) || ArrayBuffer.isView(values) ? Number(values[0]) : Number(values);
  return Number.isFinite(value) ? value : NaN;
}

function isCompositionValue(value) { return Number.isFinite(value) && value >= -0.0001 && value <= 1.0001; }

function setPopupState(state) {
  q('#popup-loading').hidden = state !== 'loading';
  q('#popup-result').hidden = state !== 'result';
  q('#popup-nodata').hidden = state !== 'nodata';
  requestAnimationFrame(positionPopup);
}

function setInspectMode(active) {
  inspectActive = active;
  q('#inspect-toggle').setAttribute('aria-pressed', String(active));
  q('#inspect-toggle').classList.toggle('active', active);
  document.body.classList.toggle('inspect-active', active);
  if (!active) closePopup();
}

function anchorView() {
  if (compareModeActive) return inspectTarget && inspectTarget !== mapElement ? inspectTarget : compareLeftView;
  return mapElement?.view;
}

function openPopup(point) {
  popupPoint = point;
  const popup = q('#pixel-popup');
  popup.hidden = false;
  requestAnimationFrame(() => { positionPopup(); popup.classList.add('visible'); });
  popupWatcher?.remove();
  const view = anchorView();
  if (reactiveUtils && view) popupWatcher = reactiveUtils.watch(() => view.viewpoint, () => positionPopup());
}

function closePopup() {
  ++inspectionRequestId;
  const popup = q('#pixel-popup');
  popup.classList.remove('visible');
  popupPoint = null;
  setTimeout(() => { if (!popupPoint) popup.hidden = true; }, 220);
  popupWatcher?.remove(); popupWatcher = null;
  if (inspectionGraphic) {
    [mapElement?.view, compareLeftView, compareRightView].forEach(view => view?.graphics?.remove(inspectionGraphic));
    inspectionGraphic = null;
  }
}

function positionPopup() {
  const popup = q('#pixel-popup');
  if (popup.hidden || !popupPoint || !mapElement?.view) return;
  const view = anchorView();
  if (!view) return;
  let screen;
  try { screen = view.toScreen(popupPoint); } catch { return; }
  if (!screen) return;
  const rect = popup.getBoundingClientRect();
  const margin = 14;
  const chromeTop = 92;
  let left = screen.x - rect.width / 2;
  let top = screen.y - rect.height - 20;
  const below = top < chromeTop;
  if (below) top = screen.y + 20;
  left = Math.max(margin, Math.min(window.innerWidth - rect.width - margin, left));
  top = Math.max(chromeTop, Math.min(window.innerHeight - rect.height - margin, top));
  popup.style.left = `${Math.round(left)}px`;
  popup.style.top = `${Math.round(top)}px`;
  popup.classList.toggle('below', below);
  popup.style.setProperty('--tail-x', `${Math.round(Math.max(18, Math.min(rect.width - 18, screen.x - left)))}px`);
}

function drawInspectionPoint(point) {
  const view = anchorView();
  if (!view || !Graphic) return;
  if (inspectionGraphic) [mapElement?.view, compareLeftView, compareRightView].forEach(item => item?.graphics?.remove(inspectionGraphic));
  inspectionGraphic = new Graphic({
    geometry: point,
    symbol: { type: 'simple-marker', style: 'circle', size: 12, color: [255, 255, 255, 0.18], outline: { color: '#173c32', width: 2 } }
  });
  view.graphics.add(inspectionGraphic);
}

async function getInspectionLayer(species) {
  if (inspectionLayers[species.key]) return inspectionLayers[species.key];
  const url = PROBABILITY_URLS[species.key];
  if (!url) throw new Error(`No public service is configured for ${species.name}.`);
  const layer = new ImageryTileLayer({ title: `${species.name} inspection`, url, format: 'lerc', interpolation: 'nearest', opacity: 0.001, visible: true, listMode: 'hide' });
  inspectionLayers[species.key] = layer;
  await layer.load();
  return layer;
}

function waitForLayerView(layerView) {
  if (!layerView.updating) return Promise.resolve();
  return reactiveUtils.whenOnce(() => !layerView.updating);
}

async function hitTestInspectionLayers(layers, screenPoint, target) {
  target.map.addMany(layers);
  try {
    const layerViews = await Promise.all(layers.map(layer => target.whenLayerView(layer)));
    await Promise.all(layerViews.map(waitForLayerView));
    const response = await target.hitTest(screenPoint, { include: layers });
    return layers.map(layer => response.results.find(result => result.type === 'raster' && result.layer === layer));
  } finally {
    layers.forEach(layer => target.map.remove(layer));
  }
}

function formatCoordinates(point) {
  const lat = Number(point.latitude); const lon = Number(point.longitude);
  return `${Math.abs(lat).toFixed(5)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(5)}° ${lon >= 0 ? 'E' : 'W'}`;
}

function renderPixelComposition(values, dominantSpecies, point) {
  const sorted = values.map((value, index) => ({ ...SPECIES[index], value })).sort((a, b) => b.value - a.value);
  const dominantValue = values[SPECIES.findIndex(species => species.key === dominantSpecies.key)];
  q('#popup-dominant').textContent = speciesLabel(dominantSpecies);
  q('#popup-share').textContent = `${(dominantValue * 100).toFixed(1)}%`;
  q('#popup-rule').style.background = dominantSpecies.colour;
  q('#popup-coords').textContent = formatCoordinates(point);
  renderCompositionChart(sorted, dominantSpecies);
  setPopupState('result');
}

function renderCompositionChart(sorted, dominantSpecies) {
  const chartElement = q('#popup-chart');
  if (!window.echarts) throw new Error('Apache ECharts could not be loaded.');
  compositionChart ??= window.echarts.init(chartElement, null, { renderer: 'svg' });
  compositionChart.setOption({
    animationDuration: 460,
    animationDurationUpdate: 300,
    animationEasing: 'cubicOut',
    animationDelay: index => index * 32,
    grid: { left: 24, right: 18, top: 24, bottom: 66 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: value => `${Number(value).toFixed(1)}%` },
    xAxis: {
      type: 'category', data: sorted.map(species => species.name),
      axisLine: { lineStyle: { color: '#d9e1dd' } },
      axisTick: { alignWithLabel: true, lineStyle: { color: '#d9e1dd' } },
      axisLabel: { color: '#43524b', fontFamily: 'DM Sans', fontSize: 11, fontWeight: 500, interval: 0, rotate: 32, margin: 12 }
    },
    yAxis: {
      type: 'value', min: 0, max: 100,
      axisLabel: { color: '#75817b', fontFamily: 'DM Mono', fontSize: 10, formatter: value => `${value}%` },
      axisLine: { show: false }, axisTick: { show: false },
      splitLine: { lineStyle: { color: '#edf1ef', type: 'dashed' } }
    },
    series: [{
      name: 'Basal-area proportion', type: 'bar', barMaxWidth: 36,
      data: sorted.map(species => ({
        value: species.value * 100,
        itemStyle: { color: species.colour, borderRadius: [3, 3, 0, 0] }
      })),
      label: { show: true, position: 'top', color: '#314139', fontFamily: 'DM Mono', fontSize: 10, formatter: params => `${params.value.toFixed(1)}%` },
      emphasis: { focus: 'series' }
    }]
  }, { notMerge: true, lazyUpdate: false });
  requestAnimationFrame(() => compositionChart.resize());
}

async function inspectPixel(point, screenPoint, target) {
  if (!point || !inspectActive) return;
  inspectTarget = target || mapElement;
  const requestId = ++inspectionRequestId;
  setPopupState('loading'); openPopup(point); drawInspectionPoint(point);
  setStatus('Reading 11 tree-group basal-area values at selected 30 m cell…');
  try {
    const speciesLayers = await Promise.all(SPECIES.map(getInspectionLayer));
    const probabilityResults = await hitTestInspectionLayers(speciesLayers, screenPoint, inspectTarget);
    if (requestId !== inspectionRequestId) return;
    const values = probabilityResults.map(rasterValue);
    if (!values.every(isCompositionValue)) {
      setPopupState('nodata'); setStatus('Selected location has no valid model prediction.'); return;
    }
    const computedDominant = values.indexOf(Math.max(...values));
    const dominantSpecies = SPECIES[computedDominant];
    renderPixelComposition(values, dominantSpecies, point);
    setStatus(`${dominantSpecies.name} · selected 30 m cell · 11 basal-area values loaded`);
  } catch (error) {
    if (requestId !== inspectionRequestId) return;
    console.error(error);
    setPopupState('nodata');
    q('#popup-nodata-title').textContent = 'Values unavailable';
    q('#popup-nodata-copy').textContent = 'One or more basal-area services could not be read. Please try again.';
    setStatus('Could not read all 11 pixel values.');
  }
}

function showInfo(kind) {
  const content = {
    methods: ['Methods and data meaning', 'TreeAI Switzerland Forest Basal-Area Composition visualises 11 Swiss NFI tree groups. Each Float32 layer represents the modelled basal-area proportion of one group, and the dominant layer is their categorical argmax. In the Swiss NFI, basal area is the sum of stem cross-sectional areas measured at 1.3 m; it covers living trees and shrubs with DBH ≥12 cm. Values are rendered with nearest-neighbour sampling, so no new values are introduced between original 30 m cells.'],
    data: ['Data & scope', 'The model groups follow the Swiss NFI main-tree-species grouping, plus Other for all remaining retained taxa. A displayed percentage is a basal-area proportion, not a proportion of individual trees, land area, timber volume, or the probability that a class label is correct.'],
    stats: ['About these statistics', 'This chart reports the share of forest grid cells for which each tree group is the dominant model class. It is not a count of individual tree stems.']
  }[kind];
  q('#info-title').textContent = content[0]; q('#info-copy').textContent = content[1]; q('#info-dialog').showModal();
}

function wire() {
  q('#species-download-options').innerHTML = SPECIES.map(species => `<label class="download-option"><input type="checkbox" name="product" value="${species.key}"><span><strong>${speciesLabel(species)}</strong><small>${speciesLabel(species)} basal-area proportion</small></span></label>`).join('');
  q('#dominant-mode').onclick = () => { exitCompare(); setMode('dominant'); };
  q('#leaftype-mode').onclick = () => { exitCompare(); setMode('leaftype'); };
  q('#probability-mode').onclick = () => { exitCompare(); setMode('species'); };
  q('#compare-mode').onclick = startCompare;
  q('#compare-exit').onclick = () => { exitCompare(); closePanels(); setMode(activeMode); };
  q('#probability-select').onchange = () => { speciesKey = q('#probability-select').value; if (isProbabilityMode()) activateProbability(activeLayerKey()); };
  q('#swissimage-toggle').onchange = event => { swissImageLayer.visible = event.target.checked; };
  q('#dominant-toggle').onchange = event => { dominantLayer.visible = event.target.checked; };
  q('#dominant-opacity').oninput = event => { q('#dominant-opacity-value').textContent = `${event.target.value}%`; dominantLayer.opacity = Number(event.target.value) / 100; };
  q('#probability-toggle').onchange = event => { if (event.target.checked) setMode(activeMode === 'dominant' ? 'species' : activeMode); else setMode('dominant'); };
  q('#probability-opacity').oninput = event => { q('#probability-opacity-value').textContent = `${event.target.value}%`; if (probabilityLayer) probabilityLayer.opacity = Number(event.target.value) / 100; };
  q('#colour-scale').onchange = () => { updateRange(); queueProbabilityRefresh(); };
  ['#range-min-input', '#range-max-input'].forEach(selector => { q(selector).oninput = event => { updateRange(event); queueProbabilityRefresh(); }; q(selector).onchange = queueProbabilityRefresh; });
  q('#focus-switzerland').onclick = () => (compareModeActive ? compareLeftView : mapElement).goTo({ center: [8.509764, 46.929471], zoom: 9 });
  q('#zoom-in').onclick = () => { const target = compareModeActive ? compareLeftView : mapElement; target.goTo({ zoom: target.zoom + 1 }); }; q('#zoom-out').onclick = () => { const target = compareModeActive ? compareLeftView : mapElement; target.goTo({ zoom: target.zoom - 1 }); };
  q('#settings-toggle').onclick = () => setPanel('settings');
  q('#stats-toggle').onclick = () => openStatistics().catch(error => { console.error(error); fail(`Statistics could not load: ${error.message}`); closeStatistics(); });
  q('#statistics-close').onclick = closeStatistics;
  q('#download-toggle').onclick = openDownload;
  q('#download-close').onclick = closeDownload;
  q('#download-all').onchange = event => { document.querySelectorAll('input[name="product"]').forEach(input => { input.checked = event.target.checked; }); updateDownloadControls(); };
  document.querySelectorAll('input[name="product"]').forEach(input => { input.onchange = updateDownloadControls; });
  q('#download-selected').onclick = downloadSelectedProducts;
  q('#canton-select').onchange = event => selectCanton(event.target.value).catch(error => { console.error(error); fail(`Could not zoom to canton: ${error.message}`); });
  q('#drawer-toggle').onclick = closePanels;
  q('#inspect-toggle').onclick = () => setInspectMode(!inspectActive);
  q('#popup-close').onclick = closePopup;
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closePopup(); });
  window.addEventListener('resize', () => { positionPopup(); compositionChart?.resize(); statisticsChart?.resize(); });
  q('#legend-toggle').onclick = () => {
    const content = q('#legend-content'); content.hidden = !content.hidden; q('#legend-toggle').textContent = content.hidden ? '+' : '−';
  };
  document.querySelectorAll('[data-info]').forEach(button => button.onclick = () => showInfo(button.dataset.info)); q('#info-close').onclick = () => q('#info-dialog').close();
  ['left', 'right'].forEach(side => {
    const select = q(`#compare-${side}-layer`); select.innerHTML = COMPARE_LAYERS.map(layer => `<option value="${layer.key}">${layer.label}</option>`).join('');
    select.value = side === 'left' ? 'dominant' : 'none';
    select.onchange = () => rebuildCompareSide(side);
    q(`#compare-${side}-basemap`).onchange = () => rebuildCompareSide(side);
    q(`#compare-${side}-opacity`).oninput = event => { q(`#compare-${side}-opacity-value`).textContent = `${event.target.value}%`; rebuildCompareSide(side); };
    });
  document.querySelectorAll('[data-compare-preset]').forEach(button => button.onclick = () => applyComparePreset(button.dataset.comparePreset));
  q('#compare-swap').onclick = swapCompareSides;
  q('#compare-layout').onclick = () => {
    const split = q('#compare-workspace').classList.toggle('split-mode');
    q('#compare-layout').textContent = split ? '↔ Sliding view' : '▯ Side by side';
    compareLeftView?.resize(); compareRightView?.resize();
  };
  q('#compare-position').oninput = event => setComparePosition(event.target.value);
  q('#compare-handle').onpointerdown = event => {
    event.preventDefault(); const workspace = q('#compare-workspace');
    const move = pointerEvent => { const rect = workspace.getBoundingClientRect(); setComparePosition((pointerEvent.clientX - rect.left) / rect.width * 100); };
    const stop = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop, { once: true });
  };
  mapElement.addEventListener('arcgisViewClick', event => inspectPixel(event.detail.mapPoint, event.detail.screenPoint));

  window.addEventListener('keydown', event => { if (event.key === 'Escape') closePanels(); });
  updateRange();
}

async function boot() {
  try {
    if (!DOMINANT_URL) throw new Error('No dominant ImageServer URL is configured.');
    [ImageryTileLayer, FeatureLayer, MultipartColorRamp, AlgorithmicColorRamp, Graphic, geometryEngine] = await $arcgis.import(['@arcgis/core/layers/ImageryTileLayer.js', '@arcgis/core/layers/FeatureLayer.js', '@arcgis/core/rest/support/MultipartColorRamp.js', '@arcgis/core/rest/support/AlgorithmicColorRamp.js', '@arcgis/core/Graphic.js', '@arcgis/core/geometry/geometryEngine.js']);
    [WebTileLayer, Map, MapView, reactiveUtils] = await $arcgis.import(['@arcgis/core/layers/WebTileLayer.js', '@arcgis/core/Map.js', '@arcgis/core/views/MapView.js', '@arcgis/core/core/reactiveUtils.js']);
    mapElement = q('#map'); await mapElement.componentOnReady(); mapElement.map.basemap = null;
    const lightBaseLayer = createLightBaseLayer();
    swissImageLayer = createSwissimageBaseLayer(); swissImageLayer.visible = q('#swissimage-toggle').checked;
    dominantLayer = new ImageryTileLayer({ title: 'Dominant tree group', url: DOMINANT_URL, format: 'lerc', interpolation: 'nearest', opacity: Number(q('#dominant-opacity').value) / 100, renderer: categoricalRenderer() });
    cantonStatisticsLayer = new FeatureLayer({ title: 'Swiss canton statistics', url: CANTON_STATISTICS_URL, outFields: ['*'], listMode: 'hide' });
    mapElement.map.addMany([lightBaseLayer, swissImageLayer, dominantLayer]); await Promise.all([dominantLayer.load(), cantonStatisticsLayer.load()]);
    const boundaryResult = await cantonStatisticsLayer.queryFeatures({ where: '1=1', returnGeometry: true, outFields: [] });
    nationalBoundaryGraphic = new Graphic({
      geometry: geometryEngine.union(boundaryResult.features.map(feature => feature.geometry)),
      symbol: { type: 'simple-fill', color: [255, 255, 255, 0], outline: { color: [22, 54, 44, 0.88], width: 1.35 } }
    });
    mapElement.view.graphics.add(nationalBoundaryGraphic);
    buildLegend(); wire(); updateLegend(); setStatus('Dominant tree group · 11 classes · native 30 m grid');
  } catch (error) { console.error(error); fail(`ArcGIS map could not load: ${error.message}`); setStatus('Connection failed. Confirm public ImageServer access.'); }
}

boot();
