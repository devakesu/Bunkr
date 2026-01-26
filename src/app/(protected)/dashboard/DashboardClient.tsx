"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import * as Sentry from "@sentry/nextjs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { AttendanceCalendar } from "@/components/attendance/attendance-calendar";
import { CourseCard } from "@/components/attendance/course-card";
import { ErrorBoundary } from "@/components/error-boundary";
import { useProfile } from "@/hooks/users/profile";
import { useAttendanceReport } from "@/hooks/courses/attendance";
import { useFetchCourses } from "@/hooks/courses/courses";
import {
  useFetchSemester,
  useFetchAcademicYear,
  useSetSemester,
  useSetAcademicYear,
} from "@/hooks/users/settings";
import { generateSlotKey } from "@/lib/utils";
import { Loading as CompLoading } from "@/components/loading";
import { useUser } from "@/hooks/users/user";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAttendanceSettings } from "@/providers/attendance-settings";
import { useTrackingData } from "@/hooks/tracker/useTrackingData";
import { useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";

const ChartSkeleton = () => (
  <div className="flex items-center justify-center h-full">
    <CompLoading />
  </div>
);

const AttendanceChart = dynamic(() => import('@/components/attendance/attendance-chart').then((mod) => mod.AttendanceChart), {
  loading: () => <ChartSkeleton />,
  ssr: false
});

// --- Types & Constants ---
const ATTENDANCE_STATUS = {
  PRESENT: 110,
  ABSENT: 111,
  DUTY_LEAVE: 225,
  OTHER_LEAVE: 112,
};

// --- Helper Functions ---
const isPositive = (code: number): boolean => {
  return code === ATTENDANCE_STATUS.PRESENT || code === ATTENDANCE_STATUS.DUTY_LEAVE;
};

const getOfficialSessionRaw = (session: any, sessionKey: string | number): string | number => {
  if (session && session.session != null && session.session !== "") {
    return session.session;
  }
  return sessionKey;
};

export default function DashboardClient() {
  const { data: profile } = useProfile();
  const { data: user } = useUser();
  const queryClient = useQueryClient();
  
  const { data: semesterData, isLoading: isLoadingSemester, isError: isSemesterError } = useFetchSemester();
  const { data: academicYearData, isLoading: isLoadingAcademicYear, isError: isAcademicYearError } = useFetchAcademicYear();
  
  const setSemesterMutation = useSetSemester();
  const setAcademicYearMutation = useSetAcademicYear();
  const { targetPercentage } = useAttendanceSettings();

  const [selectedSemester, setSelectedSemester] = useState<"even" | "odd" | null>(null);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [hoveredCourseId, setHoveredCourseId] = useState<string | null>(null);

  const [isSyncing, setIsSyncing] = useState(true);
  const syncAttempted = useRef(false);

  const [pendingChange, setPendingChange] = useState<
    | { type: "semester"; value: "even" | "odd" }
    | { type: "academicYear"; value: string }
    | null
  >(null);

  const [isUpdating, setIsUpdating] = useState(false);
  const getDefaultDefaults = useCallback(() => {
    const now = new Date();
    const month = now.getMonth(); // 0-11
    const year = now.getFullYear();

    // Logic: Jan(0)-June(5) is Even Sem (part of previous academic year start)
    // July(6)-Dec(11) is Odd Sem (start of new academic year)
    const isFirstHalf = month < 6; 

    const currentSemester: "even" | "odd" = isFirstHalf ? "even" : "odd";
    
    const startYear = isFirstHalf ? year - 1 : year;
    const endYearShort = String(startYear + 1).slice(-2);
    const currentYearStr = `${startYear}-${endYearShort}`;

    return { currentSemester, currentYearStr };
  }, []);

  const {
    data: attendanceData,
    isLoading: isLoadingAttendance,
    refetch: refetchAttendance,
  } = useAttendanceReport();

  const {
    data: coursesData,
    isLoading: isLoadingCourses,
    refetch: refetchCourses,
  } = useFetchCourses();
  
  const { 
    data: trackingData, 
    isLoading: isLoadingTracking, 
    refetch: refetchTracking 
  } = useTrackingData(user);

  const handleSemesterChange = (value: "even" | "odd") => {
    if (value === selectedSemester) return;
    setPendingChange({ type: "semester", value });
    setShowConfirmDialog(true);
  };

  const handleAcademicYearChange = (value: string) => {
    if (value === selectedYear) return;
    setPendingChange({ type: "academicYear", value });
    setShowConfirmDialog(true);
  };

  const handleConfirmChange = async () => {
    if (!pendingChange || !user?.username) return;
    setIsUpdating(true);
    setShowConfirmDialog(false);
    try {
        if (pendingChange.type === "semester") {
            setSelectedSemester(pendingChange.value);
            await setSemesterMutation.mutateAsync({ default_semester: pendingChange.value });
        } else {
            setSelectedYear(pendingChange.value);
            await setAcademicYearMutation.mutateAsync({ default_academic_year: pendingChange.value });
        }
        await Promise.all([refetchCourses(), refetchAttendance()]);

    } catch (error) {
        console.error("Settings Update Failed:", error);
        
        // Send to Sentry with context
        Sentry.captureException(error, {
            tags: { type: "update_settings_failed", location: "DashboardClient/handleConfirmChange" },
            extra: {
                change_type: pendingChange?.type,
                target_value: pendingChange?.value,
            }
        });

        toast.error("Failed to update settings");

    } finally {
        setIsUpdating(false);
        setPendingChange(null);
    }
  };

  const handleCancelChange = () => {
    setShowConfirmDialog(false);
    setPendingChange(null);
  };
  
  const academicYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const startYear = 2022;
    const years: string[] = [];
    for (let year = startYear; year <= currentYear; year++) {
      years.push(`${year}-${(year + 1).toString().slice(-2)}`);
    }
    return years;
  }, []);

  // 1. Semester Initialization
  useEffect(() => {
    // Case A: User already has a setting on the server
    if (semesterData) {
      setSelectedSemester(semesterData);
    } 
    // Case B: No setting found on server (404) -> Auto-set Default
    // Only initialize if data is explicitly null (404), not on errors
    else if (!isLoadingSemester && !isSemesterError && semesterData === null) {
      const defaultSem = getDefaultDefaults().currentSemester;
      
      // Optimistic Update (Immediate UI feedback)
      setSelectedSemester(defaultSem);

      const initializeSemester = async () => {
        if (!setSemesterMutation.isPending) {
          try {
            await setSemesterMutation.mutateAsync({ default_semester: defaultSem });
            // Only refetch data once we confirm the setting is saved
            await Promise.all([refetchCourses(), refetchAttendance()]); 
          } catch (error) {
            console.error("Failed to set default semester", error);
            Sentry.captureException(error, {
                tags: { type: "auto_init_semester", location: "DashboardClient/useEffect/SemesterInitialization" },
                extra: { 
                    attempted_value: defaultSem,
                }
            });
          }
        }
      };
      initializeSemester();
    }
  }, [semesterData, isLoadingSemester, isSemesterError, getDefaultDefaults, setSemesterMutation, refetchCourses, refetchAttendance]);

// 2. Academic Year Initialization
  useEffect(() => {
    if (academicYearData) {
      setSelectedYear(academicYearData);
    } 
    // Only initialize if data is explicitly null (404), not on errors
    else if (!isLoadingAcademicYear && !isAcademicYearError && academicYearData === null) {
      const defaultYear = getDefaultDefaults().currentYearStr;

      setSelectedYear(defaultYear);

      const initializeYear = async () => {
        if (!setAcademicYearMutation.isPending) {
          try {
            await setAcademicYearMutation.mutateAsync({ default_academic_year: defaultYear });
            await Promise.all([refetchCourses(), refetchAttendance()]);
          } catch (error) {
             console.error("Failed to set default year", error);
             Sentry.captureException(error, {
                tags: { type: "auto_init_year", location: "DashboardClient/useEffect/AcademicYearInitialization" },
                extra: { 
                    attempted_value: defaultYear,
                }
            });
          }
        }
      };
      initializeYear();
    }
  }, [academicYearData, isLoadingAcademicYear, isAcademicYearError, getDefaultDefaults, setAcademicYearMutation, refetchCourses, refetchAttendance]);
  
  // --- SYNC ---
  useEffect(() => {
    // 1. Wait until user is loaded and initial data fetch is complete
    if (!user?.username || isLoadingAttendance || isLoadingTracking) {
        return;
    }

    // 2. Prevent Double-Firing (Strict Mode safety)
    if (syncAttempted.current) return;
    syncAttempted.current = true;

    setIsSyncing(true);
    const abortController = new AbortController();

    const performSync = async () => {
        try {
            const res = await fetch(`/api/cron/sync?username=${user.username}`, {
                signal: abortController.signal
            });

            const data = await res.json();

            // Handle different response status codes
            if (res.status === 207) {
                // Partial failure: Some records synced, some failed
                toast.warning("Partial Sync Completed", {
                    description: "Some attendance data couldn't be synced. Your dashboard may be incomplete."
                });
                
                Sentry.captureMessage("Partial sync failure in dashboard", {
                    level: "warning",
                    tags: { type: "dashboard_partial_sync", location: "DashboardClient/useEffect/performSync" },
                    extra: { username: user.username, response: data }
                });
                
                // Still refetch queries as partial sync may have updated some records
                await Promise.all([
                    refetchTracking(),
                    refetchAttendance(),
                    queryClient.invalidateQueries({ queryKey: ["notifications"] })
                ]);
            } else if (!res.ok) {
                // Complete failure (500 or other error codes)
                throw new Error(`Sync API responded with status: ${res.status}`);
            } else if (data.success && (data.deletions > 0 || data.conflicts > 0 || data.updates > 0)) {
                // Success with changes
                toast.info("Attendance Synced", {
                    description: `Dashboard updated. ${data.deletions + data.updates} records synced.`
                });
                
                // Refetch queries to show new data
                await Promise.all([
                    refetchTracking(),
                    refetchAttendance(),
                    queryClient.invalidateQueries({ queryKey: ["notifications"] })
                ]);
            }
        } catch (error: any) {
            // Ignore AbortErrors (user navigated away)
            if (error.name === 'AbortError') return;

            console.error("Background sync failed", error);
            
            // Capture API failures in Sentry
            Sentry.captureException(error, {
                tags: { type: "background_sync", location: "DashboardClient/useEffect/performSync" },
                extra: { username: user.username }
            });
        } finally {
            setIsSyncing(false);
        }
    };

    performSync();

    // Cleanup: Cancel request if component unmounts
    // Reset sync flag after a delay to allow reruns after navigation while preventing strict mode double-fire
    return () => {
      abortController.abort();
      // Use setTimeout to distinguish between strict mode cleanup (immediate remount) 
      // and actual unmount (navigation away). Strict mode remounts happen synchronously,
      // so the flag stays true. Real navigation has enough delay for the reset to take effect.
      setTimeout(() => {
        syncAttempted.current = false;
      }, 100);
    };

  }, [user?.username, isLoadingAttendance, isLoadingTracking, refetchTracking, refetchAttendance, queryClient
  ]);

  // CALCULATE ACTIVE COURSES (Courses with at least 1 record)
  const activeCourseCount = useMemo(() => {
    const totalCourses = coursesData?.courses ? Object.keys(coursesData.courses).length : 0;
    const activeIds = new Set<string>();

    // 1. Scan Official Data (Check for ACTUAL attendance codes)
    if (attendanceData?.studentAttendanceData) {
      Object.values(attendanceData.studentAttendanceData).forEach((sessions: any) => {
        Object.values(sessions).forEach((session: any) => {
          const attCode = Number(session.attendance);
          
          // Only count if attendance code is valid (Present, Absent, Leaves)
          const isValidAttendance = [110, 111, 225, 112].includes(attCode);

          if (session.course && session.course !== "null" && isValidAttendance) {
            activeIds.add(String(session.course));
          }
        });
      });
    }

    // 2. Scan Tracking Data (Filtered by Semester)
    if (trackingData) {
      trackingData.forEach((t: any) => {
        const isSameSemester = !selectedSemester || t.semester === selectedSemester;
        const isSameYear = !selectedYear || t.year === selectedYear;

        if (t.course && isSameSemester && isSameYear) {
          activeIds.add(String(t.course));
        }
      });
    }

    return {
      active: activeIds.size,
      total: totalCourses
    };
  }, [attendanceData, trackingData, coursesData, selectedSemester, selectedYear]);

  const filteredChartData = useMemo(() => {
    if (!attendanceData) return undefined;
    const newData = JSON.parse(JSON.stringify(attendanceData));
    
    if (newData.studentAttendanceData) {
      Object.keys(newData.studentAttendanceData).forEach(date => {
        const sessions = { ...newData.studentAttendanceData[date] };
        let modified = false;
        Object.keys(sessions).forEach(sessionKey => {
          if ((sessions[sessionKey] as any).class_type === "Revision") {
            delete sessions[sessionKey];
            modified = true;
          }
        });
        if (modified) newData.studentAttendanceData[date] = sessions;
      });
    }
    return newData;
  }, [attendanceData]);

  // --- STATS CALCULATION ---
  const stats = useMemo(() => {
    const officialStats = { present: 0, absent: 0, dl: 0, total: 0, other: 0 };
    const modifierStats = { correctionPresent: 0, savedAbsent: 0, correctionDL: 0, extraPresent: 0, extraAbsent: 0, extraDL: 0 };
    
    const courseStats: Record<string, { present: number; total: number; bunkable: number; required: number }> = {};
    if (coursesData?.courses) { 
        Object.values(coursesData.courses).forEach((c: any) => { 
            courseStats[String(c.id)] = { present: 0, total: 0, bunkable: 0, required: 0 }; 
        }); 
    }

    const officialMap = new Map<string, number>();
    if (attendanceData?.studentAttendanceData) {
      Object.entries(attendanceData.studentAttendanceData).forEach(([dateStr, dateData]) => {
        Object.entries(dateData as any).forEach(([sessionKey, session]: [string, any]) => {
          if (session.course && session.class_type !== "Revision") {
            const cid = String(session.course);
            const status = Number(session.attendance);
            const rawSession = getOfficialSessionRaw(session, sessionKey);
            const key = generateSlotKey(cid, dateStr, rawSession);
            
            officialMap.set(key, status);

            officialStats.total++;
            if (isPositive(status)) officialStats.present++; else officialStats.absent++; 
            if (status === ATTENDANCE_STATUS.DUTY_LEAVE) officialStats.dl++;
            if (status === ATTENDANCE_STATUS.OTHER_LEAVE) officialStats.other++;

            if (courseStats[cid]) { 
                courseStats[cid].total++; 
                if (isPositive(status)) courseStats[cid].present++; 
            }
          }
        });
      });
    }

    if (trackingData) {
      trackingData.forEach((item) => {

        if (item.semester !== selectedSemester || item.year !== selectedYear) {
            return;
        }

        if (!item.course) return;
        const cid = String(item.course);
        const key = generateSlotKey(cid, item.date, item.session);
        
        let trackerStatus = ATTENDANCE_STATUS.PRESENT;
        if (typeof item.attendance === "number") trackerStatus = item.attendance;

        const officialStatus = officialMap.get(key);
        const isTrulyExtra = item.status === "extra" && officialStatus === undefined; 
        
        const trackerPositive = isPositive(trackerStatus);
        const trackerDL = trackerStatus === ATTENDANCE_STATUS.DUTY_LEAVE;
        
        const officialPositive = officialStatus !== undefined ? isPositive(officialStatus) : false; 
        const officialDL = officialStatus === ATTENDANCE_STATUS.DUTY_LEAVE;

        const updateCourse = (isExtraClass: boolean, offPos: boolean, trackPos: boolean) => {
            if (courseStats[cid]) {
                if (isExtraClass) { 
                    courseStats[cid].total++; 
                    if (trackPos) courseStats[cid].present++; 
                } else { 
                    if (!offPos && trackPos) courseStats[cid].present++; 
                    else if (offPos && !trackPos) courseStats[cid].present--; 
                }
            }
        };

        if (isTrulyExtra) {
            if (trackerPositive) modifierStats.extraPresent++; else modifierStats.extraAbsent++;
            if (trackerDL) modifierStats.extraDL++;
            updateCourse(true, false, trackerPositive); 
        } else {
            if (!officialPositive && trackerPositive) modifierStats.correctionPresent++;
            if (!officialPositive && (trackerPositive || trackerDL)) modifierStats.savedAbsent++;
            if (!officialDL && trackerDL) modifierStats.correctionDL++;
            
            updateCourse(false, officialPositive, trackerPositive);
        }
      });
    }

    const finalTotal = officialStats.total + modifierStats.extraPresent + modifierStats.extraAbsent;
    const finalPresent = officialStats.present + modifierStats.correctionPresent + modifierStats.extraPresent;
    
    const percentage = finalTotal > 0 ? (finalPresent / finalTotal) * 100 : 0;
    const officialPercentage = officialStats.total > 0 ? (officialStats.present / officialStats.total) * 100 : 0;
    const formatPct = (val: number) => (val % 1 === 0 ? Math.round(val) : parseFloat(val.toFixed(1)));

    return {
        percentage: formatPct(percentage), rawPercentage: percentage, officialPercentage: formatPct(officialPercentage), rawOfficialPercentage: officialPercentage,
        realPresent: officialStats.present, correctionPresent: modifierStats.correctionPresent, extraPresent: modifierStats.extraPresent, 
        realAbsent: officialStats.absent, savedAbsent: modifierStats.savedAbsent, extraAbsent: modifierStats.extraAbsent, 
        realDL: officialStats.dl, correctionDL: modifierStats.correctionDL, extraDL: modifierStats.extraDL, otherLeave: officialStats.other,
        realTotal: officialStats.total, finalTotal: finalTotal, finalPresent: finalPresent, courseStats
    };
  }, [attendanceData, trackingData, coursesData, selectedSemester, selectedYear]);

  const sortedCourses = useMemo(() => {
    if (!coursesData?.courses) return [];
    return Object.values(coursesData.courses).map((course: any) => {
        const id = String(course.id);
        const statsObj = stats.courseStats[id] || { present: 0, total: 0 };
        const { present, total } = statsObj;
        const isNew = total === 0;
        const pct = total > 0 ? Math.round((present / total) * 100) : 0;
        let bunkable = 0, required = 0;
        if (!isNew) {
            if (pct >= targetPercentage) {
                const maxClassesToAttend = Math.floor((100 * present) / targetPercentage);
                bunkable = Math.max(0, maxClassesToAttend - total);
            } else {
                if (targetPercentage < 100) {
                    const numerator = (targetPercentage * total) - (100 * present);
                    required = Math.max(0, Math.ceil(numerator / (100 - targetPercentage)));
                } else required = total > present ? Infinity : 0;
            }
        }
        return { ...course, currentPercentage: pct, bunkable, required, isNew, present, total }; 
      }).sort((a: any, b: any) => {
        if (a.isNew && !b.isNew) return 1; if (!a.isNew && b.isNew) return -1;
        if (b.bunkable !== a.bunkable) return b.bunkable - a.bunkable;
        return a.required - b.required;
      });
  }, [coursesData, stats, targetPercentage]);

  if (isLoadingSemester || isLoadingAcademicYear || isLoadingAttendance || isLoadingCourses || isLoadingTracking || isUpdating || isSyncing) {
    return <CompLoading />;
  }

  const officialWidth = stats.rawOfficialPercentage;
  let diffWidth = 0, isGain = false;
  if (stats.rawPercentage >= stats.rawOfficialPercentage) { isGain = true; diffWidth = stats.rawPercentage - stats.rawOfficialPercentage; } 
  else { isGain = false; diffWidth = stats.rawOfficialPercentage - stats.rawPercentage; }
  if (officialWidth + diffWidth > 100) diffWidth = 100 - officialWidth; if (diffWidth < 0) diffWidth = 0;
  const diffPresent = stats.finalPresent - stats.realPresent;
  const diffTotal = stats.finalTotal - stats.realTotal;

  return (
    <div className="flex flex-col min-h-screen bg-background font-manrope">
      <main className="flex-1 container mx-auto p-4 md:p-6">
        <div className="mb-6 flex flex-col lg:flex-row gap-6 lg:items-end justify-between">
          <div className="flex flex-col gap-4 flex-1">
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-bold mb-2 w-full">Welcome back, <span className="gradient-name w-full pr-2">{profile?.first_name} {profile?.last_name}</span></h1>
              <p className="text-muted-foreground font-normal italic">{"Stay on top of your classes, track your attendance, and manage your day like a pro!"}</p>
            </div>
            <div className="flex gap-4 items-center font-normal">
              <p className="flex flex-wrap items-center gap-2.5 max-sm:text-md text-muted-foreground">
                <span>You&apos;re checking out the</span>
                <Select value={selectedSemester || undefined} onValueChange={(value) => handleSemesterChange(value as "even" | "odd")} disabled={isLoadingSemester || setSemesterMutation.isPending}>
                  <SelectTrigger className="w-fit h-6 px-2 text-[14px] font-medium rounded-xl pl-3 uppercase custom-dropdown">{isLoadingSemester ? "..." : selectedSemester || "semester"}</SelectTrigger>
                  <SelectContent className="custom-dropdown"><SelectItem value="odd">ODD</SelectItem><SelectItem value="even">EVEN</SelectItem></SelectContent>
                </Select>
                <span>semester reports for academic year</span>
                <Select value={selectedYear || undefined} onValueChange={handleAcademicYearChange} disabled={isLoadingAcademicYear || setAcademicYearMutation.isPending}>
                  <SelectTrigger className="w-fit h-6 px-2 text-[14px] font-medium rounded-xl pl-3 custom-dropdown">{isLoadingAcademicYear ? "..." : selectedYear || "year"}</SelectTrigger>
                  <SelectContent className="custom-dropdown max-h-70">{academicYears.map((year) => <SelectItem key={year} value={year}>{year}</SelectItem>)}</SelectContent>
                </Select>
              </p>
            </div>
          </div>

          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="w-full lg:w-[350px]">
            <Card className="custom-container shadow-sm border-accent/20">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium">Total Attendance</CardTitle>
                <div className="flex items-center gap-2 text-sm font-bold">
                  {(diffPresent !== 0 || diffTotal > 0) && stats.officialPercentage !== stats.percentage && (
                    <span className="text-muted-foreground opacity-70">{stats.officialPercentage}% <span className="mx-0.5">→</span></span>
                  )}
                  <span className={stats.rawPercentage >= targetPercentage ? "text-primary" : "text-red-400"}>
                    {stats.percentage}%
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex h-2 mb-2 w-full overflow-hidden rounded-full bg-secondary">
                  {isGain ? (
                    <>
                      <div className="bg-primary h-full transition-all duration-500 ease-in-out" style={{ width: `${Math.min(officialWidth, 100)}%` }} />
                      <div className="bg-green-500/60 h-full relative transition-all duration-500 ease-in-out border-l border-background/20" style={{ width: `${Math.min(diffWidth, 100)}%` }}>
                          <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.3)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.3)_50%,rgba(255,255,255,0.3)_75%,transparent_75%,transparent)] bg-[length:6px_6px]" />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="bg-primary h-full transition-all duration-500 ease-in-out" style={{ width: `${Math.min(stats.rawPercentage, 100)}%` }} />
                      <div className="bg-red-500/75 h-full relative transition-all duration-500 ease-in-out border-l border-background/20" style={{ width: `${Math.min(diffWidth, 100)}%` }}>
                          <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:6px_6px]" />
                      </div>
                    </>
                  )}
                </div>
                <p className="text-xs text-muted-foreground text-right mt-2 font-medium">
                  <span className="text-foreground/80">{stats.realPresent}</span>
                  {diffPresent > 0 && <span className="text-green-500"> + ({diffPresent})</span>}
                  {diffPresent < 0 && <span className="text-red-500"> - ({Math.abs(diffPresent)})</span>}
                  <span> present</span>
                  <span className="mx-1 text-muted-foreground/50">/</span>
                  <span className="text-foreground/80">{stats.realTotal}</span>
                  {diffTotal > 0 && <span className="text-blue-500"> + {diffTotal}</span>}
                  <span> total</span>
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }} className="h-full">
              <Card className="h-full custom-container flex flex-col">
                <CardHeader className="flex flex-col gap-0.5">
                  <CardTitle className="text-[16px]">Attendance Overview</CardTitle>
                  <CardDescription className="text-accent-foreground/60 text-sm">
                    See where you&apos;ve been keeping up
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 pb-6">
                  <div className="h-[300px] w-full">
                    {attendanceData ? (
                      <ErrorBoundary 
                        fallback={
                          <div className="flex items-center justify-center h-full">
                            <p className="text-muted-foreground">Unable to load chart. Please try refreshing.</p>
                          </div>
                        }
                      >
                        <AttendanceChart 
                          attendanceData={filteredChartData} 
                          trackingData={trackingData} 
                          coursesData={coursesData} 
                        />
                      </ErrorBoundary>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-muted-foreground">No attendance data available</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <div className="lg:col-span-1 h-full">
            <div className="flex flex-col gap-4 h-full">
              
              <div className="grid grid-cols-2 gap-4">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
                  <Card className="custom-container flex flex-col justify-center py-4 px-2">
                    <CardHeader className="pb-1 px-4"><CardTitle className="text-sm font-medium">Present (+DL)</CardTitle></CardHeader>
                    <CardContent className="px-4 pb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-2xl font-bold text-green-500">{stats.realPresent}</span>
                        {stats.correctionPresent > 0 && <span className="text-lg font-bold text-orange-500">+{stats.correctionPresent}</span>}
                        {stats.extraPresent > 0 && <span className="text-lg font-bold text-blue-400">+{stats.extraPresent}</span>}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.2 }}>
                  <Card className="custom-container flex flex-col justify-center py-4 px-2">
                    <CardHeader className="pb-1 px-4"><CardTitle className="text-sm font-medium">Absent</CardTitle></CardHeader>
                    <CardContent className="px-4 pb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-2xl font-bold text-red-500">{stats.realAbsent}</span>
                        {stats.savedAbsent > 0 && <span className="text-lg font-bold text-orange-500">-{stats.savedAbsent}</span>}
                        {stats.extraAbsent > 0 && <span className="text-lg font-bold text-blue-400">+{stats.extraAbsent}</span>}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.3 }}>
                  <Card className="custom-container flex flex-col justify-center py-4 px-2">
                    <CardHeader className="pb-1 px-4"><CardTitle className="text-sm font-medium">Duty Leave(s)</CardTitle></CardHeader>
                    <CardContent className="px-4 pb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-2xl font-bold text-yellow-500">{stats.realDL}</span>
                          {stats.correctionDL > 0 && <span className="text-lg font-bold text-orange-500">+{stats.correctionDL}</span>}
                          {stats.extraDL > 0 && <span className="text-lg font-bold text-blue-400">+{stats.extraDL}</span>}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.4 }}>
                  <Card className="custom-container flex flex-col justify-center py-4 px-2"><CardHeader className="pb-1 px-4"><CardTitle className="text-sm font-medium">Special Leave(s)</CardTitle></CardHeader><CardContent className="px-4 pb-2"><div className="text-2xl font-bold text-teal-400">{stats.otherLeave}</div></CardContent></Card>
                </motion.div>
              </div>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.5 }}>
                <Card className="custom-container flex flex-col py-4"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Active Course(s)</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{activeCourseCount.active} <span className="text-muted-foreground text-sm font-normal">/ {coursesData?.courses ? Object.keys(coursesData.courses).length : 0}</span></div></CardContent></Card>
              </motion.div>
            </div>
          </div>
        </div>

        <div className="mb-6 mt-10">
          <div className="mb-6 flex flex-col justify-center items-center mx-3"><h2 className="text-lg font-bold mb-0.5 italic">Your Courses Lineup <span className="ml-1">⬇️📚</span></h2><p className="italic text-muted-foreground text-sm text-center">Your current courses — organized for easy access.</p></div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{sortedCourses.length > 0 ? sortedCourses.map((course: any) => <div key={course.id}><CourseCard course={course} /></div>) : <div className="col-span-full text-center py-8 bg-accent/50 rounded-xl border-2 border-accent-foreground/12"><p className="text-muted-foreground">No courses found for this semester</p></div>}</div>
        </div>

        <div className="mb-6">
          <Card className="custom-container"><CardHeader className="flex flex-col gap-0.5"><CardTitle className="text-[16px]">Attendance Calendar</CardTitle><CardDescription className="text-accent-foreground/60 text-sm">Your attendance history at a glance</CardDescription></CardHeader><CardContent>{attendanceData ? <AttendanceCalendar attendanceData={attendanceData} /> : <div className="flex items-center justify-center h-[200px]"><p className="text-muted-foreground">No attendance data available</p></div>}</CardContent></Card>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mb-6">
          <Card className="custom-container"><CardHeader className="flex flex-col gap-0.5"><CardTitle className="text-[16px]">Instructor Details</CardTitle><CardDescription className="text-accent-foreground/60 text-sm">Get to know your instructors</CardDescription></CardHeader><CardContent>{coursesData?.courses && Object.keys(coursesData.courses).length > 0 ? (
            <div className="rounded-md custom-container overflow-clip">
              <div className="w-full overflow-auto">
                <table className="w-full caption-bottom text-sm">
                  <thead className="relative">
                    <tr className="border-b-2 border-[#2B2B2B]/[0.6]">
                      <th className="h-10 px-4 text-left font-medium text-muted-foreground bg-[rgb(31,31,32)]">Course</th>
                      <th className="h-10 px-4 text-left font-medium text-muted-foreground bg-[rgb(31,31,32)]">Instructor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {Object.entries(coursesData.courses).map(([courseId, course]: [string, any]) => { 
                      const instructors = course.institution_users?.filter((user: any) => user.pivot.courserole_id === 1) || []; 
                      return instructors.length > 0 ? (instructors.map((instructor: any, index: number) => (
                        <tr 
                          key={`${courseId}-${instructor.id}`} 
                          className={`group transition-colors border-[#2B2B2B]/[0.8] ${hoveredCourseId === courseId ? "bg-muted/25" : ""}`} 
                          onMouseEnter={() => setHoveredCourseId(courseId)} 
                          onMouseLeave={() => setHoveredCourseId(null)}
                        >
                          {index === 0 ? (
                            <td className="p-4 align-top" rowSpan={instructors.length}>
                              <div className="font-medium">{course.code}</div>
                              <div className="text-sm text-muted-foreground capitalize">{course.name.toLowerCase()}</div>
                              {instructors.length > 1 && (<div className="mt-2"><span className="inline-flex items-center rounded-full border px-2 min-h-5 pt-[0.05px] justify-center text-xs font-semibold bg-blue-50/3 text-white/60 border-[#2B2B2B]/[0.8]">{instructors.length} instructors</span></div>)}
                            </td>
                          ) : null}
                          <td className="p-4"><div className="font-medium">{instructor.first_name} {instructor.last_name}</div></td>
                        </tr>
                      ))) : (
                        <tr key={courseId} className="hover:bg-muted/50 transition-colors">
                          <td className="p-4"><div className="font-medium">{course.code}</div><div className="text-sm text-muted-foreground">{course.name}</div></td>
                          <td className="p-4 text-muted-foreground italic">No instructor assigned</td>
                        </tr>
                      ); 
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : <div className="flex items-center justify-center h-[200px]"><p className="text-muted-foreground">No faculty information available</p></div>}</CardContent></Card>
        </motion.div>

        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent className="custom-container">
            <AlertDialogHeader><AlertDialogTitle>Confirm Change</AlertDialogTitle><AlertDialogDescription>You are about to change the {pendingChange?.type === "semester" ? "semester" : "academic year"}. Are you sure you want to continue?</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel onClick={handleCancelChange} className="custom-button">Cancel</AlertDialogCancel><AlertDialogAction onClick={handleConfirmChange} className="custom-button bg-primary! border-accent-foreground!">Confirm</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
}