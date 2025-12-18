"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
// Removed ScrollArea from imports as it's no longer used in this file directly
// import { ScrollArea } from "@/components/ui/scroll-area"; 
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
import { redirect } from "next/navigation";
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

export default function Dashboard() {
  const { data: profile } = useProfile();
  const { data: user } = useUser();
  const { data: semesterData, isLoading: isLoadingSemester } =
    useFetchSemester();
  const { data: academicYearData, isLoading: isLoadingAcademicYear } =
    useFetchAcademicYear();
  const setSemesterMutation = useSetSemester();
  const setAcademicYearMutation = useSetAcademicYear();

  const [selectedSemester, setSelectedSemester] = useState<
    "even" | "odd" | null
  >(null);
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

    // 1. Start loading and close the dialog immediately
    setIsUpdating(true);
    setShowConfirmDialog(false);

    try {
      if (pendingChange.type === "semester") {
        setSelectedSemester(pendingChange.value);

        await setSemesterMutation.mutateAsync(
          { default_semester: pendingChange.value },
          {
            // Make this async to wait for data refetch
            onSuccess: async () => {
              // Wait for both refetches to complete before stopping loading
              await Promise.all([refetchCourses(), refetchAttendance()]);
            },
            onError: (error) => {
              console.error("Error changing semester:", error);
              if (semesterData) {
                setSelectedSemester(semesterData);
              }
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
              if (academicYearData) {
                setSelectedYear(academicYearData);
              }
            },
          }
        );
      }
    } catch (error) {
      console.error("Error during change confirmation:", error);
      // Optional: Revert optimistic updates here if needed
    } finally {
      // 2. Stop loading only after everything is done
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

  interface AttendanceStats {
    present: number;
    absent: number;
    total: number;
    percentage: number;
    dutyLeave: number;
    otherLeave: number;
  }

  interface AttendanceSession {
    attendance: number;
    [key: string]: any;
  }

  interface DateData {
    [sessionId: string]: AttendanceSession;
  }

  interface StudentAttendanceData {
    [date: string]: DateData;
  }

  // --- 1. OVERALL STATS CALCULATION ---
  const calculateOverallStats = (): AttendanceStats => {
    const defaultStats: AttendanceStats = {
      present: 0,
      absent: 0,
      total: 0,
      percentage: 0,
      dutyLeave: 0,
      otherLeave: 0,
    };

    if (!attendanceData?.studentAttendanceData) {
      return defaultStats;
    }

    const studentData =
      attendanceData.studentAttendanceData as StudentAttendanceData;

    let totalPresent = 0;
    let totalAbsent = 0;
    let dutyLeave = 0;
    let otherLeave = 0;

    Object.values(studentData).forEach((dateData) => {
      Object.values(dateData).forEach((session) => {
        const { attendance } = session;

        if (attendance === ATTENDANCE_STATUS.PRESENT) totalPresent++;
        else if (attendance === ATTENDANCE_STATUS.ABSENT) totalAbsent++;
        else if (attendance === ATTENDANCE_STATUS.DUTY_LEAVE) dutyLeave++;
        else if (attendance === ATTENDANCE_STATUS.OTHER_LEAVE) otherLeave++;
      });
    });

    const effectivePresent = totalPresent + dutyLeave;
    const totalClasses = effectivePresent + totalAbsent + otherLeave;

    const percentage =
      totalClasses > 0
        ? Math.round((effectivePresent / totalClasses) * 100)
        : 0;

    return {
      present: effectivePresent,
      absent: totalAbsent,
      total: totalClasses,
      percentage,
      dutyLeave,
      otherLeave,
    };
  };

  const stats = calculateOverallStats();

  // --- 2. COURSE SORTING LOGIC (Decreasing % order) ---
  const sortedCourses = useMemo(() => {
    if (!coursesData?.courses) return [];

    const coursesArray = Object.values(coursesData.courses);

    if (!attendanceData?.studentAttendanceData) {
      return coursesArray; // Return unsorted if no attendance data
    }

    // Map to store temporary counts
    const courseStats: Record<string, { present: number; total: number }> = {};
    
    // Initialize
    coursesArray.forEach((c: any) => {
      courseStats[c.id] = { present: 0, total: 0 };
    });

    // Count using existing Constants
    Object.values(attendanceData.studentAttendanceData).forEach((dateData) => {
      Object.values(dateData).forEach((session: any) => {
        if (session.course && courseStats[session.course]) {
          // Logic: 110 & 225 are present, 111 is absent
          if (
            session.attendance === ATTENDANCE_STATUS.PRESENT || 
            session.attendance === ATTENDANCE_STATUS.DUTY_LEAVE
          ) {
            courseStats[session.course].present += 1;
            courseStats[session.course].total += 1;
          } else if (session.attendance === ATTENDANCE_STATUS.ABSENT) {
            courseStats[session.course].total += 1;
          }
        }
      });
    });

    // Attach percentage and Sort Decreasing
    return coursesArray
      .map((course: any) => {
        const s = courseStats[course.id];
        const pct = s.total > 0 ? Math.round((s.present / s.total) * 100) : 0;
        return { ...course, currentPercentage: pct }; // Store pct to sort
      })
      .sort((a: any, b: any) => b.currentPercentage - a.currentPercentage);

  }, [coursesData, attendanceData]);

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
        
        {/* HEADER SECTION: Title + Total Attendance (Top Right) */}
        <div className="mb-6 flex flex-col lg:flex-row gap-6 lg:items-end justify-between">
          
          {/* Left: Welcome & Selectors */}
          <div className="flex flex-col gap-4 flex-1">
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-bold mb-2 w-full">
                Welcome back,{" "}
                <span className="gradient-name w-full pr-2">
                  {profile?.first_name} {profile?.last_name}
                </span>
              </h1>
              <p className="text-muted-foreground font-normal italic">
                {
                  "Stay on top of your classes, track your attendance, and manage your day like a pro!"
                }
              </p>
            </div>
            <div className="flex gap-4 items-center font-normal">
              <p className="flex flex-wrap items-center gap-2.5 max-sm:text-md text-muted-foreground">
                <span>You&apos;re checking out the</span>
                <Select
                  value={selectedSemester || undefined}
                  onValueChange={(value) =>
                    handleSemesterChange(value as "even" | "odd")
                  }
                  disabled={isLoadingSemester || setSemesterMutation.isPending}
                >
                  <SelectTrigger className="w-fit h-6 px-2 text-[14px] font-medium rounded-xl pl-3 uppercase custom-dropdown">
                    {isLoadingSemester ? (
                      <span className="text-muted-foreground">...</span>
                    ) : selectedSemester ? (
                      <span>{selectedSemester}</span>
                    ) : (
                      <span className="text-muted-foreground lowercase">
                        semester
                      </span>
                    )}
                  </SelectTrigger>
                  <SelectContent className="custom-dropdown">
                    <SelectItem
                      value="odd"
                      className={selectedSemester === "odd" ? "bg-white/5" : ""}
                    >
                      ODD
                    </SelectItem>
                    <SelectItem
                      value="even"
                      className={
                        selectedSemester === "even"
                          ? "bg-white/5 mt-1"
                          : "mt-0.5"
                      }
                    >
                      EVEN
                    </SelectItem>
                  </SelectContent>
                </Select>
                <span>semester reports for academic year</span>
                <Select
                  value={selectedYear || undefined}
                  onValueChange={handleAcademicYearChange}
                  disabled={
                    isLoadingAcademicYear || setAcademicYearMutation.isPending
                  }
                >
                  <SelectTrigger className="w-fit h-6 px-2 text-[14px] font-medium rounded-xl pl-3 custom-dropdown">
                    {isLoadingAcademicYear ? (
                      <span className="text-muted-foreground">...</span>
                    ) : selectedYear ? (
                      <span>{selectedYear}</span>
                    ) : (
                      <span className="text-muted-foreground">year</span>
                    )}
                  </SelectTrigger>
                  <SelectContent className="custom-dropdown max-h-70">
                    {academicYears.map((year) => (
                      <SelectItem
                        key={year}
                        value={year}
                        className={
                          selectedYear === year ? "bg-white/5 mt-0.5" : "mt-0.5"
                        }
                      >
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </p>
            </div>
          </div>

          {/* Right: Total Attendance Card */}
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
                <div className="text-sm font-bold text-muted-foreground">
                  {stats.percentage}%
                </div>
              </CardHeader>
              <CardContent>
                <Progress value={stats.percentage} className="h-2 mb-2" />
                <p className="text-xs text-muted-foreground text-right">
                  {stats.present} present / {stats.total} total
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* SECTION 2: Chart (Left) & Stats Grid (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          
          {/* LEFT SIDE: Chart (Fixed Height Control) */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
              className="h-full"
            >
              <Card className="h-full custom-container flex flex-col">
                <CardHeader className="flex flex-col gap-0.5">
                  <CardTitle className="text-[16px]">
                    Attendance Overview
                  </CardTitle>
                  <CardDescription className="text-accent-foreground/60 text-sm">
                    {"See where you've been keeping up"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 pb-6">
                  {/* FIXED HEIGHT: This controls the height of the entire row */}
                  <div className="h-[300px] w-full"> 
                    {isLoadingAttendance ? (
                      <div className="flex items-center justify-center h-full">
                        <CompLoading />
                      </div>
                    ) : attendanceData ? (
                      <AttendanceChart attendanceData={attendanceData} />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-muted-foreground">
                          No attendance data available
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* RIGHT SIDE: Stats Grid (Condenses to match Left Side) */}
          <div className="lg:col-span-1 h-full">
            <div className="flex flex-col gap-4 h-full">
              
              {/* Row 1: Present & Absent */}
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
                      <div className="text-2xl font-bold text-green-500">
                        {stats.present}
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
                      <div className="text-2xl font-bold text-red-500">
                        {stats.absent}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              {/* Row 2: Duty & Special Leaves */}
              <div className="grid grid-cols-2 gap-4 flex-1">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.3 }}
                  className="h-full"
                >
                  <Card className="h-full custom-container flex flex-col justify-center">
                    <CardHeader className="pb-1">
                      <CardTitle className="text-sm font-medium">Duty Leaves</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-yellow-500">
                        {stats.dutyLeave}
                      </div>
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
                      <div className="text-2xl font-bold text-teal-400">
                        {stats.otherLeave}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              {/* Row 3: Total Courses */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.5 }}
                className="flex-1"
              >
                {/* FIXED: Removed justify-center to allow header to be top-aligned visible */}
                <Card className="h-full custom-container flex flex-col">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Total Courses
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {coursesData?.courses
                        ? Object.keys(coursesData.courses).length
                        : 0}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

            </div>
          </div>
        </div>

        {/* SECTION 3: Courses Lineup - UPDATED SORTING */}
        <div className="mb-6 mt-10"> {/* ADDED mt-10 for more space */}
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
              Array(6)
                .fill(0)
                .map((_, i) => (
                  <Card key={i} className="overflow-hidden">
                    <CardHeader className="p-0">
                      <Skeleton className="h-40 w-full rounded-none" />
                    </CardHeader>
                    <CardContent className="p-6">
                      <Skeleton className="h-6 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-1/2" />
                    </CardContent>
                  </Card>
                ))
            ) : sortedCourses.length > 0 ? (
              sortedCourses.map((course: any) => (
                <div key={course.id}>
                  <CourseCard course={course} />
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-8 bg-accent/50 rounded-xl border-2 border-accent-foreground/12">
                <p className="text-muted-foreground">
                  No courses found for this semester
                </p>
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
                <div className="flex items-center justify-center h-[200px]">
                  <CompLoading />
                </div>
              ) : attendanceData ? (
                <AttendanceCalendar attendanceData={attendanceData} />
              ) : (
                <div className="flex items-center justify-center h-[200px]">
                  <p className="text-muted-foreground">
                    No attendance data available
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* SECTION 5: Instructor Details */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6"
        >
          <Card className="custom-container">
            <CardHeader className="flex flex-col gap-0.5">
              <CardTitle className="text-[16px]">Instructor Details</CardTitle>
              <CardDescription className="text-accent-foreground/60 text-sm">
                Get to know your instructors
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingCourses ? (
                <div className="flex items-center justify-center h-[200px]">
                  <CompLoading />
                </div>
              ) : coursesData?.courses &&
                Object.keys(coursesData.courses).length > 0 ? (
                <div className="rounded-md custom-container overflow-clip">
                  {/* CHANGED: Removed ScrollArea, used simple div with overflow-auto for horizontal scroll if needed, vertical is auto */}
                  <div className="w-full overflow-auto">
                    <table className="w-full caption-bottom text-sm">
                      <thead className="relative">
                        <tr className="border-b-2 border-[#2B2B2B]/[0.6]">
                          <th className="h-10 px-4 text-left font-medium text-muted-foreground bg-[rgb(31,31,32)]">
                            Course
                          </th>
                          <th className="h-10 px-4 text-left font-medium text-muted-foreground bg-[rgb(31,31,32)]">
                            Instructor
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {Object.entries(coursesData.courses).map(
                          ([courseId, course]: [string, any]) => {
                            const instructors =
                              course.institution_users?.filter(
                                (user: any) => user.pivot.courserole_id === 1
                              ) || [];

                            return instructors.length > 0 ? (
                              instructors.map(
                                (instructor: any, index: number) => (
                                  <tr
                                    key={`${courseId}-${instructor.id}`}
                                    className="group transition-colors border-[#2B2B2B]/[0.8]"
                                    data-course-id={courseId}
                                    onMouseEnter={() => {
                                      document
                                        .querySelectorAll(
                                          `tr[data-course-id="${courseId}"]`
                                        )
                                        .forEach((row) => {
                                          row.classList.add("bg-muted/25");
                                        });
                                    }}
                                    onMouseLeave={() => {
                                      document
                                        .querySelectorAll(
                                          `tr[data-course-id="${courseId}"]`
                                        )
                                        .forEach((row) => {
                                          row.classList.remove("bg-muted/25");
                                        });
                                    }}
                                  >
                                    {index === 0 ? (
                                      <td
                                        className="p-4 align-top"
                                        rowSpan={instructors.length}
                                      >
                                        <div className="font-medium">
                                          {course.code}
                                        </div>
                                        <div className="text-sm text-muted-foreground capitalize">
                                          {course.name.toLowerCase()}
                                        </div>
                                        {instructors.length > 1 && (
                                          <div className="mt-2">
                                            <span className="inline-flex items-center rounded-full border px-2 min-h-5 pt-[0.05px] justify-center text-xs font-semibold bg-blue-50/3 text-white/60 border-[#2B2B2B]/[0.8]">
                                              {instructors.length} instructors
                                            </span>
                                          </div>
                                        )}
                                      </td>
                                    ) : null}
                                    <td className="p-4">
                                      <div className="font-medium">
                                        {instructor.first_name}{" "}
                                        {instructor.last_name}
                                      </div>
                                    </td>
                                  </tr>
                                )
                              )
                            ) : (
                              <tr
                                key={courseId}
                                className="hover:bg-muted/50 transition-colors"
                              >
                                <td className="p-4">
                                  <div className="font-medium">
                                    {course.code}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {course.name}
                                  </div>
                                </td>
                                <td className="p-4 text-muted-foreground italic">
                                  No instructor assigned
                                </td>
                              </tr>
                            );
                          }
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[200px]">
                  <p className="text-muted-foreground">
                    No faculty information available
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Confirmation Dialog */}
        <AlertDialog
          open={showConfirmDialog}
          onOpenChange={setShowConfirmDialog}
        >
          <AlertDialogContent className="custom-container">
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Change</AlertDialogTitle>
              <AlertDialogDescription>
                You are about to change the{" "}
                {pendingChange?.type === "semester"
                  ? "semester"
                  : "academic year"}
                {". "}
                Are you sure you want to continue?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={handleCancelChange}
                className="custom-button"
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmChange}
                className="custom-button bg-primary! border-accent-foreground!"
              >
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
}