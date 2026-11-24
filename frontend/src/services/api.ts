import { APIResponse } from '../types/api';
import { Profile, ProfileUpdateInput, UsernameCheckResult } from '../types/profile';
import { tripService } from './tripService';
import {
  Trip,
  TripStop,
  TripCreateInput,
  TripUpdateInput,
  TripPublishInput,
  TripStopCreateInput,
  TripStopUpdateInput,
  PaginatedTripList,
} from '../types/trip';

const API_BASE = typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null'
  ? `${window.location.origin}/api/v1`
  : 'http://localhost:3000/api/v1';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('michi_access_token');
  const headers = new Headers(options.headers || {});

  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const json: APIResponse<T> = await response.json().catch(() => ({
    success: false,
    data: null,
    error: { code: 'NETWORK_ERROR', message: 'Failed to parse response from server' },
  }));

  if (!response.ok || !json.success) {
    const errorMsg = json.error?.message || `Request failed with status ${response.status}`;
    const err = new Error(errorMsg);
    (err as any).code = json.error?.code || `HTTP_${response.status}`;
    (err as any).details = json.error?.details;
    throw err;
  }

  return json.data as T;
}

export const api = {
  auth: {
    checkSession: () =>
      request<{ user_id: string; email?: string; role: string; authenticated: boolean }>('/auth/session', {
        method: 'GET',
      }),
  },

  profiles: {
    getMyProfile: () =>
      request<Profile>('/profiles/me', {
        method: 'GET',
      }),

    updateMyProfile: (data: ProfileUpdateInput) =>
      request<Profile>('/profiles/me', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    updateAISettings: (is_ai_chatbot_enabled: boolean) =>
      request<Profile>('/profiles/me/ai-settings', {
        method: 'PATCH',
        body: JSON.stringify({ is_ai_chatbot_enabled }),
      }),

    checkUsername: (username: string) =>
      request<UsernameCheckResult>(`/profiles/check-username?username=${encodeURIComponent(username)}`, {
        method: 'GET',
      }),

    getPublicProfile: (username: string) =>
      request<Profile>(`/profiles/${encodeURIComponent(username)}`, {
        method: 'GET',
      }),
  },

  trips: tripService,
};
