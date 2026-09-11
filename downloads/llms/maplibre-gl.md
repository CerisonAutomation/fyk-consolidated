# MapLibre GL JS v6 - Documentation

**Package:** `maplibre-gl` v6.5.0
**Docs:** https://maplibre.org/maplibre-gl-js/docs/, https://maplibre.org/maplibre-gl-js/docs/API/

## Overview

MapLibre GL JS is a TypeScript library that uses WebGL to render interactive maps from vector tiles in a browser. It's an open-source fork of mapbox-gl-js.

## Installation

```bash
npm install maplibre-gl
```

## Basic Map Setup

```typescript
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

const map = new maplibregl.Map({
  container: 'map', // HTML element ID or DOM element
  style: 'https://demotiles.maplibre.org/style.json', // Map style URL
  center: [-122.420679, 37.772537], // [lng, lat]
  zoom: 13,
  pitch: 0,
  bearing: 0,
  hash: true, // Sync map state with URL hash
  antialias: true,
})

map.on('load', () => {
  console.log('Map loaded')
})
```

## Map Options

```typescript
const map = new maplibregl.Map({
  container: 'map',
  style: {
    version: 8,
    sources: {
      'osm': {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '&copy; OpenStreetMap contributors',
      },
    },
    layers: [
      {
        id: 'osm',
        type: 'raster',
        source: 'osm',
      },
    ],
  },
  center: [0, 0],
  zoom: 2,
  maxZoom: 18,
  minZoom: 1,
  maxBounds: [[-180, -85], [180, 85]],
  transformRequest: (url, resourceType) => {
    if (resourceType === 'Source' && url.startsWith('http://myHost')) {
      return {
        url: url.replace('http', 'https'),
        headers: { 'my-custom-header': 'value' },
        credentials: 'include',
      }
    }
  },
})
```

## Markers

```typescript
// Default marker
const marker = new maplibregl.Marker()
  .setLngLat([-122.4194, 37.7749])
  .addTo(map)

// Custom marker with popup
const popup = new maplibregl.Popup({ offset: 25 })
  .setHTML('<h3>Hello!</h3><p>Welcome to San Francisco</p>')

const marker = new maplibregl.Marker({ color: '#FF0000' })
  .setLngLat([-122.4194, 37.7749])
  .setPopup(popup)
  .addTo(map)

// Draggable marker
const marker = new maplibregl.Marker({ draggable: true })
  .setLngLat([-122.4194, 37.7749])
  .addTo(map)

marker.on('dragend', () => {
  const lngLat = marker.getLngLat()
  console.log('Marker moved to:', lngLat)
})
```

## Sources and Layers

### Vector Source

```typescript
map.addSource('my-data', {
  type: 'geojson',
  data: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-122.4194, 37.7749] },
        properties: { name: 'San Francisco' },
      },
    ],
  },
})

// Circle layer
map.addLayer({
  id: 'points',
  type: 'circle',
  source: 'my-data',
  paint: {
    'circle-radius': 8,
    'circle-color': '#FF0000',
    'circle-stroke-width': 2,
    'circle-stroke-color': '#FFFFFF',
  },
})

// Symbol layer
map.addLayer({
  id: 'labels',
  type: 'symbol',
  source: 'my-data',
  layout: {
    'text-field': ['get', 'name'],
    'text-font': ['Open Sans Regular'],
    'text-offset': [0, 0.6],
    'text-anchor': 'top',
  },
  paint: {
    'text-color': '#333333',
  },
})
```

### GeoJSON Source

```typescript
map.addSource('points', {
  type: 'geojson',
  data: '/path/to/geojson.json',
  cluster: true,
  clusterMaxZoom: 14,
  clusterRadius: 50,
})

map.addLayer({
  id: 'clusters',
  type: 'circle',
  source: 'points',
  filter: ['has', 'point_count'],
  paint: {
    'circle-color': [
      'step',
      ['get', 'point_count'],
      '#51bbd6',
      100,
      '#f1f075',
      750,
      '#f28cb1',
    ],
    'circle-radius': ['step', ['get', 'point_count'], 20, 100, 30, 750, 40],
  },
})

map.addLayer({
  id: 'cluster-count',
  type: 'symbol',
  source: 'points',
  filter: ['has', 'point_count'],
  layout: {
    'text-field': '{point_count_abbreviated}',
    'text-font': ['DIN Offc Pro Medium'],
    'text-size': 12,
  },
})
```

### Raster Source

```typescript
map.addSource('raster', {
  type: 'raster',
  tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
  tileSize: 256,
  attribution: '&copy; OpenStreetMap contributors',
})

map.addLayer({
  id: 'raster-layer',
  type: 'raster',
  source: 'raster',
})
```

## Popups

```typescript
const popup = new maplibregl.Popup({
  closeButton: true,
  closeOnClick: false,
  anchor: 'top-left',
  offset: 10,
})

popup.setLngLat([-122.4194, 37.7749])
  .setHTML('<h3>Hello World</h3>')
  .addTo(map)

// Close popup
popup.remove()
```

## Events

### Map Events

```typescript
map.on('load', () => {
  console.log('Map loaded')
})

map.on('click', (e) => {
  console.log('Click at:', e.lngLat)
})

map.on('mousemove', (e) => {
  console.log('Mouse at:', e.lngLat)
})

map.on('moveend', () => {
  const center = map.getCenter()
  console.log('Map center:', center)
})

map.on('error', (e) => {
  console.error('Map error:', e.error)
})

// Layer-specific events
map.on('click', 'points', (e) => {
  if (e.features && e.features.length > 0) {
    const feature = e.features[0]
    new maplibregl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(`<h3>${feature.properties?.name}</h3>`)
      .addTo(map)
  }
})

// Mouse events on layers
map.on('mouseenter', 'points', () => {
  map.getCanvas().style.cursor = 'pointer'
})

map.on('mouseleave', 'points', () => {
  map.getCanvas().style.cursor = ''
})
```

### Remove Event Listeners

```typescript
function onClick(e) {
  console.log('Clicked')
}

map.on('click', onClick)
map.off('click', onClick)
```

## Camera Methods

```typescript
// Fly to location
map.flyTo({
  center: [-122.4194, 37.7749],
  zoom: 14,
  pitch: 45,
  bearing: 90,
  duration: 2000,
  essential: true,
})

// Ease to location
map.easeTo({
  center: [-122.4194, 37.7749],
  zoom: 14,
  duration: 2000,
})

// Jump to location (instant)
map.jumpTo({
  center: [-122.4194, 37.7749],
  zoom: 14,
})

// Fit bounds
map.fitBounds(
  [[-122.5, 37.5], [-122.3, 37.9]],
  { padding: 50 }
)

// Get current state
const center = map.getCenter()
const zoom = map.getZoom()
const bounds = map.getBounds()
```

## Controls

```typescript
// Navigation control (zoom + compass)
map.addControl(new maplibregl.NavigationControl(), 'top-right')

// Geolocation control
map.addControl(
  new maplibregl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true },
    trackUserLocation: true,
    showUserHeading: true,
  }),
  'top-right'
)

// Scale control
map.addControl(new maplibregl.ScaleControl(), 'bottom-left')

// Attribution control
map.addControl(new maplibregl.AttributionControl(), 'bottom-left')

// Fullscreen control
map.addControl(new maplibregl.FullscreenControl(), 'top-right')
```

## Fit Bounds

```typescript
// Fit map to GeoJSON features
const features = map.querySourceFeatures('my-source')
const bounds = new maplibregl.LngLatBounds()
features.forEach((feature) => {
  bounds.extend(feature.geometry.coordinates)
})
map.fitBounds(bounds, { padding: 50 })
```

## Style Manipulation

```typescript
// Set paint property
map.setPaintProperty('points', 'circle-radius', 12)

// Set layout property
map.setLayoutProperty('points', 'visibility', 'none')

// Get paint property
const radius = map.getPaintProperty('points', 'circle-radius')

// Check if layer exists
const hasLayer = map.getLayer('points')
```

## TypeScript Types

```typescript
import type {
  Map,
  Marker,
  Popup,
  LngLat,
  LngLatBounds,
  GeoJSONSource,
  MapLayerEventType,
  MapEventType,
} from 'maplibre-gl'

// LngLat is [longitude, latitude]
const center: LngLat = map.getCenter()
console.log(center.lng, center.lat)

// GeoJSON types
interface GeoJsonFeature {
  type: 'Feature'
  geometry: {
    type: string
    coordinates: number[] | number[][] | number[][][]
  }
  properties: Record<string, unknown>
}
```

## Cleanup

```typescript
function cleanup() {
  map.remove()
}
```

## Key Patterns

1. Always wait for `map.on('load')` before adding layers/sources
2. Use `LngLat` format: `[longitude, latitude]`
3. Use `flyTo` for smooth transitions, `jumpTo` for instant
4. Remove event listeners when component unmounts
5. Use `queryRenderedFeatures` for feature detection on click/hover
6. Use `querySourceFeatures` for all features from a source
7. Style functions support expressions: `['get', 'property']`, `['step', ...]`
8. Always clean up with `map.remove()` on unmount
