import React from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { Button } from '../components/ui/Button';

export const AccessDeniedScreen: React.FC = () => {
  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto py-16 px-page-margin text-center flex flex-col items-center gap-6">
        <div className="w-20 h-20 rounded-full bg-sunshine-yellow/20 text-[#855700] dark:text-sunshine-yellow flex items-center justify-center">
          <span className="material-symbols-outlined text-4xl">lock</span>
        </div>

        <div className="flex flex-col gap-2">
          <span className="font-label text-label-sm uppercase tracking-wider text-adventure-orange font-bold">
            403 · Private Route
          </span>
          <h1 className="font-headline text-headline-lg text-light-on-surface dark:text-dark-on-surface">
            This Journey Is Private
          </h1>
          <p className="font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant max-w-md mx-auto">
            The creator of this trip has set its visibility to private. Only the trip owner can view
            its itinerary and waypoints.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
          <Link to="/">
            <Button variant="secondary" size="md">
              <span className="material-symbols-outlined text-base mr-1.5">home</span>
              Return Home
            </Button>
          </Link>
          <Link to="/my-trips">
            <Button variant="primary" size="md">
              <span className="material-symbols-outlined text-base mr-1.5">map</span>
              Go to My Trips
            </Button>
          </Link>
        </div>
      </div>
    </AppLayout>
  );
};
