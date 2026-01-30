// Calculate attendance statistics
// src/utils/bunk.ts
interface AttendanceResult {
  canBunk: number;
  requiredToAttend: number;
  targetPercentage: number;
  isExact: boolean;
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
  }  if (currentPercentage > safeTarget) {
    const bunkableExact = (100 * present - safeTarget * total) / safeTarget;
    const bunkable = Math.floor(bunkableExact);
    
    result.canBunk = Math.max(0, bunkable);
    
    if (bunkableExact > 0 && bunkableExact < 0.9 && bunkable === 0) {
      result.isExact = true;
    }
    
    return result;
  }

  return result;
}
