export interface TrackAttendance {
  username: string;
  course: string;
  date: string;
  session : string;
  year: string;
  semester: string;
  status?: string;
  attendance?: number
  remarks?: string;
};
