/**
 * Maps & Route Planning Service
 * MapLibre GL JS + Geoapify Routing Architecture
 * Handles Geoapify vector map tile styling, road routing queries, geodesic Haversine fallbacks,
 * and client/server-side caching to avoid redundant recalculations.
 * Aligned with PRD Module 5 and Phase 4 requirements.
 */

import { Coordinate, MapWaypoint, PointType, RouteLegInfo, RouteMetrics } from '../types/maps';
import { Trip } from '../types/trip';
import { tripService } from './tripService';

// In-memory client-side route calculation cache
const routeCalculationCache = new Map<string, RouteMetrics>();
const geocodeCache = new Map<string, Coordinate | null>();

/**
 * Clear the client-side route calculation and geocode caches
 */
export function clearRouteCache(): void {
  routeCalculationCache.clear();
  geocodeCache.clear();
}

/**
 * Server-side Geoapify Geocoding API lookup via FastAPI (/api/v1/trips/geocode)
 * Resolves location name to Coordinate without exposing Geoapify API keys in the frontend.
 */
export async function geocodeLocation(
  query: string
): Promise<Coordinate | null> {
  if (!query || !query.trim()) {
    return null;
  }
  const clean = query.trim();
  const cacheKey = clean.toLowerCase();
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey) || null;
  }

  try {
    const data = await tripService.geocodeLocation(clean);
    if (!data) {
      geocodeCache.set(cacheKey, null);
      return null;
    }

    const lat = Number(data.lat);
    const lng = Number(data.lng);

    if (
      isNaN(lat) ||
      isNaN(lng) ||
      (lat === 0 && lng === 0) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      geocodeCache.set(cacheKey, null);
      return null;
    }

    const coord: Coordinate = { lat, lng };
    geocodeCache.set(cacheKey, coord);
    return coord;
  } catch (err) {
    console.warn(`[Michi Maps] Backend geocoding request failed for '${clean}':`, err);
    return null;
  }
}

/**
 * Returns a MapLibre GL JS compatible style specification.
 * Uses public OpenStreetMap raster tiles so no Geoapify API key is exposed in frontend assets.
 */
export function getMapLibreStyleUrl(
  style: 'osm-bright' | 'osm-carto' | 'dark-matter' = 'osm-bright'
): any {
  const isDark = style === 'dark-matter';
  const isCarto = style === 'osm-carto';

  const rasterPaint: Record<string, any> = isDark
    ? {
        'raster-saturation': -0.85,
        'raster-brightness-max': 0.35,
        'raster-contrast': 0.35,
      }
    : isCarto
    ? {
        'raster-saturation': -0.45,
        'raster-contrast': 0.12,
        'raster-brightness-min': 0.06,
      }
    : {};

  const layers: any[] = [];
  if (isDark) {
    layers.push({
      id: 'dark-background',
      type: 'background',
      paint: {
        'background-color': '#111815',
      },
    });
  }

  layers.push({
    id: 'osm-tiles-layer',
    type: 'raster',
    source: 'osm-tiles',
    minzoom: 0,
    maxzoom: 19,
    paint: rasterPaint,
  });

  return {
    version: 8,
    sources: {
      'osm-tiles': {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      },
    },
    layers,
  };
}

/**
 * Great-circle distance between two coordinates in kilometers using Haversine formula
 */
export function calculateHaversineDistance(
  coord1: Coordinate,
  coord2: Coordinate
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((coord2.lat - coord1.lat) * Math.PI) / 180;
  const dLon = ((coord2.lng - coord1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((coord1.lat * Math.PI) / 180) *
      Math.cos((coord2.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function formatDistance(km: number): string {
  if (km >= 1000) {
    return `${km.toLocaleString(undefined, { maximumFractionDigits: 1 })} km`;
  }
  return `${km.toFixed(1)} km`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return hours === 1 ? '1 hr' : `${hours} hrs`;
  }
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Builds ordered list of journey waypoints from trip metadata and stops
 */
export function buildMapWaypoints(
  trip: Trip,
  resolvedCoordinates?: { origin?: Coordinate | null; destination?: Coordinate | null }
): MapWaypoint[] {
  const waypoints: MapWaypoint[] = [];

  const originCoord = resolvedCoordinates?.origin ?? null;
  const hasOrigin = Boolean(originCoord && !isNaN(originCoord.lat) && !isNaN(originCoord.lng));

  // 1. Starting Location (Origin)
  waypoints.push({
    id: `origin-${trip.id}`,
    pointType: 'origin',
    title: 'Journey Origin',
    location: trip.starting_location,
    orderIndex: 0,
    coordinate: hasOrigin ? originCoord : null,
    hasCoordinates: hasOrigin,
    arrivalDate: trip.start_date,
    departureDate: trip.start_date,
  });

  // 2..N: Intermediate Stops (sorted chronologically)
  const sortedStops = [...(trip.stops || [])].sort((a, b) => a.order_index - b.order_index);

  sortedStops.forEach((stop, index) => {
    const lat = Number(stop.latitude);
    const lng = Number(stop.longitude);
    // Identify unplaced coordinates (Null Island (0,0) or NaN)
    const isPlaced =
      !isNaN(lat) &&
      !isNaN(lng) &&
      !(lat === 0 && lng === 0) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180;

    waypoints.push({
      id: stop.id,
      pointType: 'stop',
      stopId: stop.id,
      title: stop.stop_name,
      location: stop.location,
      orderIndex: index + 1,
      coordinate: isPlaced ? { lat, lng } : null,
      hasCoordinates: isPlaced,
      arrivalDate: stop.arrival_date,
      departureDate: stop.departure_date,
      stopData: stop,
    });
  });

  const destCoord = resolvedCoordinates?.destination ?? null;
  const hasDest = Boolean(destCoord && !isNaN(destCoord.lat) && !isNaN(destCoord.lng));

  // N+1: Ending Location (Destination)
  waypoints.push({
    id: `dest-${trip.id}`,
    pointType: 'destination',
    title: 'Final Destination',
    location: trip.ending_location,
    orderIndex: sortedStops.length + 1,
    coordinate: hasDest ? destCoord : null,
    hasCoordinates: hasDest,
    arrivalDate: trip.end_date,
    departureDate: trip.end_date,
  });

  return waypoints;
}

/**
 * Generate a cache key for route calculations to avoid duplicate requests
 */
function getRouteCacheKey(trip: Trip): string {
  const stopsSignature = (trip.stops || [])
    .map((s) => `${s.id}:${s.order_index}:${s.latitude}:${s.longitude}`)
    .join('|');
  return `${trip.id}_${trip.starting_location}_${trip.ending_location}_${trip.updated_at || ''}_${stopsSignature}`;
}

/**
 * Calculate route metrics (distance, estimated duration, legs, geometry)
 * Prioritizes backend routing API with server-side caching and Geoapify,
 * with graceful fallback to backend geocoding + Haversine straight-line calculation.
 */
export async function calculateTripRoute(
  trip: Trip
): Promise<RouteMetrics> {
  const cacheKey = getRouteCacheKey(trip);
  const cached = routeCalculationCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // 1. Primary path: Backend route calculation endpoint
  if (trip.id) {
    try {
      const backendRoute = await tripService.getTripRoute(trip.id);
      if (backendRoute && backendRoute.trip_id === trip.id) {
        const legs: RouteLegInfo[] = (backendRoute.legs || []).map((l: any) => ({
          legIndex: l.leg_index,
          fromTitle: l.from_title,
          toTitle: l.to_title,
          fromOrderIndex: l.from_order_index,
          toOrderIndex: l.to_order_index,
          distanceKm: l.distance_km,
          estimatedDurationMinutes: l.estimated_duration_minutes,
          distanceFormatted: formatDistance(l.distance_km || 0),
          durationFormatted: formatDuration(l.estimated_duration_minutes || 0),
          status: l.status || 'available',
        }));

        const routeWaypoints: MapWaypoint[] = (backendRoute.waypoints || []).map((w: any) => {
          const lat = w.latitude != null ? Number(w.latitude) : null;
          const lng = w.longitude != null ? Number(w.longitude) : null;
          const isPlaced =
            lat !== null &&
            lng !== null &&
            !isNaN(lat) &&
            !isNaN(lng) &&
            !(lat === 0 && lng === 0) &&
            w.has_coordinates;

          return {
            id: w.point_type === 'stop' && w.stop_id ? w.stop_id : `${w.point_type}-${trip.id}`,
            pointType: w.point_type as PointType,
            stopId: w.stop_id,
            title: w.title,
            location: w.location,
            orderIndex: w.order_index,
            coordinate: isPlaced ? { lat: lat!, lng: lng! } : null,
            hasCoordinates: isPlaced,
            arrivalDate: w.arrival_date,
            departureDate: w.departure_date,
            stopData: (trip.stops || []).find((s) => s.id === w.stop_id),
          };
        });

        const placedJourneyWaypoints = routeWaypoints.filter(
          (w) => w.hasCoordinates && w.coordinate !== null
        );

        const isGeoapify = backendRoute.calculation_method === 'geoapify_roads';
        const hasValidDistance = Number(backendRoute.total_distance_km) > 0;
        const routeType: 'geoapify_roads' | 'geodesic_haversine' | 'unavailable' =
          isGeoapify
            ? 'geoapify_roads'
            : hasValidDistance || placedJourneyWaypoints.length >= 2
            ? 'geodesic_haversine'
            : 'unavailable';

        const metrics: RouteMetrics = {
          totalDistanceKm: backendRoute.total_distance_km,
          totalDurationMinutes: backendRoute.estimated_duration_minutes || 0,
          distanceFormatted:
            backendRoute.distance_formatted || formatDistance(backendRoute.total_distance_km),
          durationFormatted:
            backendRoute.duration_formatted ||
            formatDuration(backendRoute.estimated_duration_minutes || 0),
          routeType,
          distanceType: backendRoute.distance_type,
          durationType: backendRoute.duration_type,
          isApproximate: backendRoute.is_approximate ?? !isGeoapify,
          provider: backendRoute.provider,
          routeGeometry: backendRoute.route_geometry,
          totalWaypoints: backendRoute.total_waypoints ?? routeWaypoints.length,
          totalStops: backendRoute.total_stops ?? (trip.stops || []).length,
          validCoordinatesCount:
            backendRoute.valid_coordinates_count ?? placedJourneyWaypoints.length,
          missingCoordinatesCount:
            backendRoute.missing_coordinates_count ??
            Math.max(0, routeWaypoints.length - placedJourneyWaypoints.length),
          hasMissingCoordinates:
            backendRoute.has_missing_coordinates ??
            placedJourneyWaypoints.length < routeWaypoints.length,
          legs,
          waypoints: routeWaypoints,
          routingError:
            backendRoute.routing_error ||
            (routeType === 'unavailable'
              ? 'Unable to calculate route: missing coordinates for origin or destination.'
              : null),
        };
        routeCalculationCache.set(cacheKey, metrics);
        return metrics;
      }
    } catch {
      // Backend route fetch failed or offline; continue to client-side logic
    }
  }

  // 2. Fallback if backend route endpoint is unavailable: geocode via FastAPI if reachable, then Haversine
  const originCoord = await geocodeLocation(trip.starting_location);
  const destCoord = await geocodeLocation(trip.ending_location);

  const waypoints = buildMapWaypoints(trip, {
    origin: originCoord,
    destination: destCoord,
  });

  const placedWaypoints = waypoints.filter(
    (w) => w.hasCoordinates && w.coordinate !== null
  );

  const totalWaypoints = waypoints.length;
  const totalStops = (trip.stops || []).length;
  const validCoordinatesCount = placedWaypoints.length;
  const missingCoordinatesCount = totalWaypoints - validCoordinatesCount;
  const hasMissingCoordinates = missingCoordinatesCount > 0;

  // 3. Fallback: Client-side Geodesic (Haversine) straight-line calculation
  let totalKm = 0;
  const legs: RouteLegInfo[] = [];

  if (placedWaypoints.length >= 2) {
    for (let i = 0; i < placedWaypoints.length - 1; i++) {
      const fromPoint = placedWaypoints[i];
      const toPoint = placedWaypoints[i + 1];
      const legDistance = calculateHaversineDistance(fromPoint.coordinate!, toPoint.coordinate!);
      totalKm += legDistance;

      const estimatedMinutes = Math.max(5, Math.round((legDistance / 60) * 60));

      legs.push({
        legIndex: i + 1,
        fromTitle: fromPoint.location || fromPoint.title,
        toTitle: toPoint.location || toPoint.title,
        fromOrderIndex: fromPoint.orderIndex,
        toOrderIndex: toPoint.orderIndex,
        distanceKm: legDistance,
        estimatedDurationMinutes: estimatedMinutes,
        distanceFormatted: formatDistance(legDistance),
        durationFormatted: formatDuration(estimatedMinutes),
        status: 'available',
      });
    }
  }

  totalKm = Math.round(totalKm * 10) / 10;
  const totalMinutes = totalKm > 0 ? Math.max(1, Math.round((totalKm / 60) * 60)) : 0;
  const routeType = placedWaypoints.length >= 2 ? 'geodesic_haversine' : 'unavailable';

  const metrics: RouteMetrics = {
    totalDistanceKm: totalKm,
    totalDurationMinutes: totalMinutes,
    distanceFormatted: formatDistance(totalKm),
    durationFormatted: totalMinutes > 0 ? formatDuration(totalMinutes) : 'Unavailable',
    routeType,
    distanceType: routeType === 'unavailable' ? undefined : 'haversine_straight_line',
    durationType: routeType === 'unavailable' ? undefined : 'unverified_estimate',
    isApproximate: true,
    provider: routeType === 'unavailable' ? 'none' : 'haversine',
    routeGeometry: null,
    totalWaypoints,
    totalStops,
    validCoordinatesCount,
    missingCoordinatesCount,
    hasMissingCoordinates,
    legs,
    waypoints,
    routingError:
      routeType === 'unavailable'
        ? 'Unable to calculate route: missing coordinates for origin or destination.'
        : null,
  };

  routeCalculationCache.set(cacheKey, metrics);
  return metrics;
}

/**
 * Computes bounding box enclosing all placed coordinates
 */
export function computeBoundingBox(waypoints: MapWaypoint[]): {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  center: Coordinate;
} | null {
  const coords = waypoints
    .filter((w) => w.hasCoordinates && w.coordinate !== null)
    .map((w) => w.coordinate!);

  if (coords.length === 0) return null;

  let minLat = coords[0].lat;
  let maxLat = coords[0].lat;
  let minLng = coords[0].lng;
  let maxLng = coords[0].lng;

  for (const c of coords) {
    minLat = Math.min(minLat, c.lat);
    maxLat = Math.max(maxLat, c.lat);
    minLng = Math.min(minLng, c.lng);
    maxLng = Math.max(maxLng, c.lng);
  }

  return {
    minLat,
    maxLat,
    minLng,
    maxLng,
    center: {
      lat: (minLat + maxLat) / 2,
      lng: (minLng + maxLng) / 2,
    },
  };
}
