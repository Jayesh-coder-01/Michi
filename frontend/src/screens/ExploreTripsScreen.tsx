import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '../components/layout/AppLayout';
import { TripCard } from '../components/trips/TripCard';
import { api } from '../services/api';
import { TripListItem, TripCategory } from '../types/trip';

const CATEGORIES: TripCategory[] = [
  'Solo travel',
  'Road trip',
  'Backpacking',
  'Family trip',
  'Adventure',
  'Trekking',
  'Cultural exploration',
  'Beach vacation',
  'International travel',
  'Other',
];

export const ExploreTripsScreen: React.FC = () => {
  const [trips, setTrips] = useState<TripListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPublicTrips = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.trips.getPublicTrips(selectedCategory || undefined, 1, 30);
      setTrips(res.items);
      setTotal(res.total);
    } catch (err: any) {
      setError(err.message || 'Failed to load community journeys.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    fetchPublicTrips();
  }, [fetchPublicTrips]);

  return (
    <AppLayout>
      <div className="flex flex-col gap-8 max-w-7xl mx-auto py-4">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <span className="font-label text-label-sm uppercase tracking-wider text-forest-green dark:text-dark-primary font-bold">
            Community Expeditions
          </span>
          <h1 className="font-display text-display-md-mobile md:text-display-md text-light-on-surface dark:text-dark-on-surface font-extrabold">
            Explore Whole-Journey Itineraries
          </h1>
          <p className="font-body text-body-lg text-light-on-surface-variant dark:text-dark-on-surface-variant max-w-2xl">
            Real routes logged by passionate travellers. Trace complete waypoints, activity field notes, and stay locations.
          </p>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-full font-label text-label-sm whitespace-nowrap transition-colors ${
              selectedCategory === null
                ? 'bg-forest-green text-white font-bold shadow-sm'
                : 'bg-light-surface dark:bg-dark-surface border border-light-outline-variant dark:border-dark-outline-variant text-light-on-surface dark:text-dark-on-surface hover:bg-light-surface-container dark:hover:bg-dark-surface-container'
            }`}
          >
            All Categories ({total})
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-full font-label text-label-sm whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-forest-green text-white font-bold shadow-sm'
                  : 'bg-light-surface dark:bg-dark-surface border border-light-outline-variant dark:border-dark-outline-variant text-light-on-surface dark:text-dark-on-surface hover:bg-light-surface-container dark:hover:bg-dark-surface-container'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Loading Skeletons */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-80 rounded-2xl bg-light-surface-container dark:bg-dark-surface-container animate-pulse"
              />
            ))}
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="p-8 rounded-2xl bg-light-surface dark:bg-dark-surface border border-light-error/40 text-center flex flex-col items-center gap-3">
            <span className="material-symbols-outlined text-4xl text-light-error">error</span>
            <p className="font-body text-body-md text-light-error font-medium">{error}</p>
            <button
              type="button"
              onClick={fetchPublicTrips}
              className="font-label text-label-md text-forest-green dark:text-dark-primary font-bold underline"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && trips.length === 0 && (
          <div className="p-12 rounded-3xl bg-light-surface dark:bg-dark-surface border border-light-outline-variant dark:border-dark-outline-variant text-center flex flex-col items-center gap-4">
            <span className="material-symbols-outlined text-6xl text-forest-green/50 dark:text-dark-primary/50">
              travel_explore
            </span>
            <h3 className="font-headline text-title-lg text-light-on-surface dark:text-dark-on-surface font-bold">
              No Published Journeys Found
            </h3>
            <p className="font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant max-w-md">
              {selectedCategory
                ? `No published itineraries found under "${selectedCategory}". Try selecting another category.`
                : 'Be the first traveller to publish a journey and inspire the Michi community!'}
            </p>
          </div>
        )}

        {/* Trips Grid */}
        {!isLoading && !error && trips.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trips.map((trip) => (
              <TripCard key={trip.id} trip={trip} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};
