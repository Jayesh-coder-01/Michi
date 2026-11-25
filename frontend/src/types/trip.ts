export type TripVisibility = 'public' | 'private';
export type TripStatus = 'draft' | 'published' | 'archived';

export type TripCategory =
  | 'Solo travel'
  | 'Road trip'
  | 'Backpacking'
  | 'Family trip'
  | 'Adventure'
  | 'Trekking'
  | 'Cultural exploration'
  | 'Beach vacation'
  | 'International travel'
  | 'Other';

export const TRIP_CATEGORIES: TripCategory[] = [
  'Solo travel',
  'Road trip',
  'Backpacking',
  'Family trip',
  'Adventure',
  'Trekking',
  'Cultural exploration',
  'Beach vacation',
  'International travel',
  'Other',
];

export interface TripOwnerSnippet {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string | null;
}

export interface TripStop {
  id: string;
  trip_id: string;
  stop_name: string;
  location: string;
  latitude: number;
  longitude: number;
  arrival_date?: string | null;
  departure_date?: string | null;
  accommodation_details?: string | null;
  activities?: string | null;
  notes?: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface Trip {
  id: string;
  owner_id: string;
  title: string;
  description?: string | null;
  cover_image_url?: string | null;
  starting_location: string;
  ending_location: string;
  start_date?: string | null;
  end_date?: string | null;
  category: TripCategory;
  visibility: TripVisibility;
  status: TripStatus;
  created_at: string;
  updated_at: string;
  owner: TripOwnerSnippet;
  stops_count: number;
  stops: TripStop[];
}

export interface TripListItem {
  id: string;
  owner_id: string;
  title: string;
  description?: string | null;
  cover_image_url?: string | null;
  starting_location: string;
  ending_location: string;
  start_date?: string | null;
  end_date?: string | null;
  category: TripCategory;
  visibility: TripVisibility;
  status: TripStatus;
  created_at: string;
  stops_count: number;
  owner: TripOwnerSnippet;
}

export interface PaginatedTripList {
  items: TripListItem[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

export interface TripCreateInput {
  title: string;
  description?: string | null;
  cover_image_url?: string | null;
  starting_location: string;
  ending_location: string;
  start_date?: string | null;
  end_date?: string | null;
  category?: TripCategory;
  visibility?: TripVisibility;
}

export interface TripUpdateInput {
  title?: string;
  description?: string | null;
  cover_image_url?: string | null;
  starting_location?: string;
  ending_location?: string;
  start_date?: string | null;
  end_date?: string | null;
  category?: TripCategory;
  visibility?: TripVisibility;
}

export interface TripPublishInput {
  visibility?: TripVisibility;
}

export interface TripStopCreateInput {
  stop_name: string;
  location: string;
  latitude: number;
  longitude: number;
  arrival_date?: string | null;
  departure_date?: string | null;
  accommodation_details?: string | null;
  activities?: string | null;
  notes?: string | null;
}

export interface TripStopUpdateInput {
  stop_name?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  arrival_date?: string | null;
  departure_date?: string | null;
  accommodation_details?: string | null;
  activities?: string | null;
  notes?: string | null;
}

export interface TripStopReorderInput {
  ordered_stop_ids: string[];
}

export interface RouteWaypointResponse {
  point_type: 'origin' | 'stop' | 'destination';
  stop_id?: string | null;
  title: string;
  location: string;
  order_index: number;
  latitude?: number | null;
  longitude?: number | null;
  has_coordinates: boolean;
  arrival_date?: string | null;
  departure_date?: string | null;
}

export interface RouteLegResponse {
  leg_index: number;
  from_title: string;
  to_title: string;
  from_order_index: number;
  to_order_index: number;
  distance_km?: number | null;
  estimated_duration_minutes?: number | null;
  status: 'available' | 'missing_coordinates' | 'unrouted';
}

export interface TripRouteSummary {
  trip_id: string;
  title: string;
  starting_location: string;
  ending_location: string;
  total_waypoints: number;
  total_stops: number;
  valid_coordinates_count: number;
  missing_coordinates_count: number;
  has_missing_coordinates: boolean;
  total_distance_km: number;
  estimated_duration_minutes: number;
  distance_formatted: string;
  duration_formatted: string;
  calculation_method: string;
  waypoints: RouteWaypointResponse[];
  legs: RouteLegResponse[];
}

