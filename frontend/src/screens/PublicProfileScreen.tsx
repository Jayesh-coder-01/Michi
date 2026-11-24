import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Alert } from '../components/ui/Alert';
import { Profile } from '../types/profile';
import { api } from '../services/api';

export const PublicProfileScreen: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);

  const defaultCover = "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1400&q=80";

  useEffect(() => {
    if (!username) return;
    setIsLoading(true);
    setError(null);

    api.profiles.getPublicProfile(username)
      .then((data) => {
        setProfile(data);
      })
      .catch((err) => {
        setError(err.message || 'Traveller profile not found');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [username]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="w-8 h-8 border-3 border-forest-green border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (error || !profile) {
    return (
      <AppLayout>
        <div className="min-h-[50vh] flex flex-col items-center justify-center text-center gap-4">
          <span className="material-symbols-outlined text-5xl text-adventure-orange">
            person_off
          </span>
          <h2 className="font-headline text-headline-md text-light-on-background dark:text-dark-on-background">
            Traveller Not Found
          </h2>
          <p className="font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant max-w-md">
            The traveller handle &lsquo;@{username}&rsquo; does not exist on Michi.
          </p>
          <Link to="/">
            <Button variant="secondary" size="md">
              Return to Home
            </Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col gap-gutter-xl">
        {/* Profile Card Header */}
        <section className="bg-light-surface dark:bg-dark-surface border border-light-outline-variant dark:border-dark-outline-variant rounded-xl overflow-hidden shadow-sm">
          {/* Cover Photo */}
          <div className="h-52 md:h-64 w-full relative bg-dark-surface-container">
            <img
              src={profile.cover_image_url || defaultCover}
              alt="Profile cover banner"
              className="w-full h-full object-cover"
            />
          </div>

          {/* User Details & Identity */}
          <div className="p-gutter-lg md:p-gutter-xl flex flex-col gap-gutter-md">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-gutter-md -mt-16 md:-mt-20 relative z-10">
              <div className="flex items-end gap-gutter-md">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.display_name}
                    className="w-24 h-24 md:w-28 md:h-28 rounded-full object-cover border-4 border-light-surface dark:border-dark-surface shadow-md"
                  />
                ) : (
                  <div className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-forest-green text-on-forest-green flex items-center justify-center font-display text-4xl font-extrabold border-4 border-light-surface dark:border-dark-surface shadow-md">
                    {profile.display_name[0].toUpperCase()}
                  </div>
                )}
                <div className="pb-1">
                  <h1 className="font-headline text-headline-md md:text-headline-lg text-light-on-surface dark:text-dark-on-surface">
                    {profile.display_name}
                  </h1>
                  <p className="font-label text-label-md text-forest-green dark:text-dark-primary">
                    @{profile.username}
                    {profile.location && <span> · {profile.location}</span>}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-gutter-sm">
                <Button
                  variant={isFollowing ? 'secondary' : 'primary'}
                  size="md"
                  onClick={() => setIsFollowing(!isFollowing)}
                  leftIcon={
                    <span className="material-symbols-outlined text-lg">
                      {isFollowing ? 'check' : 'person_add'}
                    </span>
                  }
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </Button>

                {profile.is_ai_chatbot_enabled && (
                  <Button
                    variant="adventure"
                    size="md"
                    onClick={() => alert(`Ask AI About @${profile.username} will be activated in Phase 7 (AI Traveller Chatbot).`)}
                    leftIcon={<span className="material-symbols-outlined text-lg">smart_toy</span>}
                  >
                    Ask AI About This Traveller
                  </Button>
                )}
              </div>
            </div>

            {/* Bio */}
            {profile.bio && (
              <p className="font-body text-body-lg text-light-on-background dark:text-dark-on-background max-w-3xl leading-relaxed mt-2">
                {profile.bio}
              </p>
            )}

            {/* Stats Row */}
            <div className="flex flex-wrap items-center gap-gutter-xl pt-gutter-md border-t border-light-outline-variant dark:border-dark-outline-variant">
              <div>
                <strong className="font-title text-title-md tabular-nums text-light-on-surface dark:text-dark-on-surface">
                  {profile.stats?.published_trips_count || 0}
                </strong>{' '}
                <span className="font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant">
                  Published Journeys
                </span>
              </div>
              <div>
                <strong className="font-title text-title-md tabular-nums text-light-on-surface dark:text-dark-on-surface">
                  {profile.stats?.followers_count || 0}
                </strong>{' '}
                <span className="font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant">
                  Followers
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Public Trips Section */}
        <section className="flex flex-col gap-gutter-md">
          <h2 className="font-headline text-headline-md text-light-on-background dark:text-dark-on-background">
            Published Journeys
          </h2>
          <div className="p-gutter-xl rounded-xl bg-light-surface dark:bg-dark-surface border border-light-outline-variant dark:border-dark-outline-variant text-center text-light-on-surface-variant dark:text-dark-on-surface-variant font-body text-body-md">
            No published journeys yet. Check back soon!
          </div>
        </section>
      </div>
    </AppLayout>
  );
};
