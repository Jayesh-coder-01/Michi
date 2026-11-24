import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '../context/ThemeContext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { EmailVerificationScreen } from '../screens/EmailVerificationScreen';
import { supabase } from '../services/supabaseClient';
import { api } from '../services/api';

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          {ui}
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
};

describe('Unified Supabase Auth & Frontend Screens Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api.profiles, 'getMyProfile').mockResolvedValue({
      id: 'mock-user-uuid-1',
      username: 'mock_traveller',
      display_name: 'Mock Traveller',
      is_ai_chatbot_enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      stats: { published_trips_count: 0, drafts_count: 0, followers_count: 0, following_count: 0 },
    });
  });

  it('renders LoginScreen with email, password inputs, submit button, and Google OAuth', () => {
    const { container } = renderWithProviders(<LoginScreen />);
    
    expect(screen.getByRole('heading', { name: /welcome back, traveller/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    
    const passwordInput = container.querySelector('input[type="password"]');
    expect(passwordInput).toBeInTheDocument();
    
    expect(screen.getByRole('button', { name: /^log in$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /google account/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /forgot password\?/i })).toBeInTheDocument();
  });

  it('submits login credentials to Supabase Auth', async () => {
    const signInSpy = vi.spyOn(supabase.auth, 'signInWithPassword');
    const { container } = renderWithProviders(<LoginScreen />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'traveller@michi.travel' },
    });
    const passwordInput = container.querySelector('input[type="password"]')!;
    fireEvent.change(passwordInput, {
      target: { value: 'Adventure2026!' },
    });

    fireEvent.click(screen.getByRole('button', { name: /^log in$/i }));

    await waitFor(() => {
      expect(signInSpy).toHaveBeenCalledWith({
        email: 'traveller@michi.travel',
        password: 'Adventure2026!',
      });
    });
  });

  it('initiates Google OAuth through Supabase signInWithOAuth', async () => {
    const oAuthSpy = vi.spyOn(supabase.auth, 'signInWithOAuth');
    renderWithProviders(<LoginScreen />);

    const googleBtn = screen.getByRole('button', { name: /google account/i });
    fireEvent.click(googleBtn);

    await waitFor(() => {
      expect(oAuthSpy).toHaveBeenCalledWith({
        provider: 'google',
        options: expect.objectContaining({
          redirectTo: expect.stringContaining('/profile'),
        }),
      });
    });
  });

  it('toggles password visibility when toggle button is clicked', () => {
    const { container } = renderWithProviders(<LoginScreen />);
    
    const passwordInput = container.querySelector('#password') as HTMLInputElement;
    expect(passwordInput.type).toBe('password');

    const toggleButton = screen.getByRole('button', { name: /show password/i });
    fireEvent.click(toggleButton);

    expect(passwordInput.type).toBe('text');

    const hideButton = screen.getByRole('button', { name: /hide password/i });
    fireEvent.click(hideButton);

    expect(passwordInput.type).toBe('password');
  });

  it('submits registration data including display_name and username to Supabase Auth metadata', async () => {
    const signUpSpy = vi.spyOn(supabase.auth, 'signUp');
    const { container } = renderWithProviders(<RegisterScreen />);

    fireEvent.change(screen.getByLabelText(/full name \/ display name/i), {
      target: { value: 'Elena Rostova' },
    });
    fireEvent.change(screen.getByLabelText(/traveller handle/i), {
      target: { value: 'elena.wander' },
    });
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'elena@example.com' },
    });
    const passwordInput = container.querySelector('input[type="password"]')!;
    fireEvent.change(passwordInput, {
      target: { value: 'Adventure2026!' },
    });
    fireEvent.click(screen.getByLabelText(/terms of service/i));

    fireEvent.click(screen.getByRole('button', { name: /create traveller passport/i }));

    await waitFor(() => {
      expect(signUpSpy).toHaveBeenCalledWith({
        email: 'elena@example.com',
        password: 'Adventure2026!',
        options: {
          data: {
            display_name: 'Elena Rostova',
            username: 'elena.wander',
          },
        },
      });
    });
  });

  it('submits password recovery request via Supabase Auth without leaking tokens', async () => {
    const resetSpy = vi.spyOn(supabase.auth, 'resetPasswordForEmail');
    renderWithProviders(<ForgotPasswordScreen />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'recovery@michi.travel' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send recovery link/i }));

    await waitFor(() => {
      expect(resetSpy).toHaveBeenCalledWith(
        'recovery@michi.travel',
        expect.objectContaining({
          redirectTo: expect.stringContaining('/forgot-password'),
        })
      );
      expect(screen.getByRole('heading', { name: /recovery link dispatched/i })).toBeInTheDocument();
      // Ensure no reset token appears in the document
      expect(screen.queryByText(/dev_reset_token/i)).not.toBeInTheDocument();
    });
  });

  it('verifies email OTP via Supabase Auth verifyOtp', async () => {
    const verifySpy = vi.spyOn(supabase.auth as any, 'verifyOtp');
    renderWithProviders(<EmailVerificationScreen />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'verify@michi.travel' },
    });
    fireEvent.change(screen.getByLabelText(/activation code/i), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: /verify & activate passport/i }));

    await waitFor(() => {
      expect(verifySpy).toHaveBeenCalledWith({
        email: 'verify@michi.travel',
        token: '123456',
        type: 'email',
      });
      expect(screen.getByRole('heading', { name: /passport verified!/i })).toBeInTheDocument();
    });
  });

  it('restores authenticated session from Supabase getSession on initial mount', async () => {
    const mockSession = {
      user: {
        id: 'restored-user-uuid',
        email: 'restored@michi.travel',
        user_metadata: { username: 'restored_traveller', display_name: 'Restored Traveller' },
      },
      access_token: 'mock-restored-jwt-token',
    };
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: { session: mockSession } as any,
      error: null,
    });

    renderWithProviders(<LoginScreen />);

    await waitFor(() => {
      expect(supabase.auth.getSession).toHaveBeenCalled();
      expect(localStorage.getItem('michi_access_token')).toBe('mock-restored-jwt-token');
    });
  });

  it('invokes Supabase signOut and clears local storage on logout', async () => {
    localStorage.setItem('michi_access_token', 'token-to-be-cleared');
    const signOutSpy = vi.spyOn(supabase.auth, 'signOut').mockResolvedValue({ error: null } as any);

    // Test helper component to invoke useAuth().logout()
    const LogoutTester = () => {
      const { logout } = useAuth();
      return <button onClick={() => logout()}>Test Logout</button>;
    };

    renderWithProviders(<LogoutTester />);
    fireEvent.click(screen.getByText('Test Logout'));

    await waitFor(() => {
      expect(signOutSpy).toHaveBeenCalled();
      expect(localStorage.getItem('michi_access_token')).toBeNull();
    });
  });

  it('correctly maps Google OAuth user metadata (full_name and picture) to display_name and avatar_url', async () => {
    const googleUserSession = {
      user: {
        id: 'google-user-123',
        email: 'elena.rostova@gmail.com',
        user_metadata: {
          full_name: 'Elena Rostova',
          name: 'Elena R',
          picture: 'https://lh3.googleusercontent.com/a/google-avatar-123',
        },
      },
      access_token: 'google-oauth-jwt-token',
    };
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: { session: googleUserSession } as any,
      error: null,
    });
    vi.spyOn(api.profiles, 'getMyProfile').mockResolvedValue({
      id: 'google-user-123',
      username: 'elena_rostova',
      display_name: 'Elena Rostova',
      avatar_url: 'https://lh3.googleusercontent.com/a/google-avatar-123',
      is_ai_chatbot_enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      stats: { published_trips_count: 0, drafts_count: 0, followers_count: 0, following_count: 0 },
    });

    const ProfileViewer = () => {
      const { user, profile } = useAuth();
      return (
        <div>
          <span data-testid="user-display-name">{user?.display_name}</span>
          <span data-testid="user-avatar-url">{user?.avatar_url}</span>
          <span data-testid="profile-display-name">{profile?.display_name}</span>
        </div>
      );
    };

    renderWithProviders(<ProfileViewer />);

    await waitFor(() => {
      expect(screen.getByTestId('user-display-name').textContent).toBe('Elena Rostova');
      expect(screen.getByTestId('user-avatar-url').textContent).toBe('https://lh3.googleusercontent.com/a/google-avatar-123');
      expect(screen.getByTestId('profile-display-name').textContent).toBe('Elena Rostova');
    });
  });
});
