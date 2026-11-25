import {
  Trip,
  TripCreateInput,
  TripUpdateInput,
  TripPublishInput,
  PaginatedTripList,
  TripStop,
  TripStopCreateInput,
  TripStopUpdateInput,
} from '../types/trip';
import { APIResponse } from '../types/api';
import { supabase } from './supabaseClient';

const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, '');
const fallbackOrigin =
  typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null'
    ? window.location.origin
    : 'http://localhost:3000';
const API_BASE =
  configuredApiBase && /^https?:\/\//i.test(configuredApiBase)
    ? configuredApiBase
    : `${fallbackOrigin}${configuredApiBase || '/api/v1'}`;

async function getAccessToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    const sessionToken = data?.session?.access_token;
    if (sessionToken) {
      localStorage.setItem('michi_access_token', sessionToken);
      return sessionToken;
    }
  } catch {
    // Fall back to localStorage if Supabase session lookup fails
  }
  return localStorage.getItem('michi_access_token');
}

async function performFetch(endpoint: string, options: RequestInit, token: string | null): Promise<Response> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });
}

export async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  let response = await performFetch(endpoint, options, token);

  // On 401 (e.g., expired JWT), try refreshing the Supabase session once before failing
  if (response.status === 401 && token) {
    try {
      const { data } = await supabase.auth.refreshSession();
      const refreshedToken = data?.session?.access_token;
      if (refreshedToken && refreshedToken !== token) {
        localStorage.setItem('michi_access_token', refreshedToken);
        response = await performFetch(endpoint, options, refreshedToken);
      } else {
        localStorage.removeItem('michi_access_token');
        localStorage.removeItem('michi_user');
      }
    } catch {
      localStorage.removeItem('michi_access_token');
      localStorage.removeItem('michi_user');
    }
  }

  const json: APIResponse<T> = await response.json().catch(() => ({
    success: false,
    data: null,
    error: { code: 'NETWORK_ERROR', message: 'Failed to parse response from server' },
  }));

  if (!response.ok || !json.success) {
    const errorMsg = json.error?.message || `Request failed with status ${response.status}`;
    const err = new Error(errorMsg);
    (err as any).code = json.error?.code || `HTTP_${response.status}`;
    (err as any).status = response.status;
    (err as any).details = json.error?.details;
    throw err;
  }

  return json.data as T;
}

export const tripService = {
  // Trip CRUD
  createTrip: (data: TripCreateInput): Promise<Trip> =>
    request<Trip>('/trips', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  create: (data: TripCreateInput): Promise<Trip> =>
    request<Trip>('/trips', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getMyTrips: (
    paramsOrStatus?: string | { status?: string; page?: number; page_size?: number },
    pageArg?: number,
    pageSizeArg?: number
  ): Promise<PaginatedTripList> => {
    const query = new URLSearchParams();
    if (typeof paramsOrStatus === 'string') {
      if (paramsOrStatus && paramsOrStatus !== 'all') query.append('status', paramsOrStatus);
      if (pageArg) query.append('page', pageArg.toString());
      if (pageSizeArg) query.append('page_size', pageSizeArg.toString());
    } else if (paramsOrStatus && typeof paramsOrStatus === 'object') {
      if (paramsOrStatus.status && paramsOrStatus.status !== 'all') query.append('status', paramsOrStatus.status);
      if (paramsOrStatus.page) query.append('page', paramsOrStatus.page.toString());
      if (paramsOrStatus.page_size) query.append('page_size', paramsOrStatus.page_size.toString());
    }
    const qs = query.toString();
    return request<PaginatedTripList>(`/trips${qs ? `?${qs}` : ''}`, { method: 'GET' });
  },

  getPublicTrips: (
    categoryOrParams?: string | { category?: string; page?: number; page_size?: number },
    pageArg?: number,
    pageSizeArg?: number
  ): Promise<PaginatedTripList> => {
    const query = new URLSearchParams();
    if (typeof categoryOrParams === 'string') {
      if (categoryOrParams) query.append('category', categoryOrParams);
      if (pageArg) query.append('page', pageArg.toString());
      if (pageSizeArg) query.append('page_size', pageSizeArg.toString());
    } else if (categoryOrParams && typeof categoryOrParams === 'object') {
      if (categoryOrParams.category) query.append('category', categoryOrParams.category);
      if (categoryOrParams.page) query.append('page', categoryOrParams.page.toString());
      if (categoryOrParams.page_size) query.append('page_size', categoryOrParams.page_size.toString());
    }
    const qs = query.toString();
    return request<PaginatedTripList>(`/trips/public${qs ? `?${qs}` : ''}`, { method: 'GET' });
  },

  getTrip: (id: string): Promise<Trip> =>
    request<Trip>(`/trips/${encodeURIComponent(id)}`, { method: 'GET' }),

  updateTrip: (id: string, data: TripUpdateInput): Promise<Trip> =>
    request<Trip>(`/trips/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteTrip: (id: string): Promise<{ deleted: boolean; id: string }> =>
    request<{ deleted: boolean; id: string }>(`/trips/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  // Lifecycle dedicated endpoints
  publishTrip: (id: string, data?: TripPublishInput): Promise<Trip> =>
    request<Trip>(`/trips/${encodeURIComponent(id)}/publish`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),

  archiveTrip: (id: string): Promise<Trip> =>
    request<Trip>(`/trips/${encodeURIComponent(id)}/archive`, {
      method: 'POST',
    }),

  restoreTrip: (id: string): Promise<Trip> =>
    request<Trip>(`/trips/${encodeURIComponent(id)}/restore`, {
      method: 'POST',
    }),

  unpublishTrip: (id: string): Promise<Trip> =>
    request<Trip>(`/trips/${encodeURIComponent(id)}/unpublish`, {
      method: 'POST',
    }),

  // Trip Stops CRUD & Reorder
  getStops: (tripId: string): Promise<TripStop[]> =>
    request<TripStop[]>(`/trips/${encodeURIComponent(tripId)}/stops`, { method: 'GET' }),

  addStop: (tripId: string, data: TripStopCreateInput): Promise<TripStop> =>
    request<TripStop>(`/trips/${encodeURIComponent(tripId)}/stops`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateStop: (tripId: string, stopId: string, data: TripStopUpdateInput): Promise<TripStop> =>
    request<TripStop>(`/trips/${encodeURIComponent(tripId)}/stops/${encodeURIComponent(stopId)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteStop: (tripId: string, stopId: string): Promise<{ deleted: boolean; id: string }> =>
    request<{ deleted: boolean; id: string }>(
      `/trips/${encodeURIComponent(tripId)}/stops/${encodeURIComponent(stopId)}`,
      { method: 'DELETE' }
    ),

  reorderStops: (tripId: string, orderedStopIds: string[]): Promise<TripStop[]> =>
    request<TripStop[]>(`/trips/${encodeURIComponent(tripId)}/stops/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ ordered_stop_ids: orderedStopIds }),
    }),

  getTripRoute: (tripId: string): Promise<any> =>
    request<any>(`/trips/${encodeURIComponent(tripId)}/route`, { method: 'GET' }),

  geocodeLocation: (
    query: string
  ): Promise<{ lat: number; lng: number; formatted?: string } | null> =>
    request<{ lat: number; lng: number; formatted?: string } | null>(
      `/trips/geocode?q=${encodeURIComponent(query)}`,
      { method: 'GET' }
    ),
};
