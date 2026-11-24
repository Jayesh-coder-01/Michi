import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Alert';
import {
  Trip,
  TripCategory,
  TripVisibility,
  TripCreateInput,
  TripUpdateInput,
} from '../../types/trip';

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

interface TripEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: TripCreateInput | TripUpdateInput) => Promise<void>;
  initialTrip?: Trip | null;
}

export const TripEditorModal: React.FC<TripEditorModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialTrip = null,
}) => {
  const isEditing = Boolean(initialTrip);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startingLocation, setStartingLocation] = useState('');
  const [endingLocation, setEndingLocation] = useState('');
  const [category, setCategory] = useState<TripCategory>('Other');
  const [visibility, setVisibility] = useState<TripVisibility>('private');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialTrip) {
      setTitle(initialTrip.title);
      setDescription(initialTrip.description || '');
      setStartingLocation(initialTrip.starting_location);
      setEndingLocation(initialTrip.ending_location);
      setCategory(initialTrip.category);
      setVisibility(initialTrip.visibility);
      setStartDate(initialTrip.start_date || '');
      setEndDate(initialTrip.end_date || '');
      setCoverImageUrl(initialTrip.cover_image_url || '');
    } else {
      setTitle('');
      setDescription('');
      setStartingLocation('');
      setEndingLocation('');
      setCategory('Other');
      setVisibility('private');
      setStartDate('');
      setEndDate('');
      setCoverImageUrl('');
    }
    setError(null);
  }, [initialTrip, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim() || title.trim().length < 3) {
      setError('Trip title must be at least 3 characters.');
      return;
    }

    if (!startingLocation.trim() || startingLocation.trim().length < 2) {
      setError('Starting location must be at least 2 characters.');
      return;
    }

    if (!endingLocation.trim() || endingLocation.trim().length < 2) {
      setError('Ending location must be at least 2 characters.');
      return;
    }

    if (startDate && endDate && endDate < startDate) {
      setError('End date cannot be earlier than start date.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: TripCreateInput = {
        title: title.trim(),
        description: description.trim() || undefined,
        starting_location: startingLocation.trim(),
        ending_location: endingLocation.trim(),
        category,
        visibility,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        cover_image_url: coverImageUrl.trim() || undefined,
      };
      await onSubmit(payload);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save journey.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Trip Information' : 'Plan a New Journey'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && <Alert type="error" message={error} />}

        <Input
          label="Trip Title *"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Trans-Himalayan High Passes"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Starting Location (Origin) *"
            value={startingLocation}
            onChange={(e) => setStartingLocation(e.target.value)}
            placeholder="e.g. Leh, Ladakh"
          />

          <Input
            label="Ending Location (Destination) *"
            value={endingLocation}
            onChange={(e) => setEndingLocation(e.target.value)}
            placeholder="e.g. Manali, Himachal Pradesh"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="font-label text-label-md text-light-on-surface dark:text-dark-on-surface">
              Travel Category *
            </label>
            <select
              className="w-full px-4 py-2.5 rounded-xl border border-light-outline-variant dark:border-dark-outline-variant bg-light-surface dark:bg-dark-surface text-light-on-surface dark:text-dark-on-surface text-body-md focus:outline-none focus:ring-2 focus:ring-forest-green dark:focus:ring-dark-primary"
              value={category}
              onChange={(e) => setCategory(e.target.value as TripCategory)}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-label text-label-md text-light-on-surface dark:text-dark-on-surface">
              Visibility *
            </label>
            <select
              className="w-full px-4 py-2.5 rounded-xl border border-light-outline-variant dark:border-dark-outline-variant bg-light-surface dark:bg-dark-surface text-light-on-surface dark:text-dark-on-surface text-body-md focus:outline-none focus:ring-2 focus:ring-forest-green dark:focus:ring-dark-primary"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as TripVisibility)}
            >
              <option value="private">Private (Only visible to you)</option>
              <option value="public">Public (Visible in Explore when published)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Start Date (Optional)"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />

          <Input
            label="End Date (Optional)"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        <Input
          label="Cover Image URL (Optional)"
          type="url"
          value={coverImageUrl}
          onChange={(e) => setCoverImageUrl(e.target.value)}
          placeholder="https://images.unsplash.com/..."
        />

        <div className="flex flex-col gap-1">
          <label className="font-label text-label-md text-light-on-surface dark:text-dark-on-surface">
            Trip Introduction & Overview (Optional)
          </label>
          <textarea
            className="w-full px-4 py-2.5 rounded-xl border border-light-outline-variant dark:border-dark-outline-variant bg-light-surface dark:bg-dark-surface text-light-on-surface dark:text-dark-on-surface text-body-md focus:outline-none focus:ring-2 focus:ring-forest-green dark:focus:ring-dark-primary"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tell fellow travellers about your journey plans, motivation, or terrain notes..."
            maxLength={5000}
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-light-outline-variant dark:border-dark-outline-variant">
          <Button variant="ghost" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="adventure" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Draft'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
