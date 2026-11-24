import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
}

export const Card: React.FC<CardProps> = ({
  children,
  padding = 'lg',
  className = '',
  ...props
}) => {
  const paddingClasses = {
    none: 'p-0',
    sm: 'p-gutter-sm',
    md: 'p-gutter-md',
    lg: 'p-gutter-lg',
    xl: 'p-gutter-xl',
  }[padding];

  return (
    <div
      className={`bg-light-surface dark:bg-dark-surface border border-light-outline-variant dark:border-dark-outline-variant rounded-xl ${paddingClasses} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
