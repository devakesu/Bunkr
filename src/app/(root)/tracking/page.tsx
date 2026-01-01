"use client";

import { useState, useEffect, useMemo } from "react";
import { useTrackingData } from "@/hooks/tracker/useTrackingData";
import { useTrackingCount } from "@/hooks/tracker/useTrackingCount";
import { useUser } from "@/hooks/users/user";
import { getToken } from "@/utils/auth";
import { Badge } from "@/components/ui/badge";
import { Trash2, CircleAlert, ChevronLeft, ChevronRight, BookOpen } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";
import { LazyMotion, domAnimation, m, AnimatePresence } from "framer-motion";
import { useAttendanceReport } from "@/hooks/courses/attendance";
import { useFetchSemester, useFetchAcademicYear } from "@/hooks/users/settings";
import { Loading } from "@/components/loading";

const Tracking = () => {
  const { data: user } = useUser();
  const accessToken = getToken();
  const [deleteId, setDeleteId] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(0);
  
  const coursesPerPage = 3; 

  const [isProcessing, setIsProcessing] = useState(false);

  const { data: semester } = useFetchSemester();
  const { data: year } = useFetchAcademicYear();

  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (user) {
      setEnabled(true);
    }
  }, [user]);

  const {
    data: count,
    refetch: refetchCount,
  } = useTrackingCount(enabled ? user : null, enabled ? accessToken : null);

  const {
    data: trackingData,
    isLoading,
    refetch: refetchTrackingData,
  } = useTrackingData(enabled ? user : null, enabled ? accessToken : null);

  const [filteredAttendanceEvents, setFilteredAttendanceEvents] = useState<any[]>([]);
  const { data: attendanceData } = useAttendanceReport();

  // --- HELPERS FOR SORTING & FORMATTING ---

  const formatSessionName = (sessionName: string): string => {
    const romanToOrdinal: Record<string, string> = {
      I: "1st hour", II: "2nd hour", III: "3rd hour",
      IV: "4th hour", V: "5th hour", VI: "6th hour", VII: "7th hour",
    };
    return romanToOrdinal[sessionName] || sessionName;
  };

  // Ensure DD/MM/YYYY format for Display
  const formatDisplayDate = (dateStr: string): string => {
    if (!dateStr) return "";
    if (dateStr.includes("/")) return dateStr; // Already DD/MM/YYYY
    if (dateStr.includes("-")) {
      const parts = dateStr.split("-");
      // Handle YYYY-MM-DD -> DD/MM/YYYY
      if (parts[0].length === 4) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      // Handle DD-MM-YYYY -> DD/MM/YYYY
      return `${parts[0]}/${parts[1]}/${parts[2]}`;
    }
    return dateStr;
  };

  // Robust Date Parsing for Sorting
  const parseDateValue = (dateStr: string) => {
    if (!dateStr) return 0;
    // Handle DD/MM/YYYY
    if (dateStr.includes('/')) {
        const [d, m, y] = dateStr.split('/');
        return new Date(`${y}-${m}-${d}`).getTime();
    }
    // Handle DD-MM-YYYY
    if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts[0].length === 4) return new Date(dateStr).getTime(); // YYYY-MM-DD
        return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime(); // DD-MM-YYYY
    }
    return new Date(dateStr).getTime();
  };

  // Extract number from session string (e.g. "1st Hour" -> 1, "Session 220" -> 220)
  const getSessionNumber = (name: string): number => {
    if (!name) return 999;
    const clean = name.toString().toLowerCase().replace(/session/g, "").replace(/hour/g, "").trim();
    
    // Roman numerals fallback
    const map: Record<string, number> = { "i": 1, "ii": 2, "iii": 3, "iv": 4, "v": 5, "vi": 6, "vii": 7, "viii": 8 };
    if (map[clean]) return map[clean];

    const numbers = name.match(/\d+/);
    if (numbers) return parseInt(numbers[0], 10);
    return 999;
  };

  // --- 1. GROUP AND SORT DATA ---
  const groupedAllData = useMemo(() => {
    if (!trackingData) return {};
    
    const grouped: Record<string, typeof trackingData> = {};

    trackingData.forEach((item) => {
      const courseKey = item.course.trim();
      if (!grouped[courseKey]) {
        grouped[courseKey] = [];
      }
      grouped[courseKey].push(item);
    });

    // Sort items within each course
    Object.keys(grouped).forEach(key => {
        grouped[key].sort((a, b) => {
            // 1. Sort by Date (Descending - Newest First)
            const dateA = parseDateValue(a.date);
            const dateB = parseDateValue(b.date);
            if (dateA !== dateB) return dateB - dateA;

            // 2. Sort by Session Number (Ascending - 1st before 2nd)
            const sessionA = getSessionNumber(a.session);
            const sessionB = getSessionNumber(b.session);
            return sessionA - sessionB;
        });
    });

    return grouped;
  }, [trackingData]);

  const allCourseKeys = useMemo(() => Object.keys(groupedAllData).sort(), [groupedAllData]);
  const totalPages = Math.ceil(allCourseKeys.length / coursesPerPage);

  const currentCourseKeys = useMemo(() => {
    const startIndex = currentPage * coursesPerPage;
    return allCourseKeys.slice(startIndex, startIndex + coursesPerPage);
  }, [currentPage, allCourseKeys, coursesPerPage]);


  const goToPrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleDeleteTrackData = async (
    username: string, session: string, course: string, date: string
  ) => {
    const deletingId = `${username}-${session}-${course}-${date}`;
    setDeleteId(deletingId);

    try {
      const res = await axios.post(
        process.env.NEXT_PUBLIC_SUPABASE_API_URL + "/delete-tracking-data",
        { username, session, course, date },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      if (res.data.success) {
        toast.success("Delete successful");
      } else {
        toast.error("Error deleting the record");
      }
      await Promise.all([refetchTrackingData(), refetchCount()]);
    } catch (error) {
      toast.error("Network error occurred");
    } finally {
      setDeleteId("");
    }
  };

  // --- OPTIMIZED FILTER LOGIC ---
  useEffect(() => {
    if (!attendanceData?.studentAttendanceData || !trackingData) return;

    const newFilteredEvents: any[] = [];
    
    const normalizeToYMD = (dateStr: string): string => {
      if (!dateStr) return "";
      if (dateStr.includes("-")) {
          // If YYYY-MM-DD leave as is
          if (dateStr.split('-')[0].length === 4) return dateStr;
          // If DD-MM-YYYY convert to YYYY-MM-DD
          const [dd, mm, yyyy] = dateStr.split('-');
          return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
      }
      if (dateStr.includes("/")) {
        const [dd, mm, yyyy] = dateStr.split("/");
        if (dd && mm && yyyy) return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
      }
      return dateStr;
    };

    const trackingMap = new Map();
    trackingData.forEach(item => {
        const c = (item.course || "").toLowerCase().trim();
        const s = (item.session || "").toLowerCase().trim();
        const d = normalizeToYMD(item.date);
        const uniqueKey = `${c}_${s}_${d}`;
        trackingMap.set(uniqueKey, item);
    });

    Object.entries(attendanceData.studentAttendanceData).forEach(
      ([dateStr, sessions]) => {
        // Handle YYYYMMDD string from attendance data
        const dateYear = parseInt(dateStr.substring(0, 4), 10);
        const month = parseInt(dateStr.substring(4, 6), 10) - 1;
        const day = parseInt(dateStr.substring(6, 8), 10);
        
        const formattedDate = `${dateYear}-${String(month + 1).padStart(2,"0")}-${String(day).padStart(2, "0")}`;

        Object.entries(sessions).forEach(([sessionKey, sessionData]) => {
          if (!sessionData.course) return;

          const courseId = sessionData.course.toString();
          const courseInfo = attendanceData.courses?.[courseId];
          const courseName = courseInfo?.name || "Unknown Course";
          const sessionName = attendanceData.sessions?.[sessionKey]?.name || `Session ${sessionKey}`;

          const lookupKey = `${courseName.toLowerCase().trim()}_${sessionName.toLowerCase().trim()}_${formattedDate}`;
          const matchingTrackingItem = trackingMap.get(lookupKey);

          if (matchingTrackingItem) {
            let attendanceStatus = "normal";
            let attendanceLabel = "Absent";
            let statusColor = "red";

            switch (sessionData.attendance) {
              case 110: 
                attendanceStatus = "normal"; 
                attendanceLabel = "Present"; 
                statusColor = "blue"; 
                break;
              case 111: 
                attendanceStatus = "important"; 
                attendanceLabel = "Absent"; 
                statusColor = "red"; 
                break;
              case 225: 
                attendanceStatus = "normal"; 
                attendanceLabel = "Duty Leave"; 
                statusColor = "yellow"; 
                break;
              case 112: 
                attendanceStatus = "important"; 
                attendanceLabel = "Leave"; 
                statusColor = "teal"; 
                break;
              default:
                attendanceStatus = "normal"; 
                attendanceLabel = "Unknown"; 
                statusColor = "gray";
            }

            newFilteredEvents.push({
              title: courseName,
              date: formattedDate,
              sessionName,
              sessionKey,
              type: attendanceStatus,
              status: attendanceLabel, 
              statusColor,
              courseId,
              username: matchingTrackingItem.username,
              trackingId: `${matchingTrackingItem.username}-${matchingTrackingItem.session}-${matchingTrackingItem.course}-${matchingTrackingItem.date}`,
              semester: matchingTrackingItem.semester,
              year: matchingTrackingItem.year,
              matchesCurrent: matchingTrackingItem.semester === semester && matchingTrackingItem.year === year,
            });
          }
        });
      }
    );
    setFilteredAttendanceEvents(newFilteredEvents);
  }, [attendanceData, trackingData, semester, year]);

  const deleteAllTrackingData = async () => {
    try {
      setIsProcessing(true);
      await axios.post(
        `${process.env.NEXT_PUBLIC_SUPABASE_API_URL}/delete-records-of-users`,
        { username: user?.username },
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      await refetchTrackingData();
      await refetchCount();
      setCurrentPage(0);
      toast.success("All records cleared");
    } catch {
      toast.error("Failed to delete all tracking data");
    } finally {
      setIsProcessing(false);
    }
  };

  const cardVariants = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 }, exit: { opacity: 0, scale: 0.95 } };
  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.3, staggerChildren: 0.05 } } };
  const pageVariants = { enter: (d: number) => ({ x: d > 0 ? 50 : -50, opacity: 0 }), center: { x: 0, opacity: 1 }, exit: (d: number) => ({ x: d < 0 ? 50 : -50, opacity: 0 }) };

  if (isLoading) return <div className="h-screen"><Loading /></div>;

  return isProcessing ? (
    <div className="h-screen"><Loading /></div>
  ) : (
    <LazyMotion features={domAnimation}>
      <div className="flex flex-1 flex-col flex-wrap gap-4 h-full p-4 md:p-6 min-h-[70vh] text-center relative">
        {trackingData && trackingData.length > 0 ? (
          <>
            <div className="mb-2 pb-4 mt-10">
              <p className="text-2xl font-semibold text-foreground py-2 max-md:text-xl">
                Attendance Tracker
              </p>
              <p className="text-sm text-muted-foreground max-md:text-xs mb-4">
                These are custom-marked attendance records or the absences you&apos;ve marked for re-checking or duty leave.
              </p>
              {(count ?? 0) > 0 && (
                <div className="flex flex-col gap-2 items-center justify-center">
                  <Badge className="text-sm py-1 px-3 bg-yellow-500/12 text-yellow-400/75 border-yellow-500/15">
                    You have added <strong>{count}</strong> {count === 1 ? "class" : "classes"}.
                  </Badge>
                  <button onClick={deleteAllTrackingData} className="text-sm cursor-pointer justify-between items-center gap-2 bg-red-500/12 text-red-400/75 hover:bg-red-500/18 duration-300 border-1 border-red-500/15 py-1 px-3 rounded-md flex">
                    Clear all <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>

            <m.div variants={containerVariants} initial="hidden" animate="visible" className="flex flex-col gap-4 relative w-full max-w-[700px] mx-auto">
              <AnimatePresence mode="wait" initial={false} custom={currentPage > 0 ? -1 : 1}>
                <m.div key={currentPage} custom={currentPage} initial="enter" animate="center" exit="exit" variants={pageVariants} transition={{ type: "tween", duration: 0.3 }} className="flex flex-col gap-6">
                  
                  {currentCourseKeys.map((courseName) => {
                    const items = groupedAllData[courseName];

                    return (
                      <div key={courseName} className="flex flex-col gap-3">
                        <div className="flex items-center gap-2 pl-1 sticky top-0 bg-background/95 backdrop-blur z-10 py-2">
                          <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                            <BookOpen size={16} />
                          </div>
                          <h3 className="text-md font-semibold text-left text-foreground/90 capitalize">
                            {courseName.toLowerCase()}
                          </h3>
                          <Badge variant="outline" className="ml-auto text-xs">{items.length}</Badge>
                        </div>

                        <div className="flex flex-col gap-3">
                          {items.map((trackingItem) => {
                            const trackingId = `${trackingItem.username}-${trackingItem.session}-${trackingItem.course}-${trackingItem.date}`;
                            const matchingEvent = filteredAttendanceEvents.find(e => e.trackingId === trackingId);

                            // --- LOGIC ---
                            const attCode = trackingItem.attendance;
                            let userTargetLabel = "Present";
                            let userTargetColor = "blue";

                            if (attCode === 225) { 
                                userTargetLabel = "Duty Leave"; 
                                userTargetColor = "yellow"; 
                            } else if (attCode === 111) { 
                                userTargetLabel = "Absent"; 
                                userTargetColor = "red"; 
                            }

                            let statusLabel = "Pending";
                            let statusColor = "gray"; 
                            let isVerified = false;
                            
                            // Check if official record exists
                            const isCorrection = !!matchingEvent; 

                            if (isCorrection) {
                                statusLabel = matchingEvent.status; 
                                statusColor = matchingEvent.statusColor; 
                                
                                if (statusLabel === "Present" || statusLabel === "Duty Leave") isVerified = true;
                                if (attCode === 111 && statusLabel === "Absent") isVerified = true;
                            } else {
                                statusLabel = "Pending";
                                statusColor = userTargetColor; 
                            }

                            const colorClass = {
                              red: "bg-red-500/10 border-red-500/30 text-red-400",
                              blue: "bg-blue-500/10 border-blue-500/30 text-blue-400",
                              yellow: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400",
                              teal: "bg-teal-500/10 border-teal-500/30 text-teal-400",
                              gray: "bg-muted/50 border-border text-muted-foreground",
                            }[statusColor] || "bg-muted/50 border-border text-muted-foreground";

                            const badgeColorClass = statusLabel === "Pending" 
                                ? (userTargetColor === "blue" ? "bg-blue-500/20 text-blue-400" 
                                  : userTargetColor === "yellow" ? "bg-yellow-500/20 text-yellow-400"
                                  : "bg-red-500/20 text-red-400")
                                : (statusLabel === "Present" ? "bg-blue-500/20 text-blue-400" 
                                  : statusLabel === "Absent" ? "bg-red-500/20 text-red-400" 
                                  : statusLabel === "Duty Leave" ? "bg-yellow-500/20 text-yellow-400" 
                                  : "bg-gray-500/20 text-gray-400");
                            
                            const typeLabel = isCorrection ? "Correction" : "Extra";
                            const typeColorClass = isCorrection 
                                ? "bg-purple-500/10 text-purple-400 border-purple-500/20" 
                                : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";

                            return (
                              <m.div key={trackingId} variants={cardVariants} layout className={`p-4 text-left rounded-xl border hover:bg-opacity-20 ${colorClass} transition-all w-full`}>
                                <div className="flex justify-between items-start mb-2 gap-4">
                                  <div className="font-medium text-sm text-foreground/70">
                                    Session: <span className="text-foreground capitalize">{formatSessionName(trackingItem.session)}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {(trackingItem.semester !== semester || trackingItem.year !== year) && (
                                      <Badge className="bg-orange-500/20 text-orange-400 text-sm">≠</Badge>
                                    )}
                                    
                                    <Badge variant="outline" className={`text-[10px] px-1.5 h-5 ${typeColorClass}`}>
                                        {typeLabel}
                                    </Badge>

                                    <Badge className={badgeColorClass}>
                                      {statusLabel === "Pending" 
                                        ? `${userTargetLabel === "Duty Leave" ? "DL" : userTargetLabel} - Not Updated` 
                                        : isVerified 
                                          ? `${statusLabel} - Verified` 
                                          : `${statusLabel} - Not updated to ${userTargetLabel === "Duty Leave" ? "DL" : userTargetLabel}`
                                      }
                                    </Badge>
                                  </div>
                                </div>
                                <div className="text-xs text-muted-foreground flex items-center justify-between mt-2">
                                  {/* --- FORMATTED DATE --- */}
                                  <span className="font-medium">{formatDisplayDate(trackingItem.date)}</span>
                                  
                                  <m.button 
                                    whileHover={{ scale: 1.05 }} 
                                    whileTap={{ scale: 0.95 }} 
                                    disabled={deleteId === trackingId}
                                    onClick={() => handleDeleteTrackData(trackingItem.username, trackingItem.session, trackingItem.course, trackingItem.date)} 
                                    className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 bg-yellow-400/6 rounded-lg font-medium text-yellow-600 disabled:opacity-50"
                                  >
                                    {deleteId === trackingId ? "Deleting..." : <><span className="max-md:hidden">Remove</span><Trash2 size={15} /></>}
                                  </m.button>
                                </div>
                              </m.div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </m.div>
              </AnimatePresence>

              {totalPages > 1 && (
                <div className="flex justify-center items-center mt-6 gap-8 pb-8">
                  <m.button onClick={goToPrevPage} disabled={currentPage === 0} className={`h-8 w-8 flex justify-center items-center rounded-lg ${currentPage === 0 ? "text-muted-foreground bg-accent/30" : "text-primary bg-accent hover:bg-accent/40"}`}><ChevronLeft size={20} /></m.button>
                  <div className="text-sm text-muted-foreground font-medium">Page {currentPage + 1} of {totalPages}</div>
                  <m.button onClick={goToNextPage} disabled={currentPage === totalPages - 1} className={`h-8 w-8 flex justify-center items-center rounded-lg ${currentPage === totalPages - 1 ? "text-muted-foreground bg-accent/30" : "text-primary bg-accent hover:bg-accent/40"}`}><ChevronRight size={20} /></m.button>
                </div>
              )}
            </m.div>
          </>
        ) : (
          <m.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center flex-1">
            <div className="rounded-full p-2 mb-4 bg-amber-500/6 text-amber-500"><CircleAlert className="w-6 h-6" /></div>
            <h3 className="text-lg font-medium">No Records Found</h3>
            <p className="text-sm text-muted-foreground">You haven&apos;t added any attendance records yet.</p>
          </m.div>
        )}
      </div>
    </LazyMotion>
  );
};

export default Tracking;