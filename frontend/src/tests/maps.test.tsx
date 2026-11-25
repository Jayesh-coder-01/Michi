import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculateHaversineDistance,
  buildMapWaypoints,
  calculateTripRoute,
  formatDistance,
  formatDuration,
  getMapLibreStyleUrl,
  clearRouteCache,
  geocodeLocation,
  computeBoundingBox,
} from '../services/mapsService';
import { tripService } from '../services/tripService';
import { RouteMetricsBar } from '../components/maps/RouteMetricsBar';
import { InteractiveJourneyMap } from '../components/maps/InteractiveJourneyMap';
import { JourneyTimeline } from '../components/trips/JourneyTimeline';
import { Trip, TripStop } from '../types/trip';
import { RouteMetrics } from '../types/maps';

// Mock Trips for testing
const mockTripLehToManali: Trip = {
  id: 'trip-leh-manali',
  owner_id: 'user-001',
  title: 'Himalayan Ridge Expedition: Leh to Manali',
  description: 'Traversing the legendary Leh-Manali highway across high Himalayan passes.',
  cover_image_url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb',
  starting_location: 'Leh',
  ending_location: 'Manali',
  start_date: '2026-07-01',
  end_date: '2026-07-08',
  category: 'Adventure',
  visibility: 'public',
  status: 'published',
  created_at: '2026-11-20T10:00:00Z',
  updated_at: '2026-11-20T10:00:00Z',
  stops_count: 0,
  owner: {
    id: 'user-001',
    username: 'himalayan_explorer',
    display_name: 'Explorer',
    avatar_url: null,
  },
  stops: [],
};

const mockTripOneStop: Trip = {
  id: 'trip-one-stop',
  owner_id: 'user-001',
  title: 'Tokyo to Kyoto via Hakone',
  description: 'A classic journey stopping in Hakone hot springs.',
  cover_image_url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e',
  starting_location: 'Tokyo',
  ending_location: 'Kyoto',
  start_date: '2026-12-01',
  end_date: '2026-12-05',
  category: 'Cultural exploration',
  visibility: 'public',
  status: 'published',
  created_at: '2026-11-20T10:00:00Z',
  updated_at: '2026-11-20T10:00:00Z',
  stops_count: 1,
  owner: {
    id: 'user-001',
    username: 'daisuke_hikes',
    display_name: 'Daisuke',
    avatar_url: null,
  },
  stops: [
    {
      id: 'stop-hakone',
      trip_id: 'trip-one-stop',
      stop_name: 'Hakone Onsen',
      location: 'Hakone, Kanagawa',
      latitude: 35.2324,
      longitude: 139.107,
      order_index: 0,
      arrival_date: '2026-12-02',
      departure_date: '2026-12-03',
      created_at: '2026-11-20T10:00:00Z',
      updated_at: '2026-11-20T10:00:00Z',
    },
  ],
};

const mockTripWithStops: Trip = {
  id: 'trip-101',
  owner_id: 'user-001',
  title: 'Hokkaido Wilderness Loop',
  description: 'Deep powder, volcanic hot springs, and remote coastal passes.',
  cover_image_url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b',
  starting_location: 'Sapporo Station',
  ending_location: 'Hakodate Harbor',
  start_date: '2026-12-01',
  end_date: '2026-12-10',
  category: 'Adventure',
  visibility: 'public',
  status: 'published',
  created_at: '2026-11-20T10:00:00Z',
  updated_at: '2026-11-20T10:00:00Z',
  stops_count: 3,
  owner: {
    id: 'user-001',
    username: 'daisuke_hikes',
    display_name: 'Daisuke',
    avatar_url: null,
  },
  stops: [
    {
      id: 'stop-1',
      trip_id: 'trip-101',
      stop_name: 'Otaru Canal',
      location: 'Otaru, Hokkaido',
      latitude: 43.1907,
      longitude: 140.9947,
      order_index: 0,
      arrival_date: '2026-12-02',
      departure_date: '2026-12-03',
      created_at: '2026-11-20T10:00:00Z',
      updated_at: '2026-11-20T10:00:00Z',
    },
    {
      id: 'stop-2',
      trip_id: 'trip-101',
      stop_name: 'Niseko Grand Hirafu',
      location: 'Niseko, Hokkaido',
      latitude: 42.8622,
      longitude: 140.7042,
      order_index: 1,
      arrival_date: '2026-12-04',
      departure_date: '2026-12-06',
      created_at: '2026-11-20T10:00:00Z',
      updated_at: '2026-11-20T10:00:00Z',
    },
    {
      id: 'stop-3',
      trip_id: 'trip-101',
      stop_name: 'Lake Toya Caldera',
      location: 'Toya, Hokkaido',
      latitude: 42.6075,
      longitude: 140.8524,
      order_index: 2,
      arrival_date: '2026-12-07',
      departure_date: '2026-12-08',
      created_at: '2026-11-20T10:00:00Z',
      updated_at: '2026-11-20T10:00:00Z',
    },
  ],
};

const mockTripWithMissingCoordinates: Trip = {
  ...mockTripWithStops,
  id: 'trip-103',
  stops: [
    mockTripWithStops.stops[0],
    {
      ...mockTripWithStops.stops[1],
      id: 'stop-unplaced',
      stop_name: 'Secret Hot Spring',
      latitude: 0,
      longitude: 0, // Unplaced / Null Island
    },
  ],
};

describe('Haversine & Formatting Helper Tests', () => {
  it('calculates Haversine great-circle distance accurately', () => {
    // Tokyo (35.6812, 139.7671) to Kyoto (34.9858, 135.7588) ~370.5 km
    const dist = calculateHaversineDistance(
      { lat: 35.6812, lng: 139.7671 },
      { lat: 34.9858, lng: 135.7588 }
    );
    expect(dist).toBeGreaterThan(365);
    expect(dist).toBeLessThan(375);

    // Distance to same point is 0
    expect(calculateHaversineDistance({ lat: 35, lng: 139 }, { lat: 35, lng: 139 })).toBe(0);
  });

  it('formats distance and duration strings appropriately', () => {
    expect(formatDistance(45.2)).toBe('45.2 km');
    expect(formatDistance(1250)).toBe('1,250 km');

    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(60)).toBe('1 hr');
    expect(formatDuration(120)).toBe('2 hrs');
    expect(formatDuration(150)).toBe('2h 30m');
  });

  it('provides MapLibre style url with Geoapify or OSM fallback specification', () => {
    const styleObj = getMapLibreStyleUrl('osm-bright');
    expect(styleObj).toBeDefined();
    if (typeof styleObj === 'object') {
      expect(styleObj.version).toBe(8);
      expect(styleObj.sources['osm-tiles']).toBeDefined();
      expect(styleObj.layers[0].id).toBe('osm-tiles-layer');
    } else {
      expect(styleObj).toContain('geoapify.com');
    }
  });
});

describe('Geocoding Service Tests (FastAPI Proxy)', () => {
  beforeEach(() => {
    clearRouteCache();
    vi.restoreAllMocks();
  });

  it('resolves valid location name to coordinates via FastAPI backend', async () => {
    const geocodeSpy = vi.spyOn(tripService, 'geocodeLocation').mockResolvedValueOnce({
      lat: 34.1642,
      lng: 77.5848,
      formatted: 'Leh, Ladakh, India',
    });

    const coord = await geocodeLocation('Leh');
    expect(coord).toEqual({ lat: 34.1642, lng: 77.5848 });
    expect(geocodeSpy).toHaveBeenCalledWith('Leh');
  });

  it('returns null when backend rejects invalid or ambiguous locations', async () => {
    vi.spyOn(tripService, 'geocodeLocation').mockResolvedValueOnce(null);

    const coord = await geocodeLocation('AmbiguousPlace');
    expect(coord).toBeNull();
  });

  it('handles geocoding failures and network errors gracefully without crashing', async () => {
    vi.spyOn(tripService, 'geocodeLocation').mockRejectedValueOnce(new Error('Network offline or 500'));

    const coord = await geocodeLocation('OfflineLocation');
    expect(coord).toBeNull();

    // Empty or whitespace query returns null immediately
    expect(await geocodeLocation('   ')).toBeNull();
  });

  it('caches successful geocoding results and reuses without re-fetching', async () => {
    const geocodeSpy = vi.spyOn(tripService, 'geocodeLocation').mockResolvedValue({
      lat: 32.2455,
      lng: 77.1873,
      formatted: 'Manali, Himachal Pradesh, India',
    });

    const coord1 = await geocodeLocation('Manali');
    expect(coord1).toEqual({ lat: 32.2455, lng: 77.1873 });
    expect(geocodeSpy).toHaveBeenCalledTimes(1);

    // Second call should return cached coordinate without calling backend
    const coord2 = await geocodeLocation('Manali');
    expect(coord2).toEqual(coord1);
    expect(geocodeSpy).toHaveBeenCalledTimes(1);
  });
});

describe('Map Waypoint Construction & Route Ordering', () => {
  it('builds chronological MapWaypoints starting with origin (0) and ending with destination (N+1)', () => {
    const waypoints = buildMapWaypoints(mockTripWithStops, {
      origin: { lat: 43.0687, lng: 141.3508 },
      destination: { lat: 41.7687, lng: 140.7288 },
    });

    expect(waypoints.length).toBe(5); // Origin + 3 stops + Destination
    expect(waypoints[0].pointType).toBe('origin');
    expect(waypoints[0].location).toBe('Sapporo Station');
    expect(waypoints[0].orderIndex).toBe(0);
    expect(waypoints[0].hasCoordinates).toBe(true);

    expect(waypoints[1].title).toBe('Otaru Canal');
    expect(waypoints[1].orderIndex).toBe(1);
    expect(waypoints[1].hasCoordinates).toBe(true);

    expect(waypoints[2].title).toBe('Niseko Grand Hirafu');
    expect(waypoints[2].orderIndex).toBe(2);

    expect(waypoints[3].title).toBe('Lake Toya Caldera');
    expect(waypoints[3].orderIndex).toBe(3);

    expect(waypoints[4].pointType).toBe('destination');
    expect(waypoints[4].location).toBe('Hakodate Harbor');
    expect(waypoints[4].orderIndex).toBe(4);
    expect(waypoints[4].hasCoordinates).toBe(true);
  });

  it('builds waypoints for zero intermediate stops (Origin -> Destination)', () => {
    const waypoints = buildMapWaypoints(mockTripLehToManali, {
      origin: { lat: 34.1642, lng: 77.5848 },
      destination: { lat: 32.2455, lng: 77.1873 },
    });

    expect(waypoints.length).toBe(2);
    expect(waypoints[0].pointType).toBe('origin');
    expect(waypoints[0].location).toBe('Leh');
    expect(waypoints[0].orderIndex).toBe(0);
    expect(waypoints[0].coordinate).toEqual({ lat: 34.1642, lng: 77.5848 });

    expect(waypoints[1].pointType).toBe('destination');
    expect(waypoints[1].location).toBe('Manali');
    expect(waypoints[1].orderIndex).toBe(1);
    expect(waypoints[1].coordinate).toEqual({ lat: 32.2455, lng: 77.1873 });
  });

  it('flags unplaced (0,0) coordinates as hasCoordinates: false', () => {
    const waypoints = buildMapWaypoints(mockTripWithMissingCoordinates);
    const unplaced = waypoints.find((w) => w.title === 'Secret Hot Spring');

    expect(unplaced).toBeDefined();
    expect(unplaced?.hasCoordinates).toBe(false);
    expect(unplaced?.coordinate).toBeNull();
  });

  it('flags missing origin or missing destination coordinates as hasCoordinates: false', () => {
    const waypoints = buildMapWaypoints(mockTripLehToManali, {
      origin: null,
      destination: { lat: 32.2455, lng: 77.1873 },
    });

    expect(waypoints[0].hasCoordinates).toBe(false);
    expect(waypoints[0].coordinate).toBeNull();
    expect(waypoints[1].hasCoordinates).toBe(true);
  });

  it('computes bounding box enclosing all placed coordinates', () => {
    const waypoints = buildMapWaypoints(mockTripLehToManali, {
      origin: { lat: 34.1642, lng: 77.5848 },
      destination: { lat: 32.2455, lng: 77.1873 },
    });

    const bbox = computeBoundingBox(waypoints);
    expect(bbox).not.toBeNull();
    expect(bbox!.minLat).toBe(32.2455);
    expect(bbox!.maxLat).toBe(34.1642);
    expect(bbox!.minLng).toBe(77.1873);
    expect(bbox!.maxLng).toBe(77.5848);
    expect(bbox!.center.lat).toBeCloseTo((32.2455 + 34.1642) / 2);
  });
});

describe('Trip Route Calculation & Fallbacks', () => {
  beforeEach(() => {
    clearRouteCache();
    vi.restoreAllMocks();
  });

  it('calculates road route for zero intermediate stops (Leh to Manali) with road distance and 1 leg', async () => {
    vi.spyOn(tripService, 'getTripRoute').mockResolvedValueOnce({
      trip_id: 'trip-leh-manali',
      calculation_method: 'geoapify_roads',
      distance_type: 'geoapify_road_route',
      duration_type: 'geoapify_verified_duration',
      is_approximate: false,
      provider: 'geoapify',
      total_distance_km: 426.2,
      estimated_duration_minutes: 396,
      distance_formatted: '426.2 km',
      duration_formatted: '6h 36m',
      total_waypoints: 2,
      total_stops: 0,
      valid_coordinates_count: 2,
      missing_coordinates_count: 0,
      has_missing_coordinates: false,
      route_geometry: {
        type: 'LineString',
        coordinates: [
          [77.5848, 34.1642],
          [77.1873, 32.2455],
        ],
      },
      legs: [
        {
          leg_index: 1,
          from_title: 'Leh',
          to_title: 'Manali',
          from_order_index: 0,
          to_order_index: 1,
          distance_km: 426.2,
          estimated_duration_minutes: 396,
          distance_formatted: '426.2 km',
          duration_formatted: '6h 36m',
          status: 'available',
        },
      ],
      waypoints: [
        {
          point_type: 'origin',
          title: 'Journey Origin',
          location: 'Leh',
          order_index: 0,
          latitude: 34.1642,
          longitude: 77.5848,
          has_coordinates: true,
        },
        {
          point_type: 'destination',
          title: 'Final Destination',
          location: 'Manali',
          order_index: 1,
          latitude: 32.2455,
          longitude: 77.1873,
          has_coordinates: true,
        },
      ],
    });

    const metrics = await calculateTripRoute(mockTripLehToManali);

    expect(metrics.totalStops).toBe(0);
    expect(metrics.totalWaypoints).toBe(2);
    expect(metrics.totalDistanceKm).toBe(426.2);
    expect(metrics.distanceFormatted).toBe('426.2 km');
    expect(metrics.durationFormatted).toBe('6h 36m');
    expect(metrics.durationFormatted).not.toBe('Direct');
    expect(metrics.routeType).toBe('geoapify_roads');
    expect(metrics.isApproximate).toBe(false);
    expect(metrics.legs.length).toBe(1);
    expect(metrics.legs[0].fromTitle).toBe('Leh');
    expect(metrics.legs[0].toTitle).toBe('Manali');
    expect(metrics.legs[0].distanceKm).toBe(426.2);
  });

  it('calculates route for origin, one intermediate stop, and destination (2 legs)', async () => {
    vi.spyOn(tripService, 'getTripRoute').mockResolvedValueOnce({
      trip_id: 'trip-one-stop',
      calculation_method: 'geoapify_roads',
      distance_type: 'geoapify_road_route',
      duration_type: 'geoapify_verified_duration',
      is_approximate: false,
      provider: 'geoapify',
      total_distance_km: 450.0,
      estimated_duration_minutes: 330,
      distance_formatted: '450.0 km',
      duration_formatted: '5h 30m',
      total_waypoints: 3,
      total_stops: 1,
      valid_coordinates_count: 3,
      missing_coordinates_count: 0,
      has_missing_coordinates: false,
      legs: [
        {
          leg_index: 1,
          from_title: 'Tokyo',
          to_title: 'Hakone Onsen',
          from_order_index: 0,
          to_order_index: 1,
          distance_km: 85.0,
          estimated_duration_minutes: 80,
          distance_formatted: '85.0 km',
          duration_formatted: '1h 20m',
          status: 'available',
        },
        {
          leg_index: 2,
          from_title: 'Hakone Onsen',
          to_title: 'Kyoto',
          from_order_index: 1,
          to_order_index: 2,
          distance_km: 365.0,
          estimated_duration_minutes: 250,
          distance_formatted: '365.0 km',
          duration_formatted: '4h 10m',
          status: 'available',
        },
      ],
      waypoints: [
        { point_type: 'origin', title: 'Journey Origin', location: 'Tokyo', order_index: 0, latitude: 35.6812, longitude: 139.7671, has_coordinates: true },
        { point_type: 'stop', title: 'Hakone Onsen', location: 'Hakone, Kanagawa', order_index: 1, latitude: 35.2324, longitude: 139.107, has_coordinates: true },
        { point_type: 'destination', title: 'Final Destination', location: 'Kyoto', order_index: 2, latitude: 34.9858, longitude: 135.7588, has_coordinates: true },
      ],
    });

    const metrics = await calculateTripRoute(mockTripOneStop);

    expect(metrics.totalStops).toBe(1);
    expect(metrics.totalWaypoints).toBe(3);
    expect(metrics.legs.length).toBe(2);
    expect(metrics.legs[0].fromTitle).toBe('Tokyo');
    expect(metrics.legs[0].toTitle).toBe('Hakone Onsen');
    expect(metrics.legs[1].fromTitle).toBe('Hakone Onsen');
    expect(metrics.legs[1].toTitle).toBe('Kyoto');
  });

  it('calculates route for origin, multiple stops, and destination (4 legs)', async () => {
    vi.spyOn(tripService, 'getTripRoute').mockResolvedValueOnce({
      trip_id: 'trip-101',
      calculation_method: 'geoapify_roads',
      distance_type: 'geoapify_road_route',
      duration_type: 'geoapify_verified_duration',
      is_approximate: false,
      provider: 'geoapify',
      total_distance_km: 320.0,
      estimated_duration_minutes: 300,
      total_waypoints: 5,
      total_stops: 3,
      valid_coordinates_count: 5,
      missing_coordinates_count: 0,
      has_missing_coordinates: false,
      legs: [
        { leg_index: 1, from_title: 'Sapporo', to_title: 'Otaru', from_order_index: 0, to_order_index: 1, distance_km: 38.0 },
        { leg_index: 2, from_title: 'Otaru', to_title: 'Niseko', from_order_index: 1, to_order_index: 2, distance_km: 72.0 },
        { leg_index: 3, from_title: 'Niseko', to_title: 'Lake Toya', from_order_index: 2, to_order_index: 3, distance_km: 55.0 },
        { leg_index: 4, from_title: 'Lake Toya', to_title: 'Hakodate', from_order_index: 3, to_order_index: 4, distance_km: 155.0 },
      ],
      waypoints: [
        { point_type: 'origin', title: 'Sapporo', location: 'Sapporo', order_index: 0, latitude: 43.06, longitude: 141.35, has_coordinates: true },
        { point_type: 'stop', title: 'Otaru', location: 'Otaru', order_index: 1, latitude: 43.19, longitude: 140.99, has_coordinates: true },
        { point_type: 'stop', title: 'Niseko', location: 'Niseko', order_index: 2, latitude: 42.86, longitude: 140.70, has_coordinates: true },
        { point_type: 'stop', title: 'Lake Toya', location: 'Lake Toya', order_index: 3, latitude: 42.60, longitude: 140.85, has_coordinates: true },
        { point_type: 'destination', title: 'Hakodate', location: 'Hakodate', order_index: 4, latitude: 41.76, longitude: 140.72, has_coordinates: true },
      ],
    });

    const metrics = await calculateTripRoute(mockTripWithStops);

    expect(metrics.totalStops).toBe(3);
    expect(metrics.totalWaypoints).toBe(5);
    expect(metrics.legs.length).toBe(4);
  });

  it('handles missing origin coordinates and exposes clear routing error', async () => {
    vi.spyOn(tripService, 'getTripRoute').mockResolvedValueOnce({
      trip_id: 'trip-missing-origin',
      calculation_method: 'unavailable',
      distance_type: 'none',
      duration_type: 'none',
      is_approximate: true,
      provider: 'none',
      total_distance_km: 0.0,
      estimated_duration_minutes: 0,
      distance_formatted: '0.0 km',
      duration_formatted: 'Direct',
      total_waypoints: 2,
      total_stops: 0,
      valid_coordinates_count: 1,
      missing_coordinates_count: 1,
      has_missing_coordinates: true,
      routing_error: 'Unable to calculate journey route: missing coordinates for origin (Unknown Origin).',
      legs: [],
      waypoints: [
        { point_type: 'origin', title: 'Journey Origin', location: 'Unknown Origin', order_index: 0, latitude: null, longitude: null, has_coordinates: false },
        { point_type: 'destination', title: 'Final Destination', location: 'Manali', order_index: 1, latitude: 32.2455, longitude: 77.1873, has_coordinates: true },
      ],
    });

    const tripMissingOrigin = { ...mockTripLehToManali, id: 'trip-missing-origin', starting_location: 'Unknown Origin' };
    const metrics = await calculateTripRoute(tripMissingOrigin);

    expect(metrics.hasMissingCoordinates).toBe(true);
    expect(metrics.missingCoordinatesCount).toBe(1);
    expect(metrics.routeType).toBe('unavailable');
    expect(metrics.routingError).toContain('missing coordinates for origin');
  });

  it('handles missing destination coordinates and exposes clear routing error', async () => {
    vi.spyOn(tripService, 'getTripRoute').mockResolvedValueOnce({
      trip_id: 'trip-missing-dest',
      calculation_method: 'unavailable',
      distance_type: 'none',
      duration_type: 'none',
      is_approximate: true,
      provider: 'none',
      total_distance_km: 0.0,
      estimated_duration_minutes: 0,
      total_waypoints: 2,
      total_stops: 0,
      valid_coordinates_count: 1,
      missing_coordinates_count: 1,
      has_missing_coordinates: true,
      routing_error: 'Unable to calculate journey route: missing coordinates for destination (Unknown Destination).',
      legs: [],
      waypoints: [
        { point_type: 'origin', title: 'Journey Origin', location: 'Leh', order_index: 0, latitude: 34.1642, longitude: 77.5848, has_coordinates: true },
        { point_type: 'destination', title: 'Final Destination', location: 'Unknown Destination', order_index: 1, latitude: null, longitude: null, has_coordinates: false },
      ],
    });

    const tripMissingDest = { ...mockTripLehToManali, id: 'trip-missing-dest', ending_location: 'Unknown Destination' };
    const metrics = await calculateTripRoute(tripMissingDest);

    expect(metrics.hasMissingCoordinates).toBe(true);
    expect(metrics.missingCoordinatesCount).toBe(1);
    expect(metrics.routeType).toBe('unavailable');
    expect(metrics.routingError).toContain('missing coordinates for destination');
  });

  it('falls back to Haversine straight-line estimation when Geoapify routing API fails', async () => {
    // Backend route returns haversine fallback with approximate metadata
    vi.spyOn(tripService, 'getTripRoute').mockResolvedValueOnce({
      trip_id: 'trip-leh-manali',
      calculation_method: 'geodesic_haversine',
      distance_type: 'haversine_straight_line',
      duration_type: 'unverified_estimate',
      is_approximate: true,
      provider: 'haversine',
      total_distance_km: 216.5,
      estimated_duration_minutes: 217,
      distance_formatted: '216.5 km',
      duration_formatted: '3h 37m',
      total_waypoints: 2,
      total_stops: 0,
      valid_coordinates_count: 2,
      missing_coordinates_count: 0,
      has_missing_coordinates: false,
      route_geometry: null,
      legs: [
        {
          leg_index: 1,
          from_title: 'Leh',
          to_title: 'Manali',
          from_order_index: 0,
          to_order_index: 1,
          distance_km: 216.5,
          estimated_duration_minutes: 217,
          distance_formatted: '216.5 km',
          duration_formatted: '3h 37m',
          status: 'available',
        },
      ],
      waypoints: [
        { point_type: 'origin', title: 'Journey Origin', location: 'Leh', order_index: 0, latitude: 34.1642, longitude: 77.5848, has_coordinates: true },
        { point_type: 'destination', title: 'Final Destination', location: 'Manali', order_index: 1, latitude: 32.2455, longitude: 77.1873, has_coordinates: true },
      ],
    });

    const metrics = await calculateTripRoute(mockTripLehToManali);

    expect(metrics.routeType).toBe('geodesic_haversine');
    expect(metrics.isApproximate).toBe(true);
    expect(metrics.totalDistanceKm).toBe(216.5);
    expect(metrics.provider).toBe('haversine');
    expect(metrics.distanceType).toBe('haversine_straight_line');
  });

  it('returns cached instance on duplicate calls without recalculating', async () => {
    vi.spyOn(tripService, 'getTripRoute').mockResolvedValue({
      trip_id: 'trip-leh-manali',
      calculation_method: 'geoapify_roads',
      total_distance_km: 426.2,
      estimated_duration_minutes: 396,
      distance_formatted: '426.2 km',
      duration_formatted: '6h 36m',
      legs: [],
      waypoints: [],
    });

    const m1 = await calculateTripRoute(mockTripLehToManali);
    const m2 = await calculateTripRoute(mockTripLehToManali);
    expect(m2).toBe(m1);
  });

  it('invalidates route cache when origin or destination location changes', async () => {
    const routeSpy = vi.spyOn(tripService, 'getTripRoute')
      .mockResolvedValueOnce({
        trip_id: 'trip-leh-manali',
        calculation_method: 'geoapify_roads',
        total_distance_km: 426.2,
        estimated_duration_minutes: 396,
        distance_formatted: '426.2 km',
        duration_formatted: '6h 36m',
        legs: [],
        waypoints: [],
      })
      .mockResolvedValueOnce({
        trip_id: 'trip-leh-manali',
        calculation_method: 'geoapify_roads',
        total_distance_km: 510.0,
        estimated_duration_minutes: 480,
        distance_formatted: '510.0 km',
        duration_formatted: '8 hrs',
        legs: [],
        waypoints: [],
      });

    const m1 = await calculateTripRoute(mockTripLehToManali);
    expect(m1.totalDistanceKm).toBe(426.2);

    const updatedTrip = { ...mockTripLehToManali, ending_location: 'Shimla' };
    const m2 = await calculateTripRoute(updatedTrip);
    expect(m2).not.toBe(m1);
    expect(m2.totalDistanceKm).toBe(510.0);
    expect(routeSpy).toHaveBeenCalledTimes(2);
  });
});

describe('RouteMetricsBar Component Tests', () => {
  const sampleMetrics: RouteMetrics = {
    totalDistanceKm: 145.8,
    totalDurationMinutes: 145,
    distanceFormatted: '145.8 km',
    durationFormatted: '2h 25m',
    routeType: 'geodesic_haversine',
    isApproximate: true,
    totalWaypoints: 5,
    totalStops: 3,
    validCoordinatesCount: 3,
    missingCoordinatesCount: 0,
    hasMissingCoordinates: false,
    legs: [],
  };

  it('renders total distance, estimated duration, and stops metrics', () => {
    render(<RouteMetricsBar metrics={sampleMetrics} />);

    expect(screen.getByText('145.8 km')).toBeInTheDocument();
    expect(screen.getByText('2h 25m')).toBeInTheDocument();
    expect(screen.getByText('3 stops')).toBeInTheDocument();
    expect(screen.getByText('Haversine Straight Line (Estimated)')).toBeInTheDocument();
  });

  it('renders verified road route badge when Geoapify route is available', () => {
    const verifiedMetrics: RouteMetrics = {
      ...sampleMetrics,
      routeType: 'geoapify_roads',
      isApproximate: false,
    };
    render(<RouteMetricsBar metrics={verifiedMetrics} />);

    expect(screen.getByText('Geoapify Road Route (Verified)')).toBeInTheDocument();
  });

  it('never displays 0.0 km or Direct when a valid route exists', () => {
    const validMetrics: RouteMetrics = {
      totalDistanceKm: 426.2,
      totalDurationMinutes: 396,
      distanceFormatted: '426.2 km',
      durationFormatted: '6h 36m',
      routeType: 'geoapify_roads',
      isApproximate: false,
      totalWaypoints: 2,
      totalStops: 0,
      validCoordinatesCount: 2,
      missingCoordinatesCount: 0,
      hasMissingCoordinates: false,
      legs: [],
    };

    render(<RouteMetricsBar metrics={validMetrics} />);

    expect(screen.getByText('426.2 km')).toBeInTheDocument();
    expect(screen.getByText('6h 36m')).toBeInTheDocument();
    expect(screen.queryByText('0.0 km')).not.toBeInTheDocument();
    expect(screen.queryByText('Direct')).not.toBeInTheDocument();
  });

  it('displays clear error notice and action button when routing cannot be calculated', () => {
    const errorMetrics: RouteMetrics = {
      totalDistanceKm: 0,
      totalDurationMinutes: 0,
      distanceFormatted: '0.0 km',
      durationFormatted: 'Direct',
      routeType: 'unavailable',
      isApproximate: true,
      totalWaypoints: 2,
      totalStops: 0,
      validCoordinatesCount: 1,
      missingCoordinatesCount: 1,
      hasMissingCoordinates: true,
      routingError: 'Unable to calculate journey route: missing coordinates for origin.',
      legs: [],
    };

    const onEditMock = vi.fn();
    render(<RouteMetricsBar metrics={errorMetrics} onEditMissingCoordinates={onEditMock} />);

    expect(screen.getByTestId('route-metrics-error')).toBeInTheDocument();
    expect(screen.getByText('Route Calculation Notice')).toBeInTheDocument();
    expect(screen.getByText('Unable to calculate journey route: missing coordinates for origin.')).toBeInTheDocument();

    const editBtn = screen.getByText('Correct Location');
    fireEvent.click(editBtn);
    expect(onEditMock).toHaveBeenCalledTimes(1);
  });

  it('displays missing coordinates warning when waypoints lack coordinates', () => {
    const missingMetrics: RouteMetrics = {
      ...sampleMetrics,
      missingCoordinatesCount: 2,
      hasMissingCoordinates: true,
    };

    render(<RouteMetricsBar metrics={missingMetrics} />);

    const warning = screen.getByTestId('missing-coordinates-warning');
    expect(warning).toBeInTheDocument();
    expect(warning).toHaveTextContent('2 waypoints missing coordinates');
  });

  it('displays skeleton when loading', () => {
    render(<RouteMetricsBar metrics={null} isLoading={true} />);
    expect(screen.getByTestId('route-metrics-loading')).toBeInTheDocument();
  });
});

describe('InteractiveJourneyMap Component Tests', () => {
  beforeEach(() => {
    clearRouteCache();
    vi.restoreAllMocks();
  });

  it('renders zero-intermediate-stop journey (Leh to Manali) with distinct Origin and Destination markers', async () => {
    vi.spyOn(tripService, 'getTripRoute').mockResolvedValueOnce({
      trip_id: 'trip-leh-manali',
      calculation_method: 'geoapify_roads',
      distance_type: 'geoapify_road_route',
      duration_type: 'geoapify_verified_duration',
      is_approximate: false,
      provider: 'geoapify',
      total_distance_km: 426.2,
      estimated_duration_minutes: 396,
      distance_formatted: '426.2 km',
      duration_formatted: '6h 36m',
      total_waypoints: 2,
      total_stops: 0,
      valid_coordinates_count: 2,
      missing_coordinates_count: 0,
      has_missing_coordinates: false,
      route_geometry: {
        type: 'LineString',
        coordinates: [
          [77.5848, 34.1642],
          [77.1873, 32.2455],
        ],
      },
      legs: [
        {
          leg_index: 1,
          from_title: 'Leh',
          to_title: 'Manali',
          from_order_index: 0,
          to_order_index: 1,
          distance_km: 426.2,
          estimated_duration_minutes: 396,
        },
      ],
      waypoints: [
        {
          point_type: 'origin',
          title: 'Journey Origin',
          location: 'Leh',
          order_index: 0,
          latitude: 34.1642,
          longitude: 77.5848,
          has_coordinates: true,
        },
        {
          point_type: 'destination',
          title: 'Final Destination',
          location: 'Manali',
          order_index: 1,
          latitude: 32.2455,
          longitude: 77.1873,
          has_coordinates: true,
        },
      ],
    });

    render(
      <InteractiveJourneyMap
        trip={mockTripLehToManali}
        selectedStopId={null}
        onSelectStop={vi.fn()}
      />
    );

    // Map container exists
    expect(screen.getByTestId('interactive-journey-map')).toBeInTheDocument();

    // In SVG fallback mode (test runner without WebGL), renders SVG route line and endpoints
    await waitFor(() => {
      expect(screen.getByTestId('fallback-svg-route-line')).toBeInTheDocument();
      expect(screen.getByTestId('svg-node-origin')).toBeInTheDocument();
      expect(screen.getByTestId('svg-node-destination')).toBeInTheDocument();
      expect(screen.getByText('Leh')).toBeInTheDocument();
      expect(screen.getByText('Manali')).toBeInTheDocument();
    });

    // Zero intermediate stops means no intermediate stop nodes rendered
    expect(screen.queryByTestId('svg-node-stop-1')).not.toBeInTheDocument();
  });

  it('renders interactive map with intermediate stops and triggers onSelectStop', async () => {
    vi.spyOn(tripService, 'getTripRoute').mockResolvedValueOnce({
      trip_id: 'trip-101',
      calculation_method: 'geoapify_roads',
      total_distance_km: 300,
      estimated_duration_minutes: 240,
      total_waypoints: 5,
      total_stops: 3,
      valid_coordinates_count: 5,
      missing_coordinates_count: 0,
      has_missing_coordinates: false,
      legs: [],
      waypoints: [
        { point_type: 'origin', title: 'Sapporo Station', location: 'Sapporo', order_index: 0, latitude: 43.06, longitude: 141.35, has_coordinates: true },
        { point_type: 'stop', stop_id: 'stop-1', title: 'Otaru Canal', location: 'Otaru', order_index: 1, latitude: 43.19, longitude: 140.99, has_coordinates: true },
        { point_type: 'stop', stop_id: 'stop-2', title: 'Niseko Grand Hirafu', location: 'Niseko', order_index: 2, latitude: 42.86, longitude: 140.70, has_coordinates: true },
        { point_type: 'stop', stop_id: 'stop-3', title: 'Lake Toya Caldera', location: 'Toya', order_index: 3, latitude: 42.60, longitude: 140.85, has_coordinates: true },
        { point_type: 'destination', title: 'Hakodate Harbor', location: 'Hakodate', order_index: 4, latitude: 41.76, longitude: 140.72, has_coordinates: true },
      ],
    });

    const onSelectStopMock = vi.fn();
    render(
      <InteractiveJourneyMap
        trip={mockTripWithStops}
        selectedStopId={null}
        onSelectStop={onSelectStopMock}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Niseko Grand Hirafu')).toBeInTheDocument();
    });

    // Click Niseko node
    fireEvent.click(screen.getByText('Niseko Grand Hirafu'));
    expect(onSelectStopMock).toHaveBeenCalledWith('stop-2');
  });

  it('displays missing coordinates banner when waypoints lack valid coordinates', () => {
    render(
      <InteractiveJourneyMap
        trip={mockTripWithMissingCoordinates}
        selectedStopId={null}
        onSelectStop={vi.fn()}
      />
    );

    const banner = screen.getByTestId('map-unplaced-stops-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent('Secret Hot Spring');
  });
});

describe('Timeline & Map Synchronization Tests', () => {
  it('highlights the selected stop in the JourneyTimeline', () => {
    const onSelectStopMock = vi.fn();

    render(
      <JourneyTimeline
        startingLocation={mockTripWithStops.starting_location}
        endingLocation={mockTripWithStops.ending_location}
        stops={mockTripWithStops.stops}
        selectedStopId="stop-2"
        onSelectStop={onSelectStopMock}
      />
    );

    // Stop 2 card has highlighted active ring
    const stop2Card = screen.getByTestId('timeline-stop-card-stop-2');
    expect(stop2Card).toBeInTheDocument();
    expect(screen.getByText('Focused on Map')).toBeInTheDocument();

    // Clicking Map button on Stop 1 triggers onSelectStop
    const stop1Card = screen.getByTestId('timeline-stop-card-stop-1');
    fireEvent.click(stop1Card);
    expect(onSelectStopMock).toHaveBeenCalledWith('stop-1');
  });
});
