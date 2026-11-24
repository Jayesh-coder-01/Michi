import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { Button } from '../components/ui/Button';
import { TripCard } from '../components/trips/TripCard';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { PublishModal } from '../components/trips/PublishModal';
import { tripService } from '../services/tripService';
import { Trip, TripListItem, TripStatus } from '../types/trip';

type TabStatus = 'all' | TripStatus;

export const MyTripsScreen: React.FC = () => {
  const [trips, setTrips] = useState<TripListItem[]>([]);
  const [selectedTab, setSelectedTab] = useState<TabStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [deleteTripId, setDeleteTripId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [publishTripTarget, setPublishTripTarget] = useState<Trip | null>(null);

  const fetchTrips = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const statusParam = selectedTab === 'all' ? undefined : selectedTab;
      const response = await tripService.getMyTrips({ status: statusParam, page: 1, page_size: 100 });
      setTrips(response.items || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load your trips. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedTab]);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  const handleDeleteConfirm = async () => {
    if (!deleteTripId) return;
    setIsDeleting(true);
    try {
      await tripService.deleteTrip(deleteTripId);
      setDeleteTripId(null);
      fetchTrips();
    } catch (err: any) {
      alert(err.message || 'Failed to delete trip');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleQuickPublish = async (tripId: string) => {
    try {
      const fullTrip = await tripService.getTrip(tripId);
      setPublishTripTarget(fullTrip);
    } catch (err: any) {
      alert(err.message || 'Failed to prepare trip for publishing');
    }
  };

  const handlePublishConfirm = async (visibility: any) => {
    if (!publishTripTarget) return;
    await tripService.publishTrip(publishTripTarget.id, { visibility });
    setPublishTripTarget(null);
    fetchTrips();
  };

  // Filter by search query
  const filteredTrips = trips.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      t.starting_location.toLowerCase().includes(q) ||
      t.ending_location.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q)
    );
  });

  const tabCounts = {
    all: trips.length,
    published: trips.filter((t) => t.status === 'published').length,
    draft: trips.filter((t) => t.status === 'draft').length,
    archived: trips.filter((t) => t.status === 'archived').length,
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto py-8 px-page-margin flex flex-col gap-8">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-light-outline-variant dark:border-dark-outline-variant pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-label text-xs uppercase tracking-wider text-forest-green dark:text-dark-primary font-bold">
                Expedition Hub
              </span>
              <span className="text-light-outline-variant">·</span>
              <span className="font-label text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
                Phase 3 Active
              </span>
            </div>
            <h1 className="font-headline text-headline-md md:text-headline-lg text-light-on-surface dark:text-dark-on-surface mt-1">
              My Journeys & Itineraries
            </h1>
            <p className="font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant mt-1">
              Manage your published expeditions, draft itineraries, and archived routes.
            </p>
          </div>

          <Link to="/trips/create">
            <Button variant="adventure" size="md" className="shadow-md">
              <span className="material-symbols-outlined text-lg mr-1.5">add</span>
              Create New Trip
            </Button>
          </Link>
        </div>

        {/* Filters & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-light-surface-container dark:bg-dark-surface-container rounded-full border border-light-outline-variant dark:border-dark-outline-variant overflow-x-auto">
            <button
              type="button"
              onClick={() => setSelectedTab('all')}
              className={`px-4 py-1.5 rounded-full font-label text-xs md:text-sm font-semibold transition-colors shrink-0 ${
                selectedTab === 'all'
                  ? 'bg-forest-green text-white dark:bg-dark-primary dark:text-[#003822] shadow-sm'
                  : 'text-light-on-surface-variant dark:text-dark-on-surface-variant hover:text-light-on-surface'
              }`}
            >
              All Routes
            </button>
            <button
              type="button"
              onClick={() => setSelectedTab('published')}
              className={`px-4 py-1.5 rounded-full font-label text-xs md:text-sm font-semibold transition-colors shrink-0 ${
                selectedTab === 'published'
                  ? 'bg-forest-green text-white dark:bg-dark-primary dark:text-[#003822] shadow-sm'
                  : 'text-light-on-surface-variant dark:text-dark-on-surface-variant hover:text-light-on-surface'
              }`}
            >
              Published
            </button>
            <button
              type="button"
              onClick={() => setSelectedTab('draft')}
              className={`px-4 py-1.5 rounded-full font-label text-xs md:text-sm font-semibold transition-colors shrink-0 ${
                selectedTab === 'draft'
                  ? 'bg-forest-green text-white dark:bg-dark-primary dark:text-[#003822] shadow-sm'
                  : 'text-light-on-surface-variant dark:text-dark-on-surface-variant hover:text-light-on-surface'
              }`}
            >
              Drafts
            </button>
            <button
              type="button"
              onClick={() => setSelectedTab('archived')}
              className={`px-4 py-1.5 rounded-full font-label text-xs md:text-sm font-semibold transition-colors shrink-0 ${
                selectedTab === 'archived'
                  ? 'bg-forest-green text-white dark:bg-dark-primary dark:text-[#003822] shadow-sm'
                  : 'text-light-on-surface-variant dark:text-dark-on-surface-variant hover:text-light-on-surface'
              }`}
            >
              Archived
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-light-outline dark:text-dark-outline pointer-events-none text-lg">
              search
            </span>
            <input
              type="text"
              placeholder="Search by title, location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-full border border-light-outline-variant dark:border-dark-outline-variant bg-light-surface dark:bg-dark-surface pl-9 pr-4 py-2 font-body text-xs md:text-sm text-light-on-surface dark:text-dark-on-surface focus:outline-none focus:ring-2 focus:ring-forest-green"
            />
          </div>
        </div>

        {/* Content States: Loading, Error, Empty, List */}
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4">
            <span className="w-8 h-8 border-3 border-forest-green border-t-transparent rounded-full animate-spin" />
            <p className="font-label text-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
              Loading your journeys...
            </p>
          </div>
        ) : error ? (
          <div className="p-6 rounded-2xl bg-light-error/10 border border-light-error/30 text-center flex flex-col items-center gap-3">
            <span className="material-symbols-outlined text-4xl text-light-error">error</span>
            <p className="font-body text-sm text-light-error max-w-md">{error}</p>
            <Button variant="secondary" size="sm" onClick={fetchTrips}>
              Retry Loading
            </Button>
          </div>
        ) : filteredTrips.length === 0 ? (
          /* Empty State */
          <div className="py-16 px-6 rounded-3xl bg-light-surface dark:bg-dark-surface border border-dashed border-light-outline-variant dark:border-dark-outline-variant text-center flex flex-col items-center gap-5">
            <div className="w-20 h-20 rounded-full bg-forest-green/10 text-forest-green dark:bg-dark-primary/20 dark:text-dark-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-4xl">travel_explore</span>
            </div>

            <div className="flex flex-col gap-1.5 max-w-md">
              <h3 className="font-headline text-headline-sm text-light-on-surface dark:text-dark-on-surface">
                {searchQuery
                  ? 'No matching journeys found'
                  : selectedTab === 'draft'
                  ? 'No drafts in progress'
                  : selectedTab === 'archived'
                  ? 'No archived expeditions'
                  : 'Start Your First Journey'}
              </h3>
              <p className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                {searchQuery
                  ? `No journeys matched your query "${searchQuery}". Clear your search to see all routes.`
                  : 'Every journey begins with a single step. Map your trail, log intermediate stops, notes, and photos.'}
              </p>
            </div>

            {searchQuery ? (
              <Button variant="secondary" size="sm" onClick={() => setSearchQuery('')}>
                Clear Filter
              </Button>
            ) : (
              <Link to="/trips/create">
                <Button variant="adventure" size="md">
                  <span className="material-symbols-outlined text-base mr-1.5">add</span>
                  Create Your First Trip
                </Button>
              </Link>
            )}
          </div>
        ) : (
          /* Grid of Trips */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTrips.map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                isOwner={true}
                onDelete={(id) => setDeleteTripId(id)}
                onPublish={(id) => handleQuickPublish(id)}
              />
            ))}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        <ConfirmModal
          isOpen={!!deleteTripId}
          onClose={() => setDeleteTripId(null)}
          onConfirm={handleDeleteConfirm}
          title="Delete Journey"
          message="Are you sure you want to permanently delete this trip? All intermediate waypoints, notes, and timeline data will be permanently removed. This action cannot be undone."
          confirmText="Delete Trip"
          variant="danger"
          isLoading={isDeleting}
        />

        {/* Publish Modal */}
        {publishTripTarget && (
          <PublishModal
            isOpen={!!publishTripTarget}
            onClose={() => setPublishTripTarget(null)}
            onPublish={handlePublishConfirm}
            trip={publishTripTarget}
          />
        )}
      </div>
    </AppLayout>
  );
};
