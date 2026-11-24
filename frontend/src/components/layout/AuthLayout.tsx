import React from 'react';
import { Link } from 'react-router-dom';
import { ThemeToggle } from '../ui/ThemeToggle';

export interface AuthLayoutProps {
  children: React.ReactNode;
  heroImage?: string;
  heroQuote?: string;
  heroLocation?: string;
  heroAuthor?: string;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  heroImage = "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1400&q=80",
  heroQuote = "A journey is more than a collection of photographs. It is a collection of places, experiences, people and memories.",
  heroLocation = "Zanskar Valley, Ladakh · 3,850m",
  heroAuthor = "Aarav Mehta · Himalayan Motorbike Traverse",
}) => {
  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-light-background dark:bg-dark-background text-light-on-background dark:text-dark-on-background transition-colors duration-surface-enter">
      {/* Left: Form Area */}
      <div className="lg:col-span-6 flex flex-col justify-between p-gutter-lg md:p-gutter-xl">
        {/* Top Bar */}
        <header className="flex items-center justify-between gap-gutter-md">
          <Link to="/" className="flex items-center gap-gutter-sm">
            <svg width="34" height="34" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <rect width="40" height="40" rx="10" fill="#246B4A" />
              <path d="M12 31C12 24 27 24 27 17C27 12.5 22 10 17 10" stroke="#F7F8F3" strokeWidth="3.2" strokeLinecap="round" />
              <circle cx="15" cy="10" r="3.5" fill="#FF7138" />
            </svg>
            <span className="font-display text-title-lg text-light-on-background dark:text-dark-on-background">MICHI</span>
            <span className="font-display text-title-md text-forest-green dark:text-dark-primary">道</span>
          </Link>

          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>

        {/* Center: Auth Form Slot */}
        <main className="my-auto py-8 flex justify-center">
          <div className="w-full max-w-md">
            {children}
          </div>
        </main>

        {/* Bottom: Subtle Footer */}
        <footer className="pt-4 text-center sm:text-left text-xs font-body text-light-on-surface-variant dark:text-dark-on-surface-variant flex flex-col sm:flex-row justify-between items-center gap-2">
          <span>&copy; {new Date().getFullYear()} MICHI (道). Every Path Has a Story.</span>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="hover:underline">Privacy</Link>
            <Link to="/terms" className="hover:underline">Terms</Link>
          </div>
        </footer>
      </div>

      {/* Right: Immersive Travel Photo & Story */}
      <div className="hidden lg:col-span-6 lg:relative lg:flex flex-col justify-between p-gutter-xl overflow-hidden bg-dark-surface">
        {/* Background Image with Dark Vignette Overlay */}
        <img
          src={heroImage}
          alt="Adventure travel scenery"
          className="absolute inset-0 w-full h-full object-cover opacity-85"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-dark-background/95 via-dark-background/40 to-dark-background/20" />

        {/* Top Badge */}
        <div className="relative z-10 flex justify-end">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-dark-surface/80 backdrop-blur-md border border-dark-outline-variant text-dark-on-surface font-label text-label-sm">
            <span className="material-symbols-outlined text-sm text-adventure-orange">explore</span>
            {heroLocation}
          </span>
        </div>

        {/* Bottom Story Card */}
        <div className="relative z-10 p-gutter-lg rounded-xl bg-dark-surface/85 backdrop-blur-md border border-dark-outline-variant max-w-xl text-dark-on-surface">
          <p className="font-headline text-title-md font-semibold text-white mb-2 leading-relaxed">
            &ldquo;{heroQuote}&rdquo;
          </p>
          <div className="flex items-center gap-2 text-label-sm text-dark-on-surface-variant font-label">
            <span className="w-2 h-2 rounded-full bg-adventure-orange" />
            <span>{heroAuthor}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
