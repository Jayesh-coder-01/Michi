/**
 * Map & Route Planning TypeScript Types
 * Aligned with PRD Module 5 and Phase 4 Architecture
 */

import { TripStop } from './trip';

export interface Coordinate {
  lat: number;
  lng: number;
}

export type PointType = 'origin' | 'stop' | 'destination';

export interface MapWaypoint {
  id: string;
  pointType: PointType;
  stopId?: string;
  title: string;
  location: string;
  orderIndex: number;
  coordinate: Coordinate | null;
  hasCoordinates: boolean;
  arrivalDate?: string | null;
  departureDate?: string | null;
  stopData?: TripStop;
}

export interface RouteLegInfo {
  legIndex: number;
  fromTitle: string;
  toTitle: string;
  fromOrderIndex: number;
  toOrderIndex: number;
  distanceKm: number | null;
  estimatedDurationMinutes: number | null;
  distanceFormatted: string;
  durationFormatted: string;
  status: 'available' | 'missing_coordinates' | 'unrouted';
}

export interface RouteMetrics {
  totalDistanceKm: number;
  totalDurationMinutes: number;
  distanceFormatted: string;
  durationFormatted: string;
  routeType: 'geoapify_roads' | 'geodesic_haversine' | 'unavailable';
  distanceType?: 'geoapify_road_route' | 'haversine_straight_line';
  durationType?: 'geoapify_verified_duration' | 'unverified_estimate';
  isApproximate: boolean;
  provider?: 'geoapify' | 'haversine' | 'none';
  routeGeometry?: any;
  totalWaypoints: number;
  totalStops: number;
  validCoordinatesCount: number;
  missingCoordinatesCount: number;
  hasMissingCoordinates: boolean;
  legs: RouteLegInfo[];
  waypoints?: MapWaypoint[];
  routingError?: string | null;
}

export type MapLibreStatus = 'idle' | 'loading' | 'loaded' | 'error';

export type MapViewMode = 'split' | 'map' | 'timeline';

