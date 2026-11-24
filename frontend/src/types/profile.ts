export interface ProfileStats {
  published_trips_count: number;
  drafts_count?: number | null;
  followers_count: number;
  following_count: number;
}

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  bio?: string | null;
  location?: string | null;
  avatar_url?: string | null;
  cover_image_url?: string | null;
  social_links?: Record<string, any>;
  is_ai_chatbot_enabled: boolean;
  created_at: string;
  updated_at: string;
  stats?: ProfileStats;
}

export interface ProfileUpdateInput {
  display_name?: string;
  username?: string;
  bio?: string;
  location?: string;
  avatar_url?: string;
  cover_image_url?: string;
  social_links?: Record<string, any>;
}

export interface UsernameCheckResult {
  username: string;
  available: boolean;
  message: string;
}
