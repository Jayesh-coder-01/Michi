import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { AppLayout } from '../components/layout/AppLayout';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Alert } from '../components/ui/Alert';
import { EditProfileModal } from './EditProfileModal';
import { TripCard } from '../components/trips/TripCard';
import { TripEditorModal } from '../components/trips/TripEditorModal';
import { api } from '../services/api';
import { TripListItem, TripCreateInput, TripUpdateInput } from '../types/trip';

export const MyProfileScreen: React.FC = () => {
  const { profile, user, logout, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'trips' | 'ai' | 'account'>('trips');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isTogglingAI, setIsTogglingAI] = useState(false);
  const [aiMessage, setAIMessage] = useState<string | null>(null);

  // Trips state
  const [trips, setTrips] = useState<TripListItem[]>([]);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [tripsError, setTripsError] = useState<string | null>(null);
  const [tripStatusFilter, setTripStatusFilter] = useState<'all' | 'draft' | 'published' | 'archived'>('all');
  const [isCreateTripModalOpen, setIsCreateTripModalOpen] = useState(false);

  const fetchMyTrips = useCallback(async () => {
    setTripsLoading(true);
    setTripsError(null);
    try {
      const statusParam = tripStatusFilter === 'all' ? undefined : tripStatusFilter;
      const res = await api.trips.getMyTrips(statusParam, 1, 50);
      setTrips(res.items);
    } catch (err: any) {
      setTripsError(err.message || 'Failed to load your trips.');
    } finally {
      setTripsLoading(false);
    }
  }, [tripStatusFilter]);

  useEffect(() => {
    if (activeTab === 'trips') {
      fetchMyTrips();
    }
  }, [activeTab, fetchMyTrips]);

  const handleCreateTrip = async (data: TripCreateInput | TripUpdateInput) => {
    await api.trips.create(data as TripCreateInput);
    await fetchMyTrips();
  };

  const handleDeleteTrip = async (tripId: string) => {
    try {
      await api.trips.deleteTrip(tripId);
      await fetchMyTrips();
    } catch (err: any) {
      setTripsError(err.message || 'Failed to delete trip.');
    }
  };

  const handlePublishTrip = async (tripId: string) => {
    try {
      await api.trips.publishTrip(tripId);
      await fetchMyTrips();
    } catch (err: any) {
      setTripsError(err.message || 'Failed to publish trip.');
    }
  };

  const defaultCover = "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1400&q=80";

  const handleToggleAI = async () => {
    if (!profile) return;
    setIsTogglingAI(true);
    setAIMessage(null);
    try {
      const nextState = !profile.is_ai_chatbot_enabled;
      await api.profiles.updateAISettings(nextState);
      await refreshProfile();
      setAIMessage(
        nextState
          ? 'AI Chatbot enabled. Profile visitors can now ask questions about your public trips.'
          : 'AI Chatbot disabled. Visitors will not be able to interact with the AI assistant on your profile.'
      );
    } catch (err: any) {
      setAIMessage(`Error updating AI settings: ${err.message}`);
    } finally {
      setIsTogglingAI(false);
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-gutter-xl">
        {/* Profile Card Header */}
        <section className="bg-light-surface dark:bg-dark-surface border border-light-outline-variant dark:border-dark-outline-variant rounded-xl overflow-hidden shadow-sm">
          {/* Cover Photo */}
          <div className="h-52 md:h-64 w-full relative bg-dark-surface-container">
            <img
              src={profile?.cover_image_url || defaultCover}
              alt="Profile cover banner"
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={() => setIsEditModalOpen(true)}
              className="absolute top-4 right-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-dark-surface/85 backdrop-blur-md text-white font-label text-label-sm hover:bg-dark-surface transition-colors"
            >
              <span className="material-symbols-outlined text-base">photo_camera</span>
              Change Cover
            </button>
          </div>

          {/* User Details & Identity */}
          <div className="p-gutter-lg md:p-gutter-xl flex flex-col gap-gutter-md">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-gutter-md -mt-16 md:-mt-20 relative z-10">
              {/* Avatar + Names */}
              <div className="flex items-end gap-gutter-md">
                {profile?.avatar_url || user?.avatar_url ? (
                  <img
                    src={profile?.avatar_url || user?.avatar_url || ''}
                    alt={profile?.display_name || user?.display_name}
                    className="w-24 h-24 md:w-28 md:h-28 rounded-full object-cover border-4 border-light-surface dark:border-dark-surface shadow-md"
                  />
                ) : (
                  <div className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-forest-green text-on-forest-green flex items-center justify-center font-display text-4xl font-extrabold border-4 border-light-surface dark:border-dark-surface shadow-md">
                    {(profile?.display_name || user?.display_name || 'M')[0].toUpperCase()}
                  </div>
                )}
                <div className="pb-1">
                  <div className="flex items-center gap-2">
                    <h1 className="font-headline text-headline-md md:text-headline-lg text-light-on-surface dark:text-dark-on-surface">
                      {profile?.display_name || user?.display_name}
                    </h1>
                    {user?.is_verified && (
                      <span className="material-symbols-outlined text-forest-green dark:text-dark-primary text-xl" title="Verified Traveller">
                        verified
                      </span>
                    )}
                  </div>
                  <p className="font-label text-label-md text-forest-green dark:text-dark-primary">
                    @{profile?.username || user?.username}
                    {profile?.location && <span> · {profile.location}</span>}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-gutter-sm">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setIsEditModalOpen(true)}
                  leftIcon={<span className="material-symbols-outlined text-lg">edit</span>}
                >
                  Edit Profile
                </Button>
                <Button
                  variant="adventure"
                  size="md"
                  onClick={() => alert('Trip creation will activate in Phase 3 (Trip Management).')}
                  leftIcon={<span className="material-symbols-outlined text-lg">add</span>}
                >
                  New Trip
                </Button>
              </div>
            </div>

            {/* Bio */}
            {profile?.bio && (
              <p className="font-body text-body-lg text-light-on-background dark:text-dark-on-background max-w-3xl leading-relaxed mt-2">
                {profile.bio}
              </p>
            )}

            {/* Social Links */}
            {profile?.social_links && Object.keys(profile.social_links).length > 0 && (
              <div className="flex items-center gap-4 text-xs font-label text-light-on-surface-variant dark:text-dark-on-surface-variant">
                {profile.social_links.instagram && (
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">photo_camera</span>
                    @{profile.social_links.instagram}
                  </span>
                )}
                {profile.social_links.website && (
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">language</span>
                    {profile.social_links.website}
                  </span>
                )}
              </div>
            )}

            {/* Stats Row */}
            <div className="flex flex-wrap items-center gap-gutter-xl pt-gutter-md border-t border-light-outline-variant dark:border-dark-outline-variant">
              <div>
                <strong className="font-title text-title-md tabular-nums text-light-on-surface dark:text-dark-on-surface">
                  {profile?.stats?.published_trips_count || 0}
                </strong>{' '}
                <span className="font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant">
                  Published Trips
                </span>
              </div>
              <div>
                <strong className="font-title text-title-md tabular-nums text-light-on-surface dark:text-dark-on-surface">
                  {profile?.stats?.drafts_count || 0}
                </strong>{' '}
                <span className="font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant">
                  Private Drafts
                </span>
              </div>
              <div>
                <strong className="font-title text-title-md tabular-nums text-light-on-surface dark:text-dark-on-surface">
                  {profile?.stats?.followers_count || 0}
                </strong>{' '}
                <span className="font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant">
                  Followers
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-light-outline-variant dark:border-dark-outline-variant">
          <button
            type="button"
            onClick={() => setActiveTab('trips')}
            className={`px-4 py-2.5 font-label text-label-md border-b-2 transition-colors ${
              activeTab === 'trips'
                ? 'border-forest-green text-forest-green dark:border-dark-primary dark:text-dark-primary font-bold'
                : 'border-transparent text-light-on-surface-variant dark:text-dark-on-surface-variant hover:text-light-on-surface dark:hover:text-dark-on-surface'
            }`}
          >
            Manage Trips
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ai')}
            className={`px-4 py-2.5 font-label text-label-md border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'ai'
                ? 'border-forest-green text-forest-green dark:border-dark-primary dark:text-dark-primary font-bold'
                : 'border-transparent text-light-on-surface-variant dark:text-dark-on-surface-variant hover:text-light-on-surface dark:hover:text-dark-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-lg">smart_toy</span>
            AI Chatbot Settings
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('account')}
            className={`px-4 py-2.5 font-label text-label-md border-b-2 transition-colors ${
              activeTab === 'account'
                ? 'border-forest-green text-forest-green dark:border-dark-primary dark:text-dark-primary font-bold'
                : 'border-transparent text-light-on-surface-variant dark:text-dark-on-surface-variant hover:text-light-on-surface dark:hover:text-dark-on-surface'
            }`}
          >
            Account & Security
          </button>
        </div>

        {/* Tab 1: Manage Trips */}
        {activeTab === 'trips' && (
          <div className="flex flex-col gap-gutter-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-headline text-headline-md text-light-on-background dark:text-dark-on-background font-bold">
                  Your Journeys
                </h2>
                <p className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                  Create, document, and manage whole itineraries with intermediate stops
                </p>
              </div>

              <Button
                variant="adventure"
                size="md"
                onClick={() => setIsCreateTripModalOpen(true)}
              >
                <span className="material-symbols-outlined text-base mr-1">add_circle</span>
                Plan a New Journey
              </Button>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {(['all', 'draft', 'published', 'archived'] as const).map((statusKey) => (
                <button
                  key={statusKey}
                  type="button"
                  onClick={() => setTripStatusFilter(statusKey)}
                  className={`px-3.5 py-1.5 rounded-full font-label text-label-sm capitalize transition-colors ${
                    tripStatusFilter === statusKey
                      ? 'bg-forest-green text-white font-bold'
                      : 'bg-light-surface dark:bg-dark-surface border border-light-outline-variant dark:border-dark-outline-variant text-light-on-surface dark:text-dark-on-surface hover:bg-light-surface-container dark:hover:bg-dark-surface-container'
                  }`}
                >
                  {statusKey === 'all' ? 'All Journeys' : statusKey}
                </button>
              ))}
            </div>

            {tripsError && <Alert type="error" message={tripsError} />}

            {/* Loading */}
            {tripsLoading && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-72 rounded-2xl bg-light-surface-container dark:bg-dark-surface-container animate-pulse"
                  />
                ))}
              </div>
            )}

            {/* Empty State */}
            {!tripsLoading && trips.length === 0 && (
              <div className="p-gutter-xl rounded-2xl bg-light-surface dark:bg-dark-surface border border-light-outline-variant dark:border-dark-outline-variant flex flex-col items-center justify-center text-center gap-4">
                <span className="material-symbols-outlined text-6xl text-forest-green dark:text-dark-primary">
                  route
                </span>
                <h3 className="font-headline text-title-lg text-light-on-surface dark:text-dark-on-surface font-bold">
                  {tripStatusFilter === 'all'
                    ? 'No Journeys Logged Yet'
                    : `No ${tripStatusFilter} journeys found.`}
                </h3>
                <p className="font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant max-w-md">
                  Every path has a story. Begin documenting your travels by adding an origin, destination, and intermediate stops.
                </p>
                <Button
                  variant="adventure"
                  size="md"
                  onClick={() => setIsCreateTripModalOpen(true)}
                >
                  <span className="material-symbols-outlined text-base mr-1">add_location_alt</span>
                  Start Your First Trip
                </Button>
              </div>
            )}

            {/* Trips Grid */}
            {!tripsLoading && trips.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {trips.map((tripItem) => (
                  <TripCard
                    key={tripItem.id}
                    trip={tripItem}
                    isOwner={true}
                    onDelete={handleDeleteTrip}
                    onPublish={handlePublishTrip}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: AI Chatbot Settings */}
        {activeTab === 'ai' && (
          <div className="flex flex-col gap-gutter-md max-w-2xl">
            {aiMessage && <Alert type="info" message={aiMessage} />}

            <div className="p-gutter-lg rounded-xl bg-light-surface dark:bg-dark-surface border border-light-outline-variant dark:border-dark-outline-variant flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-headline text-title-md text-light-on-surface dark:text-dark-on-surface">
                    AI Traveller Profile Chatbot (FR-AI-10)
                  </h3>
                  <p className="font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant mt-1">
                    Allow visitors on your profile to ask questions about your public travel journeys, accommodation recommendations, and route tips.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={profile?.is_ai_chatbot_enabled}
                  onClick={handleToggleAI}
                  disabled={isTogglingAI}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer ${
                    profile?.is_ai_chatbot_enabled ? 'bg-forest-green' : 'bg-light-outline dark:bg-dark-outline'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                      profile?.is_ai_chatbot_enabled ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="p-3.5 rounded-DEFAULT bg-light-surface-container dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant text-xs font-body text-light-on-surface-variant dark:text-dark-on-surface-variant flex items-start gap-2">
                <span className="material-symbols-outlined text-base text-forest-green dark:text-dark-primary flex-shrink-0">
                  shield
                </span>
                <span>
                  <strong>Privacy Guarantee:</strong> The AI chatbot is restricted by strict database RLS and server-side SQL filters. It only indexes your published, public trips. Private drafts and unlisted journals are <em>never</em> indexed or exposed.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Account & Security */}
        {activeTab === 'account' && (
          <div className="flex flex-col gap-4 max-w-xl">
            <div className="p-gutter-lg rounded-xl bg-light-surface dark:bg-dark-surface border border-light-outline-variant dark:border-dark-outline-variant flex flex-col gap-4">
              <h3 className="font-headline text-title-md text-light-on-surface dark:text-dark-on-surface">
                Account Details
              </h3>

              <div className="flex flex-col gap-2 font-body text-body-md">
                <div className="flex justify-between py-2 border-b border-light-outline-variant dark:border-dark-outline-variant">
                  <span className="text-light-on-surface-variant dark:text-dark-on-surface-variant">Email Address</span>
                  <span className="font-semibold">{user?.email}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-light-outline-variant dark:border-dark-outline-variant">
                  <span className="text-light-on-surface-variant dark:text-dark-on-surface-variant">Passport Verification</span>
                  <span className={user?.is_verified ? 'text-forest-green dark:text-dark-primary font-semibold' : 'text-adventure-orange font-semibold'}>
                    {user?.is_verified ? 'Verified' : 'Pending Verification'}
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-light-on-surface-variant dark:text-dark-on-surface-variant">User Identifier</span>
                  <span className="font-mono text-xs">{user?.id}</span>
                </div>
              </div>

              <div className="pt-2">
                <Button variant="outline" size="sm" onClick={logout}>
                  Sign Out of Michi
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <EditProfileModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
      />

      <TripEditorModal
        isOpen={isCreateTripModalOpen}
        onClose={() => setIsCreateTripModalOpen(false)}
        onSubmit={handleCreateTrip}
      />
    </AppLayout>
  );
};
