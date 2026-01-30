/**
 * Represents a user's association with an educational institution.
 * Links users to institutions with specific roles and enrollment status.
 */
export interface Institution {
  /** Unique institution user record ID */
  id: number;
  /** User's first name */
  first_name: string;
  /** User's last name */
  last_name: string;
  /** ID of the associated institution */
  institution_id: number;
  /** ID of the user's role in the institution */
  institutionrole_id: number;
  /** Current enrollment status */
  enroll_status: string;
  /** Institution details */
  institution: {
    /** Institution ID */
    id: number;
    /** Institution name */
    name: string;
  };
  /** Role details */
  institution_role: {
    /** Role ID */
    id: number;
    /** Role name (e.g., "student", "teacher") */
    name: string;
  };
}
