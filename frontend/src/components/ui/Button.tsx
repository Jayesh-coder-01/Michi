import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'adventure' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-label rounded-full transition-colors duration-state-change focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-forest-green disabled:opacity-50 disabled:cursor-not-allowed';

  const sizeClasses = {
    sm: 'px-gutter-sm py-1 text-label-sm gap-1',
    md: 'px-gutter-md py-2 text-label-md gap-2',
    lg: 'px-gutter-xl py-3 text-label-lg gap-2',
  }[size];

  const variantClasses = {
    primary: 'bg-forest-green text-on-forest-green hover:bg-[#1c563b]',
    adventure: 'bg-adventure-orange text-on-adventure-orange hover:bg-[#e05e26]',
    secondary: 'bg-light-surface-container dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant text-light-on-surface dark:text-dark-on-surface hover:bg-light-surface-container-high dark:hover:bg-dark-surface-container-high',
    outline: 'border border-light-outline dark:border-dark-outline text-light-on-background dark:text-dark-on-background hover:bg-light-surface-container dark:hover:bg-dark-surface-container',
    ghost: 'text-light-on-surface-variant dark:text-dark-on-surface-variant hover:bg-light-surface-container dark:hover:bg-dark-surface-container',
    danger: 'bg-light-error text-white hover:bg-red-700 dark:bg-light-error dark:hover:bg-red-700',
  }[variant];

  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button
      className={`${baseClasses} ${sizeClasses} ${variantClasses} ${widthClass} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        leftIcon
      )}
      {children}
      {!isLoading && rightIcon}
    </button>
  );
};
