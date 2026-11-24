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
