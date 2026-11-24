import React from 'react';
import { TripStatus, TripVisibility, TripCategory } from '../../types/trip';

interface StatusBadgeProps {
  status: TripStatus;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'sm' }) => {
  const sizeClass = size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  switch (status) {
    case 'published':
      return (
        <span
          className={`inline-flex items-center gap-1 font-label font-medium rounded-full bg-forest-green/15 text-forest-green dark:bg-dark-primary/20 dark:text-dark-primary ${sizeClass}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-forest-green dark:bg-dark-primary" />
          Published
        </span>
      );
    case 'draft':
      return (
        <span
          className={`inline-flex items-center gap-1 font-label font-medium rounded-full bg-sunshine-yellow/30 text-[#855700] dark:bg-sunshine-yellow/20 dark:text-sunshine-yellow ${sizeClass}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#855700] dark:bg-sunshine-yellow" />
          Draft
        </span>
      );
    case 'archived':
      return (
        <span
          className={`inline-flex items-center gap-1 font-label font-medium rounded-full bg-light-surface-container dark:bg-dark-surface-container text-light-on-surface-variant dark:text-dark-on-surface-variant border border-light-outline-variant dark:border-dark-outline-variant ${sizeClass}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-light-outline dark:bg-dark-outline" />
          Archived
        </span>
      );
    default:
      return null;
  }
};

interface VisibilityBadgeProps {
  visibility: TripVisibility;
  size?: 'sm' | 'md';
}

export const VisibilityBadge: React.FC<VisibilityBadgeProps> = ({ visibility, size = 'sm' }) => {
  const sizeClass = size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  if (visibility === 'public') {
    return (
      <span
        className={`inline-flex items-center gap-1 font-label font-medium rounded-full bg-sky-blue/20 text-[#005273] dark:bg-sky-blue/20 dark:text-sky-blue ${sizeClass}`}
      >
        <span className="material-symbols-outlined text-[13px]">public</span>
        Public
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 font-label font-medium rounded-full bg-light-surface-container dark:bg-dark-surface-container text-light-on-surface-variant dark:text-dark-on-surface-variant border border-light-outline-variant dark:border-dark-outline-variant ${sizeClass}`}
    >
      <span className="material-symbols-outlined text-[13px]">lock</span>
      Private
    </span>
  );
};

interface CategoryBadgeProps {
  category: TripCategory | string;
  size?: 'sm' | 'md';
}

export const CategoryBadge: React.FC<CategoryBadgeProps> = ({ category, size = 'sm' }) => {
  const sizeClass = size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm';
  return (
    <span
      className={`inline-flex items-center font-label font-medium rounded-full bg-light-surface-container-high dark:bg-dark-surface-container-high text-light-on-surface dark:text-dark-on-surface ${sizeClass}`}
    >
      {category}
    </span>
  );
};
