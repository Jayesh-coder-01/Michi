import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AppLayout } from '../components/layout/AppLayout';
import { Button } from '../components/ui/Button';

export const HomeScreen: React.FC = () => {
  const { isAuthenticated, profile } = useAuth();

  return (
    <AppLayout>
      <div className="flex flex-col gap-12 py-8">
        {/* Hero Section */}
        <div className="relative rounded-2xl overflow-hidden bg-forest-green text-on-forest-green p-8 md:p-14 shadow-lg flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="max-w-xl flex flex-col gap-4">
            <span className="font-label text-label-md px-3 py-1 rounded-full bg-adventure-orange text-on-adventure-orange self-start">
              Every Path Has a Story
            </span>
            <h1 className="font-display text-display-md-mobile md:text-display-md leading-tight text-white font-extrabold">
              Document your entire travel journey, not just scattered photos.
            </h1>
            <p className="font-body text-body-lg text-white/85 leading-relaxed">
              Michi treats whole trips as the core story. Trace routes, log intermediate stops, capture memories, and interact with traveller AI avatars.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              {isAuthenticated ? (
                <Link to="/profile">
                  <Button variant="adventure" size="lg">
                    Go to My Profile (@{profile?.username})
                  </Button>
                </Link>
              ) : (
                <>
                  <Link to="/register">
                    <Button variant="adventure" size="lg">
                      Start Your Journey
                    </Button>
                  </Link>
                  <Link to="/login">
                    <Button variant="secondary" size="lg">
                      Log In
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="w-full md:w-80 rounded-xl overflow-hidden shadow-2xl border-4 border-white/20">
            <img
              src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80"
              alt="Himalayan Mountain Vista"
              className="w-full h-64 object-cover"
            />
            <div className="p-4 bg-dark-surface text-dark-on-surface">
              <p className="font-headline text-title-md font-bold">Zanskar Valley Traverse</p>
              <p className="font-label text-label-sm text-adventure-orange">3 Stops · 1,420 km</p>
            </div>
          </div>
        </div>

        {/* Core Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-outline-variant dark:border-dark-outline-variant flex flex-col gap-3">
            <span className="material-symbols-outlined text-3xl text-forest-green dark:text-dark-primary">
              route
            </span>
            <h3 className="font-headline text-title-lg text-light-on-surface dark:text-dark-on-surface">
              Whole-Trip Architecture
            </h3>
            <p className="font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant">
              Start points, end points, route polylines, and chronological intermediate stops with accommodations and activity field notes.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-outline-variant dark:border-dark-outline-variant flex flex-col gap-3">
            <span className="material-symbols-outlined text-3xl text-adventure-orange">
              smart_toy
            </span>
            <h3 className="font-headline text-title-lg text-light-on-surface dark:text-dark-on-surface">
              Traveller AI Profile Avatar
            </h3>
            <p className="font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant">
              Visitors can ask questions about your public routes, gear notes, and budget with grounded citations back to your trip logs.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-outline-variant dark:border-dark-outline-variant flex flex-col gap-3">
            <span className="material-symbols-outlined text-3xl text-sky-blue">
              lock
            </span>
            <h3 className="font-headline text-title-lg text-light-on-surface dark:text-dark-on-surface">
              Privacy by Default
            </h3>
            <p className="font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant">
              PostgreSQL Row Level Security protects your drafts and private journeys. You decide what to share and what to keep personal.
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};
