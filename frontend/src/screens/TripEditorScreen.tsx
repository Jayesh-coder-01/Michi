import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { StatusBadge, VisibilityBadge } from '../components/trips/TripBadge';
import { JourneyTimeline } from '../components/trips/JourneyTimeline';
import { InteractiveJourneyMap } from '../components/maps/InteractiveJourneyMap';
import { RouteMetricsBar } from '../components/maps/RouteMetricsBar';
import { StopModal } from '../components/trips/StopModal';
import { PublishModal } from '../components/trips/PublishModal';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { tripService } from '../services/tripService';
import { useAuth } from '../context/AuthContext';
import {
  Trip,
  TripStop,
  TripCategory,
  TripVisibility,
  TRIP_CATEGORIES,
  TripUpdateInput,
  TripStopCreateInput,
  TripStopUpdateInput,
} from '../types/trip';

const SAMPLE_COVERS = [
  { label: 'Mountain Trail', url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Coastal Highway', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Forest Hike', url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Historic Town', url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=80' },
];

export const TripEditorScreen: React.FC = () => {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [stops, setStops] = useState<TripStop[]>([]);
  const [activeTab, setActiveTab] = useState<'details' | 'stops' | 'map' | 'lifecycle'>('details');
  const [selectedMapStopId, setSelectedMapStopId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [lifecycleLoading, setLifecycleLoading] = useState(false);

  const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form fields for Trip metadata
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startingLocation, setStartingLocation] = useState('');
  const [endingLocation, setEndingLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [category, setCategory] = useState<TripCategory>('Other');
  const [visibility, setVisibility] = useState<TripVisibility>('private');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Stop modal state
  const [isStopModalOpen, setIsStopModalOpen] = useState(false);
  const [editingStop, setEditingStop] = useState<TripStop | null>(null);
  const [deletingStopId, setDeletingStopId] = useState<string | null>(null);

  // Delete trip & Publish modals
  const [isDeleteTripOpen, setIsDeleteTripOpen] = useState(false);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);

  const loadTripData = useCallback(async () => {
    if (!tripId) return;
    setIsLoading(true);
    setAlertMessage(null);
    try {
      const data = await tripService.getTrip(tripId);
      setTrip(data);
      setStops(data.stops || []);

      // Prepopulate form
      setTitle(data.title);
      setDescription(data.description || '');
      setStartingLocation(data.starting_location);
      setEndingLocation(data.ending_location);
      setStartDate(data.start_date || '');
      setEndDate(data.end_date || '');
      setCategory(data.category);
      setVisibility(data.visibility);
      setCoverImageUrl(data.cover_image_url || '');
    } catch (err: any) {
      setAlertMessage({ type: 'error', text: err.message || 'Failed to load trip.' });
    } finally {
      setIsLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    loadTripData();
  }, [loadTripData]);

  // Check ownership
  const isOwner = Boolean(user && trip && (user.id === trip.owner_id || user.id === trip.owner?.id));

  // Validate metadata form
  const validateMetadata = (): boolean => {
    const errs: Record<string, string> = {};

    if (!title.trim() || title.trim().length < 3) {
      errs.title = 'Title must be at least 3 characters.';
    } else if (title.length > 150) {
      errs.title = 'Title cannot exceed 150 characters.';
    }

    if (!startingLocation.trim() || startingLocation.trim().length < 2) {
      errs.startingLocation = 'Starting location is required (min 2 characters).';
    }

    if (!endingLocation.trim() || endingLocation.trim().length < 2) {
      errs.endingLocation = 'Ending location is required (min 2 characters).';
    }

    if (startDate && endDate && endDate < startDate) {
      errs.endDate = 'End date cannot be earlier than start date.';
    }

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Save Trip Metadata (strictly excludes status)
  const handleSaveMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateMetadata() || !tripId) return;

    setIsSavingMetadata(true);
    setAlertMessage(null);

    const payload: TripUpdateInput = {
      title: title.trim(),
      description: description.trim() || undefined,
      starting_location: startingLocation.trim(),
      ending_location: endingLocation.trim(),
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      category,
      visibility,
      cover_image_url: coverImageUrl.trim() || undefined,
    };

    try {
      const updated = await tripService.updateTrip(tripId, payload);
      setTrip(updated);
      setAlertMessage({ type: 'success', text: 'Trip details updated successfully.' });
    } catch (err: any) {
      setAlertMessage({ type: 'error', text: err.message || 'Failed to update trip details.' });
    } finally {
      setIsSavingMetadata(false);
    }
  };

  // Stop Operations
  const handleSaveStop = async (data: TripStopCreateInput | TripStopUpdateInput) => {
    if (!tripId) return;
    if (editingStop) {
      await tripService.updateStop(tripId, editingStop.id, data);
      setAlertMessage({ type: 'success', text: `Waypoint "${data.stop_name || editingStop.stop_name}" updated.` });
    } else {
      await tripService.addStop(tripId, data as TripStopCreateInput);
      setAlertMessage({ type: 'success', text: `New waypoint "${data.stop_name}" added to route.` });
    }
    await loadTripData();
  };

  const handleDeleteStopConfirm = async () => {
    if (!tripId || !deletingStopId) return;
    try {
      await tripService.deleteStop(tripId, deletingStopId);
      setDeletingStopId(null);
      setAlertMessage({ type: 'success', text: 'Waypoint removed and route re-indexed.' });
      await loadTripData();
    } catch (err: any) {
      setAlertMessage({ type: 'error', text: err.message || 'Failed to delete waypoint.' });
    }
  };

  // Reordering Stops with Batch API
  const handleReorderStops = async (newStops: TripStop[]) => {
    if (!tripId) return;
    setIsReordering(true);
    setAlertMessage(null);

    // Optimistically update state
    setStops(newStops);

    const orderedIds = newStops.map((s) => s.id);
    try {
      const updated = await tripService.reorderStops(tripId, orderedIds);
      setStops(updated);
      setAlertMessage({ type: 'success', text: 'Stops sequence reordered successfully.' });
    } catch (err: any) {
      setAlertMessage({ type: 'error', text: err.message || 'Failed to reorder stops.' });
      await loadTripData(); // Revert on failure
    } finally {
      setIsReordering(false);
    }
  };

  const handleMoveStopStep = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= stops.length) return;

    const reordered = [...stops];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;

    await handleReorderStops(reordered);
  };

  // Dedicated Lifecycle Operations
  const handlePublishConfirm = async (pubVisibility: TripVisibility) => {
    if (!tripId) return;
    setLifecycleLoading(true);
    try {
      const updated = await tripService.publishTrip(tripId, { visibility: pubVisibility });
      setTrip(updated);
      setIsPublishModalOpen(false);
      setAlertMessage({ type: 'success', text: 'Journey published successfully!' });
    } catch (err: any) {
      setAlertMessage({ type: 'error', text: err.message || 'Publishing checklist failed.' });
    } finally {
      setLifecycleLoading(false);
    }
  };

  const handleUnpublish = async () => {
    if (!tripId) return;
    setLifecycleLoading(true);
    try {
      const updated = await tripService.unpublishTrip(tripId);
      setTrip(updated);
      setAlertMessage({ type: 'success', text: 'Journey reverted to draft status.' });
    } catch (err: any) {
      setAlertMessage({ type: 'error', text: err.message || 'Failed to unpublish.' });
    } finally {
      setLifecycleLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!tripId) return;
    setLifecycleLoading(true);
    try {
      const updated = await tripService.archiveTrip(tripId);
      setTrip(updated);
      setAlertMessage({ type: 'success', text: 'Journey archived. Hidden from public discovery.' });
    } catch (err: any) {
      setAlertMessage({ type: 'error', text: err.message || 'Failed to archive.' });
    } finally {
      setLifecycleLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!tripId) return;
    setLifecycleLoading(true);
    try {
      const updated = await tripService.restoreTrip(tripId);
      setTrip(updated);
      setAlertMessage({ type: 'success', text: 'Journey restored to published status.' });
    } catch (err: any) {
      setAlertMessage({ type: 'error', text: err.message || 'Failed to restore.' });
    } finally {
      setLifecycleLoading(false);
    }
  };

  const handleDeleteTripConfirm = async () => {
    if (!tripId) return;
    try {
      await tripService.deleteTrip(tripId);
      navigate('/my-trips');
    } catch (err: any) {
      alert(err.message || 'Failed to delete trip');
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="py-20 flex flex-col items-center justify-center gap-4">
          <span className="w-8 h-8 border-3 border-forest-green border-t-transparent rounded-full animate-spin" />
          <p className="font-label text-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
            Loading expedition editor...
          </p>
        </div>
      </AppLayout>
    );
  }

  if (!trip) {
    return (
      <AppLayout>
        <div className="max-w-md mx-auto py-16 text-center flex flex-col items-center gap-4">
          <h2 className="font-headline text-headline-sm">Trip Not Found</h2>
          <Link to="/my-trips">
            <Button variant="primary">Back to My Trips</Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto py-8 px-page-margin flex flex-col gap-8">
        {/* Breadcrumb & Top Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-light-outline-variant dark:border-dark-outline-variant pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-label text-light-on-surface-variant dark:text-dark-on-surface-variant mb-1">
              <Link to="/my-trips" className="hover:text-forest-green dark:hover:text-dark-primary">
                My Trips
              </Link>
              <span>/</span>
              <span className="font-semibold text-light-on-surface dark:text-dark-on-surface truncate max-w-xs">
                {trip.title}
              </span>
              <span>/</span>
              <span>Editor</span>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="font-headline text-headline-md text-light-on-surface dark:text-dark-on-surface">
                Trip Management Hub
              </h1>
              <StatusBadge status={trip.status} size="sm" />
              <VisibilityBadge visibility={trip.visibility} size="sm" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link to={`/trips/${trip.id}`}>
              <Button variant="secondary" size="sm">
                <span className="material-symbols-outlined text-base mr-1">visibility</span>
                View Journey
              </Button>
            </Link>
            {trip.status === 'draft' && (
              <Button variant="adventure" size="sm" onClick={() => setIsPublishModalOpen(true)}>
                <span className="material-symbols-outlined text-base mr-1">publish</span>
                Publish Trip
              </Button>
            )}
          </div>
        </div>

        {/* Global Feedback Alert */}
        {alertMessage && (
          <Alert
            variant={alertMessage.type}
            message={alertMessage.text}
            onClose={() => setAlertMessage(null)}
          />
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-light-outline-variant dark:border-dark-outline-variant pb-1">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`px-5 py-2.5 font-label text-sm font-semibold rounded-t-xl transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === 'details'
                ? 'border-forest-green text-forest-green dark:border-dark-primary dark:text-dark-primary bg-forest-green/5'
                : 'border-transparent text-light-on-surface-variant dark:text-dark-on-surface-variant hover:text-light-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-base">edit_note</span>
            1. Trip Fundamentals
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('stops')}
            className={`px-5 py-2.5 font-label text-sm font-semibold rounded-t-xl transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === 'stops'
                ? 'border-forest-green text-forest-green dark:border-dark-primary dark:text-dark-primary bg-forest-green/5'
                : 'border-transparent text-light-on-surface-variant dark:text-dark-on-surface-variant hover:text-light-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-base">location_on</span>
            2. Manage Stops ({stops.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('map')}
            className={`px-5 py-2.5 font-label text-sm font-semibold rounded-t-xl transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === 'map'
                ? 'border-forest-green text-forest-green dark:border-dark-primary dark:text-dark-primary bg-forest-green/5'
                : 'border-transparent text-light-on-surface-variant dark:text-dark-on-surface-variant hover:text-light-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-base">map</span>
            3. Route Map
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('lifecycle')}
            className={`px-5 py-2.5 font-label text-sm font-semibold rounded-t-xl transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === 'lifecycle'
                ? 'border-forest-green text-forest-green dark:border-dark-primary dark:text-dark-primary bg-forest-green/5'
                : 'border-transparent text-light-on-surface-variant dark:text-dark-on-surface-variant hover:text-light-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-base">settings</span>
            4. Lifecycle & Privacy
          </button>
        </div>

        {/* TAB 1: TRIP FUNDAMENTALS */}
        {activeTab === 'details' && (
          <form onSubmit={handleSaveMetadata} className="flex flex-col gap-6">
            <div className="bg-light-surface dark:bg-dark-surface border border-light-outline-variant dark:border-dark-outline-variant rounded-2xl p-6 md:p-8 flex flex-col gap-6 shadow-sm">
              <h2 className="font-headline text-title-md font-bold text-light-on-surface dark:text-dark-on-surface">
                Trip Metadata & Locations
              </h2>

              <Input
                label="Trip Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                error={formErrors.title}
                required
              />

              <div className="flex flex-col gap-1.5">
                <label className="font-label text-label-md text-light-on-background dark:text-dark-on-background">
                  Description & Field Overview
                </label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Outline key route details..."
                  className="w-full rounded-DEFAULT border border-light-outline-variant dark:border-dark-outline-variant bg-light-surface dark:bg-dark-surface text-light-on-surface dark:text-dark-on-surface p-3 font-body text-body-md focus:outline-none focus:ring-2 focus:ring-forest-green"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Starting Location"
                  value={startingLocation}
                  onChange={(e) => setStartingLocation(e.target.value)}
                  error={formErrors.startingLocation}
                  required
                  leftIcon="trip_origin"
                />
                <Input
                  label="Ending Destination"
                  value={endingLocation}
                  onChange={(e) => setEndingLocation(e.target.value)}
                  error={formErrors.endingLocation}
                  required
                  leftIcon="sports_score"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Start Date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  error={formErrors.startDate}
                />
                <Input
                  label="End Date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  error={formErrors.endDate}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="font-label text-label-md text-light-on-background dark:text-dark-on-background">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as TripCategory)}
                    className="w-full rounded-DEFAULT border border-light-outline-variant dark:border-dark-outline-variant bg-light-surface dark:bg-dark-surface text-light-on-surface dark:text-dark-on-surface px-3.5 py-2.5 font-body text-body-md focus:outline-none focus:ring-2 focus:ring-forest-green"
                  >
                    {TRIP_CATEGORIES.map((cat: string) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-label text-label-md text-light-on-background dark:text-dark-on-background">
                    Visibility
                  </label>
                  <select
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value as TripVisibility)}
                    className="w-full rounded-DEFAULT border border-light-outline-variant dark:border-dark-outline-variant bg-light-surface dark:bg-dark-surface text-light-on-surface dark:text-dark-on-surface px-3.5 py-2.5 font-body text-body-md focus:outline-none focus:ring-2 focus:ring-forest-green"
                  >
                    <option value="private">Private (Only you can view)</option>
                    <option value="public">Public (Visible to community)</option>
                  </select>
                </div>
              </div>

              {/* Cover Image */}
              <div className="flex flex-col gap-2 pt-2 border-t border-light-outline-variant dark:border-dark-outline-variant">
                <Input
                  label="Cover Image URL"
                  value={coverImageUrl}
                  onChange={(e) => setCoverImageUrl(e.target.value)}
                  leftIcon="image"
                />
                <div className="flex flex-wrap gap-2 mt-1">
                  {SAMPLE_COVERS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setCoverImageUrl(preset.url)}
                      className="px-2.5 py-1 rounded-full text-xs font-label bg-light-surface-container dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant text-light-on-surface-variant dark:text-dark-on-surface-variant hover:text-light-on-surface"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button type="submit" variant="primary" size="md" isLoading={isSavingMetadata}>
                  <span className="material-symbols-outlined text-base mr-1">save</span>
                  Save Trip Details
                </Button>
              </div>
            </div>
          </form>
        )}

        {/* TAB 2: MANAGE & REORDER STOPS */}
        {activeTab === 'stops' && (
          <div className="flex flex-col gap-6">
            <div className="bg-light-surface dark:bg-dark-surface border border-light-outline-variant dark:border-dark-outline-variant rounded-2xl p-6 md:p-8 flex flex-col gap-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-light-outline-variant dark:border-dark-outline-variant">
                <div>
                  <h2 className="font-headline text-title-md font-bold text-light-on-surface dark:text-dark-on-surface">
                    Journey Waypoints & Stops
                  </h2>
                  <p className="font-body text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant mt-0.5">
                    Drag waypoints or use arrows to reorder. Stops save atomically via the batch reorder API.
                  </p>
                </div>

                <Button
                  variant="adventure"
                  size="sm"
                  onClick={() => {
                    setEditingStop(null);
                    setIsStopModalOpen(true);
                  }}
                >
                  <span className="material-symbols-outlined text-base mr-1">add_location_alt</span>
                  Add Waypoint
                </Button>
              </div>

              {isReordering && (
                <div className="p-3 rounded-lg bg-sky-blue/10 border border-sky-blue/30 text-sky-blue text-xs font-label flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Saving reordered sequence to database...
                </div>
              )}

              {/* Interactive Journey Timeline with Reorder controls */}
              <JourneyTimeline
                startingLocation={trip.starting_location}
                endingLocation={trip.ending_location}
                startDate={trip.start_date}
                endDate={trip.end_date}
                stops={stops}
                isEditable={true}
                onEditStop={(stop) => {
                  setEditingStop(stop);
                  setIsStopModalOpen(true);
                }}
                onDeleteStop={(stopId) => setDeletingStopId(stopId)}
                onMoveUp={(index) => handleMoveStopStep(index, 'up')}
                onMoveDown={(index) => handleMoveStopStep(index, 'down')}
                onReorder={(reordered) => handleReorderStops(reordered)}
              />
            </div>
          </div>
        )}

        {/* TAB 3: ROUTE MAP & GEOGRAPHY */}
        {activeTab === 'map' && (
          <div className="flex flex-col gap-6">
            <div className="bg-light-surface dark:bg-dark-surface border border-light-outline-variant dark:border-dark-outline-variant rounded-2xl p-6 md:p-8 flex flex-col gap-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-light-outline-variant dark:border-dark-outline-variant pb-4">
                <div>
                  <h2 className="font-headline text-title-md font-bold text-light-on-surface dark:text-dark-on-surface">
                    Journey Map & Route Visualization
                  </h2>
                  <p className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                    Interactive geographical preview of your starting point, intermediate stops, and final destination.
                  </p>
                </div>
                <Button
                  variant="adventure"
                  size="sm"
                  onClick={() => {
                    setEditingStop(null);
                    setIsStopModalOpen(true);
                  }}
                >
                  <span className="material-symbols-outlined text-base mr-1">add_location_alt</span>
                  Add Waypoint
                </Button>
              </div>

              <InteractiveJourneyMap
                trip={{ ...trip, stops }}
                selectedStopId={selectedMapStopId}
                onSelectStop={(stopId) => setSelectedMapStopId(stopId)}
                onEditStop={(stop) => {
                  setEditingStop(stop);
                  setIsStopModalOpen(true);
                }}
                onEditTrip={() => {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                height="550px"
              />
            </div>
          </div>
        )}

        {/* TAB 4: LIFECYCLE & DANGEROUS ACTIONS */}
        {activeTab === 'lifecycle' && (
          <div className="flex flex-col gap-6">
            {/* Status Machine Controls */}
            <div className="bg-light-surface dark:bg-dark-surface border border-light-outline-variant dark:border-dark-outline-variant rounded-2xl p-6 md:p-8 flex flex-col gap-5 shadow-sm">
              <h2 className="font-headline text-title-md font-bold text-light-on-surface dark:text-dark-on-surface border-b border-light-outline-variant dark:border-dark-outline-variant pb-3">
                Lifecycle State Machine Controls
              </h2>

              <div className="flex items-center gap-3">
                <span className="font-label text-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                  Current Status:
                </span>
                <StatusBadge status={trip.status} size="md" />
              </div>

              {trip.status === 'draft' && (
                <div className="p-4 rounded-xl bg-sunshine-yellow/15 border border-sunshine-yellow/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-headline text-sm font-bold text-light-on-surface dark:text-dark-on-surface">
                      Draft Journey
                    </h4>
                    <p className="font-body text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant mt-0.5">
                      This route is currently in draft mode. Complete the checklist to publish.
                    </p>
                  </div>
                  <Button
                    variant="adventure"
                    size="sm"
                    onClick={() => setIsPublishModalOpen(true)}
                    disabled={lifecycleLoading}
                  >
                    <span className="material-symbols-outlined text-base mr-1">publish</span>
                    Publish Journey
                  </Button>
                </div>
              )}

              {trip.status === 'published' && (
                <div className="p-4 rounded-xl bg-forest-green/10 border border-forest-green/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-headline text-sm font-bold text-forest-green dark:text-dark-primary">
                      Published Journey
                    </h4>
                    <p className="font-body text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant mt-0.5">
                      This itinerary is live. You can revert it to draft for private revisions or archive it.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleUnpublish}
                      disabled={lifecycleLoading}
                    >
                      <span className="material-symbols-outlined text-base mr-1">drafts</span>
                      Revert to Draft
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleArchive}
                      disabled={lifecycleLoading}
                    >
                      <span className="material-symbols-outlined text-base mr-1">archive</span>
                      Archive
                    </Button>
                  </div>
                </div>
              )}

              {trip.status === 'archived' && (
                <div className="p-4 rounded-xl bg-light-surface-container dark:bg-dark-surface-container border border-light-outline-variant flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-headline text-sm font-bold text-light-on-surface dark:text-dark-on-surface">
                      Archived Journey
                    </h4>
                    <p className="font-body text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant mt-0.5">
                      Hidden from community feeds. You can restore this trip back to published.
                    </p>
                  </div>
                  <Button
                    variant="adventure"
                    size="sm"
                    onClick={handleRestore}
                    disabled={lifecycleLoading}
                  >
                    <span className="material-symbols-outlined text-base mr-1">unarchive</span>
                    Restore to Published
                  </Button>
                </div>
              )}
            </div>

            {/* Permanent Danger Zone */}
            <div className="bg-light-surface dark:bg-dark-surface border border-light-error/40 rounded-2xl p-6 md:p-8 flex flex-col gap-4 shadow-sm">
              <h2 className="font-headline text-title-md font-bold text-light-error flex items-center gap-2">
                <span className="material-symbols-outlined text-xl">warning</span>
                Danger Zone
              </h2>
              <p className="font-body text-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                Permanently deleting this trip will remove the itinerary, all {stops.length} associated
                waypoints, field notes, and coordinates. This action cannot be reversed.
              </p>
              <div className="pt-2">
                <Button
                  variant="adventure"
                  size="md"
                  onClick={() => setIsDeleteTripOpen(true)}
                  className="bg-light-error hover:bg-red-700 text-white"
                >
                  <span className="material-symbols-outlined text-base mr-1">delete_forever</span>
                  Permanently Delete Trip
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* MODALS */}
        {/* Stop Modal (Add/Edit) */}
        <StopModal
          isOpen={isStopModalOpen}
          onClose={() => {
            setIsStopModalOpen(false);
            setEditingStop(null);
          }}
          onSave={handleSaveStop}
          initialStop={editingStop}
          tripStartDate={trip.start_date}
          tripEndDate={trip.end_date}
        />

        {/* Delete Stop Modal */}
        <ConfirmModal
          isOpen={!!deletingStopId}
          onClose={() => setDeletingStopId(null)}
          onConfirm={handleDeleteStopConfirm}
          title="Delete Waypoint"
          message="Are you sure you want to remove this stop from your itinerary? Subsequent stops will be automatically re-indexed."
          confirmText="Remove Stop"
          variant="danger"
        />

        {/* Publish Modal */}
        {trip && (
          <PublishModal
            isOpen={isPublishModalOpen}
            onClose={() => setIsPublishModalOpen(false)}
            onPublish={handlePublishConfirm}
            trip={trip}
          />
        )}

        {/* Delete Trip Modal */}
        <ConfirmModal
          isOpen={isDeleteTripOpen}
          onClose={() => setIsDeleteTripOpen(false)}
          onConfirm={handleDeleteTripConfirm}
          title="Permanently Delete Trip"
          message="Are you sure you want to permanently delete this trip? All stops and data will be destroyed."
          confirmText="Yes, Delete Permanently"
          variant="danger"
        />
      </div>
    </AppLayout>
  );
};
