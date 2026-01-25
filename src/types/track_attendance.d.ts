import { UUID } from "crypto";

export interface TrackAttendance {
  auth_user_id: UUID
  course: string;
  date: string;
  session : string;
  year: string;
  semester: string;
  status?: 'extra' | 'correction';
  attendance?: number
  remarks?: string;
};
