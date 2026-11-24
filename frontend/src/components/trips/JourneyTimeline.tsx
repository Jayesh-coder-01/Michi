import React from 'react';
import { TripStop } from '../../types/trip';
import { Button } from '../ui/Button';

interface JourneyTimelineProps {
  startingLocation: string;
  endingLocation: string;
  stops: TripStop[];
  startDate?: string | null;
  endDate?: string | null;
  isOwner?: boolean;
  isEditable?: boolean;
  onAddStop?: () => void;
  onEditStop?: (stop: TripStop) => void;
  onDeleteStop?: (stopId: string) => void;
  onMoveUp?: (index: number) => void;
  onMoveDown?: (index: number) => void;
  onReorder?: (reorderedStops: TripStop[]) => void;
}

export const JourneyTimeline: React.FC<JourneyTimelineProps> = ({
  startingLocation,
  endingLocation,
  stops,
  startDate,
  endDate,
  isOwner = false,
  isEditable,
  onAddStop,
  onEditStop,
  onDeleteStop,
  onMoveUp,
  onMoveDown,
  onReorder,
}) => {
  const [draggedIdx, setDraggedIdx] = React.useState<number | null>(null);
  const showEditControls = isEditable !== undefined ? isEditable : isOwner;
  const sortedStops = [...stops].sort((a, b) => a.order_index - b.order_index);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === dropIndex || !onReorder) return;
    const reordered = [...sortedStops];
    const [moved] = reordered.splice(draggedIdx, 1);
    reordered.splice(dropIndex, 0, moved);
    setDraggedIdx(null);
    onReorder(reordered);
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-headline text-title-lg text-light-on-surface dark:text-dark-on-surface">
            Journey Timeline & Stops
          </h3>
          <p className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
            {sortedStops.length} intermediate {sortedStops.length === 1 ? 'stop' : 'stops'} between origin and destination
          </p>
        </div>

        {isOwner && onAddStop && (
          <Button variant="adventure" size="sm" onClick={onAddStop}>
            <span className="material-symbols-outlined text-base mr-1">add_location_alt</span>
            Add Stop
          </Button>
        )}
      </div>

      {/* Timeline Node Flow */}
      <div className="relative pl-6 md:pl-8 border-l-2 border-dashed border-forest-green/40 dark:border-dark-primary/40 flex flex-col gap-8 ml-4 my-2">
        {/* Node 1: Origin */}
        <div className="relative group">
          <div className="absolute -left-[35px] md:-left-[43px] top-0.5 w-7 h-7 md:w-8 md:h-8 rounded-full bg-forest-green text-on-forest-green flex items-center justify-center shadow-md">
            <span className="material-symbols-outlined text-base md:text-lg">trip_origin</span>
          </div>
          <div className="p-4 rounded-xl bg-forest-green/10 dark:bg-forest-green/20 border border-forest-green/30 flex flex-col gap-1">
            <span className="font-label text-label-xs uppercase tracking-wider text-forest-green dark:text-dark-primary font-bold">
              Journey Starting Point
            </span>
            <p className="font-headline text-title-md text-light-on-surface dark:text-dark-on-surface font-semibold">
              {startingLocation}
            </p>
          </div>
        </div>

        {/* Node 2..N: Intermediate Stops */}
        {sortedStops.length === 0 ? (
          <div className="p-4 rounded-xl border border-light-outline-variant dark:border-dark-outline-variant bg-light-surface dark:bg-dark-surface text-center">
            <p className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant italic">
              No intermediate stops added yet. Point-to-point journey from {startingLocation} to {endingLocation}.
            </p>
          </div>
        ) : (
          sortedStops.map((stop, index) => {
            const arrDate = formatDate(stop.arrival_date);
            const depDate = formatDate(stop.departure_date);
            const dateDisplay =
              arrDate && depDate ? `${arrDate} – ${depDate}` : arrDate || depDate || null;

            return (
              <div
                key={stop.id}
                draggable={showEditControls && !!onReorder}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
                className={`relative group transition-opacity duration-200 ${
                  draggedIdx === index ? 'opacity-40' : 'opacity-100'
                }`}
              >
                {/* Node Marker with sequence number */}
                <div
                  className={`absolute -left-[35px] md:-left-[43px] top-1 w-7 h-7 md:w-8 md:h-8 rounded-full bg-adventure-orange text-white flex items-center justify-center font-bold text-xs md:text-sm shadow-md ${
                    showEditControls && onReorder ? 'cursor-grab active:cursor-grabbing' : ''
                  }`}
                  title={showEditControls && onReorder ? 'Drag to reorder' : `Stop #${index + 1}`}
                >
                  {index + 1}
                </div>

                {/* Stop Card */}
                <div className="p-5 rounded-2xl bg-light-surface dark:bg-dark-surface border border-light-outline-variant dark:border-dark-outline-variant shadow-sm hover:border-adventure-orange/50 transition-colors flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {showEditControls && onReorder && (
                          <span className="material-symbols-outlined text-xs text-light-outline cursor-grab" title="Drag to reorder">
                            drag_indicator
                          </span>
                        )}
                        <span className="font-label text-label-xs px-2 py-0.5 rounded-full bg-adventure-orange/15 text-adventure-orange font-semibold">
                          Stop #{index + 1}
                        </span>
                        {dateDisplay && (
                          <span className="font-label text-label-xs text-light-on-surface-variant dark:text-dark-on-surface-variant flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">calendar_month</span>
                            {dateDisplay}
                          </span>
                        )}
                        <span className="font-label text-label-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
                          ({Number(stop.latitude).toFixed(4)}, {Number(stop.longitude).toFixed(4)})
                        </span>
                      </div>
                      <h4 className="font-headline text-title-md text-light-on-surface dark:text-dark-on-surface font-bold">
                        {stop.stop_name}
                      </h4>
                      <p className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm text-forest-green dark:text-dark-primary">
                          location_on
                        </span>
                        {stop.location}
                      </p>
                    </div>

                    {/* Reorder & Action Controls for Owner */}
                    {showEditControls && (
                      <div className="flex items-center gap-1 self-start bg-light-surface-container dark:bg-dark-surface-container p-1 rounded-xl">
                        {onMoveUp && (
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => onMoveUp(index)}
                            title="Move stop earlier in journey"
                            className="p-1 rounded-lg hover:bg-light-surface dark:hover:bg-dark-surface disabled:opacity-30 disabled:hover:bg-transparent text-light-on-surface-variant dark:text-dark-on-surface-variant transition-colors"
                          >
                            <span className="material-symbols-outlined text-base">arrow_upward</span>
                          </button>
                        )}
                        {onMoveDown && (
                          <button
                            type="button"
                            disabled={index === sortedStops.length - 1}
                            onClick={() => onMoveDown(index)}
                            title="Move stop later in journey"
                            className="p-1 rounded-lg hover:bg-light-surface dark:hover:bg-dark-surface disabled:opacity-30 disabled:hover:bg-transparent text-light-on-surface-variant dark:text-dark-on-surface-variant transition-colors"
                          >
                            <span className="material-symbols-outlined text-base">arrow_downward</span>
                          </button>
                        )}
                        {onEditStop && (
                          <button
                            type="button"
                            onClick={() => onEditStop(stop)}
                            title="Edit stop details"
                            className="p-1 rounded-lg hover:bg-light-surface dark:hover:bg-dark-surface text-forest-green dark:text-dark-primary transition-colors"
                          >
                            <span className="material-symbols-outlined text-base">edit</span>
                          </button>
                        )}
                        {onDeleteStop && (
                          <button
                            type="button"
                            onClick={() => onDeleteStop(stop.id)}
                            title="Remove stop"
                            className="p-1 rounded-lg hover:bg-light-surface dark:hover:bg-dark-surface text-light-error dark:text-light-error transition-colors"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Accommodation / Activities / Notes breakdown */}
                  {(stop.accommodation_details || stop.activities || stop.notes) && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-light-outline-variant/60 dark:border-dark-outline-variant/60 text-body-sm">
                      {stop.accommodation_details && (
                        <div className="flex flex-col gap-0.5">
                          <span className="font-label text-label-xs text-forest-green dark:text-dark-primary font-bold flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">hotel</span>
                            Stay
                          </span>
                          <p className="text-light-on-surface dark:text-dark-on-surface text-xs leading-relaxed">
                            {stop.accommodation_details}
                          </p>
                        </div>
                      )}
                      {stop.activities && (
                        <div className="flex flex-col gap-0.5">
                          <span className="font-label text-label-xs text-adventure-orange font-bold flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">hiking</span>
                            Activities
                          </span>
                          <p className="text-light-on-surface dark:text-dark-on-surface text-xs leading-relaxed">
                            {stop.activities}
                          </p>
                        </div>
                      )}
                      {stop.notes && (
                        <div className="flex flex-col gap-0.5">
                          <span className="font-label text-label-xs text-sky-blue font-bold flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">notes</span>
                            Field Notes
                          </span>
                          <p className="text-light-on-surface dark:text-dark-on-surface text-xs leading-relaxed">
                            {stop.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Node Last: Final Destination */}
        <div className="relative group">
          <div className="absolute -left-[35px] md:-left-[43px] top-0.5 w-7 h-7 md:w-8 md:h-8 rounded-full bg-forest-green text-on-forest-green flex items-center justify-center shadow-md">
            <span className="material-symbols-outlined text-base md:text-lg">sports_score</span>
          </div>
          <div className="p-4 rounded-xl bg-forest-green/10 dark:bg-forest-green/20 border border-forest-green/30 flex flex-col gap-1">
            <span className="font-label text-label-xs uppercase tracking-wider text-forest-green dark:text-dark-primary font-bold">
              Final Destination
            </span>
            <p className="font-headline text-title-md text-light-on-surface dark:text-dark-on-surface font-semibold">
              {endingLocation}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
