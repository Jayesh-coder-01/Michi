import React from 'react';

export interface AlertProps {
  type?: 'error' | 'success' | 'info' | 'warning';
  variant?: 'error' | 'success' | 'info' | 'warning';
  title?: string;
  message: string;
  className?: string;
  onClose?: () => void;
}

export const Alert: React.FC<AlertProps> = ({
  type,
  variant,
  title,
  message,
  className = '',
  onClose,
}) => {
  const alertType = variant || type || 'info';
  const styles = {
    error: {
      bg: 'bg-light-error/10 dark:bg-dark-error/15',
      border: 'border-light-error/30 dark:border-dark-error/30',
      text: 'text-light-error dark:text-dark-error',
      icon: 'error',
    },
    success: {
      bg: 'bg-forest-green/10 dark:bg-dark-primary/15',
      border: 'border-forest-green/30 dark:border-dark-primary/30',
      text: 'text-forest-green dark:text-dark-primary',
      icon: 'check_circle',
    },
    warning: {
      bg: 'bg-sunshine-yellow/15 dark:bg-sunshine-yellow/20',
      border: 'border-sunshine-yellow/40',
      text: 'text-[#855300] dark:text-sunshine-yellow',
      icon: 'warning',
    },
    info: {
      bg: 'bg-sky-blue/10 dark:bg-sky-blue/15',
      border: 'border-sky-blue/30',
      text: 'text-[#005575] dark:text-sky-blue',
      icon: 'info',
    },
  }[alertType];

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 p-3.5 rounded-DEFAULT border ${styles.bg} ${styles.border} ${styles.text} ${className}`}
    >
      <span className="material-symbols-outlined text-xl flex-shrink-0 mt-0.5">
        {styles.icon}
      </span>
      <div className="flex-1 text-sm font-body">
        {title && <h4 className="font-semibold text-sm mb-0.5">{title}</h4>}
        <p>{message}</p>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close alert"
          className="text-current opacity-70 hover:opacity-100 transition-opacity"
        >
          <span className="material-symbols-outlined text-base">close</span>
        </button>
      )}
    </div>
  );
};
