// Calculate attendance statistics
// src/utils/bunk.ts

// Represents less than 1 class of headroom at the smallest meaningful scale.
// When bunkableExact is in (0, BORDERLINE_THRESHOLD), the user is technically
// above the target but cannot safely skip even a single class yet.
const BORDERLINE_THRESHOLD = 0.9;

interface AttendanceResult {
  canBunk: number;
  requiredToAttend: number;
  targetPercentage: number;
  /** True only when current attendance percentage exactly equals the safe target (clamped between 1–100). */
  isExact: boolean;
  /** True when slightly above the target but not enough to skip a full class. */
  isBorderline: boolean;
}

export function calculateAttendance(
  present: number,
  total: number,
  targetPercentage: number = 75
): AttendanceResult {
  const safeTarget = Number.isFinite(targetPercentage)
    ? Math.min(100, Math.max(1, targetPercentage))
    : 75;
  const result: AttendanceResult = {
    canBunk: 0,
    requiredToAttend: 0,
    targetPercentage: safeTarget,
    isExact: false,
    isBorderline: false,
  };

  if (total <= 0 || present < 0 || present > total) {
    return result;
  }

  const currentPercentage = (present / total) * 100;

  if (currentPercentage === safeTarget) {
    result.isExact = true;
    return result;
  }
  if (currentPercentage < safeTarget) {
    if (safeTarget >= 100) {
      result.requiredToAttend = total - present;
    } else {
      const required = Math.ceil(
        (safeTarget * total - 100 * present) / (100 - safeTarget)
      );
      result.requiredToAttend = Math.max(0, required);
    }
    return result;
  } else if (currentPercentage > safeTarget) {
    const bunkableExact = (100 * present - safeTarget * total) / safeTarget;
    const bunkable = Math.floor(bunkableExact);
    
    result.canBunk = Math.max(0, bunkable);
    
    if (bunkableExact > 0 && bunkableExact < BORDERLINE_THRESHOLD && bunkable === 0) {
      result.isBorderline = true;
    }
    
    return result;
  }

  return result;
}
