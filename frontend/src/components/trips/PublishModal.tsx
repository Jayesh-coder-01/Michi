import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Trip, TripVisibility } from '../../types/trip';

interface PublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPublish: (visibility: TripVisibility) => Promise<void>;
  trip: Trip;
}

export const PublishModal: React.FC<PublishModalProps> = ({
  isOpen,
  onClose,
  onPublish,
  trip,
}) => {
  const [selectedVisibility, setSelectedVisibility] = useState<TripVisibility>(
    trip.visibility || 'private'
  );
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  // Validate publishing checklist client-side
  const checkItems = [
    {
      label: 'Trip title (at least 3 characters)',
      passed: !!trip.title && trip.title.trim().length >= 3,
    },
    {
      label: 'Category specified',
      passed: !!trip.category,
    },
    {
      label: 'Starting location set',
      passed: !!trip.starting_location && trip.starting_location.trim().length >= 2,
    },
    {
      label: 'Ending destination set',
      passed: !!trip.ending_location && trip.ending_location.trim().length >= 2,
    },
    {
      label: 'Start and end dates defined',
      passed: !!trip.start_date && !!trip.end_date,
    },
    {
      label: 'Valid chronological date sequence (End date ≥ Start date)',
      passed:
        !trip.start_date ||
        !trip.end_date ||
        new Date(trip.end_date) >= new Date(trip.start_date),
    },
    {
      label: `Journey stops checked (${trip.stops_count || 0} stops)`,
      passed: true, // 0 stops is valid point-to-point journey per PRD Module 3
    },
  ];

  const allPassed = checkItems.every((item) => item.passed);

  const handleConfirm = async () => {
    if (!allPassed) return;
    setIsPublishing(true);
    setPublishError(null);
    try {
      await onPublish(selectedVisibility);
      onClose();
    } catch (err: any) {
      setPublishError(err.message || 'Failed to publish trip');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Publish Your Journey" maxWidth="md">
      <div className="p-6 flex flex-col gap-5">
        <p className="font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant">
          Publishing makes your journey an official MICHI itinerary. Review the publishing
          checklist below before taking your route live.
        </p>

        {publishError && (
          <div className="p-3.5 rounded-lg bg-light-error/10 border border-light-error/30 text-light-error text-sm font-body">
            {publishError}
          </div>
        )}

        {/* Publishing Checklist */}
        <div className="bg-light-surface-container dark:bg-dark-surface-container rounded-xl p-4 border border-light-outline-variant dark:border-dark-outline-variant flex flex-col gap-2.5">
          <span className="font-label text-label-md font-semibold text-light-on-surface dark:text-dark-on-surface">
            Publishing Readiness Checklist
          </span>

          <ul className="flex flex-col gap-2">
            {checkItems.map((item, i) => (
              <li key={i} className="flex items-center gap-2 text-xs font-body">
                {item.passed ? (
                  <span className="material-symbols-outlined text-forest-green dark:text-dark-primary text-base">
                    check_circle
                  </span>
                ) : (
                  <span className="material-symbols-outlined text-light-error text-base">
                    cancel
                  </span>
                )}
                <span
                  className={
                    item.passed
                      ? 'text-light-on-surface dark:text-dark-on-surface'
                      : 'text-light-error dark:text-dark-error font-medium'
                  }
                >
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Visibility Choice */}
        <div className="flex flex-col gap-2">
          <label className="font-label text-label-md text-light-on-surface dark:text-dark-on-surface font-semibold">
            Select Journey Visibility
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setSelectedVisibility('private')}
              className={`p-3.5 rounded-xl border text-left transition-colors flex flex-col gap-1 ${
                selectedVisibility === 'private'
                  ? 'border-forest-green bg-forest-green/10 dark:border-dark-primary dark:bg-dark-primary/10'
                  : 'border-light-outline-variant dark:border-dark-outline-variant hover:border-light-outline'
              }`}
            >
              <div className="flex items-center gap-1.5 font-label text-sm font-semibold text-light-on-surface dark:text-dark-on-surface">
                <span className="material-symbols-outlined text-base">lock</span>
                Private
              </div>
              <p className="font-body text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
                Only visible to you. Recommended for ongoing or personal trips.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setSelectedVisibility('public')}
              className={`p-3.5 rounded-xl border text-left transition-colors flex flex-col gap-1 ${
                selectedVisibility === 'public'
                  ? 'border-forest-green bg-forest-green/10 dark:border-dark-primary dark:bg-dark-primary/10'
                  : 'border-light-outline-variant dark:border-dark-outline-variant hover:border-light-outline'
              }`}
            >
              <div className="flex items-center gap-1.5 font-label text-sm font-semibold text-light-on-surface dark:text-dark-on-surface">
                <span className="material-symbols-outlined text-base text-forest-green dark:text-dark-primary">
                  public
                </span>
                Public
              </div>
              <p className="font-body text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
                Featured on the Explore feed and your public traveller profile.
              </p>
            </button>
          </div>
        </div>

        {/* Modal Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-light-outline-variant dark:border-dark-outline-variant">
          <Button variant="secondary" onClick={onClose} disabled={isPublishing}>
            Cancel
          </Button>
          <Button
            variant="adventure"
            onClick={handleConfirm}
            disabled={!allPassed || isPublishing}
            isLoading={isPublishing}
          >
            Confirm & Publish
          </Button>
        </div>
      </div>
    </Modal>
  );
};
