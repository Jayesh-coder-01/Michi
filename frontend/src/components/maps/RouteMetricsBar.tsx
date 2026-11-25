import React from 'react';
import { RouteMetrics } from '../../types/maps';

interface RouteMetricsBarProps {
  metrics: RouteMetrics | null;
  isLoading?: boolean;
  onEditMissingCoordinates?: () => void;
  className?: string;
}

export const RouteMetricsBar: React.FC<RouteMetricsBarProps> = ({
  metrics,
  isLoading = false,
  onEditMissingCoordinates,
  className = '',
}) => {
  if (isLoading) {
    return (
      <div
        data-testid="route-metrics-loading"
        className={`p-4 rounded-2xl bg-light-surface dark:bg-dark-surface border border-light-outline-variant dark:border-dark-outline-variant shadow-sm flex items-center justify-between animate-pulse ${className}`}
      >
        <div className="h-6 w-32 bg-light-outline-variant/50 dark:bg-dark-outline-variant/50 rounded-lg" />
        <div className="h-6 w-24 bg-light-outline-variant/50 dark:bg-dark-outline-variant/50 rounded-lg" />
        <div className="h-6 w-28 bg-light-outline-variant/50 dark:bg-dark-outline-variant/50 rounded-lg" />
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  // Display clear error state when routing cannot be calculated
  if (
    metrics.routeType === 'unavailable' ||
    Boolean(metrics.routingError) ||
    (metrics.totalDistanceKm === 0 && metrics.validCoordinatesCount < 2)
  ) {
    return (
      <div
        data-testid="route-metrics-error"
        className={`p-4 md:p-5 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 ${className}`}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-xl">error_outline</span>
          </div>
          <div className="flex flex-col">
            <span className="font-label text-label-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Route Calculation Notice
            </span>
            <span className="font-body text-body-sm font-medium">
              {metrics.routingError ||
                'Route could not be calculated. Missing valid GPS coordinates for origin or destination.'}
            </span>
          </div>
        </div>
        {onEditMissingCoordinates && (
          <button
            type="button"
            onClick={onEditMissingCoordinates}
            className="self-start md:self-auto px-4 py-2 rounded-xl bg-amber-600 text-white font-label text-label-sm font-semibold hover:bg-amber-700 transition-colors shadow-sm whitespace-nowrap"
          >
            Correct Location
          </button>
        )}
      </div>
    );
  }

  const isVerifiedRoads = metrics.routeType === 'geoapify_roads';

  return (
    <div
      data-testid="route-metrics-bar"
      className={`p-4 md:p-5 rounded-2xl bg-light-surface dark:bg-dark-surface border border-light-outline-variant dark:border-dark-outline-variant shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 ${className}`}
    >
      {/* Metric Stat Pillars */}
      <div className="flex flex-wrap items-center gap-6">
        {/* Distance */}
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-forest-green/15 dark:bg-dark-primary/15 text-forest-green dark:text-dark-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-xl">distance</span>
          </div>
          <div className="flex flex-col">
            <span className="font-label text-label-xs text-light-on-surface-variant dark:text-dark-on-surface-variant font-medium">
              Total Distance
            </span>
            <span className="font-headline text-title-md font-bold text-light-on-surface dark:text-dark-on-surface">
              {metrics.totalDistanceKm > 0
                ? metrics.distanceFormatted
                : metrics.isApproximate
                ? 'Estimated'
                : 'Unavailable'}
            </span>
          </div>
        </div>

        {/* Estimated Duration */}
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-adventure-orange/15 text-adventure-orange flex items-center justify-center">
            <span className="material-symbols-outlined text-xl">schedule</span>
          </div>
          <div className="flex flex-col">
            <span className="font-label text-label-xs text-light-on-surface-variant dark:text-dark-on-surface-variant font-medium">
              Estimated Duration
            </span>
            <span className="font-headline text-title-md font-bold text-light-on-surface dark:text-dark-on-surface">
              {metrics.totalDurationMinutes > 0
                ? metrics.durationFormatted
                : metrics.isApproximate
                ? 'Estimated'
                : 'Unavailable'}
            </span>
          </div>
        </div>

        {/* Stops Count */}
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-sky-blue/15 text-sky-blue flex items-center justify-center">
            <span className="material-symbols-outlined text-xl">pin_drop</span>
          </div>
          <div className="flex flex-col">
            <span className="font-label text-label-xs text-light-on-surface-variant dark:text-dark-on-surface-variant font-medium">
              Intermediate Stops
            </span>
            <span className="font-headline text-title-md font-bold text-light-on-surface dark:text-dark-on-surface">
              {metrics.totalStops} {metrics.totalStops === 1 ? 'stop' : 'stops'}
            </span>
          </div>
        </div>
      </div>

      {/* Badges & Flags */}
      <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-light-outline-variant/60 dark:border-dark-outline-variant/60">
        {/* Verification Status Badge (renders for 0 or more intermediate stops) */}
        {(metrics.routeType === 'geoapify_roads' || metrics.routeType === 'geodesic_haversine') && (
          <span
            data-testid="route-type-badge"
            className={`font-label text-label-xs px-2.5 py-1 rounded-full font-semibold flex items-center gap-1 ${
              isVerifiedRoads
                ? 'bg-forest-green/15 text-forest-green dark:text-dark-primary'
                : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
            }`}
            title={
              isVerifiedRoads
                ? 'Verified road driving navigation calculated by Geoapify Routing API'
                : 'Geodesic straight-line estimation calculated between placed coordinates (not road driving distance)'
            }
          >
            <span className="material-symbols-outlined text-xs">
              {isVerifiedRoads ? 'verified' : 'straighten'}
            </span>
            {isVerifiedRoads ? 'Geoapify Road Route (Verified)' : 'Haversine Straight Line (Estimated)'}
          </span>
        )}

        {/* Missing Coordinates Warning */}
        {metrics.hasMissingCoordinates && (
          <div
            data-testid="missing-coordinates-warning"
            className="flex items-center gap-1.5 font-label text-label-xs px-2.5 py-1 rounded-full bg-light-error/15 text-light-error font-semibold"
            title={`${metrics.missingCoordinatesCount} location(s) do not have valid GPS coordinates placed.`}
          >
            <span className="material-symbols-outlined text-xs">warning</span>
            <span>
              {metrics.missingCoordinatesCount}{' '}
              {metrics.missingCoordinatesCount === 1 ? 'waypoint' : 'waypoints'} missing coordinates
            </span>
            {onEditMissingCoordinates && (
              <button
                type="button"
                onClick={onEditMissingCoordinates}
                className="underline ml-1 hover:opacity-80"
              >
                Set
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
