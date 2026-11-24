import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Profile, ProfileUpdateInput } from '../types/profile';
import { api } from '../services/api';

export interface AuthUser {
  id: string;
  email?: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
  is_verified?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  profile: Profile | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  register: (data: { email: string; password: string; display_name: string; username: string }) => Promise<void>;
  logout: () => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  verifyOtp: (token: string, email?: string) => Promise<void>;
  updateProfile: (data: ProfileUpdateInput) => Promise<Profile>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Sync Supabase Auth session with FastAPI resource server
  const syncSession = async (sessionUser: any, accessToken: string | null) => {
    if (!sessionUser || !accessToken) {
      setUser(null);
      setProfile(null);
      setToken(null);
      localStorage.removeItem('michi_access_token');
      localStorage.removeItem('michi_user');
      setIsLoading(false);
      return;
    }

    const rawMeta = sessionUser.user_metadata || {};
    const fallbackDisplayName =
      rawMeta.full_name?.trim() ||
      rawMeta.name?.trim() ||
      rawMeta.display_name?.trim() ||
      (sessionUser.email ? sessionUser.email.split('@')[0] : '') ||
      'New Traveller';

    const authUser: AuthUser = {
      id: sessionUser.id,
      email: sessionUser.email,
      username: rawMeta.username,
      display_name: fallbackDisplayName,
      avatar_url: rawMeta.avatar_url || rawMeta.picture,
      is_verified: Boolean(sessionUser.email_confirmed_at || sessionUser.confirmed_at),
    };

    setUser(authUser);
    setToken(accessToken);
    localStorage.setItem('michi_access_token', accessToken);
    localStorage.setItem('michi_user', JSON.stringify(authUser));

    try {
      const p = await api.profiles.getMyProfile();
      setProfile(p);
      if (p.display_name) {
        authUser.display_name = p.display_name;
      }
      if (p.username) {
        authUser.username = p.username;
      }
      if (p.avatar_url) {
        authUser.avatar_url = p.avatar_url;
      }
      setUser({ ...authUser });
      localStorage.setItem('michi_user', JSON.stringify(authUser));
    } catch (err) {
      console.warn('Profile fetch after Supabase Auth sync:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // 1. Initial session load from Supabase Auth
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        syncSession(session.user, session.access_token);
      } else {
        setIsLoading(false);
      }
    });

    // 2. Real-time auth state listener (handles login, logout, token refresh, OAuth redirects)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        await syncSession(session.user, session.access_token);
      } else {
        await syncSession(null, null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async ({ email, password }: { email: string; password: string }) => {
    setIsLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setIsLoading(false);
      throw new Error(error.message);
    }
    if (data.session) {
      await syncSession(data.session.user, data.session.access_token);
    }
  };

  const register = async ({
    email,
    password,
    display_name,
    username,
  }: {
    email: string;
    password: string;
    display_name: string;
    username: string;
  }) => {
    setIsLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name,
          username,
        },
      },
    });

    if (error) {
      setIsLoading(false);
      throw new Error(error.message);
    }

    if (data.session) {
      await syncSession(data.session.user, data.session.access_token);
    } else {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await supabase.auth.signOut();
    } finally {
      await syncSession(null, null);
    }
  };

  const loginWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/profile`,
      },
    });
    if (error) {
      throw new Error(error.message);
    }
  };

  const forgotPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/forgot-password?view=update`,
    });
    if (error) {
      throw new Error(error.message);
    }
  };

  const verifyOtp = async (token: string, email?: string) => {
    setIsLoading(true);
    const { data, error } = await (supabase.auth as any).verifyOtp({
      token,
      email,
      type: 'email',
    });
    if (error) {
      setIsLoading(false);
      throw new Error(error.message);
    }
    if (data?.session) {
      await syncSession(data.session.user, data.session.access_token);
    } else {
      setIsLoading(false);
    }
  };

  const updateProfile = async (data: ProfileUpdateInput): Promise<Profile> => {
    const updated = await api.profiles.updateMyProfile(data);
    setProfile(updated);
    if (user) {
      setUser({
        ...user,
        username: updated.username,
        display_name: updated.display_name,
        avatar_url: updated.avatar_url || undefined,
      });
    }
    return updated;
  };

  const refreshProfile = async () => {
    if (!token) return;
    try {
      const p = await api.profiles.getMyProfile();
      setProfile(p);
    } catch (err) {
      console.warn('Failed refreshing profile:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        token,
        isLoading,
        isAuthenticated: Boolean(user && token),
        login,
        register,
        logout,
        loginWithGoogle,
        forgotPassword,
        verifyOtp,
        updateProfile,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
