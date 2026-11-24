import React from 'react';
import { Link } from 'react-router-dom';
import { Trip, TripListItem } from '../../types/trip';
import { StatusBadge, VisibilityBadge, CategoryBadge } from './TripBadge';

interface TripCardProps {
  trip: Trip | TripListItem;
  isOwner?: boolean;
  onDelete?: (tripId: string) => void;
  onPublish?: (tripId: string) => void;
}

export const TripCard: React.FC<TripCardProps> = ({
  trip,
  isOwner = false,
  onDelete,
  onPublish,
}) => {
  const fallbackCover =
    'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=800&q=80';

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const startFormatted = formatDate(trip.start_date);
  const endFormatted = formatDate(trip.end_date);
  const datesDisplay =
    startFormatted && endFormatted
      ? `${startFormatted} – ${endFormatted}`
      : startFormatted || endFormatted || null;

  return (
    <article className="group bg-light-surface dark:bg-dark-surface border border-light-outline-variant dark:border-dark-outline-variant rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col">
      {/* Cover Image & Badges */}
      <div className="relative h-48 w-full overflow-hidden bg-light-surface-container dark:bg-dark-surface-container">
        <img
          src={trip.cover_image_url || fallbackCover}
          alt={trip.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={(e) => {
            (e.target as HTMLImageElement).src = fallbackCover;
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

        {/* Top Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
          <CategoryBadge category={trip.category} size="sm" />
          <div className="flex items-center gap-1.5">
            <VisibilityBadge visibility={trip.visibility} size="sm" />
            <StatusBadge status={trip.status} size="sm" />
          </div>
        </div>

        {/* Bottom Route Summary on Cover */}
        <div className="absolute bottom-2.5 left-3 right-3 text-white">
          <div className="flex items-center gap-1.5 text-xs font-label text-white/90 truncate">
            <span className="material-symbols-outlined text-[15px] text-adventure-orange">near_me</span>
            <span className="truncate">{trip.starting_location}</span>
            <span className="text-white/60">→</span>
            <span className="truncate">{trip.ending_location}</span>
          </div>
        </div>
      </div>

      {/* Card Content */}
      <div className="p-5 flex-1 flex flex-col justify-between gap-4">
        <div>
          <Link to={`/trips/${trip.id}`}>
            <h3 className="font-headline text-title-lg text-light-on-surface dark:text-dark-on-surface group-hover:text-forest-green dark:group-hover:text-dark-primary transition-colors line-clamp-1">
              {trip.title}
            </h3>
          </Link>

          {trip.description && (
            <p className="mt-1.5 font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant line-clamp-2">
              {trip.description}
            </p>
          )}

          {/* Dates & Stops Count */}
          <div className="mt-3 flex items-center gap-4 text-xs font-label text-light-on-surface-variant dark:text-dark-on-surface-variant">
            {datesDisplay && (
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px]">calendar_today</span>
                {datesDisplay}
              </span>
            )}
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px] text-forest-green dark:text-dark-primary">
                location_on
              </span>
              {trip.stops_count} {trip.stops_count === 1 ? 'stop' : 'stops'}
            </span>
          </div>
        </div>

        {/* Card Footer: Owner snippet & Actions */}
        <div className="pt-3 border-t border-light-outline-variant dark:border-dark-outline-variant flex items-center justify-between gap-2">
          {trip.owner && (
            <Link
              to={`/traveller/${trip.owner.username}`}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              {trip.owner.avatar_url ? (
                <img
                  src={trip.owner.avatar_url}
                  alt={trip.owner.display_name}
                  className="w-6 h-6 rounded-full object-cover"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-forest-green text-on-forest-green flex items-center justify-center font-bold text-[10px]">
                  {(trip.owner.display_name || 'T')[0].toUpperCase()}
                </div>
              )}
              <span className="text-xs font-label text-light-on-surface-variant dark:text-dark-on-surface-variant truncate max-w-[110px]">
                {trip.owner.display_name}
              </span>
            </Link>
          )}

          <div className="flex items-center gap-2">
            {isOwner && (
              <>
                {trip.status === 'draft' && onPublish && (
                  <button
                    type="button"
                    onClick={() => onPublish(trip.id)}
                    className="p-1.5 rounded-full hover:bg-forest-green/10 text-forest-green dark:text-dark-primary transition-colors text-xs font-label flex items-center gap-1"
                    title="Publish Trip"
                  >
                    <span className="material-symbols-outlined text-[18px]">publish</span>
                  </button>
                )}
                <Link
                  to={`/trips/${trip.id}/edit`}
                  className="p-1.5 rounded-full hover:bg-light-surface-container dark:hover:bg-dark-surface-container text-light-on-surface-variant dark:text-dark-on-surface-variant transition-colors"
                  title="Edit Trip"
                >
                  <span className="material-symbols-outlined text-[18px]">edit</span>
                </Link>
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(trip.id)}
                    className="p-1.5 rounded-full hover:bg-red-50 text-light-error dark:hover:bg-red-950/30 transition-colors"
                    title="Delete Trip"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                )}
              </>
            )}

            <Link
              to={`/trips/${trip.id}`}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-light-surface-container dark:bg-dark-surface-container hover:bg-forest-green hover:text-white dark:hover:bg-dark-primary dark:hover:text-[#003822] text-xs font-label text-light-on-surface dark:text-dark-on-surface transition-colors font-medium"
            >
              Explore
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
};
