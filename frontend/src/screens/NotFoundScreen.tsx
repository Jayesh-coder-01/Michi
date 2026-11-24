import React from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { Button } from '../components/ui/Button';

export const NotFoundScreen: React.FC = () => {
  return (
    <AppLayout>
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center gap-4">
        <span className="material-symbols-outlined text-6xl text-adventure-orange">
          explore_off
        </span>
        <h1 className="font-headline text-display-md-mobile md:text-display-md text-light-on-background dark:text-dark-on-background">
          Path Not Found (404)
        </h1>
        <p className="font-body text-body-lg text-light-on-surface-variant dark:text-dark-on-surface-variant max-w-md">
          This trail has wandered off the map or does not exist. Let&apos;s guide you back to the main route.
        </p>
        <Link to="/" className="mt-2">
          <Button variant="adventure" size="lg">
            Return to Explorer Feed
          </Button>
        </Link>
      </div>
    </AppLayout>
  );
};
