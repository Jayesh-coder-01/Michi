import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'adventure' | 'yellow' | 'blue' | 'surface';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}) => {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-label-sm',
    md: 'px-3 py-1 text-label-md',
  }[size];

  const variantClasses = {
    primary: 'bg-forest-green text-on-forest-green',
    adventure: 'bg-adventure-orange text-on-adventure-orange',
    yellow: 'bg-sunshine-yellow text-on-sunshine-yellow',
    blue: 'bg-sky-blue text-on-sky-blue',
    surface: 'bg-light-surface-container dark:bg-dark-surface-container text-light-on-surface dark:text-dark-on-surface border border-light-outline-variant dark:border-dark-outline-variant',
  }[variant];

  return (
    <span
      className={`inline-flex items-center font-label rounded-full ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};
