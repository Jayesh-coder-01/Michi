import React, { useEffect, useState } from 'react';

const BOTPRESS_WEBCHAT_URL =
  'https://cdn.botpress.cloud/webchat/v5.0/shareable.html?configUrl=https://files.bpcontent.cloud/2026/11/25/18/20261125182551-2V1WPN2Q.json';

/**
 * Floating Botpress webchat widget rendered across the application.
 * Keeps the iframe mounted after the first open so conversation state persists across routes.
 */
export const ChatbotWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) {
        setHasOpened(true);
      }
      return next;
    });
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {hasOpened && (
        <div
          role="dialog"
          aria-label="Michi Chatbot"
          className={`${
            isOpen ? 'flex' : 'hidden'
          } flex-col w-[380px] h-[580px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-6rem)] rounded-lg overflow-hidden shadow-2xl border border-light-outline-variant dark:border-dark-outline-variant bg-light-surface dark:bg-dark-surface`}
        >
          <div className="flex items-center justify-between px-4 py-3 bg-forest-green text-on-forest-green">
            <div className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                smart_toy
              </span>
              <span className="font-title font-bold text-sm truncate">
                Michi Assistant
              </span>
            </div>
            <div className="flex items-center gap-1">
              <a
                href={BOTPRESS_WEBCHAT_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open chatbot in new tab"
                title="Open in new tab"
                className="p-1 rounded hover:bg-white/15 transition-colors flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  open_in_new
                </span>
              </a>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close chatbot"
                className="p-1 rounded hover:bg-white/15 transition-colors flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                  close
                </span>
              </button>
            </div>
          </div>

          <iframe
            src={BOTPRESS_WEBCHAT_URL}
            title="Michi Botpress Chatbot"
            className="w-full flex-1 border-0 bg-light-surface dark:bg-dark-surface"
            allow="microphone; clipboard-write"
          />
        </div>
      )}

      <button
        type="button"
        onClick={handleToggle}
        aria-label={isOpen ? 'Close chatbot' : 'Open chatbot'}
        aria-expanded={isOpen}
        className="w-14 h-14 rounded-full bg-adventure-orange text-on-adventure-orange shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-adventure-orange focus:ring-offset-2 dark:focus:ring-offset-dark-background"
      >
        <span className="material-symbols-outlined text-[26px]" aria-hidden="true">
          {isOpen ? 'close' : 'chat'}
        </span>
      </button>
    </div>
  );
};
