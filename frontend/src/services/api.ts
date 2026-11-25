import { Profile, ProfileUpdateInput, UsernameCheckResult } from '../types/profile';
import { request, tripService } from './tripService';

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
