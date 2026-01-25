import { TrackAttendance } from "@/types";
import { generateSlotKey } from "../utils";

export const ATTENDANCE_STATUS = {
  PRESENT: 110,
  ABSENT: 111,
  DUTY_LEAVE: 225,
  OTHER_LEAVE: 112,
};

export const isPositive = (code: number) => code === ATTENDANCE_STATUS.PRESENT || code === ATTENDANCE_STATUS.DUTY_LEAVE;
export const isAbsent = (code: number) => code === ATTENDANCE_STATUS.ABSENT || code === 0;

export const getOfficialSessionRaw = (session: any, sessionKey: string | number) => {
  if (session && session.session != null && session.session !== "") {
    return session.session;
  }
  return sessionKey;
};

// --- CORE LOGIC ---
export interface ReconciledStats {
  realPresent: number;
  realTotal: number;
  realAbsent: number;
  realDL: number;
  realOther: number;
  
  finalPresent: number;
  finalTotal: number;
  
  correctionPresent: number; 
  savedAbsent: number;       
  correctionDL: number;      
  
  extraPresent: number;      
  extraAbsent: number;       
  extraDL: number;
  extrasCount: number;       
  
  officialPercentage: number;
  finalPercentage: number;
}

// Define this at the top
interface OfficialSession {
  course: string | number;
  date: string;
  session: string | number;
  attendance: string | number;
  class_type?: string;
}

// Update function signature
export function getReconciledStats(
  courseId: string,
  officialAggregate: { present: number; absent: number; total: number },
  officialSessions: OfficialSession[] | undefined,
  trackingData: TrackAttendance[] | undefined
): ReconciledStats {
  
  const stats = {
    realPresent: 0, realTotal: 0, realAbsent: 0, realDL: 0, realOther: 0,
    correctionPresent: 0, savedAbsent: 0, correctionDL: 0,
    extraPresent: 0, extraAbsent: 0, extraDL: 0,
    finalPresent: 0, finalTotal: 0, extrasCount: 0
  };

  // 1. Build Official Map
  const officialMap = new Map<string, number>();

  if (officialSessions && officialSessions.length > 0) {
    officialSessions.forEach(session => {
        if (session.class_type === "Revision") return;
        
        // Ensure we only process this course's sessions
        if (String(session.course) !== String(courseId)) return;

        const key = generateSlotKey(courseId, session.date, session.session);
        const status = Number(session.attendance);
        
        officialMap.set(key, status);

        stats.realTotal++;
        if (isPositive(status)) stats.realPresent++; else stats.realAbsent++;
        if (status === ATTENDANCE_STATUS.DUTY_LEAVE) stats.realDL++;
        if (status === ATTENDANCE_STATUS.OTHER_LEAVE) stats.realOther++;
    });
  } else {
    // Fallback if calendar is empty
    stats.realPresent = officialAggregate.present;
    stats.realTotal = officialAggregate.total;
    stats.realAbsent = officialAggregate.absent;
  }

  // 2. Process Tracker
  if (trackingData) {
    const courseTracks = trackingData.filter(t => String(t.course) === String(courseId));

    courseTracks.forEach(item => {
      const key = generateSlotKey(courseId, item.date, item.session);
      const officialStatus = officialMap.get(key);
      
      const trackStatus = typeof item.attendance === "number" ? item.attendance : ATTENDANCE_STATUS.PRESENT;
      const trackPos = isPositive(trackStatus);
      const trackDL = trackStatus === ATTENDANCE_STATUS.DUTY_LEAVE;
      
      const offPos = officialStatus !== undefined ? isPositive(officialStatus) : false;
      const offDL = officialStatus === ATTENDANCE_STATUS.DUTY_LEAVE;

      // CORE LOGIC: If status='extra' AND no official record exists -> TRUE EXTRA
      const isTrulyExtra = item.status === "extra" && officialStatus === undefined;

      if (isTrulyExtra) {
          stats.extrasCount++;
          stats.finalTotal++; 

          if (trackPos) {
             stats.extraPresent++;
             stats.finalPresent++;
          } else {
             stats.extraAbsent++;
          }
          if (trackDL) stats.extraDL++;

      } else if (officialStatus !== undefined) {
          
          if (offPos) return; // Official Present -> Ignore Tracker

          if (!offPos && trackPos) {
             stats.correctionPresent++;
             stats.savedAbsent++; 
             stats.finalPresent++;
          }
          if (!offDL && trackDL) stats.correctionDL++;
      }
    });
  }

  // 3. Finalize Totals
  if (!officialSessions || officialSessions.length === 0) {
      stats.finalPresent = stats.realPresent + stats.correctionPresent + stats.extraPresent;
      stats.finalTotal = stats.realTotal + stats.extrasCount;
  } else {
      stats.finalPresent += stats.realPresent;
      stats.finalTotal += stats.realTotal;
  }

  const officialPct = stats.realTotal > 0 ? (stats.realPresent / stats.realTotal) * 100 : 0;
  const finalPct = stats.finalTotal > 0 ? (stats.finalPresent / stats.finalTotal) * 100 : 0;

  return {
    ...stats,
    officialPercentage: parseFloat(officialPct.toFixed(2)),
    finalPercentage: parseFloat(finalPct.toFixed(2))
  };
}