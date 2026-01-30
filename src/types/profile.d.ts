/**
 * User profile information combining authentication and personal data.
 * Contains both required fields and optional user-editable information.
 */
export interface UserProfile {
  /** Accepted terms version */
  terms_version: string;
  /** Unique user identifier */
  id: number;
  /** User's first name */
  first_name?: string;
  /** User's last name */
  last_name?: string | null;
  /** Login username */
  username: string;
  /** Email address */
  email: string;
  /** Phone/mobile number */
  phone?: string | null;
  /** Gender identity */
  gender?: string | null;
  /** Date of birth (ISO format) */
  birth_date?: string | null;
  /** Avatar image URL */
  avatar_url?: string | null;
}
