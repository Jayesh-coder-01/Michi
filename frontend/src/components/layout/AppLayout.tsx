import React from 'react';
import { Navbar } from './Navbar';

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col bg-light-background dark:bg-dark-background text-light-on-background dark:text-dark-on-background transition-colors duration-surface-enter">
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-page-margin py-gutter-lg">
        {children}
      </main>
      <footer className="border-t border-light-outline-variant dark:border-dark-outline-variant py-gutter-md mt-auto">
        <div className="max-w-7xl mx-auto px-page-margin flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-body text-light-on-surface-variant dark:text-dark-on-surface-variant">
          <p>&copy; {new Date().getFullYear()} MICHI (道). Every Path Has a Story.</p>
          <div className="flex items-center gap-6">
            <span>Adventure Explorer Edition</span>
            <span>PRD v1.0 Aligned</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
