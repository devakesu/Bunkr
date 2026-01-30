/**
 * Represents a course/subject in the academic system.
 * Contains course details, academic period info, and enrolled users.
 */
export interface Course {
  /** Unique course identifier */
  id: number;
  /** Serial number for ordering */
  si_no?: number;
  /** Course name */
  name: string;
  /** Course code (e.g., "CS101") */
  code?: string;
  /** Academic year (e.g., "2023-2024") */
  academic_year?: string;
  /** Academic semester (Even or Odd) */
  academic_semester?: string;
  /** User subgroup information */
  usersubgroup?: {
    /** Subgroup ID */
    id: number;
    /** Semester start date (ISO format) */
    start_date: string;
    /** Semester end date (ISO format) */
    end_date: string;
    /** User group details */
    usergroup: {
      /** Group ID */
      id: number;
      /** Branch/department name */
      name: string;
      /** University affiliation */
      affiliated_university: string;
    };
  };
  /** List of enrolled institution users */
  institution_users?: CourseUser[];
}
