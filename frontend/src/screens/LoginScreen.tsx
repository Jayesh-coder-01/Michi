import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuthLayout } from '../components/layout/AuthLayout';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';

export const LoginScreen: React.FC = () => {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect') || '/profile';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login({ email, password });
      navigate(redirect);
    } catch (err: any) {
      setError(err.message || 'Invalid email or password. Please try again.');
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
      heroQuote="The journey of a thousand miles begins with a single step, but lives forever in the stories we share along the way."
      heroLocation="Zanskar Valley, Ladakh · 3,850m"
      heroAuthor="Aarav Mehta · Himalayan Motorbike Traverse"
    >
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-headline text-headline-lg-mobile md:text-headline-lg text-light-on-background dark:text-dark-on-background">
            Welcome back, traveller
          </h1>
          <p className="font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant mt-1.5">
            Enter your credentials to continue documenting your path.
          </p>
        </div>

        {error && <Alert type="error" message={error} />}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Email Address"
            type="email"
            placeholder="traveller@michi.travel"
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
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              leftIcon="lock"
              autoComplete="current-password"
            />
            <div className="flex items-center justify-between mt-2 text-label-sm">
              <label className="flex items-center gap-2 cursor-pointer font-label text-light-on-surface-variant dark:text-dark-on-surface-variant">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded text-forest-green focus:ring-forest-green"
                />
                Remember me
              </label>
              <Link
                to="/forgot-password"
                className="font-label text-forest-green dark:text-dark-primary hover:underline"
              >
                Forgot password?
              </Link>
            </div>
          </div>

          <Button
            type="submit"
            variant="adventure"
            size="lg"
            fullWidth
            isLoading={isLoading}
            className="mt-2"
          >
            Log In
          </Button>
        </form>

        <div className="relative flex items-center my-1">
          <div className="flex-grow border-t border-light-outline-variant dark:border-dark-outline-variant" />
          <span className="flex-shrink mx-4 text-xs font-label text-light-on-surface-variant dark:text-dark-on-surface-variant uppercase tracking-wider">
            or continue with
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
          New to MICHI?{' '}
          <Link to="/register" className="font-label font-semibold text-forest-green dark:text-dark-primary hover:underline">
            Create your traveller passport
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
};
