import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ThemeToggle } from '../ui/ThemeToggle';
import { Button } from '../ui/Button';

export const Navbar: React.FC = () => {
  const { user, profile, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-30 bg-light-surface dark:bg-dark-surface border-b border-light-outline-variant dark:border-dark-outline-variant transition-colors duration-surface-enter">
      <div className="max-w-7xl mx-auto px-page-margin py-gutter-sm flex items-center justify-between gap-gutter-md">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-gutter-sm">
          <svg width="32" height="32" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect width="40" height="40" rx="10" fill="#246B4A" />
            <path d="M12 31C12 24 27 24 27 17C27 12.5 22 10 17 10" stroke="#F7F8F3" strokeWidth="3.2" strokeLinecap="round" />
            <circle cx="15" cy="10" r="3.5" fill="#FF7138" />
          </svg>
          <span className="font-display text-title-lg text-light-on-surface dark:text-dark-on-surface">MICHI</span>
          <span className="font-display text-title-md text-forest-green dark:text-dark-primary">道</span>
        </Link>

        {/* Primary Navigation */}
        <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-gutter-lg">
          <Link
            to="/"
            className={`font-label text-label-lg transition-colors ${
              isActive('/')
                ? 'text-forest-green dark:text-dark-primary font-semibold'
                : 'text-light-on-surface-variant dark:text-dark-on-surface-variant hover:text-light-on-surface dark:hover:text-dark-on-surface'
            }`}
          >
            Home
          </Link>
          <Link
            to="/explore"
            className={`font-label text-label-lg transition-colors ${
              isActive('/explore')
                ? 'text-forest-green dark:text-dark-primary font-semibold'
                : 'text-light-on-surface-variant dark:text-dark-on-surface-variant hover:text-light-on-surface dark:hover:text-dark-on-surface'
            }`}
          >
            Explore
          </Link>
          {isAuthenticated && (
            <>
              <Link
                to="/my-trips"
                className={`font-label text-label-lg transition-colors ${
                  isActive('/my-trips')
                    ? 'text-forest-green dark:text-dark-primary font-semibold'
                    : 'text-light-on-surface-variant dark:text-dark-on-surface-variant hover:text-light-on-surface dark:hover:text-dark-on-surface'
                }`}
              >
                My Trips
              </Link>
              <Link
                to="/profile"
                className={`font-label text-label-lg transition-colors ${
                  isActive('/profile')
                    ? 'text-forest-green dark:text-dark-primary font-semibold'
                    : 'text-light-on-surface-variant dark:text-dark-on-surface-variant hover:text-light-on-surface dark:hover:text-dark-on-surface'
                }`}
              >
                My Profile
              </Link>
            </>
          )}
        </nav>

        {/* Right Action Bar */}
        <div className="flex items-center gap-gutter-sm">
          {isAuthenticated && (
            <Link to="/trips/create" className="hidden sm:inline-flex">
              <Button variant="adventure" size="sm">
                <span className="material-symbols-outlined text-base mr-1">add</span>
                New Trip
              </Button>
            </Link>
          )}

          <ThemeToggle />

          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <Link to="/profile" className="flex items-center gap-2 hover:opacity-90">
                {profile?.avatar_url || user?.avatar_url ? (
                  <img
                    src={profile?.avatar_url || user?.avatar_url || ''}
                    alt={profile?.display_name || user?.display_name}
                    className="w-8 h-8 rounded-full object-cover border border-light-outline-variant dark:border-dark-outline-variant"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-forest-green text-on-forest-green flex items-center justify-center font-bold text-xs">
                    {(profile?.display_name || user?.display_name || 'M')[0].toUpperCase()}
                  </div>
                )}
                <span className="hidden sm:inline font-label text-label-md text-light-on-surface dark:text-dark-on-surface font-semibold">
                  {profile?.display_name || user?.display_name}
                </span>
              </Link>
              <Button variant="ghost" size="sm" onClick={handleLogout} title="Log out">
                <span className="material-symbols-outlined text-lg">logout</span>
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login">
                <Button variant="secondary" size="sm">Log In</Button>
              </Link>
              <Link to="/register">
                <Button variant="adventure" size="sm">Sign Up</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
