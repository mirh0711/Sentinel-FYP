/**
 * Pure function that builds a MapLibre GL style spec for the workbench map.
 *
 * Layer order (bottom → top):
 *   1. CARTO light raster basemap (outside / countries / context)
 *   2. One line layer per OVERVIEW_CLASSES entry, colored from the palette
 *   3. Boundary outline (added by MapView via <Source>+<Layer>, NOT here)
 *
 * The style is built once at runtime from the palette returned by
 * /api/class_palette so the frontend keeps zero copies of the road class colors.
 * (`buildRoadStyle` is called from a useMemo in workbench/page.tsx so it only
 * recomputes when the palette ref changes.)
 *
 * Pure function: same input → same output, no side effects, no React. Easy to
 * unit-test in isolation.
 */
import type { StyleSpecification } from 'maplibre-gl';
import type { ClassPalette } from '@/lib/schemas/classPalette';

/**
 * Line widths per OSM road class. Trunk widest, residential thinnest. Mirrors
 * the WIDTHS table from the previous Leaflet MapView.tsx so the visual
 * hierarchy is unchanged after the rebuild. Width interpolates by zoom: thin
 * at z 6, full width at z 14+.
 */
const BASE_WIDTH: Record<string, number> = {
  trunk: 3,
  trunk_link: 2,
  primary: 2.5,
  primary_link: 2,
  secondary: 2,
  secondary_link: 1.5,
  tertiary: 1.5,
  tertiary_link: 1.2,
  residential: 1,
  service: 1,
  unclassified: 1,
};

/** slate-400, used by MapView, ClassLayerLegend, and the style spec for any
 * road class missing from the palette returned by /api/class_palette. */
export const FALLBACK_ROAD_COLOR = '#94a3b8';

const BASEMAP_TILE_URLS = [
  'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
  'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
  'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
];

const BASEMAP_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · CARTO · Earth Engine';

export const PMTILES_URL = 'pmtiles:///tiles/ghana_roads.pmtiles';
export const ROADS_SOURCE_ID = 'roads-pmtiles';
const ROADS_SOURCE_LAYER = 'roads';

/**
 * Layer ID convention: `roads-{fclass}`. Stable so the click handler can build
 * its `interactiveLayerIds` list and so visibility toggles can be applied via
 * map.setLayoutProperty(layerId, 'visibility', ...).
 */
export function roadLayerId(fclass: string): string {
  return `roads-${fclass}`;
}

/** All road layer IDs in the order they appear in the style. */
export function allRoadLayerIds(palette: ClassPalette): string[] {
  return palette.order.map(roadLayerId);
}

/**
 * Build a complete MapLibre style spec containing the basemap raster source,
 * the pmtiles vector roads source, and one line layer per road class in the
 * palette. Boundary outline is added separately by <MapView> as a runtime
 * <Source>/<Layer> so the boundary can change with the selected region.
 */
export function buildRoadStyle(palette: ClassPalette): StyleSpecification {
  return {
    version: 8,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      'basemap-raster': {
        type: 'raster',
        tiles: BASEMAP_TILE_URLS,
        tileSize: 256,
        attribution: BASEMAP_ATTRIBUTION,
        maxzoom: 19,
      },
      [ROADS_SOURCE_ID]: {
        type: 'vector',
        url: PMTILES_URL,
        attribution: '© OpenStreetMap contributors',
      },
    },
    layers: [
      {
        id: 'basemap',
        type: 'raster',
        source: 'basemap-raster',
        minzoom: 0,
        maxzoom: 22,
      },
      // One line layer per road class. The order in palette.order controls
      // paint order — earlier entries paint underneath later ones, so put
      // residential first and trunk/primary last to keep big roads on top.
      ...palette.order.map((fclass) => {
        const baseWidth = BASE_WIDTH[fclass] ?? 1;
        return {
          id: roadLayerId(fclass),
          type: 'line' as const,
          source: ROADS_SOURCE_ID,
          'source-layer': ROADS_SOURCE_LAYER,
          filter: ['==', ['get', 'fclass'], fclass] as ['==', ['get', string], string],
          paint: {
            'line-color': palette.colors[fclass] ?? FALLBACK_ROAD_COLOR,
            // Width interpolates by zoom so distant zooms have hairline roads
            // and close zooms have full-thickness roads. Same end-look as the
            // previous Leaflet hardcoded widths.
            'line-width': [
              'interpolate',
              ['linear'],
              ['zoom'],
              6,
              baseWidth * 0.4,
              10,
              baseWidth * 0.8,
              14,
              baseWidth,
            ],
            'line-opacity': 0.85,
          },
          layout: {
            'line-cap': 'round',
            'line-join': 'round',
          },
        };
      }),
    ],
  } as StyleSpecification;
}

