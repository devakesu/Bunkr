import { render } from "@react-email/components";
import CourseMismatchEmail from "./course-mismatch";
import AttendanceConflictEmail from "./attendance-conflict";

export { CourseMismatchEmail, AttendanceConflictEmail };

/**
 * Render email templates to HTML strings
 */
export const renderCourseMismatchEmail = async (props: {
  username: string;
  date: string;
  session: string;
  manualCourseName: string;
  courseLabel: string;
  dashboardUrl: string;
}): Promise<string> => {
  return render(<CourseMismatchEmail {...props} />);
};

export const renderAttendanceConflictEmail = async (props: {
  username: string;
  courseLabel: string;
  date: string;
  session: string;
  dashboardUrl: string;
}): Promise<string> => {
  return render(<AttendanceConflictEmail {...props} />);
};
