import { render } from "@react-email/components";
import CourseMismatchEmail from "./course-mismatch";
import AttendanceConflictEmail from "./attendance-conflict";

export { CourseMismatchEmail, AttendanceConflictEmail };

/**
 * Render email templates to HTML strings
 */
export const renderCourseMismatchEmail = (props: {
  username: string;
  date: string;
  session: string;
  manualCourseName: string;
  courseLabel: string;
  dashboardUrl: string;
}): string => {
  return render(CourseMismatchEmail(props));
};

export const renderAttendanceConflictEmail = (props: {
  username: string;
  courseLabel: string;
  date: string;
  session: string;
  dashboardUrl: string;
}): string => {
  return render(AttendanceConflictEmail(props));
};
