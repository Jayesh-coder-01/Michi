import React, { useState } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, type = 'text', className = '', id, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="font-label text-label-md text-light-on-background dark:text-dark-on-background">
            {label}
            {props.required && <span className="text-light-error dark:text-dark-error ml-1">*</span>}
          </label>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <span className="material-symbols-outlined absolute left-3 text-light-outline dark:text-dark-outline pointer-events-none text-xl">
              {leftIcon}
            </span>
          )}

          <input
            id={inputId}
            ref={ref}
            type={inputType}
            className={`w-full rounded-DEFAULT border font-body text-body-md px-3.5 py-2.5 transition-colors duration-state-change bg-light-surface dark:bg-dark-surface text-light-on-surface dark:text-dark-on-surface focus:outline-none focus:ring-2 focus:ring-forest-green ${
              leftIcon ? 'pl-10' : ''
            } ${isPassword ? 'pr-10' : ''} ${
              error
                ? 'border-light-error dark:border-dark-error focus:ring-light-error'
                : 'border-light-outline-variant dark:border-dark-outline-variant hover:border-light-outline dark:hover:border-dark-outline'
            } ${className}`}
            {...props}
          />

          {isPassword && (
            <button
              type="button"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 text-light-outline dark:text-dark-outline hover:text-light-on-surface dark:hover:text-dark-on-surface focus:outline-none"
            >
              <span className="material-symbols-outlined text-xl">
                {showPassword ? 'visibility_off' : 'visibility'}
              </span>
            </button>
          )}
        </div>

        {error ? (
          <p className="font-body text-body-md text-light-error dark:text-dark-error flex items-center gap-1 mt-0.5">
            <span className="material-symbols-outlined text-base">error</span>
            {error}
          </p>
        ) : helperText ? (
          <p className="font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
