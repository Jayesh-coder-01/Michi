import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuthLayout } from '../components/layout/AuthLayout';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { api } from '../services/api';

export const RegisterScreen: React.FC = () => {
  const { register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);

  const [usernameStatus, setUsernameStatus] = useState<{
    checking: boolean;
    available?: boolean;
    message?: string;
  }>({ checking: false });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced username availability check
  useEffect(() => {
    if (!username || username.length < 3) {
      setUsernameStatus({ checking: false });
      return;
    }

    const timer = setTimeout(async () => {
      setUsernameStatus({ checking: true });
      try {
        const res = await api.profiles.checkUsername(username);
        setUsernameStatus({
          checking: false,
          available: res.available,
          message: res.message,
        });
      } catch {
        setUsernameStatus({ checking: false });
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [username]);

  const hasLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const isPasswordValid = hasLength && hasLetter && hasNumber;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!agreeTerms) {
      setError('You must agree to the Terms of Service and Privacy Policy to create an account.');
      return;
    }

    if (!isPasswordValid) {
      setError('Password must be at least 8 characters and include at least one letter and one number.');
      return;
    }

    if (usernameStatus.available === false) {
      setError('Please choose an available username before proceeding.');
      return;
    }

    setIsLoading(true);
    try {
      await register({
        email,
        password,
        display_name: displayName,
        username,
      });
      navigate('/profile');
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please check your information and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError(null);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setError(err.message || 'Google OAuth failed to initiate.');
    }
  };

  return (
    <AuthLayout
      heroQuote="A journey is more than a collection of photographs. It is a collection of places, experiences, people and memories."
      heroLocation="Nubra Valley, Karakoram Range"
      heroAuthor="Michi Community · Explorer Stories"
    >
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-headline text-headline-lg-mobile md:text-headline-lg text-light-on-background dark:text-dark-on-background">
            Create your traveller passport
          </h1>
          <p className="font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant mt-1.5">
            Document whole journeys, share intermediate stops, and preserve memories.
          </p>
        </div>

        {error && <Alert type="error" message={error} />}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Full Name / Display Name"
            placeholder="e.g. Elena Rostova"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            leftIcon="person"
          />

          <div>
            <Input
              label="Traveller Handle (Username)"
              placeholder="e.g. elena.wander"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
              required
              leftIcon="alternate_email"
              helperText={
                usernameStatus.checking
                  ? 'Checking handle availability...'
                  : usernameStatus.message
              }
              error={
                usernameStatus.available === false
                  ? usernameStatus.message
                  : undefined
              }
            />
          </div>

          <Input
            label="Email Address"
            type="email"
            placeholder="elena@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            leftIcon="mail"
            autoComplete="email"
          />

          <div>
            <Input
              label="Password"
              type="password"
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              leftIcon="lock"
              autoComplete="new-password"
            />
            {password.length > 0 && (
              <div className="mt-2 text-xs flex flex-wrap gap-3 font-body">
                <span className={`flex items-center gap-1 ${hasLength ? 'text-forest-green dark:text-dark-primary font-semibold' : 'text-light-on-surface-variant dark:text-dark-on-surface-variant'}`}>
                  <span className="material-symbols-outlined text-sm">{hasLength ? 'check' : 'circle'}</span>
                  8+ characters
                </span>
                <span className={`flex items-center gap-1 ${hasLetter ? 'text-forest-green dark:text-dark-primary font-semibold' : 'text-light-on-surface-variant dark:text-dark-on-surface-variant'}`}>
                  <span className="material-symbols-outlined text-sm">{hasLetter ? 'check' : 'circle'}</span>
                  Letter
                </span>
                <span className={`flex items-center gap-1 ${hasNumber ? 'text-forest-green dark:text-dark-primary font-semibold' : 'text-light-on-surface-variant dark:text-dark-on-surface-variant'}`}>
                  <span className="material-symbols-outlined text-sm">{hasNumber ? 'check' : 'circle'}</span>
                  Number
                </span>
              </div>
            )}
          </div>

          <div className="flex items-start gap-2 text-label-sm mt-1">
            <input
              type="checkbox"
              id="terms"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="mt-0.5 rounded text-forest-green focus:ring-forest-green"
              required
            />
            <label htmlFor="terms" className="font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant leading-tight">
              I agree to the <Link to="/terms" className="underline text-forest-green dark:text-dark-primary">Terms of Service</Link> and <Link to="/privacy" className="underline text-forest-green dark:text-dark-primary">Privacy Policy</Link>.
            </label>
          </div>

          <Button
            type="submit"
            variant="adventure"
            size="lg"
            fullWidth
            isLoading={isLoading}
            className="mt-2"
          >
            Create Traveller Passport
          </Button>
        </form>

        <div className="relative flex items-center my-1">
          <div className="flex-grow border-t border-light-outline-variant dark:border-dark-outline-variant" />
          <span className="flex-shrink mx-4 text-xs font-label text-light-on-surface-variant dark:text-dark-on-surface-variant uppercase tracking-wider">
            or sign up with
          </span>
          <div className="flex-grow border-t border-light-outline-variant dark:border-dark-outline-variant" />
        </div>

        <Button
          type="button"
          variant="secondary"
          size="md"
          fullWidth
          onClick={handleGoogleAuth}
          className="gap-3"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          Google Account
        </Button>

        <p className="text-center font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant mt-2">
          Already have an account?{' '}
          <Link to="/login" className="font-label font-semibold text-forest-green dark:text-dark-primary hover:underline">
            Log in here
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
};
