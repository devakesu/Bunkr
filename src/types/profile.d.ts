export interface UserProfile {
  id: number;
  first_name?: string;
  last_name?: string | null;
  username: string;
  email: string;
  phone?: string | null;
  gender?: string | null;
  birth_date?: string | null;
  avatar_url?: string | null;
}
