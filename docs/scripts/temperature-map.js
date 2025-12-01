const MAP_WIDTH = 960;
const MAP_HEIGHT = 540;
const WORLD_TOPOJSON_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';
const TEMPERATURE_DATA_URL = '../finalProject/dataset/temperature_data.zip';

const projection = d3
  .geoEquirectangular()
  .scale(153)
  .translate([MAP_WIDTH / 2, MAP_HEIGHT / 2]);
const geoPath = d3.geoPath(projection);

// [From finalProject/heatmap.js] Color scale for temperature
const colorScale = d3.scaleSequential(d3.interpolateInferno)
  .domain([230, 310]);

const revealedCountries = new Set();
let tooltip, overlayLayer, heatmapSvg;
let allTemperatureData = null;
let timePoints = [];

async function init() {
  try {
    const [worldTopo, cityData] = await Promise.all([
      d3.json(WORLD_TOPOJSON_URL),
      d3.json("data/city_temperatures_2025.json")
    ]);

    const countries = topojson.feature(worldTopo, worldTopo.objects.countries);

    setupLayers();
    renderCountries(countries);
    renderCities(cityData);
    addLegend();
    setupTooltip();
    setupCitySearch();

    await loadTemperatureData();

    console.log('Map initialized');
  } catch (err) {
    console.error('Failed to initialize map:', err);
    document.getElementById('map').innerHTML = 
      '<p style="color: red; padding: 2rem;">Failed to load map data.</p>';
  }
}

// [From finalProject/heatmap.js] Load and parse temperature data from zip
async function loadTemperatureData() {
  try {
    const response = await fetch(TEMPERATURE_DATA_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);
    const jsonFile = zip.file("temperature_data.json");
    if (!jsonFile) {
      throw new Error("temperature_data.json not found in zip file");
    }
    const jsonString = await jsonFile.async("string");
    allTemperatureData = JSON.parse(jsonString);
    
    timePoints = Object.keys(allTemperatureData).sort();
    
    const slider = document.getElementById('time-slider');
    slider.max = timePoints.length - 1;
    slider.value = 0;
    
    // [From finalProject/heatmap.js] Slider input handler
    slider.oninput = function() {
      renderHeatmap(+this.value);
    };
    
    renderHeatmap(0);
    
    console.log("Temperature data loaded successfully.");
  } catch (error) {
    console.error("Error loading temperature data:", error);
    document.getElementById('current-time-display').textContent = 'Failed to load data';
  }
}

// [From finalProject/heatmap.js] Render heatmap for a given time index
function renderHeatmap(timeIndex) {
  const currentTime = timePoints[timeIndex];
  document.getElementById('current-time-display').textContent = currentTime;
  
  const currentData = allTemperatureData[currentTime];
  
  const circles = heatmapSvg.selectAll(".data-point")
    .data(currentData, d => d[0] + "," + d[1]);
  
  circles.exit().remove();
  
  circles.enter()
    .append("circle")
    .attr("class", "data-point")
    .attr("r", 3)
    .merge(circles)
    .attr("cx", d => projection([d[0], d[1]])[0])
    .attr("cy", d => projection([d[0], d[1]])[1])
    .attr("fill", d => colorScale(d[2]))
    .attr("stroke", "none");
}

function setupCitySearch() {
  const searchInput = document.getElementById("city-search");

  searchInput.addEventListener("input", event => {
    const query = event.target.value.trim().toLowerCase();

    const allCities = overlayLayer.selectAll("circle.city");

    if (query === "") {
      allCities
        .transition()
        .duration(200)
        .attr("r", 2.5)
        .attr("fill", "#f59e0b")
        .attr("opacity", 0.65);
      return;
    }

    allCities.each(function (d) {
      const element = d3.select(this);
      const cityName = d.city.toLowerCase();

      if (cityName.includes(query)) {
        element
          .raise()
          .transition()
          .duration(200)
          .attr("r", 4.5)
          .attr("fill", "#fb923c")
          .attr("opacity", 1);
      } else {
        element
          .transition()
          .duration(200)
          .attr("r", 2)
          .attr("opacity", 0.3);
      }
    });
  });
}


function renderCities(cityData) {
  const cityGroup = overlayLayer.append("g").attr("class", "cities");

  cityGroup
    .selectAll("circle.city")
    .data(cityData)
    .join("circle")
    .attr("class", "city")
    .attr("cx", d => projection([d.lon, d.lat])[0])
    .attr("cy", d => projection([d.lon, d.lat])[1])
    .attr("r", 3)
    .attr("fill", "#f59e0b")   
    .attr("stroke", "#ffffff")
    .attr("stroke-width", 0.7)
    .attr("opacity", 0.5)
    .on("mouseover", (event, d) => {
      tooltip
        .style("opacity", 1)
        .html(`
          <strong>${d.city}</strong><br>
          Lat: ${d.lat.toFixed(2)}, Lon: ${d.lon.toFixed(2)}<br>
          Height: ${d.height} m<br>
          <hr style="margin: 4px 0; border: none; border-top: 1px solid #ccc;">
          Q1: ${(d.Q1 - 273.15).toFixed(1)} °C<br>
          Q2: ${(d.Q2 - 273.15).toFixed(1)} °C<br>
          Q3: ${(d.Q3 - 273.15).toFixed(1)} °C<br>
          Q4: ${(d.Q4 - 273.15).toFixed(1)} °C
        `)
        .style("left", (event.pageX + 12) + "px")
        .style("top", (event.pageY - 20) + "px");
    })
    .on("mouseout", () => tooltip.style("opacity", 0));
}

function setupLayers() {
  const mapContainer = document.getElementById('map');
  
  heatmapSvg = d3
    .select('#map')
    .append('svg')
    .attr('id', 'heatmap-svg')
    .attr('viewBox', `0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  overlayLayer = d3
    .select('#map')
    .append('svg')
    .attr('id', 'overlay-layer')
    .attr('viewBox', `0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');
}

function renderCountries(countries) {
  const defs = overlayLayer.append('defs');
  const clipPath = defs.append('clipPath').attr('id', 'sphere-clip');
  clipPath
    .append('path')
    .datum({ type: 'Sphere' })
    .attr('d', geoPath);
  
  const mask = defs.append('mask').attr('id', 'ocean-mask');
  
  mask.append('path')
    .datum({ type: 'Sphere' })
    .attr('d', geoPath)
    .attr('fill', 'white');
  
  mask.selectAll('path.country-mask')
    .data(countries.features)
    .join('path')
    .attr('class', 'country-mask')
    .attr('d', geoPath)
    .attr('fill', 'black');
  
  const oceanGroup = overlayLayer.append('g').attr('class', 'ocean-group');
  oceanGroup
    .append('path')
    .datum({ type: 'Sphere' })
    .attr('class', 'ocean-background')
    .attr('d', geoPath)
    .attr('mask', 'url(#ocean-mask)')
    .style('fill', '#a8d8ea')
    .style('pointer-events', 'none');
  
  const countryMasks = overlayLayer.append('g').attr('class', 'country-masks');
  countryMasks
    .selectAll('path.country')
    .data(countries.features)
    .join('path')
    .attr('class', 'country')
    .attr('d', geoPath)
    .on('mouseenter', handleMouseEnter)
    .on('mouseleave', handleMouseLeave)
    .on('click', handleClick);
  
  const countryBorders = overlayLayer.append('g').attr('class', 'country-borders');
  countryBorders
    .selectAll('path.country-border')
    .data(countries.features)
    .join('path')
    .attr('class', 'country-border')
    .attr('d', geoPath)
    .style('fill', 'none')
    .style('stroke', '#94a3b8')
    .style('stroke-width', '0.5px')
    .style('pointer-events', 'none');
}

function handleMouseEnter(event, feature) {
  const countryId = getCountryId(feature);
  const countryName = getCountryName(feature);

  tooltip
    .style('opacity', 1)
    .html(`<strong>${countryName}</strong><br/>Click to toggle mask`);

  if (!revealedCountries.has(countryId)) {
    d3.select(event.target).classed('country--hover', true);
  }
}

function handleMouseLeave(event, feature) {
  const countryId = getCountryId(feature);

  tooltip.style('opacity', 0);

  if (!revealedCountries.has(countryId)) {
    d3.select(event.target).classed('country--hover', false);
  }
}

function handleClick(event, feature) {
  const countryId = getCountryId(feature);
  const countryName = getCountryName(feature);
  const element = d3.select(event.target);

  if (revealedCountries.has(countryId)) {
    revealedCountries.delete(countryId);
    element.classed('country--revealed', false);
    removeFromSelectionList(countryId);
  } else {
    revealedCountries.add(countryId);
    element.classed('country--revealed', true);
    addToSelectionList(countryId, countryName);
  }
  
  updateBorderStyle(countryId, revealedCountries.has(countryId));
}

function addToSelectionList(id, name) {
  const list = document.getElementById('selection-list');
  const item = document.createElement('li');
  item.className = 'selection-list__item';
  item.dataset.countryId = id;
  item.innerHTML = `
    <span>${name}</span>
    <button onclick="removeCountry('${id}')" style="background:none;border:none;cursor:pointer;color:#ef4444;">✕</button>
  `;
  list.appendChild(item);
}

function removeFromSelectionList(id) {
  const item = document.querySelector(`li[data-country-id="${id}"]`);
  if (item) {
    item.remove();
  }
}

function updateBorderStyle(countryId, isRevealed) {
  overlayLayer
    .select('.country-borders')
    .selectAll('path.country-border')
    .filter(d => getCountryId(d) === countryId)
    .style('stroke', isRevealed ? '#3b82f6' : '#94a3b8')
    .style('stroke-width', isRevealed ? '1.2px' : '0.5px');
}

window.removeCountry = function(id) {
  revealedCountries.delete(id);

  overlayLayer
    .select('.country-masks')
    .selectAll('path.country')
    .filter(d => getCountryId(d) === id)
    .classed('country--revealed', false)
    .classed('country--hover', false); 

  updateBorderStyle(id, false);

  removeFromSelectionList(id);

  updateMapVisuals();
};

function updateMapVisuals() {
  overlayLayer
    .selectAll('path.country')
    .classed('country--revealed', d => revealedCountries.has(getCountryId(d)))
    .classed('country--hover', false);
}

function setupTooltip() {
  tooltip = d3
    .select('body')
    .append('div')
    .attr('class', 'tooltip')
    .style('position', 'absolute')
    .style('opacity', 0);

  overlayLayer.on('mousemove', event => {
    tooltip
      .style('left', `${event.pageX + 12}px`)
      .style('top', `${event.pageY - 8}px`);
  });
}

function addLegend() {
  const mapWrapper = document.querySelector('.map-wrapper');
  const legend = document.createElement('div');
  legend.className = 'legend';
  
  const canvas = document.createElement('canvas');
  canvas.width = 200;
  canvas.height = 20;
  const ctx = canvas.getContext('2d');
  
  const gradient = ctx.createLinearGradient(0, 0, 200, 0);
  // [From finalProject/heatmap.js] Inferno color scale
  const infernoColors = [
    { stop: 0, color: '#000004' },
    { stop: 0.25, color: '#57106e' },
    { stop: 0.5, color: '#bc3754' },
    { stop: 0.75, color: '#f98e09' },
    { stop: 1, color: '#fcffa4' }
  ];
  infernoColors.forEach(c => gradient.addColorStop(c.stop, c.color));
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 200, 20);
  
  ctx.strokeStyle = '#cbd5e1';
  ctx.strokeRect(0, 0, 200, 20);
  
  legend.appendChild(canvas);
  
  const labelDiv = document.createElement('div');
  labelDiv.style.display = 'flex';
  labelDiv.style.justifyContent = 'space-between';
  labelDiv.style.width = '200px';
  labelDiv.style.fontSize = '0.75rem';
  labelDiv.style.color = '#475569';
  labelDiv.style.marginTop = '4px';
  labelDiv.innerHTML = '<span>230K (-43C)</span><span>310K (37C)</span>';
  
  const container = document.createElement('div');
  container.appendChild(canvas);
  container.appendChild(labelDiv);
  legend.appendChild(container);
  
  mapWrapper.appendChild(legend);
}

function getCountryId(feature) {
  return (
    feature.properties?.iso_a3 ||
    feature.properties?.adm0_a3 ||
    feature.id ||
    String(feature.properties?.name || 'unknown')
  );
}

function getCountryName(feature) {
  return feature.properties?.name || 'Unknown';
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
