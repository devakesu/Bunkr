/**
 * Represents session-level attendance data for a specific course.
 */
interface SessionData {
  /** Course identifier */
  course: number;
  /** Attendance count for this session */
  attendance: number;
}

/**
 * Represents a teaching session (lecture hour/period).
 */
interface Session {
  /** Display name of the session (e.g., "1st Hour") */
  name: string;
  /** Unique session identifier */
  id: string;
}

/**
 * Comprehensive attendance report containing all course and session data.
 * Used for generating attendance statistics and calendar views.
 */
export interface AttendanceReport {
  /** Map of course ID to course information */
  courses: Record<string, CourseInfo>;
  /** Map of session ID to session information */
  sessions: Record<string, SessionInfo>;
  /** Map of attendance type ID to type information */
  attendanceTypes: Record<string, AttendanceType>;
  /** Nested map: student ID -> session ID -> attendance data */
  studentAttendanceData: Record<string, Record<string, SessionData>>;
  /** Map of date string to date metadata */
  attendanceDatesArray: Record<string, DateInfo>;
}

/**
 * Represents a single attendance event for calendar display.
 * Contains all information needed to render an attendance record.
 */
export interface AttendanceEvent {
  /** Event title (usually course name) */
  title: string;
  /** Date of the attendance event */
  date: Date;
  /** Formatted session name (e.g., "1st Hour") */
  sessionName: string;
  /** Unique key for the session */
  sessionKey: string;
  /** Type of attendance (present/absent) */
  type: string;
  /** Human-readable status */
  status: string;
  /** Color code for status visualization */
  statusColor: string;
  /** Course identifier */
  courseId: string;
}

/**
 * Detailed attendance statistics for a specific course.
 * Used for displaying attendance summaries and percentages.
 */
export interface CourseDetail {
  /** Number of present marks */
  present: number;
  /** Number of absent marks */
  absent: number;
  /** Total attendance records (present + absent) */
  total: number;
  /** Attendance percentage (0-100) */
  percentage: number;
  /** Course information */
  course: {
    /** Course ID */
    id: number | string;
    /** Course name */
    name: string;
    /** Course code */
    code: string;
  };
}
