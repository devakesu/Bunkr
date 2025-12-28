"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import axios from "axios";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { AttendanceCalendar } from "@/components/attendance-calendar";
import { CourseCard } from "@/components/course-card";
import { AttendanceChart } from "@/components/attendance-chart";
import { useProfile } from "@/hooks/users/profile";
import { useAttendanceReport } from "@/hooks/courses/attendance";
import { useFetchCourses } from "@/hooks/courses/courses";
import {
  useFetchSemester,
  useFetchAcademicYear,
  useSetSemester,
  useSetAcademicYear,
} from "@/hooks/users/settings";
import { getToken } from "@/utils/auth";
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

export default function Dashboard() {
  const { data: profile } = useProfile();
  const { data: user } = useUser();
  const accessToken = getToken();
  
  const { data: semesterData, isLoading: isLoadingSemester } = useFetchSemester();
  const { data: academicYearData, isLoading: isLoadingAcademicYear } = useFetchAcademicYear();
  
  const setSemesterMutation = useSetSemester();
  const setAcademicYearMutation = useSetAcademicYear();
  const { targetPercentage } = useAttendanceSettings();

  const [selectedSemester, setSelectedSemester] = useState<"even" | "odd" | null>(null);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const [pendingChange, setPendingChange] = useState<
    | { type: "semester"; value: "even" | "odd" }
    | { type: "academicYear"; value: string }
    | null
  >(null);

  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (semesterData) {
      setSelectedSemester(semesterData);
    }
  }, [semesterData]);

  useEffect(() => {
    if (academicYearData) {
      setSelectedYear(academicYearData);
    }
  }, [academicYearData]);

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

  const { data: trackingData, refetch: refetchTracking } = useTrackingData(user, accessToken);

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
        await setSemesterMutation.mutateAsync(
          { default_semester: pendingChange.value },
          {
            onSuccess: async () => {
              await Promise.all([refetchCourses(), refetchAttendance()]);
            },
            onError: (error) => {
              console.error("Error changing semester:", error);
              if (semesterData) setSelectedSemester(semesterData);
            },
          }
        );
      } else {
        setSelectedYear(pendingChange.value);
        await setAcademicYearMutation.mutateAsync(
          { default_academic_year: pendingChange.value },
          {
            onSuccess: async () => {
              await Promise.all([refetchCourses(), refetchAttendance()]);
            },
            onError: (error) => {
              console.error("Error changing academic year:", error);
              if (academicYearData) setSelectedYear(academicYearData);
            },
          }
        );
      }
    } catch (error) {
      console.error("Error during change confirmation:", error);
    } finally {
      setIsUpdating(false);
      setPendingChange(null);
    }
  };

  const handleCancelChange = () => {
    setShowConfirmDialog(false);
    setPendingChange(null);
  };

  const generateAcademicYears = () => {
    const currentYear = new Date().getFullYear();
    const startYear = 2018;
    const years: string[] = [];
    for (let year = startYear; year <= currentYear; year++) {
      const academicYear = `${year}-${(year + 1).toString().slice(-2)}`;
      years.push(academicYear);
    }
    return years;
  };

  const academicYears = generateAcademicYears();

  const ATTENDANCE_STATUS = {
    PRESENT: 110,
    ABSENT: 111,
    DUTY_LEAVE: 225,
    OTHER_LEAVE: 112,
  } as const;

  // --- AUTO-DELETE LOGIC (Sync Official Updates) ---
  const processedRef = useRef(new Set<string>()); 

  useEffect(() => {
    if (!attendanceData?.studentAttendanceData || !trackingData || trackingData.length === 0) return;

    const toDelete: Array<{ username: string, session: string, course: string, date: string }> = [];

    trackingData.forEach((item) => {
      const uniqueId = `${item.username}-${item.session}-${item.course}-${item.date}`;
      if (processedRef.current.has(uniqueId)) return;

      let dateKey = "";
      if (item.date.includes("/")) {
        const [dd, mm, yyyy] = item.date.split("/");
        dateKey = `${yyyy}${mm}${dd}`;
      } else if (item.date.includes("-")) {
        dateKey = item.date.replace(/-/g, "");
      }

      const daySessions = attendanceData.studentAttendanceData[dateKey];
      if (daySessions) {
        const matchingSessionEntry = Object.values(daySessions).find(
          (s: any) => (s.session || "").toLowerCase() === item.session.toLowerCase()
        );

        if (matchingSessionEntry) {
          const officialCode = (matchingSessionEntry as any).attendance; 
          const expectedCode = item.attendance || 0;

          let shouldDelete = false;

          if (officialCode === expectedCode) {
            shouldDelete = true;
          }
          else if (expectedCode === ATTENDANCE_STATUS.DUTY_LEAVE && officialCode === ATTENDANCE_STATUS.PRESENT) {
            shouldDelete = true;
          }

          if (shouldDelete) {
            toDelete.push({
              username: item.username,
              session: item.session,
              course: item.course,
              date: item.date,
            });
            processedRef.current.add(uniqueId);
          }
        }
      }
    });

    if (toDelete.length > 0) {
      Promise.all(
        toDelete.map((payload) =>
          axios.post(
            `${process.env.NEXT_PUBLIC_SUPABASE_API_URL}/delete-tracking-data`,
            payload,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          )
        )
      ).then(() => {
        toast.success(`Synced ${toDelete.length} records with official data`, {
           description: "Official attendance was updated, so manual tracking was removed."
        });
        refetchTracking(); 
      }).catch(err => console.error("Auto-sync failed", err));
    }
  }, [attendanceData, trackingData, accessToken, refetchTracking]);


  // --- 1. FILTER DATA FOR CHART (The Fix for 68/69) ---
  const filteredChartData = useMemo(() => {
    if (!attendanceData) return undefined; 
    
    const newData = { ...attendanceData, studentAttendanceData: { ...attendanceData.studentAttendanceData } };
    
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

        if (modified) {
          newData.studentAttendanceData[date] = sessions;
        }
      });
    }
    return newData;
  }, [attendanceData]);


  // --- STATS CALCULATION (Core Logic) ---
  const calculatedStats = useMemo(() => {
    const coursesArray = coursesData?.courses ? Object.values(coursesData.courses) : [];
    
    const officialCourseStats: Record<string, { present: number; total: number }> = {};
    const mergedCourseStats: Record<string, { present: number; total: number; selfMarked: number }> = {};
    
    coursesArray.forEach((c: any) => {
      const id = String(c.id);
      officialCourseStats[id] = { present: 0, total: 0 };
      mergedCourseStats[id] = { present: 0, total: 0, selfMarked: 0 };
    });

    const getSlotKey = (courseId: string, date: string, session: string) => {
        let normDate = date.split('T')[0];
        if (normDate.includes('/')) {
            const [dd, mm, yyyy] = normDate.split('/');
            normDate = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
        }
        normDate = normDate.replace(/-/g, '');

        let normSession = String(session).toLowerCase().trim();
        normSession = normSession.replace(/session|hour|lec|lab/g, '').trim();
        normSession = normSession.replace(/(st|nd|rd|th)$/, '').trim();
        
        const romans: Record<string, string> = { 'viii': '8', 'vii': '7', 'vi': '6', 'v': '5', 'iv': '4', 'iii': '3', 'ii': '2', 'i': '1' };
        if (romans[normSession]) normSession = romans[normSession];
        
        const sessionInt = parseInt(normSession);
        if (!isNaN(sessionInt)) normSession = sessionInt.toString();

        return `${courseId}_${normDate}_${normSession}`;
    };

    const officialMap = new Map<string, { status: number, courseId: string }>();

    if (attendanceData?.studentAttendanceData) {
      Object.entries(attendanceData.studentAttendanceData).forEach(([dateStr, dateData]) => {
        let formattedDate = dateStr;
        if (dateStr.length === 8) {
            formattedDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
        }

        Object.entries(dateData).forEach(([sessionKey, session]: [string, any]) => {
          if (session.course) {
            if (session.class_type === "Revision") return; 

            const cid = String(session.course);
            const key = getSlotKey(cid, formattedDate, session.session || sessionKey);
            officialMap.set(key, { status: session.attendance, courseId: cid });
          }
        });
      });
    }

    const mergedMap = new Map(officialMap);
    let totalSelfMarked = 0;

    const isPositive = (code: number) => code === ATTENDANCE_STATUS.PRESENT || code === ATTENDANCE_STATUS.DUTY_LEAVE;

    if (trackingData) {
      trackingData.forEach((item) => {
        const trackerCourseStr = (item.course || "").toString().toLowerCase().trim();
        const courseObj: any = coursesArray.find((c: any) => {
            const cId = String(c.id).toLowerCase();
            const cName = (c.name || "").toLowerCase().trim();
            const cCode = (c.code || "").toLowerCase().trim();
            return cName === trackerCourseStr || cCode === trackerCourseStr || cId === trackerCourseStr;
        });

        if (courseObj) {
          const cid = String(courseObj.id);
          const key = getSlotKey(cid, item.date, item.session);

          let statusNumber: number = ATTENDANCE_STATUS.PRESENT;
          
          if (typeof item.status === 'number') {
            statusNumber = item.status;
          } else if (typeof item.status === 'string') {
             const s = item.status.toLowerCase();
             if (s === 'absent') statusNumber = ATTENDANCE_STATUS.ABSENT;
             else if (s === 'duty leave') statusNumber = ATTENDANCE_STATUS.DUTY_LEAVE;
             else if (s === 'other leave' || s === 'leave') statusNumber = ATTENDANCE_STATUS.OTHER_LEAVE;
             else statusNumber = ATTENDANCE_STATUS.PRESENT;
          }

          const exists = mergedMap.has(key);
          const itemType = (item as any).type;
          const isCorrection = itemType === 'correction' || !itemType;
          const isExtra = itemType === 'extra';

          if (isCorrection) {
             if (exists) {
                 const originalEntry = mergedMap.get(key);
                 const originalStatus = originalEntry?.status || ATTENDANCE_STATUS.ABSENT;

                 mergedMap.set(key, { status: statusNumber, courseId: cid });

                 const wasPositive = isPositive(originalStatus);
                 const isNowPositive = isPositive(statusNumber);

                 if (!wasPositive && isNowPositive) {
                     if (mergedCourseStats[cid]) mergedCourseStats[cid].selfMarked += 1;
                     totalSelfMarked += 1;
                 }
             } else {
                 if (isPositive(statusNumber)) {
                    if (mergedCourseStats[cid]) mergedCourseStats[cid].selfMarked += 1;
                    totalSelfMarked += 1;
                 }
             }
          } else if (isExtra) {
             mergedMap.set(key, { status: statusNumber, courseId: cid });
             if (isPositive(statusNumber)) {
                if (mergedCourseStats[cid]) mergedCourseStats[cid].selfMarked += 1;
                totalSelfMarked += 1;
             }
          }
        }
      });
    }

    let offPresent = 0, offAbsent = 0, offDuty = 0, offOther = 0;
    officialMap.forEach((val) => {
        const { status, courseId } = val;
        const target = officialCourseStats[courseId];
        if (target) {
            target.total += 1;
            if (status === ATTENDANCE_STATUS.PRESENT || status === ATTENDANCE_STATUS.DUTY_LEAVE) target.present += 1;
        }
        if (status === ATTENDANCE_STATUS.PRESENT) offPresent++;
        else if (status === ATTENDANCE_STATUS.ABSENT) offAbsent++;
        else if (status === ATTENDANCE_STATUS.DUTY_LEAVE) offDuty++;
        else if (status === ATTENDANCE_STATUS.OTHER_LEAVE) offOther++;
    });

    let mPresent = 0, mAbsent = 0, mDuty = 0, mOther = 0;
    mergedMap.forEach((val) => {
        const { status, courseId } = val;
        const target = mergedCourseStats[courseId];
        if (target) {
            target.total += 1;
            if (status === ATTENDANCE_STATUS.PRESENT || status === ATTENDANCE_STATUS.DUTY_LEAVE) target.present += 1;
        }
        if (status === ATTENDANCE_STATUS.PRESENT) mPresent++;
        else if (status === ATTENDANCE_STATUS.ABSENT) mAbsent++;
        else if (status === ATTENDANCE_STATUS.DUTY_LEAVE) mDuty++;
        else if (status === ATTENDANCE_STATUS.OTHER_LEAVE) mOther++;
    });

    const offTotalClasses = offPresent + offAbsent + offDuty + offOther;
    const mTotalClasses = mPresent + mAbsent + mDuty + mOther;
    const offEffPresent = offPresent + offDuty;
    const mEffPresent = mPresent + mDuty;

    return {
        official: { present: offEffPresent, total: offTotalClasses, percentage: offTotalClasses > 0 ? Math.round((offEffPresent / offTotalClasses) * 100) : 0 },
        merged: { present: mEffPresent, absent: mAbsent, total: mTotalClasses, percentage: mTotalClasses > 0 ? Math.round((mEffPresent / mTotalClasses) * 100) : 0, dutyLeave: mDuty, otherLeave: mOther, totalSelfMarked },
        courseStats: { official: officialCourseStats, merged: mergedCourseStats }
    };

  }, [attendanceData, trackingData, coursesData]);

  // --- STATS ADAPTER ---
  const stats = useMemo(() => {
    const m = calculatedStats.merged;
    const o = calculatedStats.official;
    
    const realPresentCount = m.present - m.totalSelfMarked;
    const realAbsentCount = m.total - realPresentCount;

    return {
      percentage: m.percentage,
      officialPercentage: o.percentage, // Added Official %
      adjustedPresent: m.present,
      adjustedTotal: m.total,
      realPresent: realPresentCount,
      selfTrackedPresent: m.totalSelfMarked,
      realAbsent: realAbsentCount, 
      corrections: m.totalSelfMarked,
      dutyLeave: m.dutyLeave,
      otherLeave: m.otherLeave,
    };
  }, [calculatedStats]);

  // --- SORTED COURSES ---
  const sortedCourses = useMemo(() => {
    if (!coursesData?.courses) return [];

    return Object.values(coursesData.courses)
      .map((course: any) => {
        const id = String(course.id);
        const mStats = calculatedStats.courseStats.merged[id];
        const oStats = calculatedStats.courseStats.official[id];

        const present = mStats?.present || 0;
        const total = mStats?.total || 0;
        const selfMarkedCount = mStats?.selfMarked || 0;
        
        const officialPresent = oStats?.present || 0;
        const officialTotal = oStats?.total || 0;

        const isNew = total === 0;
        const pct = total > 0 ? Math.round((present / total) * 100) : 0;
        let bunkable = 0, required = 0;

        if (!isNew) {
            if (pct >= targetPercentage) {
                const maxClassesToAttend = Math.floor((100 * present) / targetPercentage);
                const rawBunkable = maxClassesToAttend - total;
                bunkable = rawBunkable > 0 ? rawBunkable : 0;
            } else {
                if (targetPercentage < 100) {
                    const numerator = (targetPercentage * total) - (100 * present);
                    const denominator = 100 - targetPercentage;
                    const rawRequired = Math.ceil(numerator / denominator);
                    required = rawRequired > 0 ? rawRequired : 0;
                } else {
                    required = total > present ? Infinity : 0;
                }
            }
        }
        
        return { 
            ...course, 
            currentPercentage: pct, 
            bunkable, 
            required, 
            isNew, 
            selfMarkedCount, 
            present, 
            total,
            officialPresent,
            officialTotal 
        }; 
      })
      .sort((a: any, b: any) => {
        if (a.isNew && !b.isNew) return 1;
        if (!a.isNew && b.isNew) return -1;
        if (b.bunkable !== a.bunkable) return b.bunkable - a.bunkable;
        return a.required - b.required;
      });

  }, [coursesData, calculatedStats, targetPercentage]);


  if (
    isLoadingSemester ||
    isLoadingAcademicYear ||
    isLoadingAttendance ||
    isLoadingCourses ||
    isUpdating
  ) {
    return (
      <p className="flex h-[90vh] items-center justify-center bg-background text-xl font-medium text-muted-foreground text-center italic mx-12">
        &quot;Waiting on Ezygo to stop ghosting us 👻&quot;
      </p>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background font-manrope">
      <main className="flex-1 container mx-auto p-4 md:p-6">
        
        <div className="mb-6 flex flex-col lg:flex-row gap-6 lg:items-end justify-between">
          <div className="flex flex-col gap-4 flex-1">
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-bold mb-2 w-full">
                Welcome back,{" "}
                <span className="gradient-name w-full pr-2">
                  {profile?.first_name} {profile?.last_name}
                </span>
              </h1>
              <p className="text-muted-foreground font-normal italic">
                {"Stay on top of your classes, track your attendance, and manage your day like a pro!"}
              </p>
            </div>
            <div className="flex gap-4 items-center font-normal">
              <p className="flex flex-wrap items-center gap-2.5 max-sm:text-md text-muted-foreground">
                <span>You&apos;re checking out the</span>
                <Select
                  value={selectedSemester || undefined}
                  onValueChange={(value) => handleSemesterChange(value as "even" | "odd")}
                  disabled={isLoadingSemester || setSemesterMutation.isPending}
                >
                  <SelectTrigger className="w-fit h-6 px-2 text-[14px] font-medium rounded-xl pl-3 uppercase custom-dropdown">
                    {isLoadingSemester ? <span className="text-muted-foreground">...</span> : selectedSemester || <span className="text-muted-foreground lowercase">semester</span>}
                  </SelectTrigger>
                  <SelectContent className="custom-dropdown">
                    <SelectItem value="odd" className={selectedSemester === "odd" ? "bg-white/5" : ""}>ODD</SelectItem>
                    <SelectItem value="even" className={selectedSemester === "even" ? "bg-white/5 mt-1" : "mt-0.5"}>EVEN</SelectItem>
                  </SelectContent>
                </Select>
                <span>semester reports for academic year</span>
                <Select
                  value={selectedYear || undefined}
                  onValueChange={handleAcademicYearChange}
                  disabled={isLoadingAcademicYear || setAcademicYearMutation.isPending}
                >
                  <SelectTrigger className="w-fit h-6 px-2 text-[14px] font-medium rounded-xl pl-3 custom-dropdown">
                    {isLoadingAcademicYear ? <span className="text-muted-foreground">...</span> : selectedYear || <span className="text-muted-foreground">year</span>}
                  </SelectTrigger>
                  <SelectContent className="custom-dropdown max-h-70">
                    {academicYears.map((year) => (
                      <SelectItem key={year} value={year} className={selectedYear === year ? "bg-white/5 mt-0.5" : "mt-0.5"}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </p>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full lg:w-[350px]"
          >
            <Card className="custom-container shadow-sm border-accent/20">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  Total Attendance
                </CardTitle>
                
                {/* --- UPDATED: Show Official if different --- */}
                <div className="flex items-center gap-2 text-sm font-bold">
                  {stats.corrections > 0 && stats.officialPercentage !== stats.percentage && (
                    <span className="text-muted-foreground opacity-70">
                      {stats.officialPercentage}% <span className="mx-0.5">→</span>
                    </span>
                  )}
                  <span className={stats.corrections > 0 ? "text-primary" : "text-muted-foreground"}>
                    {stats.percentage}%
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                
                {/* --- REPLACED: Dual Progress Bar --- */}
                <div className="relative h-2 mb-2 w-full overflow-hidden rounded-full bg-secondary">
                  {/* Layer 1: Merged (Ghost) */}
                  <div
                    className="absolute top-0 left-0 h-full bg-primary/40 transition-all duration-500 ease-in-out"
                    style={{ width: `${stats.percentage}%` }}
                  >
                    <div className="h-full w-full opacity-30 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:8px_8px]" />
                  </div>
                  {/* Layer 2: Official (Solid) */}
                  <div
                    className="absolute top-0 left-0 h-full bg-primary transition-all duration-500 ease-in-out"
                    style={{ width: `${stats.officialPercentage}%` }}
                  />
                </div>

                <p className="text-xs text-muted-foreground text-right">
                  {stats.adjustedPresent} present / {stats.adjustedTotal} total
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* ... (Rest of the component remains unchanged) ... */}
        {/* ... Paste rest of code from previous message starting from SECTION 2 ... */}
        {/* ... (To save space, assuming you will paste the rest of the return block here) ... */}
        
        {/* SECTION 2: Chart & Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
              className="h-full"
            >
              <Card className="h-full custom-container flex flex-col">
                <CardHeader className="flex flex-col gap-0.5">
                  <CardTitle className="text-[16px]">Attendance Overview</CardTitle>
                  <CardDescription className="text-accent-foreground/60 text-sm">
                    {"See where you've been keeping up"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 pb-6">
                  <div className="h-[300px] w-full"> 
                    {isLoadingAttendance ? (
                      <div className="flex items-center justify-center h-full"><CompLoading /></div>
                    ) : attendanceData ? (
                      <AttendanceChart 
                        attendanceData={filteredChartData} 
                        trackingData={trackingData} 
                        coursesData={coursesData} 
                      />
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
              {/* PRESENT/ABSENT CARDS */}
              <div className="grid grid-cols-2 gap-4 flex-1">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                  className="h-full"
                >
                  <Card className="h-full custom-container flex flex-col justify-center">
                    <CardHeader className="pb-1">
                      <CardTitle className="text-sm font-medium">Present</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-1">
                        <span className="text-2xl font-bold text-green-500">
                          {stats.realPresent}
                        </span>
                        {stats.selfTrackedPresent > 0 && (
                          <span className="text-lg font-bold text-orange-500">
                            +{stats.selfTrackedPresent}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                  className="h-full"
                >
                  <Card className="h-full custom-container flex flex-col justify-center">
                    <CardHeader className="pb-1">
                      <CardTitle className="text-sm font-medium">Absent</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-1">
                        <span className="text-2xl font-bold text-red-500">
                          {stats.realAbsent}
                        </span>
                        {stats.corrections > 0 && (
                          <span className="text-lg font-bold text-orange-500">
                            -{stats.corrections}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              {/* DUTY/OTHER LEAVES */}
              <div className="grid grid-cols-2 gap-4 flex-1">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.3 }}
                  className="h-full"
                >
                  <Card className="h-full custom-container flex flex-col justify-center">
                    <CardHeader className="pb-1">
                      <CardTitle className="text-sm font-medium">Approved Duty Leaves</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-yellow-500">{stats.dutyLeave}</div>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.4 }}
                  className="h-full"
                >
                  <Card className="h-full custom-container flex flex-col justify-center">
                    <CardHeader className="pb-1">
                      <CardTitle className="text-sm font-medium">Special Leave</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-teal-400">{stats.otherLeave}</div>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              {/* TOTAL COURSES */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.5 }}
                className="flex-1"
              >
                <Card className="h-full custom-container flex flex-col">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Courses</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {coursesData?.courses ? Object.keys(coursesData.courses).length : 0}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

            </div>
          </div>
        </div>

        {/* SECTION 3: Courses */}
        <div className="mb-6 mt-10">
          <div className="mb-6 flex flex-col justify-center items-center mx-3">
            <h2 className="text-lg font-bold mb-0.5 italic">
              Your Courses Lineup <span className="ml-1">⬇️📚</span>
            </h2>
            <p className="italic text-muted-foreground text-sm text-center">
              Your current courses — organized for easy access.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {isLoadingCourses ? (
              Array(6).fill(0).map((_, i) => (
                  <Card key={i} className="overflow-hidden">
                    <CardHeader className="p-0"><Skeleton className="h-40 w-full rounded-none" /></CardHeader>
                    <CardContent className="p-6">
                      <Skeleton className="h-6 w-3/4 mb-2" /><Skeleton className="h-4 w-1/2" />
                    </CardContent>
                  </Card>
                ))
            ) : sortedCourses.length > 0 ? (
              sortedCourses.map((course: any) => (
                <div key={course.id}><CourseCard course={course} /></div>
              ))
            ) : (
              <div className="col-span-full text-center py-8 bg-accent/50 rounded-xl border-2 border-accent-foreground/12">
                <p className="text-muted-foreground">No courses found for this semester</p>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 4: Attendance Calendar */}
        <div className="mb-6">
          <Card className="custom-container">
            <CardHeader className="flex flex-col gap-0.5">
              <CardTitle className="text-[16px]">Attendance Calendar</CardTitle>
              <CardDescription className="text-accent-foreground/60 text-sm">
                Your attendance history at a glance
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingAttendance ? (
                <div className="flex items-center justify-center h-[200px]"><CompLoading /></div>
              ) : attendanceData ? (
                <AttendanceCalendar attendanceData={attendanceData} />
              ) : (
                <div className="flex items-center justify-center h-[200px]"><p className="text-muted-foreground">No attendance data available</p></div>
              )}
            </CardContent>
          </Card>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6"
        >
          <Card className="custom-container">
            <CardHeader className="flex flex-col gap-0.5">
              <CardTitle className="text-[16px]">Instructor Details</CardTitle>
              <CardDescription className="text-accent-foreground/60 text-sm">Get to know your instructors</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingCourses ? (
                <div className="flex items-center justify-center h-[200px]"><CompLoading /></div>
              ) : coursesData?.courses && Object.keys(coursesData.courses).length > 0 ? (
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
                            return instructors.length > 0 ? (
                              instructors.map((instructor: any, index: number) => (
                                  <tr key={`${courseId}-${instructor.id}`} className="group transition-colors border-[#2B2B2B]/[0.8]" data-course-id={courseId}
                                    onMouseEnter={() => { document.querySelectorAll(`tr[data-course-id="${courseId}"]`).forEach((row) => { row.classList.add("bg-muted/25"); }); }}
                                    onMouseLeave={() => { document.querySelectorAll(`tr[data-course-id="${courseId}"]`).forEach((row) => { row.classList.remove("bg-muted/25"); }); }}>
                                    {index === 0 ? (
                                      <td className="p-4 align-top" rowSpan={instructors.length}>
                                        <div className="font-medium">{course.code}</div>
                                        <div className="text-sm text-muted-foreground capitalize">{course.name.toLowerCase()}</div>
                                        {instructors.length > 1 && (
                                          <div className="mt-2"><span className="inline-flex items-center rounded-full border px-2 min-h-5 pt-[0.05px] justify-center text-xs font-semibold bg-blue-50/3 text-white/60 border-[#2B2B2B]/[0.8]">{instructors.length} instructors</span></div>
                                        )}
                                      </td>
                                    ) : null}
                                    <td className="p-4"><div className="font-medium">{instructor.first_name} {instructor.last_name}</div></td>
                                  </tr>
                                ))
                            ) : (
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
              ) : (
                <div className="flex items-center justify-center h-[200px]"><p className="text-muted-foreground">No faculty information available</p></div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent className="custom-container">
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Change</AlertDialogTitle>
              <AlertDialogDescription>
                You are about to change the {pendingChange?.type === "semester" ? "semester" : "academic year"}. Are you sure you want to continue?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleCancelChange} className="custom-button">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmChange} className="custom-button bg-primary! border-accent-foreground!">Confirm</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
}