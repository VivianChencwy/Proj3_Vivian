const MAP_WIDTH = 960;
const MAP_HEIGHT = 540;
const WORLD_TOPOJSON_URL =
  'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';
const TEMPERATURE_DATA_URL = 'data/tas_2025_by_country.json';

const projection = d3.geoNaturalEarth1().scale(180).translate([MAP_WIDTH / 2, MAP_HEIGHT / 2]);
const geoPath = d3.geoPath(projection);
const graticule = d3.geoGraticule10();

const pinnedCountries = new Map();

const mapContainer = d3.select('#map');
const svg = mapContainer
  .append('svg')
  .attr('viewBox', `0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`)
  .attr('aria-label', 'World map showing 2025 surface air temperature');

const defs = svg.append('defs');
const gradient = defs
  .append('linearGradient')
  .attr('id', 'temperature-gradient')
  .attr('x1', '0%')
  .attr('x2', '100%')
  .attr('y1', '0%')
  .attr('y2', '0%');

const tooltip = mapContainer
  .append('div')
  .attr('class', 'tooltip')
  .style('opacity', 0);

const selectionList = d3.select('#selection-list');

init();

async function init() {
  const [worldTopo, temperatureData] = await Promise.all([
    d3.json(WORLD_TOPOJSON_URL),
    d3.json(TEMPERATURE_DATA_URL),
  ]);

  const countries = topojson.feature(worldTopo, worldTopo.objects.countries).features;

  const temperatures = new Map(Object.entries(temperatureData));
  const temperatureValues = Array.from(temperatures.values());
  const [minTemp, maxTemp] = d3.extent(temperatureValues);

  const colorScale = d3
    .scaleSequential()
    .domain([minTemp, maxTemp])
    .interpolator(d3.interpolateTurbo);

  addLegend(minTemp, maxTemp, colorScale);

  svg
    .append('path')
    .attr('class', 'graticule')
    .attr('d', geoPath(graticule))
    .attr('fill', 'none')
    .attr('stroke', '#cbd5f5')
    .attr('stroke-width', 0.5)
    .attr('opacity', 0.6);

  svg
    .append('path')
    .datum({ type: 'Sphere' })
    .attr('d', geoPath)
    .attr('fill', '#e2e8f0');

  svg
    .append('g')
    .selectAll('path')
    .data(countries)
    .join('path')
    .attr('class', d => {
      const iso3 = getIso3Code(d);
      const hasData = temperatures.has(iso3);
      return hasData ? 'country country--has-data' : 'country';
    })
    .attr('data-iso3', d => getIso3Code(d))
    .attr('data-name', d => getCountryName(d))
    .attr('d', geoPath)
    .attr('fill', d => {
      const iso3 = getIso3Code(d);
      const value = temperatures.get(iso3);
      return value != null ? colorScale(value) : '#dbeafe';
    })
    .on('mouseover', function (event, feature) {
      const iso3 = getIso3Code(feature);
      const name = getCountryName(feature);
      const value = temperatures.get(iso3);

      showTooltip(event, name, value);
      d3.select(this).classed('country--hover', true);
    })
    .on('mousemove', event => {
      tooltip
        .style('left', `${event.offsetX + 12}px`)
        .style('top', `${event.offsetY + 12}px`);
    })
    .on('mouseout', function () {
      tooltip.classed('is-visible', false);
      tooltip.transition().duration(150).style('opacity', 0);

      d3.select(this).classed('country--hover', false);
    })
    .on('click', function (event, feature) {
      const iso3 = getIso3Code(feature);
      const name = getCountryName(feature);
      const value = temperatures.get(iso3);

      if (value == null) {
        return;
      }

      if (pinnedCountries.has(iso3)) {
        pinnedCountries.delete(iso3);
        d3.select(this).classed('country--selected', false).classed('country--hover', false);
      } else {
        pinnedCountries.set(iso3, { iso3, name, value });
        d3.select(this).classed('country--selected', true);
      }

      updateSelectionList();
    });
}

function getIso3Code(feature) {
  return (
    feature.properties?.iso_a3 ||
    feature.properties?.adm0_a3 ||
    feature.id ||
    null
  );
}

function getCountryName(feature) {
  return feature.properties?.name || feature.properties?.admin || 'Unknown';
}

function showTooltip(event, countryName, temperatureC) {
  const content = temperatureC != null
    ? `${countryName}<br/>${temperatureC.toFixed(2)} °C`
    : `${countryName}<br/>Data unavailable`;

  tooltip
    .html(content)
    .style('left', `${event.offsetX + 12}px`)
    .style('top', `${event.offsetY + 12}px`)
    .classed('is-visible', true)
    .transition()
    .duration(120)
    .style('opacity', 1);
}

function updateSelectionList() {
  const entries = Array.from(pinnedCountries.values());

  const items = selectionList.selectAll('li').data(entries, d => d.iso3);

  items
    .enter()
    .append('li')
    .attr('class', 'selection-list__item')
    .merge(items)
    .html(d => `${d.name}<span>${d.value.toFixed(2)} °C</span>`);

  items.exit().remove();
}

function addLegend(minTemp, maxTemp, colorScale) {
  const legend = svg
    .append('g')
    .attr('class', 'legend')
    .attr('transform', `translate(${MAP_WIDTH - 260}, ${MAP_HEIGHT - 40})`);

  const gradientSteps = d3.range(0, 1.01, 0.1);

  gradient
    .selectAll('stop')
    .data(gradientSteps)
    .join('stop')
    .attr('offset', d => `${d * 100}%`)
    .attr('stop-color', d => colorScale(d3.interpolateNumber(minTemp, maxTemp)(d)));

  legend
    .append('rect')
    .attr('width', 160)
    .attr('height', 12)
    .attr('rx', 6)
    .attr('fill', 'url(#temperature-gradient)');

  const axisScale = d3.scaleLinear().domain([minTemp, maxTemp]).range([0, 160]);
  const axis = d3
    .axisBottom(axisScale)
    .ticks(5)
    .tickFormat(d => `${d.toFixed(1)}°C`);

  legend
    .append('g')
    .attr('transform', 'translate(0, 12)')
    .call(axis)
    .select('.domain')
    .remove();
}

