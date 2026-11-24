import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuthLayout } from '../components/layout/AuthLayout';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';

export const EmailVerificationScreen: React.FC = () => {
  const { verifyOtp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token') || '';
  const emailFromUrl = searchParams.get('email') || '';

  const [token, setToken] = useState(tokenFromUrl);
  const [email, setEmail] = useState(emailFromUrl);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(60);
  const [resendSent, setResendSent] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (resendCountdown > 0) {
      timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  useEffect(() => {
    if (tokenFromUrl) {
      handleVerify(tokenFromUrl);
    }
  }, [tokenFromUrl]);

  const handleVerify = async (verificationToken: string) => {
    if (!verificationToken) return;
    setError(null);
    setIsLoading(true);

    try {
      await verifyOtp(verificationToken, email || undefined);
      setIsSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Invalid or expired activation code. Please check and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleVerify(token);
  };

  const handleResend = () => {
    setResendCountdown(60);
    setResendSent(true);
  };

  return (
    <AuthLayout
      heroQuote="Every true passport bears the marks of places seen and roads yet to be taken."
      heroLocation="Kyoto Trail Markers, Japan"
      heroAuthor="Michi Cultural Collection"
    >
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-headline text-headline-lg-mobile md:text-headline-lg text-light-on-background dark:text-dark-on-background">
            Verify your passport
          </h1>
          <p className="font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant mt-1.5">
            Enter the activation code sent to your email to confirm your traveller identity with Supabase Auth.
          </p>
        </div>

        {error && <Alert type="error" message={error} />}
        {resendSent && (
          <Alert
            type="info"
            message="A fresh activation code has been dispatched to your inbox."
          />
        )}

        {isSuccess ? (
          <div className="flex flex-col gap-5 p-6 rounded-xl bg-forest-green/10 border border-forest-green/30 text-center">
            <span className="material-symbols-outlined text-4xl text-forest-green dark:text-dark-primary mx-auto">
              verified
            </span>
            <div>
              <h3 className="font-headline text-title-md font-bold text-light-on-background dark:text-dark-on-background">
                Passport Verified!
              </h3>
              <p className="font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant mt-1">
                Your email is confirmed and your traveller profile is active.
              </p>
            </div>
            <Link to="/profile">
              <Button variant="adventure" size="lg" fullWidth>
                Continue to My Profile
              </Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleFormSubmit} className="flex flex-col gap-4">
            <Input
              label="Email Address"
              type="email"
              placeholder="elena@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              leftIcon="mail"
            />

            <Input
              label="Activation Code / OTP"
              placeholder="Enter 6-digit code or paste token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
              leftIcon="key"
            />

            <Button
              type="submit"
              variant="adventure"
              size="lg"
              fullWidth
              isLoading={isLoading}
              className="mt-2"
            >
              Verify & Activate Passport
            </Button>

            <div className="flex items-center justify-between text-label-sm pt-2">
              <span className="text-light-on-surface-variant dark:text-dark-on-surface-variant">
                Didn't receive the code?
              </span>
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCountdown > 0}
                className="font-label font-semibold text-forest-green dark:text-dark-primary hover:underline disabled:opacity-50 disabled:no-underline"
              >
                {resendCountdown > 0 ? `Resend code in ${resendCountdown}s` : 'Resend code'}
              </button>
            </div>
          </form>
        )}
      </div>
    </AuthLayout>
  );
};
