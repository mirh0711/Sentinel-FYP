'use client';

/**
 * MapView — declarative MapLibre via react-map-gl/maplibre.
 *
 * MUST be loaded via next/dynamic with { ssr: false } because MapLibre touches
 * `window` at module load and crashes Next.js SSR/SSG.
 *
 * REGRESSION R5/R6: react-map-gl owns the cleanup contract for the MapLibre map
 * instance. Mounting under <StrictMode> is safe by default; the library
 * disposes the underlying map.remove() on unmount. We do NOT manually wire any
 * useEffect that creates the map — that's the whole point of using the React
 * wrapper instead of vanilla MapLibre.
 *
 * The boundary outline source/layer is added via <Source>+<Layer>, NOT in
 * buildRoadStyle, because the boundary GeoJSON changes per-region while the
 * style spec is built once per palette.
 *
 * The flyTo for region change happens in workbench/page.tsx (where the
 * mapRef is held) — see the useEffect there that watches center/zoom and
 * calls mapRef.current?.flyTo({...}).
 */
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  Map as MapLibreMap,
  Source,
  Layer,
  Popup,
  NavigationControl,
} from 'react-map-gl/maplibre';
import type { MapMouseEvent, MapRef } from 'react-map-gl/maplibre';

import { buildRoadStyle, allRoadLayerIds, roadLayerId, FALLBACK_ROAD_COLOR } from '@/lib/maplibre-style';
// Side-effect import: registers the pmtiles:// protocol with maplibre BEFORE
// the <Map> mounts. Idempotent under HMR.
import '@/lib/maplibre';
import type { ClassPalette } from '@/lib/schemas/classPalette';
import type { BoundaryLayer } from '@/lib/schemas/boundaryLayer';

export interface MapViewProps {
  palette: ClassPalette;
  center: [number, number];
  zoom: number;
  enabled: Record<string, boolean>;
  boundary: BoundaryLayer | null;
  /** Receives the maplibre Map instance for region-change flyTo from the parent. */
  onMapReady: (map: MapRef | null) => void;
}

interface ClickedRoad {
  lng: number;
  lat: number;
  name: string;
  fclass: string;
  color: string;
}

const BOUNDARY_SOURCE_ID = 'boundary-source';
const BOUNDARY_LAYER_ID = 'boundary-layer';

const EMPTY_FC = { type: 'FeatureCollection' as const, features: [] };

export default function MapView({
  palette,
  center,
  zoom,
  enabled,
  boundary,
  onMapReady,
}: MapViewProps) {
  const style = useMemo(() => buildRoadStyle(palette), [palette]);
  const interactiveLayerIds = useMemo(() => allRoadLayerIds(palette), [palette]);
  const [clicked, setClicked] = useState<ClickedRoad | null>(null);

  // initialViewState is one-shot; subsequent moves go through flyTo() in the
  // parent. Lazy-init via useState so center/zoom prop changes don't recompute.
  const [initialViewState] = useState(() => ({
    longitude: center[1],
    latitude: center[0],
    zoom,
  }));

  const handleClick = useCallback(
    (e: MapMouseEvent) => {
      const features = e.features ?? [];
      if (features.length === 0) {
        setClicked(null);
        return;
      }
      const f = features[0];
      if (!f) return;
      const props = (f.properties ?? {}) as { name?: string | null; fclass?: string };
      const fclass = props.fclass ?? '';
      const name = props.name && props.name.trim() ? props.name : '(unnamed)';
      const color = palette.colors[fclass] ?? FALLBACK_ROAD_COLOR;
      setClicked({ lng: e.lngLat.lng, lat: e.lngLat.lat, name, fclass, color });
    },
    [palette],
  );

  // Local ref so the visibility-toggle effect can call setLayoutProperty on
  // the underlying maplibre map. The parent gets the same instance via
  // onMapReady for region-change flyTo.
  const localMapRef = useRef<MapRef | null>(null);
  const handleRefChange = useCallback(
    (instance: MapRef | null) => {
      localMapRef.current = instance;
      onMapReady(instance);
    },
    [onMapReady],
  );

  // Toggle road layer visibility via the imperative MapLibre API. Road layers
  // come from the baked-in style spec (with the right colors on first paint);
  // we override visibility here per the react-map-gl pattern for runtime
  // toggling of style-spec layers.
  useEffect(() => {
    const map = localMapRef.current?.getMap();
    if (!map) return;
    const apply = () => {
      for (const fclass of palette.order) {
        const id = roadLayerId(fclass);
        if (!map.getLayer(id)) continue;
        const visible = enabled[fclass] !== false;
        map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
      }
    };
    if (map.isStyleLoaded()) {
      apply();
      return;
    }
    // Style still loading: defer until ready, and clean up the listener if
    // this effect re-runs or the component unmounts before the event fires.
    map.once('styledata', apply);
    return () => {
      map.off('styledata', apply);
    };
  }, [enabled, palette]);

  return (
    <div className="flex-1" style={{ minHeight: 720, position: 'relative' }}>
      <MapLibreMap
        ref={handleRefChange}
        initialViewState={initialViewState}
        mapStyle={style}
        style={{ width: '100%', height: '100%' }}
        interactiveLayerIds={interactiveLayerIds}
        onClick={handleClick}
        // dblclick is consumed by terra-draw to close the polygon. Disable
        // the default double-click-to-zoom so it doesn't fight the draw UX.
        doubleClickZoom={false}
      >
        <NavigationControl position="top-left" />

        {/* Boundary outline — separate source/layer because boundary changes per-region. */}
        <Source
          id={BOUNDARY_SOURCE_ID}
          type="geojson"
          data={(boundary?.geojson as GeoJSON.FeatureCollection | undefined) ?? EMPTY_FC}
        >
          <Layer
            id={BOUNDARY_LAYER_ID}
            type="line"
            source={BOUNDARY_SOURCE_ID}
            paint={{
              'line-color': '#0f172a',
              'line-width': 1.5,
              'line-opacity': 0.9,
              'line-dasharray': [4, 4],
            }}
          />
        </Source>

        {clicked && (
          <Popup
            longitude={clicked.lng}
            latitude={clicked.lat}
            anchor="top"
            closeButton={false}
            closeOnClick={true}
            onClose={() => setClicked(null)}
            className="netinspect-road-popup"
          >
            <div
              style={{
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: 11,
                color: '#334155',
                lineHeight: 1.2,
              }}
            >
              <b style={{ color: '#0f172a' }}>{clicked.name}</b>
              <br />
              <span style={{ color: clicked.color }}>● </span>
              {clicked.fclass}
            </div>
          </Popup>
        )}
      </MapLibreMap>
    </div>
  );
}
