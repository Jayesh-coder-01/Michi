import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Alert';
import { TripStop, TripStopCreateInput, TripStopUpdateInput } from '../../types/trip';

interface StopModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (data: TripStopCreateInput | TripStopUpdateInput) => Promise<void>;
  onSave?: (data: TripStopCreateInput | TripStopUpdateInput) => Promise<void>;
  initialStop?: TripStop | null;
  tripStartDate?: string | null;
  tripEndDate?: string | null;
}

export const StopModal: React.FC<StopModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  onSave,
  initialStop = null,
  tripStartDate,
  tripEndDate,
}) => {
  const saveHandler = onSave || onSubmit;
  const isEditing = Boolean(initialStop);

  const [stopName, setStopName] = useState('');
  const [location, setLocation] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [arrivalDate, setArrivalDate] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [accommodation, setAccommodation] = useState('');
  const [activities, setActivities] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialStop) {
      setStopName(initialStop.stop_name);
      setLocation(initialStop.location);
      setLatitude(String(initialStop.latitude));
      setLongitude(String(initialStop.longitude));
      setArrivalDate(initialStop.arrival_date || '');
      setDepartureDate(initialStop.departure_date || '');
      setAccommodation(initialStop.accommodation_details || '');
      setActivities(initialStop.activities || '');
      setNotes(initialStop.notes || '');
    } else {
      setStopName('');
      setLocation('');
      setLatitude('');
      setLongitude('');
      setArrivalDate(tripStartDate || '');
      setDepartureDate(tripEndDate || '');
      setAccommodation('');
      setActivities('');
      setNotes('');
    }
    setError(null);
  }, [initialStop, isOpen, tripStartDate, tripEndDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!stopName.trim() || stopName.trim().length < 2) {
      setError('Stop name must be at least 2 characters.');
      return;
    }

    if (!location.trim() || location.trim().length < 2) {
      setError('Location must be at least 2 characters.');
      return;
    }

    const latNum = parseFloat(latitude);
    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
      setError('Latitude must be a valid number between -90.0 and 90.0.');
      return;
    }

    const lngNum = parseFloat(longitude);
    if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
      setError('Longitude must be a valid number between -180.0 and 180.0.');
      return;
    }

    if (arrivalDate && departureDate && departureDate < arrivalDate) {
      setError('Departure date cannot be earlier than arrival date.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: TripStopCreateInput = {
        stop_name: stopName.trim(),
        location: location.trim(),
        latitude: latNum,
        longitude: lngNum,
        arrival_date: arrivalDate || undefined,
        departure_date: departureDate || undefined,
        accommodation_details: accommodation.trim() || undefined,
        activities: activities.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      if (saveHandler) await saveHandler(payload);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save stop.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Stop / Waypoint' : 'Add New Journey Stop'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && <Alert type="error" message={error} />}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Stop Destination Name *"
            value={stopName}
            onChange={(e) => setStopName(e.target.value)}
            placeholder="e.g. Takahara Village"
          />

          <Input
            label="Address or Location *"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Nonaka, Wakayama"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Latitude (-90 to 90) *"
            type="number"
            step="any"
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
            placeholder="e.g. 33.7833"
          />

          <Input
            label="Longitude (-180 to 180) *"
            type="number"
            step="any"
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
            placeholder="e.g. 135.5333"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Arrival Date (Optional)"
            type="date"
            value={arrivalDate}
            onChange={(e) => setArrivalDate(e.target.value)}
          />

          <Input
            label="Departure Date (Optional)"
            type="date"
            value={departureDate}
            onChange={(e) => setDepartureDate(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-label text-label-md text-light-on-surface dark:text-dark-on-surface">
            Accommodation Details (Optional)
          </label>
          <input
            type="text"
            className="w-full px-4 py-2.5 rounded-xl border border-light-outline-variant dark:border-dark-outline-variant bg-light-surface dark:bg-dark-surface text-light-on-surface dark:text-dark-on-surface text-body-md focus:outline-none focus:ring-2 focus:ring-forest-green dark:focus:ring-dark-primary"
            value={accommodation}
            onChange={(e) => setAccommodation(e.target.value)}
            placeholder="e.g. Kawayu Onsen Ryokan, river view room"
            maxLength={2000}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-label text-label-md text-light-on-surface dark:text-dark-on-surface">
            Activities & Experiences (Optional)
          </label>
          <input
            type="text"
            className="w-full px-4 py-2.5 rounded-xl border border-light-outline-variant dark:border-dark-outline-variant bg-light-surface dark:bg-dark-surface text-light-on-surface dark:text-dark-on-surface text-body-md focus:outline-none focus:ring-2 focus:ring-forest-green dark:focus:ring-dark-primary"
            value={activities}
            onChange={(e) => setActivities(e.target.value)}
            placeholder="e.g. Early morning hike to mountain shrine, tea ceremony"
            maxLength={2000}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-label text-label-md text-light-on-surface dark:text-dark-on-surface">
            Field Notes & Tips (Optional)
          </label>
          <textarea
            className="w-full px-4 py-2.5 rounded-xl border border-light-outline-variant dark:border-dark-outline-variant bg-light-surface dark:bg-dark-surface text-light-on-surface dark:text-dark-on-surface text-body-md focus:outline-none focus:ring-2 focus:ring-forest-green dark:focus:ring-dark-primary"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Bring cash for trail donation boxes; no ATMs along this ridge."
            maxLength={5000}
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-light-outline-variant dark:border-dark-outline-variant">
          <Button variant="ghost" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="adventure" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Stop'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
