"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Course } from "@/types";
import { useCourseDetails } from "@/hooks/courses/attendance";
import { AlertCircle } from "lucide-react";
import { calculateAttendance } from "@/lib/logic/bunk";
import { useAttendanceSettings } from "@/providers/attendance-settings";
import { useState, useEffect, useMemo } from "react";
import { useTrackingData } from "@/hooks/tracker/useTrackingData";
import { useUser } from "@/hooks/users/user";

interface ExtendedCourse extends Course {
  present?: number;
  total?: number;
}

interface CourseCardProps {
  course: ExtendedCourse;
}

export function CourseCard({ course }: CourseCardProps) {
  const { data: courseDetails, isLoading } = useCourseDetails(
    course.id.toString()
  );

  const { data: user } = useUser();
  const { data: trackingData } = useTrackingData(user);

  const { targetPercentage } = useAttendanceSettings();
  const [showBunkCalc, setShowBunkCalc] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("showBunkCalc");
    if (stored !== null) {
      setShowBunkCalc(stored === "true");
    }

    const handleBunkCalcToggle = (event: CustomEvent) => {
      setShowBunkCalc(event.detail);
    };

    window.addEventListener(
      "bunkCalcToggle",
      handleBunkCalcToggle as EventListener
    );

    return () => {
      window.removeEventListener(
        "bunkCalcToggle",
        handleBunkCalcToggle as EventListener
      );
    };
  }, []);

  const stats = useMemo(() => {
    // 1. Official Data (From API)
    const realPresent = courseDetails?.present || 0;
    const realTotal = courseDetails?.totel || courseDetails?.totel || 0;
    const realAbsent = courseDetails?.absent || 0;
    const officialPercentage = realTotal > 0 ? (realPresent / realTotal) * 100 : 0;
    
    // 2. Filter Tracking Data (Local Calculation Backup)
    const normalize = (s: string | undefined) => s?.toLowerCase().replace(/[^a-z0-9]/g, "") || "";
    const targetId = String(course.id);
    const targetName = normalize(course.name);
    const targetCode = normalize(course.code);

    const courseTracks = trackingData?.filter(t => {
        if (String(t.course) === targetId) return true;
        const tName = normalize(String(t.course));
        return tName === targetName || (targetCode && tName === targetCode);
    }) || [];
    
    // 3. Calculate Modifiers (For visual breakdown only)
    let extraPresent = 0;
    let extraAbsent = 0;
    let correctionPresent = 0; 

    courseTracks.forEach(t => {
        const isPos = t.attendance === 110 || t.attendance === 225; // Present or DL
        
        if (t.status === 'extra') {
            // Extra: Adds to Total AND (Present or Absent)
            if (isPos) extraPresent++;
            else extraAbsent++;
        } else {
            // Correction: Only swaps status. Does NOT add to total.
            // Assumption: User corrects Absent -> Present
            if (isPos) correctionPresent++;
        }
    });

    const extras = extraPresent + extraAbsent;

    // 4. Final Calculation
    const finalPresent = (course.present !== undefined) ? course.present : (realPresent + extraPresent + correctionPresent);
    const finalTotal = (course.total !== undefined) ? course.total : (realTotal + extras);
    
    const displayPercentage = finalTotal > 0 ? (finalPresent / finalTotal) * 100 : 0;

    // 5. Metrics
    const safeMetrics = calculateAttendance(realPresent, realTotal, targetPercentage || 75);
    const extraMetrics = calculateAttendance(finalPresent, finalTotal, targetPercentage || 75);

    return {
      realPresent,
      realAbsent,
      realTotal,
      correctionPresent, 
      extraPresent,           
      extras,
      extraAbsent,
      displayTotal: finalTotal,
      displayPercentage: parseFloat(displayPercentage.toFixed(2)),
      officialPercentage: parseFloat(officialPercentage.toFixed(2)),
      safeMetrics,
      extraMetrics
    };
  }, [courseDetails, trackingData, course.id, course.name, course.code, course.present, course.total, targetPercentage]);

  const hasAttendanceData = !isLoading && stats.displayTotal > 0;

  function capitalize(str: string) {
    if (!str) return "";
    return str
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }

  const renderBunkMessage = () => {
    const { safeMetrics, extraMetrics, correctionPresent, extras } = stats;

    const isModified = correctionPresent > 0 || extras > 0;
    const activeMetrics = (isModified && extraMetrics) ? extraMetrics : safeMetrics;
    const { canBunk, requiredToAttend } = activeMetrics;

    if (canBunk > 0) {
      return (
        <>
          You can safely bunk <span className="font-bold text-green-500">{canBunk}</span> {canBunk === 1 ? "class 🥳" : "classes 🥳🥳"}
          {isModified && (
             <span className="text-muted-foreground font-normal opacity-80 block text-xs mt-0.5"> (Based on Tracking Data)</span>
          )}
        </>
      );
    }

    if (requiredToAttend > 0) {
      return (
        <>
          You need to attend <span className="font-bold text-amber-500">{!isFinite(requiredToAttend) ? "all" : requiredToAttend}</span> more {requiredToAttend === 1 ? "class 💀" : "classes 💀💀"}
          {isModified && (
             <span className="text-muted-foreground font-normal opacity-80 block text-xs mt-0.5"> (Based on Tracking Data)</span>
          )}
        </>
      );
    }

    return <>You are on the edge. Skipping now&apos;s risky 💀💀</>;
  };

  const isGain = stats.displayPercentage >= stats.officialPercentage;

  return (
    <Card className="pt-0 pb-0 custom-container overflow-clip h-full min-h-[280px]">
      <CardHeader className="flex justify-between items-start flex-row gap-2 pt-6 bg-[#2B2B2B]/[0.4] pb-5 border-b-2 border-[#2B2B2B]/[0.6]">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-lg font-semibold break-words leading-tight">
            {capitalize(course.name.toLowerCase())}
          </CardTitle>
        </div>
        <Badge
          variant="secondary"
          className="h-7 uppercase custom-button rounded-md! bg-black/20! scale-105 shrink-0"
        >
          {course.code}
        </Badge>
      </CardHeader>
      
      <CardContent className="h-full pb-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-4">
            <div className="animate-pulse h-4 w-24 bg-secondary rounded mb-2"></div>
            <div className="animate-pulse h-2 w-16 bg-secondary rounded"></div>
          </div>
        ) : hasAttendanceData ? (
          <>
            {/* GRID STATS */}
            <div className="grid grid-cols-3 gap-2 mt-4">
              
              {/* PRESENT */}
              <div className="text-center p-1 bg-[#1F1F1F]/60 rounded-md py-2.5 flex gap-1 flex-col">
                <span className="text-xs text-muted-foreground block">Present</span>
                <div className="flex items-center justify-center gap-1.5 flex-wrap px-1">
                  <span className="text-sm font-medium text-green-500">
                    {stats.realPresent}
                  </span>
                  {stats.correctionPresent > 0 && (
                    <span className="text-xs font-medium text-orange-500" title="Corrections">
                      +{stats.correctionPresent}
                    </span>
                  )}
                  {stats.extraPresent > 0 && (
                    <span className="text-xs font-medium text-blue-400" title="Extras">
                      +{stats.extraPresent}
                    </span>
                  )}
                </div>
              </div>

              {/* ABSENT */}
              <div className="text-center p-1 bg-[#1F1F1F]/60 rounded-md py-2.5 flex gap-1 flex-col">
                <span className="text-xs text-muted-foreground block">Absent</span>
                <div className="flex items-center justify-center gap-0.5">
                  <span className="text-sm font-medium text-red-500">
                    {stats.realAbsent}
                  </span>
                  
                  {stats.correctionPresent > 0 && (
                    <span className="text-xs font-medium text-orange-500">
                      -{stats.correctionPresent}
                    </span>
                  )}

                  {stats.extraAbsent > 0 && (
                    <span className="text-xs font-medium text-blue-400">
                      +{stats.extraAbsent}
                    </span>
                  )}
                </div>
              </div>

              {/* TOTAL */}
              <div className="text-center p-1 bg-[#1F1F1F]/60 rounded-md py-2.5 flex gap-1 flex-col">
                <span className="text-xs text-muted-foreground block">Total</span>
                <div className="flex items-center justify-center gap-0.5">
                  <span className="text-sm font-medium">
                    {stats.realTotal}
                  </span>
                  {stats.extras > 0 && (
                    <span className="text-xs font-medium text-blue-400">
                      +{stats.extras}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* DUAL PROGRESS BAR */}
            <div className="mt-8">
              <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-secondary">
                {isGain ? (
                  <>
                    {/* SCENARIO 1: GAIN (Merged > Official) */}
                    <div
                      className="absolute top-0 left-0 h-full bg-primary/40 transition-all duration-500 ease-in-out"
                      style={{ width: `${stats.displayPercentage}%` }}
                    >
                      <div className="h-full w-full opacity-30 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:8px_8px]" />
                    </div>
                    <div
                      className="absolute top-0 left-0 h-full bg-primary transition-all duration-500 ease-in-out"
                      style={{ width: `${stats.officialPercentage}%` }}
                    />
                  </>
                ) : (
                  <>
                    {/* SCENARIO 2: LOSS (Merged < Official) */}
                    <div
                      className="absolute top-0 left-0 h-full bg-red-500/80 transition-all duration-500 ease-in-out"
                      style={{ width: `${stats.officialPercentage}%` }}
                    >
                        <div className="h-full w-full opacity-30 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:8px_8px]" />
                    </div>
                    <div
                      className="absolute top-0 left-0 h-full bg-primary transition-all duration-500 ease-in-out"
                      style={{ width: `${stats.displayPercentage}%` }}
                    />
                  </>
                )}
              </div>

              <div className="flex justify-between items-center mb-1 text-sm mt-2 text-muted-foreground font-medium">
                <span>Attendance</span>
                <div className="flex items-center gap-2">
                  {(stats.correctionPresent > 0 || stats.extras > 0) && stats.officialPercentage !== stats.displayPercentage && (
                    <span className="text-xs opacity-70">
                      {stats.officialPercentage}% <span className="mx-0.5">→</span>
                    </span>
                  )}
                  <span className={(stats.correctionPresent > 0 || stats.extras > 0) ? (isGain ? "text-primary font-bold" : "text-red-400 font-bold") : ""}>
                    {stats.displayPercentage}%
                  </span>
                </div>
              </div>
            </div>

            {/* BUNK CALCULATOR SECTION */}
            {showBunkCalc && (
              <div className="bg-accent/40 rounded-md py-2 px-3 flex justify-center items-center mt-4">
                <p className="text-sm text-muted-foreground text-center font-medium leading-tight">
                  {renderBunkMessage()}
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-4 px-2 h-full gap-1">
            <div className="flex items-center gap-2 mb-1 text-amber-500">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium text-sm">No attendance data</span>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Instructor has not updated attendance records yet.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}