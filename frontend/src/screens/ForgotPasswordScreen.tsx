import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuthLayout } from '../components/layout/AuthLayout';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';

export const ForgotPasswordScreen: React.FC = () => {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await forgotPassword(email);
      setIsSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Unable to process your request. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      heroQuote="A path never truly disappears; sometimes we just need to retrace our steps to find the way forward."
      heroLocation="Rohtang Pass · 3,978m"
      heroAuthor="Michi Mountain Archives"
    >
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-headline text-headline-lg-mobile md:text-headline-lg text-light-on-background dark:text-dark-on-background">
            Recover your journey
          </h1>
          <p className="font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant mt-1.5">
            Enter the email associated with your passport and Supabase will dispatch a secure recovery link.
          </p>
        </div>

        {error && <Alert type="error" message={error} />}

        {isSubmitted ? (
          <div className="flex flex-col gap-5 p-6 rounded-xl bg-forest-green/10 border border-forest-green/30 text-center">
            <span className="material-symbols-outlined text-4xl text-forest-green dark:text-dark-primary mx-auto">
              mark_email_read
            </span>
            <div>
              <h3 className="font-headline text-title-md font-bold text-light-on-background dark:text-dark-on-background">
                Recovery link dispatched
              </h3>
              <p className="font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant mt-1">
                If an account exists for <strong className="text-light-on-background dark:text-dark-on-background">{email}</strong>, you will receive password reset instructions shortly.
              </p>
            </div>
            <Link to="/login">
              <Button variant="primary" size="md" fullWidth>
                Back to Login
              </Button>
            </Link>
          </div>
        ) : (
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

            <Button
              type="submit"
              variant="adventure"
              size="lg"
              fullWidth
              isLoading={isLoading}
              className="mt-2"
            >
              Send Recovery Link
            </Button>

            <div className="text-center mt-2">
              <Link
                to="/login"
                className="font-label text-label-md text-forest-green dark:text-dark-primary hover:underline inline-flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-base">arrow_back</span>
                Return to Login
              </Link>
            </div>
          </form>
        )}
      </div>
    </AuthLayout>
  );
};
