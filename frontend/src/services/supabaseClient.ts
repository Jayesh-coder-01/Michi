import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  '';

export const isSupabaseConfigured = Boolean(
  import.meta.env.MODE !== 'test' &&
  supabaseUrl &&
  supabasePublishableKey &&
  !supabasePublishableKey.includes('your-publishable-key') &&
  !supabasePublishableKey.includes('your-anon-key')
);

// In mock/test environments without real anon keys, provide functional in-memory auth simulation
class MockSupabaseAuth {
  private listeners: Array<(event: string, session: any) => void> = [];
  private currentSession: any = null;

  async getSession() {
    return { data: { session: this.currentSession }, error: null };
  }

  onAuthStateChange(callback: (event: string, session: any) => void) {
    this.listeners.push(callback);
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
          },
        },
      },
    };
  }

  async signInWithPassword({ email }: any) {
    const mockUser = {
      id: 'mock-user-uuid-1',
      email,
      user_metadata: { display_name: 'Mock Traveller', username: 'mock_traveller' },
    };
    this.currentSession = {
      access_token: 'mock-supabase-jwt-token',
      user: mockUser,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    };
    this.notify('SIGNED_IN', this.currentSession);
    return { data: { user: mockUser, session: this.currentSession }, error: null };
  }

  async signUp({ email, options }: any) {
    const mockUser = {
      id: 'mock-user-uuid-1',
      email,
      user_metadata: options?.data || {},
    };
    this.currentSession = {
      access_token: 'mock-supabase-jwt-token',
      user: mockUser,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    };
    this.notify('SIGNED_IN', this.currentSession);
    return { data: { user: mockUser, session: this.currentSession }, error: null };
  }

  async signOut() {
    this.currentSession = null;
    this.notify('SIGNED_OUT', null);
    return { error: null };
  }

  async resetPasswordForEmail(_email: string, _options?: any) {
    return { data: {}, error: null };
  }

  async verifyOtp({ token }: any) {
    if (token === 'invalid') {
      return { data: null, error: new Error('Invalid verification code') };
    }
    return { data: { user: { id: 'mock-user-uuid-1' } }, error: null };
  }

  async signInWithOAuth({ provider, options }: any) {
    if (options?.redirectTo && typeof window !== 'undefined') {
      // Simulate real browser redirect initiation
      return { data: { provider, url: `${options.redirectTo}?oauth=success` }, error: null };
    }
    return { data: { provider, url: null }, error: null };
  }

  private notify(event: string, session: any) {
    for (const listener of this.listeners) {
      listener(event, session);
    }
  }
}

export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey)
  : ({ auth: new MockSupabaseAuth() } as unknown as SupabaseClient);
