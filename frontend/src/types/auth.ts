export interface User {
  id: string;
  email: string;
  is_verified: boolean;
  username: string;
  display_name: string;
  avatar_url?: string | null;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface AuthSuccessData {
  user: User;
  tokens: AuthTokens;
}
