"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Course } from "@/types";
import { useCourseDetails } from "@/hooks/courses/attendance";
import { AlertCircle } from "lucide-react";
import { calculateAttendance } from "@/utils/bunk";
import { useAttendanceSettings } from "@/providers/attendance-settings";
import { useState, useEffect, useMemo } from "react";
import { useTrackingData } from "@/hooks/tracker/useTrackingData";
import { useUser } from "@/hooks/users/user";
import { getToken } from "@/utils/auth";

interface CourseCardProps {
  course: Course;
}

export function CourseCard({ course }: CourseCardProps) {
  const { data: courseDetails, isLoading } = useCourseDetails(
    course.id.toString()
  );

  const { data: user } = useUser();
  const accessToken = getToken();
  const { data: trackingData } = useTrackingData(user, accessToken);

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
    // A. Official (Real) Data
    const realPresent = courseDetails?.present || 0;
    const realTotal = courseDetails?.totel || 0;
    const realAbsent = courseDetails?.absent || 0;
    const officialPercentage = realTotal > 0 ? (realPresent / realTotal) * 100 : 0;
    
    // B. Calculate "Safely Bunkable" based on official
    const safeMetrics = calculateAttendance(realPresent, realTotal, targetPercentage);

    // C. Handle Case: No Tracking Data
    if (!trackingData) {
      return {
        realPresent,
        realAbsent,
        realTotal,
        corrections: 0,
        extras: 0,
        selfTrackedTotal: 0,
        displayTotal: realTotal,
        displayPercentage: parseFloat(officialPercentage.toFixed(2)),
        officialPercentage: parseFloat(officialPercentage.toFixed(2)), 
        safeMetrics,
        extraMetrics: null
      };
    }

    // D. Process Tracking Data
    const courseTracks = trackingData.filter(t => t.course === course.name);
    
    // Logic: tracker.status is either 'correction' or 'extra'
    const extras = courseTracks.filter(t => t.status === 'extra').length;
    
    // Since it's binary (extra vs correction), the remainder are corrections
    const corrections = courseTracks.length - extras; 
    
    const selfTrackedTotal = corrections + extras;

    // E. Calculate Adjusted Values
    const adjustedPresent = realPresent + selfTrackedTotal;
    const adjustedTotal = realTotal + extras;
    const displayPercentage = adjustedTotal > 0 ? (adjustedPresent / adjustedTotal) * 100 : 0;

    // F. Calculate "Extra Bunkable"
    const extraMetrics = calculateAttendance(adjustedPresent, adjustedTotal, targetPercentage);

    return {
      realPresent,
      realAbsent,
      realTotal,
      corrections,
      extras,
      selfTrackedTotal,
      displayTotal: adjustedTotal,
      displayPercentage: parseFloat(displayPercentage.toFixed(2)),
      officialPercentage: parseFloat(officialPercentage.toFixed(2)),
      safeMetrics,
      extraMetrics
    };
  }, [courseDetails, trackingData, course.name, targetPercentage]);

  const hasAttendanceData = !isLoading && stats.displayTotal > 0;

  function capitalize(str: string) {
    if (!str) return "";
    return str
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }

  // --- IMPROVED: Bunk Logic with Natural Language ---
  const renderBunkMessage = () => {
    const { safeMetrics, extraMetrics, selfTrackedTotal } = stats;

    // 1. Standard Logic (No Self-Tracking or No Change)
    if (selfTrackedTotal === 0 || !extraMetrics) {
      if (safeMetrics.canBunk > 0) {
        return (
          <>
            You can safely bunk <span className="font-bold text-green-500">{safeMetrics.canBunk}</span> {safeMetrics.canBunk === 1 ? "class 🥳" : "classes 🥳🥳"}
          </>
        );
      }
      if (safeMetrics.requiredToAttend > 0) {
        return (
          <>
            You need to attend <span className="font-bold text-amber-500">{!isFinite(safeMetrics.requiredToAttend) ? "all" : safeMetrics.requiredToAttend}</span> more {safeMetrics.requiredToAttend === 1 ? "class 💀" : "classes 💀💀"}
          </>
        );
      }
      return <>You are on the edge. Skipping now&apos;s risky 💀💀</>;
    }

    // 2. Combined Logic (With Self-Tracking)
    const safeBunk = safeMetrics.canBunk;
    const safeNeed = safeMetrics.requiredToAttend;
    
    const extraBunk = extraMetrics.canBunk;
    const extraNeed = extraMetrics.requiredToAttend;

    // SCENARIO A: Official stats are already safe (Green)
    if (safeBunk > 0) {
      const additionalBunk = Math.max(0, extraBunk - safeBunk);
      if (additionalBunk > 0) {
        return (
          <>
            You can safely bunk <span className="font-bold text-green-500">{safeBunk}</span> {safeBunk === 1 ? "class 🥳" : "classes 🥳🥳"} and <span className="font-bold text-green-500">{additionalBunk}</span> more if corrections are verified.
          </>
        );
      }
      return (
        <>
          You can safely bunk <span className="font-bold text-green-500">{safeBunk}</span> {safeBunk === 1 ? "class 🥳" : "classes 🥳🥳"}
        </>
      );
    }

    // SCENARIO B: Official is Unsafe (Amber), but Tracking makes it Safe (Green)
    if (safeNeed > 0 && extraNeed === 0) {
       const officialPct = stats.realTotal > 0 ? Math.round((stats.realPresent / stats.realTotal) * 100) : 0;
       
       if (extraBunk > 0) {
         return (
           <>
             You need to attend <span className="font-bold text-amber-500">{safeNeed}</span> {safeNeed === 1 ? "class 💀" : "classes 💀💀"}, but you can bunk <span className="font-bold text-green-500">{extraBunk}</span> {extraBunk === 1 ? "class 🥳" : "classes 🥳🥳"} if corrections are verified.
           </>
         );
       }
       return (
         <>
           You need to attend <span className="font-bold text-amber-500">{safeNeed}</span> {safeNeed === 1 ? "class 💀" : "classes 💀💀"}, but you are <span className="font-bold text-green-500">safe on edge</span> if corrections are verified.
         </>
       );
    }

    // SCENARIO C: Both are Unsafe, but Tracking reduces the burden
    if (safeNeed > 0 && extraNeed > 0 && extraNeed < safeNeed) {
       return (
         <>
           You need to attend <span className="font-bold text-amber-500">{safeNeed}</span> {safeNeed === 1 ? "class 💀" : "classes 💀💀"} or just <span className="font-bold text-amber-500">{extraNeed}</span> {extraNeed === 1 ? "class" : "classes"} if corrections are verified.
         </>
       );
    }

    // Fallback
    if (safeNeed > 0) {
        return (
          <>
             You need to attend <span className="font-bold text-amber-500">{!isFinite(safeNeed) ? "all" : safeNeed}</span> more {safeNeed === 1 ? "class 💀" : "classes 💀💀"}
          </>
        );
    }
    
    return <>You are on the edge. Skipping now&apos;s risky 💀💀</>;
  };

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
            {/* GRID: Shows Confirmed + Self-Tracked numbers */}
            <div className="grid grid-cols-3 gap-2 mt-4">
              
              {/* PRESENT */}
              <div className="text-center p-1 bg-[#1F1F1F]/60 rounded-md py-2.5 flex gap-1 flex-col">
                <span className="text-xs text-muted-foreground block">Present</span>
                <div className="flex items-center justify-center gap-0.5">
                  <span className="text-sm font-medium text-green-500">
                    {stats.realPresent}
                  </span>
                  {stats.selfTrackedTotal > 0 && (
                    <span className="text-xs font-medium text-orange-500">
                      +{stats.selfTrackedTotal}
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
                  {stats.corrections > 0 && (
                    <span className="text-xs font-medium text-orange-500">
                      -{stats.corrections}
                    </span>
                  )}
                </div>
              </div>

              {/* TOTAL */}
              <div className="text-center p-1 bg-[#1F1F1F]/60 rounded-md py-2.5 flex gap-1 flex-col">
                <span className="text-xs text-muted-foreground block">Total</span>
                <span className="text-sm font-medium">{stats.displayTotal}</span>
              </div>
            </div>

            {/* --- DUAL PROGRESS BAR --- */}
            <div className="mt-8">
              
              <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-secondary">
                
                {/* Layer 1: Merged/Potential (The "Ghost" Extension) */}
                <div
                  className="absolute top-0 left-0 h-full bg-primary/40 transition-all duration-500 ease-in-out"
                  style={{ width: `${stats.displayPercentage}%` }}
                >
                  <div className="h-full w-full opacity-30 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:8px_8px]" />
                </div>

                {/* Layer 2: Official (The Solid Reality) */}
                <div
                  className="absolute top-0 left-0 h-full bg-primary transition-all duration-500 ease-in-out"
                  style={{ width: `${stats.officialPercentage}%` }}
                />
              </div>

              {/* Text Labels */}
              <div className="flex justify-between items-center mb-1 text-sm mt-2 text-muted-foreground font-medium">
                <span>Attendance</span>
                
                <div className="flex items-center gap-2">
                  {/* Show Official % if different */}
                  {stats.selfTrackedTotal > 0 && stats.officialPercentage !== stats.displayPercentage && (
                    <span className="text-xs opacity-70">
                      {stats.officialPercentage}% <span className="mx-0.5">→</span>
                    </span>
                  )}
                  {/* Merged % */}
                  <span className={stats.selfTrackedTotal > 0 ? "text-primary font-bold" : ""}>
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