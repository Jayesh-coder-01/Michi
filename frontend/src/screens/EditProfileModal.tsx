import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { api } from '../services/api';

export interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose }) => {
  const { profile, updateProfile } = useAuth();

  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [location, setLocation] = useState(profile?.location || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [coverImageUrl, setCoverImageUrl] = useState(profile?.cover_image_url || '');
  const [instagram, setInstagram] = useState(profile?.social_links?.instagram || '');
  const [website, setWebsite] = useState(profile?.social_links?.website || '');

  const [usernameStatus, setUsernameStatus] = useState<{
    checking: boolean;
    available?: boolean;
    message?: string;
  }>({ checking: false });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state whenever profile updates or modal opens
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setUsername(profile.username || '');
      setBio(profile.bio || '');
      setLocation(profile.location || '');
      setAvatarUrl(profile.avatar_url || '');
      setCoverImageUrl(profile.cover_image_url || '');
      setInstagram(profile.social_links?.instagram || '');
      setWebsite(profile.social_links?.website || '');
    }
  }, [profile, isOpen]);

  // Username check
  useEffect(() => {
    if (!username || username === profile?.username || username.length < 3) {
      setUsernameStatus({ checking: false });
      return;
    }

    const timer = setTimeout(async () => {
      setUsernameStatus({ checking: true });
      try {
        const res = await api.profiles.checkUsername(username);
        setUsernameStatus({
          checking: false,
          available: res.available,
          message: res.message,
        });
      } catch {
        setUsernameStatus({ checking: false });
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [username, profile?.username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (usernameStatus.available === false && username !== profile?.username) {
      setError('Please choose an available username before saving.');
      return;
    }

    setIsLoading(true);
    try {
      await updateProfile({
        display_name: displayName,
        username: username !== profile?.username ? username : undefined,
        bio: bio || undefined,
        location: location || undefined,
        avatar_url: avatarUrl || undefined,
        cover_image_url: coverImageUrl || undefined,
        social_links: {
          instagram: instagram || undefined,
          website: website || undefined,
        },
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Traveller Profile" maxWidth="lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && <Alert type="error" message={error} />}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Display Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            leftIcon="badge"
          />

          <Input
            label="Traveller Handle (@username)"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
            required
            leftIcon="alternate_email"
            helperText={
              usernameStatus.checking
                ? 'Checking...'
                : username !== profile?.username
                ? usernameStatus.message
                : 'Your unique identifier on Michi'
            }
            error={
              username !== profile?.username && usernameStatus.available === false
                ? usernameStatus.message
                : undefined
            }
          />
        </div>

        <Input
          label="Home Base / Location"
          placeholder="e.g. Jaipur, India"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          leftIcon="location_on"
        />

        <div className="flex flex-col gap-1.5">
          <label className="font-label text-label-md text-light-on-background dark:text-dark-on-background">
            Bio & Travel Philosophy
          </label>
          <textarea
            rows={3}
            placeholder="Tell fellow travellers about your roads travelled, your vehicle, or your style of journey..."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full rounded-DEFAULT border font-body text-body-md px-3.5 py-2.5 transition-colors bg-light-surface dark:bg-dark-surface text-light-on-surface dark:text-dark-on-surface border-light-outline-variant dark:border-dark-outline-variant focus:outline-none focus:ring-2 focus:ring-forest-green"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Avatar Image URL"
            placeholder="https://example.com/avatar.jpg"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            leftIcon="image"
          />

          <Input
            label="Cover Image URL"
            placeholder="https://example.com/cover.jpg"
            value={coverImageUrl}
            onChange={(e) => setCoverImageUrl(e.target.value)}
            leftIcon="panorama"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Instagram Handle"
            placeholder="e.g. aarav.rides"
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            leftIcon="photo_camera"
          />

          <Input
            label="Website or Journal URL"
            placeholder="https://aarav-rides.com"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            leftIcon="language"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-light-outline-variant dark:border-dark-outline-variant">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="adventure" isLoading={isLoading}>
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
};
