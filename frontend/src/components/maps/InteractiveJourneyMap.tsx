import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as maplibregl from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { Trip, TripStop } from '../../types/trip';

// Configure MapLibre GL JS v6 worker URL explicitly for Vite dev & production builds
// so GeoJSON sources (route polylines) are parsed and tiled cleanly in the Web Worker.
if (typeof maplibregl.setWorkerUrl === 'function' && maplibreWorkerUrl) {
  maplibregl.setWorkerUrl(maplibreWorkerUrl);
}
import {
  MapWaypoint,
  RouteMetrics,
  MapLibreStatus,
  Coordinate,
} from '../../types/maps';
import {
  buildMapWaypoints,
  calculateTripRoute,
  getMapLibreStyleUrl,
} from '../../services/mapsService';

function isWebGLSupported(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

interface InteractiveJourneyMapProps {
  trip: Trip;
  selectedStopId?: string | null;
  onSelectStop?: (stopId: string | null) => void;
  onEditStop?: (stop: TripStop) => void;
  onEditTrip?: () => void;
  className?: string;
  height?: string;
}

export const InteractiveJourneyMap: React.FC<InteractiveJourneyMapProps> = ({
  trip,
  selectedStopId = null,
  onSelectStop,
  onEditStop,
  onEditTrip,
  className = '',
  height = '500px',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const popupRef = useRef<maplibregl.Popup | null>(null);

  const [mapStatus, setMapStatus] = useState<MapLibreStatus>('idle');
  const [routeMetrics, setRouteMetrics] = useState<RouteMetrics | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [mapStyleType, setMapStyleType] = useState<'osm-bright' | 'osm-carto' | 'dark-matter'>('osm-bright');

  // Fallback vector map state (when WebGL is unsupported or map fails)
  const [svgZoom, setSvgZoom] = useState(1);
  const [svgPan, setSvgPan] = useState({ x: 0, y: 0 });
  const [activeTooltipStop, setActiveTooltipStop] = useState<MapWaypoint | null>(null);

  const waypoints = useMemo(() => {
    if (routeMetrics?.waypoints && routeMetrics.waypoints.length > 0) {
      return routeMetrics.waypoints;
    }
    return buildMapWaypoints(trip);
  }, [trip, routeMetrics]);

  const placedWaypoints = useMemo(
    () => waypoints.filter((w) => w.hasCoordinates && w.coordinate !== null),
    [waypoints]
  );
  const unplacedWaypoints = useMemo(
    () => waypoints.filter((w) => !w.hasCoordinates),
    [waypoints]
  );

  // Fetch or calculate route metrics
  useEffect(() => {
    let isMounted = true;
    setIsLoadingRoute(true);

    calculateTripRoute(trip)
      .then((metrics) => {
        if (isMounted) {
          setRouteMetrics(metrics);
        }
      })
      .catch((err) => {
        console.warn('[Michi Maps] Error computing route metrics:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingRoute(false);
      });

    return () => {
      isMounted = false;
    };
  }, [trip]);

  const [styleRevision, setStyleRevision] = useState(0);

  // Fit bounds helper (encloses all placed journey points and GeoJSON route geometry)
  const fitMapBounds = useCallback(() => {
    if (!mapInstanceRef.current) return;
    const bounds = new maplibregl.LngLatBounds();
    let hasPoint = false;

    placedWaypoints.forEach((w) => {
      if (
        w.coordinate &&
        w.coordinate.lat >= -90 &&
        w.coordinate.lat <= 90 &&
        w.coordinate.lng >= -180 &&
        w.coordinate.lng <= 180
      ) {
        bounds.extend([w.coordinate.lng, w.coordinate.lat]);
        hasPoint = true;
      }
    });

    const geom = routeMetrics?.routeGeometry;
    if (geom && geom.coordinates) {
      const coordPairs: any[] =
        geom.type === 'LineString'
          ? geom.coordinates
          : geom.type === 'MultiLineString'
          ? geom.coordinates.flat()
          : [];
      coordPairs.forEach((pt: any) => {
        if (Array.isArray(pt) && pt.length >= 2) {
          const lng = Number(pt[0]);
          const lat = Number(pt[1]);
          if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            bounds.extend([lng, lat]);
            hasPoint = true;
          }
        }
      });
    }

    if (!hasPoint || bounds.isEmpty()) return;
    mapInstanceRef.current.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: 0 });
  }, [placedWaypoints, routeMetrics]);

  // Update route polyline layer on MapLibre map
  const updateRouteLineLayer = useCallback(
    (map: maplibregl.Map, metrics: RouteMetrics | null) => {
      try {
        if (!map.getStyle()) return;
      } catch {
        return;
      }

      const sourceId = 'michi-route-source';
      const casingLayerId = 'michi-route-casing';
      const layerId = 'michi-route-line';

      let geometry: any = null;
      if (metrics?.routeGeometry) {
        geometry = metrics.routeGeometry;
      } else if (placedWaypoints.length >= 2 && (!metrics || metrics.isApproximate)) {
        geometry = {
          type: 'LineString',
          coordinates: placedWaypoints.map((s) => [s.coordinate!.lng, s.coordinate!.lat]),
        };
      }

      if (!geometry) {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getLayer(casingLayerId)) map.removeLayer(casingLayerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
        return;
      }

      const geojsonData: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {
              isApproximate: metrics?.isApproximate ?? true,
            },
            geometry,
          },
        ],
      };

      const existingSource = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
      if (existingSource) {
        existingSource.setData(geojsonData);
        if (map.getLayer(layerId)) {
          map.setPaintProperty(
            layerId,
            'line-dasharray',
            metrics?.isApproximate ? [2, 2] : undefined
          );
        }
      } else {
        map.addSource(sourceId, {
          type: 'geojson',
          data: geojsonData,
        });

        // High-contrast casing under the orange route line so it stays clearly visible on all basemaps
        map.addLayer({
          id: casingLayerId,
          type: 'line',
          source: sourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
            visibility: 'visible',
          },
          paint: {
            'line-color': '#FFFFFF',
            'line-width': 7,
            'line-opacity': 0.85,
          },
        });

        map.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
            visibility: 'visible',
          },
          paint: {
            'line-color': '#E25822',
            'line-width': 4.5,
            'line-opacity': 0.95,
            ...(metrics?.isApproximate ? { 'line-dasharray': [2, 2] } : {}),
          },
        });
      }
    },
    [placedWaypoints]
  );

  // Render MapLibre markers: Distinct Origin, Numbered Intermediate Stops, Distinct Destination
  const updateMapMarkers = useCallback(
    (map: maplibregl.Map) => {
      // Clear previous markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();

      if (placedWaypoints.length === 0) return;

      placedWaypoints.forEach((w) => {
        const isSelected = w.pointType === 'stop' && selectedStopId === w.stopId;
        const isOrigin = w.pointType === 'origin';
        const isDestination = w.pointType === 'destination';

        let pinColor = '#E25822'; // Adventure Orange for intermediate stops
        let labelText = `${w.orderIndex}`;
        let subTitle = `Stop #${w.orderIndex}`;
        let pointTypeBadge = 'Stop';

        if (isOrigin) {
          pinColor = '#1E3F20'; // Forest Green for Origin
          labelText = 'A';
          subTitle = 'Journey Origin';
          pointTypeBadge = 'Origin';
        } else if (isDestination) {
          pinColor = '#B3261E'; // Crimson Red for Destination
          labelText = 'B';
          subTitle = 'Final Destination';
          pointTypeBadge = 'Destination';
        } else if (isSelected) {
          pinColor = '#1E3F20';
        }

        const el = document.createElement('div');
        el.className = `michi-maplibre-marker cursor-pointer transition-transform duration-150 hover:scale-110 ${
          isOrigin ? 'marker-origin' : isDestination ? 'marker-destination' : 'marker-stop'
        }`;
        el.setAttribute('data-point-type', w.pointType);
        el.setAttribute('data-testid', `map-marker-${w.pointType}${w.stopId ? `-${w.stopId}` : ''}`);
        if (w.stopId) {
          el.setAttribute('data-stop-id', w.stopId);
        }

        el.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="${isSelected ? '44' : '36'}" height="${isSelected ? '56' : '46'}" viewBox="0 0 38 48">
            <defs>
              <filter id="shadow-${w.id}" x="-20%" y="-10%" width="140%" height="130%">
                <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.3"/>
              </filter>
            </defs>
            <path d="M19 0C8.5 0 0 8.5 0 19C0 31.5 19 48 19 48S38 31.5 38 19C38 8.5 29.5 0 19 0Z" 
                  fill="${pinColor}" 
                  filter="url(#shadow-${w.id})" />
            <circle cx="19" cy="18" r="12" fill="#FFFFFF"/>
            <text x="19" y="23" font-family="sans-serif" font-size="${labelText.length > 2 ? '9' : '12'}" font-weight="bold" fill="${pinColor}" text-anchor="middle">${labelText}</text>
          </svg>
        `;

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          if (w.stopId && onSelectStop) {
            onSelectStop(w.stopId);
          }

          if (!popupRef.current) {
            popupRef.current = new maplibregl.Popup({ offset: 25, closeButton: true });
          }

          const content = `
            <div style="font-family: inherit; padding: 4px; max-width: 220px; color: #1c1b1f;">
              <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: ${pinColor};">
                ${subTitle}
              </div>
              <div style="font-size: 14px; font-weight: 700; margin: 2px 0 4px 0;">
                ${isOrigin || isDestination ? w.location : w.title}
              </div>
              <div style="font-size: 12px; color: #49454f; margin-bottom: 4px;">
                📍 ${w.location}
              </div>
              ${w.arrivalDate ? `<div style="font-size: 11px; color: #605d62;">📅 ${w.arrivalDate}</div>` : ''}
            </div>
          `;

          popupRef.current
            .setLngLat([w.coordinate!.lng, w.coordinate!.lat])
            .setHTML(content)
            .addTo(map);
        });

        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([w.coordinate!.lng, w.coordinate!.lat])
          .addTo(map);

        markersRef.current.set(w.id, marker);
      });
    },
    [placedWaypoints, selectedStopId, onSelectStop]
  );

  // Initialize MapLibre GL instance
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Check WebGL support
    if (!isWebGLSupported()) {
      console.warn('[Michi Maps] WebGL is not supported in this environment; using vector path fallback.');
      setMapStatus('error');
      return;
    }

    setMapStatus('loading');

    const initialHasWaypoints = placedWaypoints.length > 0 && placedWaypoints[0].coordinate;
    const defaultCenter: [number, number] = initialHasWaypoints
      ? [placedWaypoints[0].coordinate!.lng, placedWaypoints[0].coordinate!.lat]
      : [20.0, 20.0];

    const styleUrl = getMapLibreStyleUrl(mapStyleType);

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: styleUrl,
        center: defaultCenter,
        zoom: initialHasWaypoints ? (placedWaypoints.length > 1 ? 8 : 11) : 1.5,
        attributionControl: false,
      });
    } catch (err) {
      console.warn('[Michi Maps] Failed to initialize MapLibre GL map instance:', err);
      setMapStatus('error');
      return;
    }

    mapInstanceRef.current = map;

    map.once('style.load', () => {
      setMapStatus('loaded');
    });

    map.on('load', () => {
      setMapStatus('loaded');
    });

    map.on('error', (e: any) => {
      console.warn('[Michi Maps] MapLibre error event:', e);
    });

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      if (popupRef.current) {
        popupRef.current.remove();
      }
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Track whether basemap style has been switched by the user so initial mount isn't duplicated
  const prevStyleRef = useRef(mapStyleType);

  // Update map style on layer switcher toggle
  useEffect(() => {
    if (!mapInstanceRef.current || mapStatus !== 'loaded') return;
    if (prevStyleRef.current === mapStyleType) return;
    prevStyleRef.current = mapStyleType;

    const styleUrl = getMapLibreStyleUrl(mapStyleType);
    // diff: false ensures MapLibre cleanly rebuilds style and fires 'style.load' so the route layer is re-added
    mapInstanceRef.current.setStyle(styleUrl, { diff: false });
    mapInstanceRef.current.once('style.load', () => {
      setStyleRevision((r) => r + 1);
    });
  }, [mapStyleType, mapStatus]);

  // Synchronize route polyline and markers when route metrics, stops, or style update
  useEffect(() => {
    if (!mapInstanceRef.current || mapStatus !== 'loaded') return;
    updateRouteLineLayer(mapInstanceRef.current, routeMetrics);
    updateMapMarkers(mapInstanceRef.current);
  }, [routeMetrics, placedWaypoints, selectedStopId, mapStatus, styleRevision, updateRouteLineLayer, updateMapMarkers]);

  // Automatically fit map bounds when map finishes loading or route/waypoints resolve
  useEffect(() => {
    if (!mapInstanceRef.current || mapStatus !== 'loaded') return;
    if (placedWaypoints.length > 0) {
      mapInstanceRef.current.resize();
      fitMapBounds();
    }
  }, [routeMetrics, placedWaypoints, mapStatus, fitMapBounds]);

  // Synchronize map pan with selected stop
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedStopId || mapStatus !== 'loaded') return;
    const stop = placedWaypoints.find((s) => s.stopId === selectedStopId);
    if (stop && stop.coordinate) {
      mapInstanceRef.current.flyTo({
        center: [stop.coordinate.lng, stop.coordinate.lat],
        zoom: Math.max(mapInstanceRef.current.getZoom(), 11),
        essential: true,
      });

      if (!popupRef.current) {
        popupRef.current = new maplibregl.Popup({ offset: 25, closeButton: true });
      }

      const content = `
        <div style="font-family: inherit; padding: 4px; max-width: 220px; color: #1c1b1f;">
          <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #1e3f20;">
            Active Stop #${stop.orderIndex}
          </div>
          <div style="font-size: 14px; font-weight: 700; margin: 2px 0 4px 0;">
            ${stop.title}
          </div>
          <div style="font-size: 12px; color: #49454f;">
            📍 ${stop.location}
          </div>
        </div>
      `;

      popupRef.current
        .setLngLat([stop.coordinate.lng, stop.coordinate.lat])
        .setHTML(content)
        .addTo(mapInstanceRef.current);
    }
  }, [selectedStopId, mapStatus, placedWaypoints]);

  // Fallback SVG Journey Map Bounds
  const svgBounds = useMemo(() => {
    if (placedWaypoints.length === 0) return null;
    let minLat = Infinity,
      maxLat = -Infinity,
      minLng = Infinity,
      maxLng = -Infinity;
    placedWaypoints.forEach((s) => {
      if (s.coordinate) {
        minLat = Math.min(minLat, s.coordinate.lat);
        maxLat = Math.max(maxLat, s.coordinate.lat);
        minLng = Math.min(minLng, s.coordinate.lng);
        maxLng = Math.max(maxLng, s.coordinate.lng);
      }
    });

    const latSpan = Math.max(0.01, maxLat - minLat);
    const lngSpan = Math.max(0.01, maxLng - minLng);

    return { minLat, maxLat, minLng, maxLng, latSpan, lngSpan };
  }, [placedWaypoints]);

  // Map coordinate to SVG viewBox space (600x400)
  const getSvgCoordinates = useCallback(
    (coord: Coordinate) => {
      if (!svgBounds) return { x: 300, y: 200 };
      const padding = 60;
      const width = 600 - padding * 2;
      const height = 400 - padding * 2;

      const x = padding + ((coord.lng - svgBounds.minLng) / svgBounds.lngSpan) * width;
      const y = padding + ((svgBounds.maxLat - coord.lat) / svgBounds.latSpan) * height;
      return { x, y };
    },
    [svgBounds]
  );

  return (
    <div
      data-testid="interactive-journey-map"
      className={`relative rounded-3xl overflow-hidden border border-light-outline-variant dark:border-dark-outline-variant bg-light-surface-container dark:bg-dark-surface-container shadow-md flex flex-col ${className}`}
      style={{ height }}
    >
      {/* Top Banner: Missing Coordinates Warning */}
      {unplacedWaypoints.length > 0 && (
        <div
          data-testid="map-unplaced-stops-banner"
          className="absolute top-3 left-3 right-3 z-20 px-3.5 py-2 rounded-xl bg-amber-500/90 text-white backdrop-blur-md shadow-md flex items-center justify-between text-xs font-medium"
        >
          <div className="flex items-center gap-1.5 truncate">
            <span className="material-symbols-outlined text-base">warning</span>
            <span>
              {unplacedWaypoints.length} {unplacedWaypoints.length === 1 ? 'location is' : 'locations are'} missing
              coordinates: {unplacedWaypoints.map((s) => s.pointType === 'origin' || s.pointType === 'destination' ? `${s.title} (${s.location})` : s.title).join(', ')}
            </span>
          </div>
          {onEditTrip && unplacedWaypoints.some((w) => w.pointType === 'origin' || w.pointType === 'destination') ? (
            <button
              type="button"
              onClick={onEditTrip}
              className="ml-2 underline font-bold whitespace-nowrap hover:text-white/80"
            >
              Edit Journey
            </button>
          ) : onEditStop && unplacedWaypoints.find((w) => w.stopData)?.stopData ? (
            <button
              type="button"
              onClick={() => onEditStop(unplacedWaypoints.find((w) => w.stopData)!.stopData!)}
              className="ml-2 underline font-bold whitespace-nowrap hover:text-white/80"
            >
              Edit Stop
            </button>
          ) : null}
        </div>
      )}

      {/* Floating Controls Overlay (Zoom, Recenter, Layer Switcher) */}
      <div className="absolute top-14 right-3 z-10 flex flex-col gap-2">
        {mapStatus === 'loaded' && (
          <>
            <div className="flex flex-col rounded-xl overflow-hidden shadow-lg bg-light-surface/95 dark:bg-dark-surface/95 backdrop-blur-md border border-light-outline-variant/60 dark:border-dark-outline-variant/60">
              <button
                type="button"
                onClick={() => {
                  if (mapInstanceRef.current) {
                    mapInstanceRef.current.zoomIn();
                  }
                }}
                className="p-2 hover:bg-light-surface-container dark:hover:bg-dark-surface-container text-light-on-surface dark:text-dark-on-surface transition-colors"
                title="Zoom in"
                aria-label="Zoom in"
              >
                <span className="material-symbols-outlined text-lg">add</span>
              </button>
              <div className="h-[1px] bg-light-outline-variant/60 dark:border-dark-outline-variant/60" />
              <button
                type="button"
                onClick={() => {
                  if (mapInstanceRef.current) {
                    mapInstanceRef.current.zoomOut();
                  }
                }}
                className="p-2 hover:bg-light-surface-container dark:hover:bg-dark-surface-container text-light-on-surface dark:text-dark-on-surface transition-colors"
                title="Zoom out"
                aria-label="Zoom out"
              >
                <span className="material-symbols-outlined text-lg">remove</span>
              </button>
            </div>

            <button
              type="button"
              onClick={fitMapBounds}
              className="p-2 rounded-xl shadow-lg bg-light-surface/95 dark:bg-dark-surface/95 backdrop-blur-md border border-light-outline-variant/60 dark:border-dark-outline-variant/60 text-forest-green dark:text-dark-primary hover:bg-light-surface-container dark:hover:bg-dark-surface-container transition-colors"
              title="Fit all stops in view"
              aria-label="Fit all stops in view"
            >
              <span className="material-symbols-outlined text-lg">crop_free</span>
            </button>

            {/* Layer Switcher */}
            <div className="flex flex-col rounded-xl overflow-hidden shadow-lg bg-light-surface/95 dark:bg-dark-surface/95 backdrop-blur-md border border-light-outline-variant/60 dark:border-dark-outline-variant/60 text-xs">
              <button
                type="button"
                onClick={() => setMapStyleType('osm-bright')}
                className={`px-2 py-1.5 transition-colors font-medium ${
                  mapStyleType === 'osm-bright'
                    ? 'bg-adventure-orange text-white'
                    : 'hover:bg-light-surface-container dark:hover:bg-dark-surface-container text-light-on-surface dark:text-dark-on-surface'
                }`}
              >
                Bright
              </button>
              <button
                type="button"
                onClick={() => setMapStyleType('osm-carto')}
                className={`px-2 py-1.5 transition-colors font-medium ${
                  mapStyleType === 'osm-carto'
                    ? 'bg-adventure-orange text-white'
                    : 'hover:bg-light-surface-container dark:hover:bg-dark-surface-container text-light-on-surface dark:text-dark-on-surface'
                }`}
              >
                Carto
              </button>
              <button
                type="button"
                onClick={() => setMapStyleType('dark-matter')}
                className={`px-2 py-1.5 transition-colors font-medium ${
                  mapStyleType === 'dark-matter'
                    ? 'bg-adventure-orange text-white'
                    : 'hover:bg-light-surface-container dark:hover:bg-dark-surface-container text-light-on-surface dark:text-dark-on-surface'
                }`}
              >
                Dark
              </button>
            </div>
          </>
        )}

        {mapStatus === 'error' && placedWaypoints.length > 0 && (
          <div className="flex flex-col rounded-xl overflow-hidden shadow-lg bg-light-surface/95 dark:bg-dark-surface/95 backdrop-blur-md border border-light-outline-variant/60 dark:border-dark-outline-variant/60">
            <button
              type="button"
              onClick={() => setSvgZoom((z) => Math.min(2.5, z + 0.25))}
              className="p-2 hover:bg-light-surface-container dark:hover:bg-dark-surface-container text-light-on-surface dark:text-dark-on-surface"
              title="Zoom in vector path"
            >
              <span className="material-symbols-outlined text-lg">add</span>
            </button>
            <div className="h-[1px] bg-light-outline-variant/60" />
            <button
              type="button"
              onClick={() => setSvgZoom((z) => Math.max(0.75, z - 0.25))}
              className="p-2 hover:bg-light-surface-container dark:hover:bg-dark-surface-container text-light-on-surface dark:text-dark-on-surface"
              title="Zoom out vector path"
            >
              <span className="material-symbols-outlined text-lg">remove</span>
            </button>
            <div className="h-[1px] bg-light-outline-variant/60" />
            <button
              type="button"
              onClick={() => {
                setSvgZoom(1);
                setSvgPan({ x: 0, y: 0 });
              }}
              className="p-2 hover:bg-light-surface-container dark:hover:bg-dark-surface-container text-forest-green dark:text-dark-primary"
              title="Reset view"
            >
              <span className="material-symbols-outlined text-lg">restart_alt</span>
            </button>
          </div>
        )}
      </div>

      {/* Primary MapLibre GL Canvas Container */}
      <div
        ref={mapContainerRef}
        data-testid="maplibre-container"
        className={`w-full h-full flex-1 ${mapStatus === 'error' ? 'hidden' : 'block'}`}
      />

      {/* Fallback Interactive SVG Journey Path View */}
      {mapStatus === 'error' && (
        <div
          data-testid="fallback-vector-map"
          className="relative w-full h-full flex-1 flex flex-col items-center justify-center p-4 bg-gradient-to-b from-forest-green/5 via-light-surface to-adventure-orange/5 dark:from-dark-surface dark:via-dark-surface-container dark:to-dark-surface"
        >
          {placedWaypoints.length < 2 ? (
            /* Empty State: Trip has fewer than 2 placed waypoints */
            <div className="flex flex-col items-center justify-center text-center p-6 max-w-md gap-3">
              <div className="w-16 h-16 rounded-full bg-forest-green/15 text-forest-green dark:text-dark-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl">wrong_location</span>
              </div>
              <h4 className="font-headline text-title-md font-bold text-light-on-surface dark:text-dark-on-surface">
                Route Coordinates Unavailable
              </h4>
              <p className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant leading-relaxed">
                Could not resolve coordinates for origin (<strong className="text-forest-green">{trip.starting_location}</strong>) or destination (<strong className="text-adventure-orange">{trip.ending_location}</strong>).
                Please edit the journey locations.
              </p>
            </div>
          ) : (
            /* Interactive SVG Journey Graph */
            <div className="w-full h-full relative overflow-hidden flex items-center justify-center">
              <svg
                viewBox="0 0 600 400"
                className="w-full h-full cursor-grab active:cursor-grabbing select-none"
                style={{
                  transform: `scale(${svgZoom}) translate(${svgPan.x}px, ${svgPan.y}px)`,
                  transition: 'transform 0.15s ease-out',
                }}
              >
                {/* Background topographic grid simulation */}
                <defs>
                  <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                    <path
                      d="M 30 0 L 0 0 0 30"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="0.5"
                      className="text-light-outline-variant/30 dark:text-dark-outline-variant/20"
                    />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />

                {/* Polyline Path connecting all placed waypoints */}
                {placedWaypoints.length >= 2 && (
                  <path
                    data-testid="fallback-svg-route-line"
                    d={placedWaypoints
                      .map((s, i) => {
                        const pt = getSvgCoordinates(s.coordinate!);
                        return `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`;
                      })
                      .join(' ')}
                    fill="none"
                    stroke="#E25822"
                    strokeWidth="3.5"
                    strokeDasharray={routeMetrics?.isApproximate ? "6 4" : undefined}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Waypoint Nodes: Origin (A), Intermediate Stops (1..N), Destination (B) */}
                {placedWaypoints.map((point) => {
                  const pt = getSvgCoordinates(point.coordinate!);
                  const isSelected = point.pointType === 'stop' && selectedStopId === point.stopId;
                  const isOrigin = point.pointType === 'origin';
                  const isDestination = point.pointType === 'destination';

                  let nodeColor = '#E25822';
                  let nodeLabel = `${point.orderIndex}`;
                  let titleLabel = point.title;

                  if (isOrigin) {
                    nodeColor = '#1E3F20'; // Green for Origin
                    nodeLabel = 'A';
                    titleLabel = point.location;
                  } else if (isDestination) {
                    nodeColor = '#B3261E'; // Crimson for Destination
                    nodeLabel = 'B';
                    titleLabel = point.location;
                  } else if (isSelected) {
                    nodeColor = '#1E3F20';
                  }

                  return (
                    <g
                      key={point.id}
                      data-testid={`svg-node-${point.pointType}${point.stopId ? `-${point.stopId}` : ''}`}
                      className="cursor-pointer group"
                      onClick={() => {
                        if (point.stopId && onSelectStop) onSelectStop(point.stopId);
                        setActiveTooltipStop(point);
                      }}
                    >
                      {/* Selection Ring */}
                      {isSelected && (
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r="22"
                          fill="none"
                          stroke="#1E3F20"
                          strokeWidth="2.5"
                          className="animate-pulse"
                        />
                      )}

                      {/* Main Node */}
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="14"
                        fill={nodeColor}
                        stroke="#FFFFFF"
                        strokeWidth="2"
                        className="transition-transform duration-200 group-hover:scale-110"
                      />

                      {/* Sequence / Indicator Label */}
                      <text
                        x={pt.x}
                        y={pt.y + 4}
                        fill="#FFFFFF"
                        fontSize="10"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {nodeLabel}
                      </text>

                      {/* Waypoint Title / Location Label below pin */}
                      <text
                        x={pt.x}
                        y={pt.y + 24}
                        fill="currentColor"
                        fontSize="11"
                        fontWeight="600"
                        textAnchor="middle"
                        className="text-light-on-surface dark:text-dark-on-surface fill-current"
                      >
                        {titleLabel}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Vector Map Mode Info Badge */}
              <div className="absolute bottom-3 left-3 z-10 px-3 py-1.5 rounded-xl bg-light-surface/90 dark:bg-dark-surface/90 backdrop-blur-md border border-light-outline-variant/60 dark:border-dark-outline-variant/60 shadow-sm flex items-center gap-1.5 font-label text-label-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
                <span className="material-symbols-outlined text-sm text-forest-green dark:text-dark-primary">
                  explore
                </span>
                <span>Interactive Journey Path</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bottom Floating Legend / Route Summary Pill */}
      {routeMetrics && placedWaypoints.length >= 2 && (
        <div className="absolute bottom-3 right-3 z-10 hidden sm:flex items-center gap-3 px-3.5 py-1.5 rounded-xl bg-light-surface/95 dark:bg-dark-surface/95 backdrop-blur-md border border-light-outline-variant/60 dark:border-dark-outline-variant/60 shadow-md font-label text-label-xs text-light-on-surface dark:text-dark-on-surface">
          <span className="flex items-center gap-1 font-semibold text-forest-green dark:text-dark-primary">
            <span className="material-symbols-outlined text-sm">straighten</span>
            {routeMetrics.distanceFormatted}
          </span>
          <span className="text-light-outline-variant">•</span>
          <span className="flex items-center gap-1 font-semibold text-adventure-orange">
            <span className="material-symbols-outlined text-sm">schedule</span>
            {routeMetrics.durationFormatted}
          </span>
          <span className="text-light-outline-variant">•</span>
          <span>{placedWaypoints.length} waypoints</span>
        </div>
      )}
    </div>
  );
};
