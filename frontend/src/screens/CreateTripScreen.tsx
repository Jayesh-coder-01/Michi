import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { tripService } from '../services/tripService';
import { TripCategory, TripVisibility, TRIP_CATEGORIES, TripCreateInput } from '../types/trip';

const SAMPLE_COVERS = [
  { label: 'Mountain Trail', url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Coastal Highway', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Forest Hike', url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Historic Town', url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=80' },
];

export const CreateTripScreen: React.FC = () => {
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState(SAMPLE_COVERS[0].url);
  const [startingLocation, setStartingLocation] = useState('');
  const [endingLocation, setEndingLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [category, setCategory] = useState<TripCategory>('Trekking');
  // Strict PRD Requirement: Privacy by default!
  const [visibility, setVisibility] = useState<TripVisibility>('private');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const validate = (forPublish: boolean = false): boolean => {
    const errs: Record<string, string> = {};

    if (!title.trim() || title.trim().length < 3) {
      errs.title = 'Title must be at least 3 characters long.';
    } else if (title.length > 150) {
      errs.title = 'Title cannot exceed 150 characters.';
    }

    if (!startingLocation.trim() || startingLocation.trim().length < 2) {
      errs.startingLocation = 'Starting location is required (min 2 characters).';
    } else if (startingLocation.length > 255) {
      errs.startingLocation = 'Starting location cannot exceed 255 characters.';
    }

    if (!endingLocation.trim() || endingLocation.trim().length < 2) {
      errs.endingLocation = 'Ending location is required (min 2 characters).';
    } else if (endingLocation.length > 255) {
      errs.endingLocation = 'Ending location cannot exceed 255 characters.';
    }

    if (startDate && endDate && endDate < startDate) {
      errs.endDate = 'End date cannot be earlier than start date.';
    }

    if (forPublish) {
      if (!startDate) errs.startDate = 'Start date is required before publishing.';
      if (!endDate) errs.endDate = 'End date is required before publishing.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async (publishImmediately: boolean = false) => {
    if (!validate(publishImmediately)) return;

    setIsSubmitting(true);
    setApiError(null);

    const payload: TripCreateInput = {
      title: title.trim(),
      description: description.trim() || undefined,
      cover_image_url: coverImageUrl.trim() || undefined,
      starting_location: startingLocation.trim(),
      ending_location: endingLocation.trim(),
      start_date: startDate || null,
      end_date: endDate || null,
      category,
      visibility,
    };

    try {
      const createdTrip = await tripService.createTrip(payload);

      if (publishImmediately) {
        try {
          await tripService.publishTrip(createdTrip.id, { visibility });
          navigate(`/trips/${createdTrip.id}`);
          return;
        } catch (pubErr: any) {
          // If publishing failed checklist, still navigate to editor with notice
          navigate(`/trips/${createdTrip.id}/edit`, {
            state: { publishError: pubErr.message || 'Saved as draft. Checklist required for publishing.' },
          });
          return;
        }
      }

      // Default: navigate to Trip Editor to add stops
      navigate(`/trips/${createdTrip.id}/edit`);
    } catch (err: any) {
      setApiError(err.message || 'Failed to create trip. Please check your inputs.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto py-8 px-page-margin">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 mb-6 text-sm font-label text-light-on-surface-variant dark:text-dark-on-surface-variant">
          <Link to="/my-trips" className="hover:text-forest-green dark:hover:text-dark-primary transition-colors">
            My Trips
          </Link>
          <span>/</span>
          <span className="text-light-on-surface dark:text-dark-on-surface font-semibold">New Journey</span>
        </div>

        {/* Page Title & Intro */}
        <div className="mb-8">
          <span className="font-label text-xs uppercase tracking-wider text-adventure-orange font-bold">
            Journey Blueprint
          </span>
          <h1 className="font-headline text-headline-md md:text-headline-lg text-light-on-surface dark:text-dark-on-surface mt-1">
            Create a New Trip
          </h1>
          <p className="font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant mt-1.5">
            Every path has a story. Map your departure, destinations, timeline, and privacy settings.
          </p>
        </div>

        {apiError && (
          <div className="mb-6 p-4 rounded-xl bg-light-error/10 border border-light-error/30 text-light-error font-body text-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">error</span>
            <span>{apiError}</span>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave(false);
          }}
          className="flex flex-col gap-8"
        >
          {/* Card 1: Core Details */}
          <div className="bg-light-surface dark:bg-dark-surface border border-light-outline-variant dark:border-dark-outline-variant rounded-2xl p-6 md:p-8 flex flex-col gap-6 shadow-sm">
            <h2 className="font-headline text-title-lg text-light-on-surface dark:text-dark-on-surface flex items-center gap-2 border-b border-light-outline-variant dark:border-dark-outline-variant pb-3">
              <span className="material-symbols-outlined text-forest-green dark:text-dark-primary">map</span>
              Trip Fundamentals
            </h2>

            {/* Title */}
            <Input
              label="Trip Title"
              placeholder="e.g. Trans-Himalayan Spiti High Pass Traverse"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              error={errors.title}
              required
              helperText="Give your expedition an evocative name (min. 3 characters)"
            />

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <label className="font-label text-label-md text-light-on-background dark:text-dark-on-background">
                Description & Overview
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the terrain, elevation, motivation, or key highlights of this route..."
                className="w-full rounded-DEFAULT border border-light-outline-variant dark:border-dark-outline-variant bg-light-surface dark:bg-dark-surface text-light-on-surface dark:text-dark-on-surface p-3 font-body text-body-md focus:outline-none focus:ring-2 focus:ring-forest-green"
              />
            </div>

            {/* Starting & Ending Locations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Starting Location (Origin)"
                placeholder="e.g. Manali, Himachal Pradesh"
                value={startingLocation}
                onChange={(e) => setStartingLocation(e.target.value)}
                error={errors.startingLocation}
                required
                leftIcon="trip_origin"
              />
              <Input
                label="Ending Location (Destination)"
                placeholder="e.g. Kaza, Spiti Valley"
                value={endingLocation}
                onChange={(e) => setEndingLocation(e.target.value)}
                error={errors.endingLocation}
                required
                leftIcon="sports_score"
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Start Date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                error={errors.startDate}
                helperText="Expected departure date"
              />
              <Input
                label="End Date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                error={errors.endDate}
                helperText="Expected completion date (≥ Start Date)"
              />
            </div>

            {/* Category */}
            <div className="flex flex-col gap-1.5">
              <label className="font-label text-label-md text-light-on-background dark:text-dark-on-background">
                Category <span className="text-light-error dark:text-dark-error">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TripCategory)}
                className="w-full rounded-DEFAULT border border-light-outline-variant dark:border-dark-outline-variant bg-light-surface dark:bg-dark-surface text-light-on-surface dark:text-dark-on-surface px-3.5 py-2.5 font-body text-body-md focus:outline-none focus:ring-2 focus:ring-forest-green"
              >
                {TRIP_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Card 2: Cover Image & Scenery */}
          <div className="bg-light-surface dark:bg-dark-surface border border-light-outline-variant dark:border-dark-outline-variant rounded-2xl p-6 md:p-8 flex flex-col gap-6 shadow-sm">
            <h2 className="font-headline text-title-lg text-light-on-surface dark:text-dark-on-surface flex items-center gap-2 border-b border-light-outline-variant dark:border-dark-outline-variant pb-3">
              <span className="material-symbols-outlined text-adventure-orange">photo_library</span>
              Cover Photograph
            </h2>

            {/* Cover Preview */}
            <div className="relative h-48 md:h-64 rounded-xl overflow-hidden bg-light-surface-container dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant">
              {coverImageUrl ? (
                <img
                  src={coverImageUrl}
                  alt="Cover preview"
                  className="w-full h-full object-cover"
                  onError={() => setCoverImageUrl(SAMPLE_COVERS[0].url)}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-light-outline dark:text-dark-outline gap-2">
                  <span className="material-symbols-outlined text-4xl">landscape</span>
                  <span className="font-label text-xs">No cover image specified</span>
                </div>
              )}
            </div>

            {/* Presets */}
            <div className="flex flex-col gap-2">
              <span className="font-label text-xs font-semibold text-light-on-surface-variant dark:text-dark-on-surface-variant">
                Select scenic preset or paste an image URL:
              </span>
              <div className="flex flex-wrap gap-2">
                {SAMPLE_COVERS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setCoverImageUrl(preset.url)}
                    className={`px-3 py-1.5 rounded-full text-xs font-label transition-colors ${
                      coverImageUrl === preset.url
                        ? 'bg-adventure-orange text-on-adventure-orange font-semibold shadow-sm'
                        : 'bg-light-surface-container dark:bg-dark-surface-container hover:bg-light-surface-container-high dark:hover:bg-dark-surface-container-high text-light-on-surface dark:text-dark-on-surface border border-light-outline-variant dark:border-dark-outline-variant'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <Input
              label="Custom Image URL"
              placeholder="https://..."
              value={coverImageUrl}
              onChange={(e) => setCoverImageUrl(e.target.value)}
              leftIcon="link"
              helperText="High-resolution landscape photography recommended"
            />
          </div>

          {/* Card 3: Privacy & Visibility Settings */}
          <div className="bg-light-surface dark:bg-dark-surface border border-light-outline-variant dark:border-dark-outline-variant rounded-2xl p-6 md:p-8 flex flex-col gap-6 shadow-sm">
            <h2 className="font-headline text-title-lg text-light-on-surface dark:text-dark-on-surface flex items-center gap-2 border-b border-light-outline-variant dark:border-dark-outline-variant pb-3">
              <span className="material-symbols-outlined text-sky-blue">lock</span>
              Visibility & Privacy
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Private Choice (Default) */}
              <button
                type="button"
                onClick={() => setVisibility('private')}
                className={`p-4 rounded-xl border text-left transition-colors flex flex-col gap-2 ${
                  visibility === 'private'
                    ? 'border-forest-green bg-forest-green/10 dark:border-dark-primary dark:bg-dark-primary/10'
                    : 'border-light-outline-variant dark:border-dark-outline-variant hover:border-light-outline'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-headline font-bold text-base text-light-on-surface dark:text-dark-on-surface">
                    <span className="material-symbols-outlined text-lg">lock</span>
                    Private Journey
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-forest-green text-white dark:bg-dark-primary dark:text-[#003822] text-[10px] font-label font-bold uppercase">
                    Default
                  </span>
                </div>
                <p className="font-body text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
                  Only you can view this route, stops, and field notes. Recommended for ongoing drafts
                  and private itineraries.
                </p>
              </button>

              {/* Public Choice */}
              <button
                type="button"
                onClick={() => setVisibility('public')}
                className={`p-4 rounded-xl border text-left transition-colors flex flex-col gap-2 ${
                  visibility === 'public'
                    ? 'border-forest-green bg-forest-green/10 dark:border-dark-primary dark:bg-dark-primary/10'
                    : 'border-light-outline-variant dark:border-dark-outline-variant hover:border-light-outline'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-headline font-bold text-base text-light-on-surface dark:text-dark-on-surface">
                    <span className="material-symbols-outlined text-lg text-forest-green dark:text-dark-primary">
                      public
                    </span>
                    Public Journey
                  </div>
                </div>
                <p className="font-body text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
                  Featured on the MICHI Community Explore feed and your traveller profile when published.
                </p>
              </button>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <Link to="/my-trips">
              <Button type="button" variant="ghost" disabled={isSubmitting}>
                Cancel
              </Button>
            </Link>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => handleSave(false)}
                disabled={isSubmitting}
                isLoading={isSubmitting}
              >
                <span className="material-symbols-outlined text-base mr-1">save</span>
                Save as Draft
              </Button>

              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => handleSave(false)}
                disabled={isSubmitting}
                isLoading={isSubmitting}
              >
                <span className="material-symbols-outlined text-base mr-1">add_location_alt</span>
                Continue to Stops
              </Button>

              <Button
                type="button"
                variant="adventure"
                size="md"
                onClick={() => handleSave(true)}
                disabled={isSubmitting}
                isLoading={isSubmitting}
              >
                <span className="material-symbols-outlined text-base mr-1">publish</span>
                Publish Now
              </Button>
            </div>
          </div>
        </form>
      </div>
    </AppLayout>
  );
};
