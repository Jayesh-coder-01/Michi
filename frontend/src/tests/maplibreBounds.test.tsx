import React from 'react';
import { render, waitFor, fireEvent, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Trip } from '../types/trip';
import { clearRouteCache } from '../services/mapsService';
import { tripService } from '../services/tripService';

// Track MapLibre calls across the component lifecycle (hoisted for vi.mock module evaluation)
const { setWorkerUrlCalls } = vi.hoisted(() => ({
  setWorkerUrlCalls: [] as string[],
}));
const mapConstructorCalls: any[] = [];
const boundsExtendCalls: [number, number][] = [];
const fitBoundsCalls: any[] = [];
const markerSetLngLatCalls: { lngLat: [number, number]; pointType: string | null }[] = [];
const addSourceCalls: { id: string; data: any }[] = [];
const addLayerCalls: any[] = [];
const setStyleCalls: { style: any; opts: any }[] = [];

vi.mock('maplibre-gl', () => {
  class MockLngLatBounds {
    private pts: [number, number][] = [];
    extend(coord: [number, number]) {
      this.pts.push(coord);
      boundsExtendCalls.push(coord);
      return this;
    }
    isEmpty() {
      return this.pts.length === 0;
    }
  }

  class MockMarker {
    private el: HTMLElement;
    constructor(opts?: { element?: HTMLElement }) {
      this.el = opts?.element || document.createElement('div');
    }
    setLngLat(lngLat: [number, number]) {
      markerSetLngLatCalls.push({
        lngLat,
        pointType: this.el.getAttribute('data-point-type'),
      });
      return this;
    }
    addTo() {
      return this;
    }
    remove() {}
  }

  class MockPopup {
    setLngLat() { return this; }
    setHTML() { return this; }
    addTo() { return this; }
    remove() {}
  }

  class MockMap {
    private listeners: Record<string, Function[]> = {};
    private sources: Record<string, any> = {};
    private layers: Record<string, any> = {};

    constructor(opts: any) {
      mapConstructorCalls.push(opts);
      // Fire 'load' synchronously on next microtask BEFORE async route fetch completes
      Promise.resolve().then(() => {
        (this.listeners['load'] || []).forEach((cb) => cb());
      });
    }
    on(event: string, cb: Function) {
      this.listeners[event] = this.listeners[event] || [];
      this.listeners[event].push(cb);
    }
    once(event: string, cb: Function) {
      const wrapper = (...args: any[]) => {
        this.listeners[event] = (this.listeners[event] || []).filter((f) => f !== wrapper);
        cb(...args);
      };
      this.on(event, wrapper);
    }
    getStyle() {
      return { version: 8, sources: {}, layers: [] };
    }
    isStyleLoaded() {
      return false; // Verify updateRouteLineLayer does not fail when tiles are still streaming
    }
    getSource(id: string) {
      return this.sources[id];
    }
    addSource(id: string, src: any) {
      addSourceCalls.push({ id, data: src.data });
      this.sources[id] = {
        setData: (d: any) => {
          addSourceCalls.push({ id, data: d });
        },
      };
    }
    getLayer(id: string) {
      return this.layers[id];
    }
    addLayer(layer: any) {
      this.layers[layer.id] = layer;
      addLayerCalls.push(layer);
    }
    removeLayer(id: string) {
      delete this.layers[id];
    }
    removeSource(id: string) {
      delete this.sources[id];
    }
    setPaintProperty() {}
    fitBounds(bounds: any, opts: any) {
      fitBoundsCalls.push({ bounds, opts });
    }
    resize() {}
    setStyle(style: any, opts?: any) {
      setStyleCalls.push({ style, opts });
      // Realistic MapLibre setStyle: wipes custom sources & layers until style.load re-adds them
      this.sources = {};
      this.layers = {};
      Promise.resolve().then(() => {
        (this.listeners['style.load'] || []).forEach((cb) => cb());
      });
    }
    flyTo() {}
    getZoom() { return 8; }
    zoomIn() {}
    zoomOut() {}
    remove() {}
  }

  return {
    setWorkerUrl: (url: string) => {
      setWorkerUrlCalls.push(url);
    },
    Map: MockMap,
    Marker: MockMarker,
    Popup: MockPopup,
    LngLatBounds: MockLngLatBounds,
  };
});

import { InteractiveJourneyMap } from '../components/maps/InteractiveJourneyMap';

describe('MapLibre GL Regression: Leh, Ladakh, India -> Manali, Himachal Pradesh, India', () => {
  beforeEach(() => {
    clearRouteCache();
    vi.restoreAllMocks();
    mapConstructorCalls.length = 0;
    boundsExtendCalls.length = 0;
    fitBoundsCalls.length = 0;
    markerSetLngLatCalls.length = 0;
    addSourceCalls.length = 0;
    addLayerCalls.length = 0;
    setStyleCalls.length = 0;

    // Enable WebGL detection in jsdom so InteractiveJourneyMap initializes MapLibre GL path
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((contextId: string) => {
      if (contextId === 'webgl' || contextId === 'experimental-webgl') {
        return {} as any;
      }
      return null;
    });
    (window as any).WebGLRenderingContext = function () {};
  });

  it('configures worker URL, never centers on Tokyo, renders visible MultiLineString route layer, and preserves route across style switches', async () => {
    let resolveRoute!: (val: any) => void;
    const delayedRoutePromise = new Promise((resolve) => {
      resolveRoute = resolve;
    });

    vi.spyOn(tripService, 'getTripRoute').mockReturnValueOnce(delayedRoutePromise as any);

    const lehManaliTrip: Trip = {
      id: 'trip-india-regression',
      owner_id: 'user-1',
      title: 'Leh to Manali Himalayan Highway',
      description: 'Crossing Taglang La and Baralacha La',
      starting_location: 'Leh, Ladakh, India',
      ending_location: 'Manali, Himachal Pradesh, India',
      start_date: '2026-07-01',
      end_date: '2026-07-05',
      category: 'Adventure',
      visibility: 'public',
      status: 'published',
      created_at: '2026-11-25T00:00:00Z',
      updated_at: '2026-11-25T00:00:00Z',
      stops_count: 0,
      owner: {
        id: 'user-1',
        username: 'rider',
        display_name: 'Rider',
        avatar_url: null,
      },
      stops: [],
    };

    render(<InteractiveJourneyMap trip={lehManaliTrip} selectedStopId={null} onSelectStop={vi.fn()} />);

    // 1. Verify initial MapLibre constructor did NOT center on Tokyo (139.6503, 35.6762)
    expect(mapConstructorCalls.length).toBe(1);
    const initialCenter = mapConstructorCalls[0].center;
    expect(initialCenter).not.toEqual([139.6503, 35.6762]);

    // Allow MapLibre 'load' event microtask to complete BEFORE route resolves
    await new Promise((r) => setTimeout(r, 10));

    // 2. Now resolve backend Geoapify road route asynchronously
    resolveRoute({
      trip_id: 'trip-india-regression',
      calculation_method: 'geoapify_roads',
      distance_type: 'geoapify_road_route',
      duration_type: 'geoapify_verified_duration',
      is_approximate: false,
      provider: 'geoapify',
      total_distance_km: 426.25,
      estimated_duration_minutes: 396,
      distance_formatted: '426.2 km',
      duration_formatted: '6h 36m',
      total_waypoints: 2,
      total_stops: 0,
      valid_coordinates_count: 2,
      missing_coordinates_count: 0,
      has_missing_coordinates: false,
      route_geometry: {
        type: 'MultiLineString',
        coordinates: [
          [
            [77.584753, 34.163745], // Leh start [lng, lat]
            [77.922706, 33.1],     // Eastern bend in Ladakh [lng, lat]
            [77.187332, 32.24529], // Manali end [lng, lat]
          ],
        ],
      },
      legs: [
        {
          leg_index: 1,
          from_title: 'Leh, Ladakh, India',
          to_title: 'Manali, Himachal Pradesh, India',
          from_order_index: 0,
          to_order_index: 1,
          distance_km: 426.25,
          estimated_duration_minutes: 396,
        },
      ],
      waypoints: [
        {
          point_type: 'origin',
          title: 'Origin',
          location: 'Leh, Ladakh, India',
          order_index: 0,
          latitude: 34.1642029,
          longitude: 77.5848133,
          has_coordinates: true,
        },
        {
          point_type: 'destination',
          title: 'Destination',
          location: 'Manali, Himachal Pradesh, India',
          order_index: 1,
          latitude: 32.2454608,
          longitude: 77.1872926,
          has_coordinates: true,
        },
      ],
    });

    // 3. Wait for MapLibre markers, route layer, and fitBounds to run AFTER async resolution
    await waitFor(() => {
      expect(fitBoundsCalls.length).toBeGreaterThanOrEqual(1);
      expect(markerSetLngLatCalls.length).toBe(2);
      expect(addSourceCalls.length).toBeGreaterThanOrEqual(1);
    });

    // Verify Origin Marker A and Destination Marker B use [lng, lat] in Northern India
    const originMarker = markerSetLngLatCalls.find((m) => m.pointType === 'origin');
    const destMarker = markerSetLngLatCalls.find((m) => m.pointType === 'destination');
    expect(originMarker?.lngLat).toEqual([77.5848133, 34.1642029]);
    expect(destMarker?.lngLat).toEqual([77.1872926, 32.2454608]);

    // Verify fitBounds extended around BOTH waypoints AND MultiLineString geometry [lng, lat]
    expect(boundsExtendCalls).toContainEqual([77.5848133, 34.1642029]);
    expect(boundsExtendCalls).toContainEqual([77.1872926, 32.2454608]);
    expect(boundsExtendCalls).toContainEqual([77.922706, 33.1]);

    // Ensure no Japan / Tokyo bounds were extended
    expect(boundsExtendCalls.every(([lng, lat]) => lng > 76 && lng < 79 && lat > 31 && lat < 35)).toBe(true);

    // Verify explicit MapLibre worker URL configured on module load (for GeoJSON Web Worker)
    expect(setWorkerUrlCalls.length).toBeGreaterThanOrEqual(1);
    expect(setWorkerUrlCalls[0]).toContain('maplibre-gl-worker');

    // Verify GeoJSON source added with MultiLineString route geometry
    const routeSrc = addSourceCalls.find((s) => s.id === 'michi-route-source');
    expect(routeSrc).toBeDefined();
    expect(routeSrc?.data.features[0].geometry.type).toBe('MultiLineString');

    // Verify visible route casing & primary line layers referencing michi-route-source
    const casingLayer = addLayerCalls.find((l) => l.id === 'michi-route-casing');
    const lineLayer = addLayerCalls.find((l) => l.id === 'michi-route-line');
    expect(casingLayer).toBeDefined();
    expect(casingLayer?.source).toBe('michi-route-source');
    expect(lineLayer).toBeDefined();
    expect(lineLayer?.type).toBe('line');
    expect(lineLayer?.source).toBe('michi-route-source');
    expect(lineLayer?.layout?.visibility).toBe('visible');
    expect(lineLayer?.paint?.['line-color']).toBe('#E25822');
    expect(lineLayer?.paint?.['line-width']).toBeGreaterThanOrEqual(4);
    expect(lineLayer?.paint?.['line-opacity']).toBeGreaterThanOrEqual(0.85);
    expect(lineLayer?.paint?.['line-dasharray']).toBeUndefined(); // Solid verified road line

    // Verify basemap switching (Dark) preserves route source and visible line layer
    const initialSourceAdds = addSourceCalls.filter((s) => s.id === 'michi-route-source').length;
    const initialLayerAdds = addLayerCalls.filter((l) => l.id === 'michi-route-line').length;
    fireEvent.click(screen.getByText('Dark'));

    await waitFor(() => {
      expect(setStyleCalls.length).toBe(1);
      expect(setStyleCalls[0].opts).toEqual({ diff: false });
      expect(addSourceCalls.filter((s) => s.id === 'michi-route-source').length).toBeGreaterThan(initialSourceAdds);
      expect(addLayerCalls.filter((l) => l.id === 'michi-route-line').length).toBeGreaterThan(initialLayerAdds);
    });
  });
});
