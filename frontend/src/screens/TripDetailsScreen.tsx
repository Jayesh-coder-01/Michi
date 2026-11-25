import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AppLayout } from '../components/layout/AppLayout';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { StatusBadge, VisibilityBadge, CategoryBadge } from '../components/trips/TripBadge';
import { JourneyTimeline } from '../components/trips/JourneyTimeline';
import { InteractiveJourneyMap } from '../components/maps/InteractiveJourneyMap';
import { RouteMetricsBar } from '../components/maps/RouteMetricsBar';
import { StopModal } from '../components/trips/StopModal';
import { TripEditorModal } from '../components/trips/TripEditorModal';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { api } from '../services/api';
import { calculateTripRoute } from '../services/mapsService';
import { RouteMetrics, MapViewMode } from '../types/maps';
import {
  Trip,
  TripStop,
  TripUpdateInput,
  TripStopCreateInput,
  TripStopUpdateInput,
} from '../types/trip';

export const TripDetailsScreen: React.FC = () => {
  const { tripId } = useParams<{ tripId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Maps & Timeline synchronization state
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<MapViewMode>('split');
  const [routeMetrics, setRouteMetrics] = useState<RouteMetrics | null>(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);

  // Modals state
  const [isEditTripOpen, setIsEditTripOpen] = useState(false);
  const [isStopModalOpen, setIsStopModalOpen] = useState(false);
  const [editingStop, setEditingStop] = useState<TripStop | null>(null);

  // Confirm delete states
  const [isDeleteTripOpen, setIsDeleteTripOpen] = useState(false);
  const [deletingStopId, setDeletingStopId] = useState<string | null>(null);

  const fetchTrip = useCallback(async () => {
    if (!tripId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.trips.getTrip(tripId);
      setTrip(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load journey details.');
    } finally {
      setIsLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    fetchTrip();
  }, [fetchTrip]);

  // Synchronize route metrics whenever trip metadata, stops, or locations change
  useEffect(() => {
    if (!trip) return;
    let isMounted = true;
    setIsCalculatingRoute(true);
    calculateTripRoute(trip)
      .then((metrics) => {
        if (isMounted) setRouteMetrics(metrics);
      })
      .catch((err) => {
        console.warn('[Michi Maps] Error computing route metrics:', err);
      })
      .finally(() => {
        if (isMounted) setIsCalculatingRoute(false);
      });
    return () => {
      isMounted = false;
    };
  }, [trip]);

  const handleSelectStop = useCallback((stopId: string | null) => {
    setSelectedStopId(stopId);
    if (stopId) {
      const element = document.getElementById(`timeline-stop-${stopId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, []);

  const isOwner = Boolean(user && trip && user.id === trip.owner_id);

  // Lifecycle action handlers
  const handlePublish = async () => {
    if (!tripId) return;
    try {
      const updated = await api.trips.publishTrip(tripId);
      setTrip(updated);
      setActionMessage({ type: 'success', text: 'Trip published successfully! Now visible on your profile.' });
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to publish trip.' });
    }
  };

  const handleArchive = async () => {
    if (!tripId) return;
    try {
      const updated = await api.trips.archiveTrip(tripId);
      setTrip(updated);
      setActionMessage({ type: 'success', text: 'Trip archived. Hidden from public exploration feeds.' });
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to archive trip.' });
    }
  };

  const handleRestore = async () => {
    if (!tripId) return;
    try {
      const updated = await api.trips.restoreTrip(tripId);
      setTrip(updated);
      setActionMessage({ type: 'success', text: 'Trip restored to published status.' });
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to restore trip.' });
    }
  };

  const handleUnpublish = async () => {
    if (!tripId) return;
    try {
      const updated = await api.trips.unpublishTrip(tripId);
      setTrip(updated);
      setActionMessage({ type: 'success', text: 'Trip reverted to draft for revisions.' });
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to unpublish trip.' });
    }
  };

  const handleDeleteTrip = async () => {
    if (!tripId) return;
    try {
      await api.trips.deleteTrip(tripId);
      navigate('/profile');
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to delete trip.' });
      setIsDeleteTripOpen(false);
    }
  };

  const handleSaveTripMetadata = async (data: TripUpdateInput) => {
    if (!tripId) return;
    const updated = await api.trips.updateTrip(tripId, data);
    setTrip(updated);
    setActionMessage({ type: 'success', text: 'Trip information updated.' });
  };

  // Stop handlers
  const handleSaveStop = async (data: TripStopCreateInput | TripStopUpdateInput) => {
    if (!tripId) return;
    if (editingStop) {
      await api.trips.updateStop(tripId, editingStop.id, data);
      setActionMessage({ type: 'success', text: `Stop "${data.stop_name || editingStop.stop_name}" updated.` });
    } else {
      await api.trips.addStop(tripId, data as TripStopCreateInput);
      setActionMessage({ type: 'success', text: `New stop "${data.stop_name}" added to itinerary.` });
    }
    await fetchTrip();
  };

  const handleDeleteStop = async () => {
    if (!tripId || !deletingStopId) return;
    try {
      await api.trips.deleteStop(tripId, deletingStopId);
      setDeletingStopId(null);
      setActionMessage({ type: 'success', text: 'Stop removed from itinerary.' });
      await fetchTrip();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to remove stop.' });
    }
  };

  const handleMoveStop = async (index: number, direction: 'up' | 'down') => {
    if (!trip || !trip.stops) return;
    const sorted = [...trip.stops].sort((a, b) => a.order_index - b.order_index);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;

    // Swap positions
    const temp = sorted[index];
    sorted[index] = sorted[targetIndex];
    sorted[targetIndex] = temp;

    const orderedIds = sorted.map((s) => s.id);
    try {
      const updatedStops = await api.trips.reorderStops(trip.id, orderedIds);
      setTrip({ ...trip, stops: updatedStops });
      setActionMessage({ type: 'success', text: 'Stops reordered successfully.' });
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to reorder stops.' });
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <div className="w-10 h-10 border-4 border-forest-green border-t-transparent rounded-full animate-spin" />
          <p className="font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant">
            Loading journey story...
          </p>
        </div>
      </AppLayout>
    );
  }

  if (error || !trip) {
    const isForbidden = error?.includes('private') || error?.includes('403');
    return (
      <AppLayout>
        <div className="max-w-xl mx-auto my-12 p-8 rounded-2xl bg-light-surface dark:bg-dark-surface border border-light-outline-variant dark:border-dark-outline-variant text-center flex flex-col items-center gap-4 shadow-sm">
          <span className="material-symbols-outlined text-6xl text-adventure-orange">
            {isForbidden ? 'lock' : 'explore_off'}
          </span>
          <h2 className="font-headline text-headline-md text-light-on-surface dark:text-dark-on-surface font-bold">
            {isForbidden ? 'Private Journey' : 'Trip Not Found'}
          </h2>
          <p className="font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant">
            {isForbidden
              ? 'This trip is currently private or in draft mode and can only be viewed by its owner.'
              : 'The requested journey does not exist or may have been deleted by the author.'}
          </p>
          <Link to="/">
            <Button variant="secondary" size="md">
              Return Home
            </Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const fallbackCover =
    'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80';

  return (
    <AppLayout>
      <div className="flex flex-col gap-8 max-w-5xl mx-auto">
        {actionMessage && (
          <Alert
            type={actionMessage.type === 'success' ? 'success' : 'error'}
            message={actionMessage.text}
          />
        )}

        {/* Hero Banner & Badges */}
        <section className="relative rounded-3xl overflow-hidden shadow-lg border border-light-outline-variant dark:border-dark-outline-variant bg-light-surface dark:bg-dark-surface">
          <div className="h-64 md:h-80 w-full relative">
            <img
              src={trip.cover_image_url || fallbackCover}
              alt={trip.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/30" />

            {/* Badges Overlay */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-2">
              <CategoryBadge category={trip.category} size="md" />
              <div className="flex items-center gap-2">
                <VisibilityBadge visibility={trip.visibility} size="md" />
                <StatusBadge status={trip.status} size="md" />
              </div>
            </div>

            {/* Title & Route summary over cover */}
            <div className="absolute bottom-6 left-6 right-6 flex flex-col gap-2 text-white">
              <h1 className="font-display text-display-md-mobile md:text-display-md font-extrabold leading-tight">
                {trip.title}
              </h1>
              <div className="flex flex-wrap items-center gap-3 font-label text-label-md text-white/90">
                <span className="flex items-center gap-1 font-semibold">
                  <span className="material-symbols-outlined text-base text-forest-green dark:text-dark-primary">
                    trip_origin
                  </span>
                  {trip.starting_location}
                </span>
                <span className="material-symbols-outlined text-sm text-adventure-orange">
                  arrow_forward
                </span>
                <span className="flex items-center gap-1 font-semibold">
                  <span className="material-symbols-outlined text-base text-adventure-orange">
                    sports_score
                  </span>
                  {trip.ending_location}
                </span>
                {trip.start_date && trip.end_date && (
                  <span className="flex items-center gap-1 text-white/75 ml-2">
                    <span className="material-symbols-outlined text-base">calendar_month</span>
                    {trip.start_date} – {trip.end_date}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Owner details & Action toolbar */}
          <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 border-t border-light-outline-variant dark:border-dark-outline-variant bg-light-surface dark:bg-dark-surface">
            {/* Author info */}
            <Link
              to={`/traveller/${trip.owner.username}`}
              className="flex items-center gap-3 group hover:opacity-90"
            >
              {trip.owner.avatar_url ? (
                <img
                  src={trip.owner.avatar_url}
                  alt={trip.owner.display_name}
                  className="w-12 h-12 rounded-full object-cover border border-light-outline-variant dark:border-dark-outline-variant"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-forest-green text-on-forest-green flex items-center justify-center font-bold text-lg">
                  {trip.owner.display_name[0]?.toUpperCase() || 'M'}
                </div>
              )}
              <div>
                <p className="font-headline text-title-md text-light-on-surface dark:text-dark-on-surface font-bold group-hover:text-forest-green dark:group-hover:text-dark-primary transition-colors">
                  {trip.owner.display_name}
                </p>
                <p className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                  @{trip.owner.username}
                </p>
              </div>
            </Link>

            {/* Dedicated Lifecycle & Management Actions for Owner */}
            {isOwner && (
              <div className="flex flex-wrap items-center gap-2">
                {trip.status === 'draft' && (
                  <Button variant="adventure" size="md" onClick={handlePublish}>
                    <span className="material-symbols-outlined text-base mr-1">publish</span>
                    Publish Journey
                  </Button>
                )}

                {trip.status === 'published' && (
                  <>
                    <Button variant="secondary" size="md" onClick={handleArchive}>
                      <span className="material-symbols-outlined text-base mr-1">archive</span>
                      Archive
                    </Button>
                    <Button variant="ghost" size="md" onClick={handleUnpublish}>
                      <span className="material-symbols-outlined text-base mr-1">edit_note</span>
                      Unpublish to Draft
                    </Button>
                  </>
                )}

                {trip.status === 'archived' && (
                  <>
                    <Button variant="adventure" size="md" onClick={handleRestore}>
                      <span className="material-symbols-outlined text-base mr-1">unarchive</span>
                      Restore to Published
                    </Button>
                    <Button variant="ghost" size="md" onClick={handleUnpublish}>
                      <span className="material-symbols-outlined text-base mr-1">edit_note</span>
                      Unpublish to Draft
                    </Button>
                  </>
                )}

                <Button variant="secondary" size="md" onClick={() => setIsEditTripOpen(true)}>
                  <span className="material-symbols-outlined text-base mr-1">edit</span>
                  Edit
                </Button>

                <Button variant="danger" size="md" onClick={() => setIsDeleteTripOpen(true)}>
                  <span className="material-symbols-outlined text-base mr-1">delete</span>
                  Delete
                </Button>
              </div>
            )}
          </div>
        </section>

        {/* Trip Description */}
        {trip.description && (
          <section className="p-6 md:p-8 rounded-2xl bg-light-surface dark:bg-dark-surface border border-light-outline-variant dark:border-dark-outline-variant flex flex-col gap-2">
            <h3 className="font-headline text-title-md text-light-on-surface dark:text-dark-on-surface font-bold">
              Journey Overview
            </h3>
            <p className="font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant whitespace-pre-line leading-relaxed">
              {trip.description}
            </p>
          </section>
        )}

        {/* Route Metrics Summary Bar */}
        <RouteMetricsBar
          metrics={routeMetrics}
          isLoading={isCalculatingRoute}
          onEditMissingCoordinates={() => {
            if (trip.stops && trip.stops.length > 0 && trip.stops.some((s) => Number(s.latitude) === 0 && Number(s.longitude) === 0)) {
              const unplacedStop = trip.stops.find((s) => Number(s.latitude) === 0 && Number(s.longitude) === 0);
              setEditingStop(unplacedStop || trip.stops[0]);
              setIsStopModalOpen(true);
            } else {
              setIsEditTripOpen(true);
            }
          }}
        />

        {/* Journey Map & Itinerary Section with Responsive View Toggle */}
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-headline text-title-lg text-light-on-surface dark:text-dark-on-surface font-bold">
                Geographical Route & Timeline
              </h3>
              <p className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                Select any stop to synchronize focus between the interactive map and timeline.
              </p>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center self-start sm:self-auto p-1 rounded-2xl bg-light-surface dark:bg-dark-surface border border-light-outline-variant dark:border-dark-outline-variant shadow-sm text-xs font-semibold">
              <button
                type="button"
                onClick={() => setViewMode('split')}
                className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                  viewMode === 'split'
                    ? 'bg-forest-green text-on-forest-green shadow-sm'
                    : 'text-light-on-surface-variant dark:text-dark-on-surface-variant hover:text-light-on-surface'
                }`}
                title="Show side-by-side view"
              >
                <span className="material-symbols-outlined text-sm">dashboard</span>
                <span className="hidden md:inline">Split</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('map')}
                className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                  viewMode === 'map'
                    ? 'bg-forest-green text-on-forest-green shadow-sm'
                    : 'text-light-on-surface-variant dark:text-dark-on-surface-variant hover:text-light-on-surface'
                }`}
                title="Full map view"
              >
                <span className="material-symbols-outlined text-sm">map</span>
                <span>Map</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('timeline')}
                className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                  viewMode === 'timeline'
                    ? 'bg-forest-green text-on-forest-green shadow-sm'
                    : 'text-light-on-surface-variant dark:text-dark-on-surface-variant hover:text-light-on-surface'
                }`}
                title="Full timeline view"
              >
                <span className="material-symbols-outlined text-sm">timeline</span>
                <span>Timeline</span>
              </button>
            </div>
          </div>

          {/* Interactive Responsive Grid: Side-by-Side on Desktop, Responsive on Mobile */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Timeline Column */}
            <section
              className={`${
                viewMode === 'map'
                  ? 'hidden'
                  : viewMode === 'timeline'
                  ? 'col-span-12'
                  : 'col-span-12 lg:col-span-5'
              } p-6 md:p-8 rounded-3xl bg-light-surface dark:bg-dark-surface border border-light-outline-variant dark:border-dark-outline-variant shadow-sm`}
            >
              <JourneyTimeline
                startingLocation={trip.starting_location}
                endingLocation={trip.ending_location}
                stops={trip.stops || []}
                isOwner={isOwner}
                selectedStopId={selectedStopId}
                onSelectStop={handleSelectStop}
                onAddStop={() => {
                  setEditingStop(null);
                  setIsStopModalOpen(true);
                }}
                onEditStop={(stop) => {
                  setEditingStop(stop);
                  setIsStopModalOpen(true);
                }}
                onDeleteStop={(stopId) => setDeletingStopId(stopId)}
                onMoveUp={(index) => handleMoveStop(index, 'up')}
                onMoveDown={(index) => handleMoveStop(index, 'down')}
              />
            </section>

            {/* Interactive Map Column */}
            <section
              className={`${
                viewMode === 'timeline'
                  ? 'hidden'
                  : viewMode === 'map'
                  ? 'col-span-12'
                  : 'col-span-12 lg:col-span-7'
              } lg:sticky lg:top-24 flex flex-col gap-4`}
            >
              <InteractiveJourneyMap
                trip={trip}
                selectedStopId={selectedStopId}
                onSelectStop={handleSelectStop}
                onEditStop={(stop) => {
                  setEditingStop(stop);
                  setIsStopModalOpen(true);
                }}
                onEditTrip={() => setIsEditTripOpen(true)}
                height={viewMode === 'map' ? '650px' : '560px'}
              />
            </section>
          </div>
        </div>
      </div>

      {/* Modals */}
      <TripEditorModal
        isOpen={isEditTripOpen}
        onClose={() => setIsEditTripOpen(false)}
        onSubmit={handleSaveTripMetadata}
        initialTrip={trip}
      />

      <StopModal
        isOpen={isStopModalOpen}
        onClose={() => {
          setIsStopModalOpen(false);
          setEditingStop(null);
        }}
        onSubmit={handleSaveStop}
        initialStop={editingStop}
        tripStartDate={trip.start_date}
        tripEndDate={trip.end_date}
      />

      <ConfirmModal
        isOpen={isDeleteTripOpen}
        onClose={() => setIsDeleteTripOpen(false)}
        onConfirm={handleDeleteTrip}
        title="Delete Journey"
        message="Are you sure you want to permanently delete this trip and all its stops? This action cannot be undone."
        confirmText="Delete Trip"
        isDangerous
      />

      <ConfirmModal
        isOpen={Boolean(deletingStopId)}
        onClose={() => setDeletingStopId(null)}
        onConfirm={handleDeleteStop}
        title="Remove Stop"
        message="Are you sure you want to remove this stop from your itinerary? Subsequent stops will be automatically renumbered."
        confirmText="Remove Stop"
        isDangerous
      />
    </AppLayout>
  );
};
