import { render } from "@react-email/components";
import CourseMismatchEmail from "./course-mismatch";
import AttendanceConflictEmail from "./attendance-conflict";
import type React from "react";

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
  return await render(CourseMismatchEmail(props) as React.ReactElement);
};

export const renderAttendanceConflictEmail = async (props: {
  username: string;
  courseLabel: string;
  date: string;
  session: string;
  dashboardUrl: string;
}): Promise<string> => {
  return await render(AttendanceConflictEmail(props) as React.ReactElement);
};
