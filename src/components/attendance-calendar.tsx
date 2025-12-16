"use client";
import Link from "next/link";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  ArrowUpRight,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SessionData, AttendanceEvent, Session, Course } from "@/types";
import { useUser } from "@/hooks/users/user";
import axios from "axios";
import { getToken } from "@/utils/auth";
import { toast } from "sonner";
import { useTrackingData } from "@/hooks/tracker/useTrackingData";
import { useFetchSemester, useFetchAcademicYear } from "@/hooks/users/settings";
import { useTrackingCount } from "@/hooks/tracker/useTrackingCount";

interface AttendanceData {
  studentAttendanceData?: Record<string, Record<string, SessionData>>;
  courses?: Record<string, Course>;
  sessions?: Record<string, Session>;
}

interface AttendanceCalendarProps {
  attendanceData: AttendanceData | undefined;
}

export function AttendanceCalendar({
  attendanceData,
}: AttendanceCalendarProps) {
  const [currentYear, setCurrentYear] = useState<number>(
    new Date().getFullYear()
  );
  const [currentMonth, setCurrentMonth] = useState<number>(
    new Date().getMonth()
  );
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>(
    {}
  );

  const clickedButtons = useRef<Set<string>>(new Set());

  const { data: semester } = useFetchSemester();
  const { data: year } = useFetchAcademicYear();

  const accessToken = getToken();
  const { data: user } = useUser();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { data: count, refetch: refetchCount } = useTrackingCount(
    user,
    accessToken
  );
  const { data: trackingData, refetch: refetchTrackData } = useTrackingData(
    user,
    accessToken
  ); //hook to get tracking data
  useEffect(() => {
    const dateSelected = sessionStorage.getItem("selected_date");
    if (dateSelected) {
      const parsedDate = new Date(dateSelected);
      setSelectedDate(parsedDate);
      setCurrentMonth(parsedDate.getMonth());
      setCurrentYear(parsedDate.getFullYear());
    } else {
      const today = new Date();
      setSelectedDate(today);
      setCurrentMonth(today.getMonth());
      setCurrentYear(today.getFullYear());
    }
  }, []);

  //function to write tracking data to supabase
  const handleWriteTracking = async (
    userId: number,
    username: string,
    sessionTitle: string,
    date: string,
    status: string,
    sessionName: string
  ) => {
    // Create a unique key for this button
    const buttonKey = `${sessionTitle}-${date}-${sessionName}`;

    // Set loading state for this specific button
    setLoadingStates((prev) => ({ ...prev, [buttonKey]: true }));

    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_SUPABASE_API_URL}/add-to-tracking`,
        {
          id: userId,
          username,
          course: sessionTitle,
          date,
          status,
          session: sessionName,
          semester,
          year,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (response.data.success) {
        toast.success("Added to tracking", {
          style: {
            backgroundColor: "rgba(34, 197, 94, 0.1)",
            color: "rgb(74, 222, 128)",
            border: "1px solid rgba(34, 197, 94, 0.2)",
            backdropFilter: "blur(5px)",
          },
        });
        await refetchTrackData();
        await refetchCount();
      }
      if (response.data.error) {
        toast.error(response.data.error.toString(), {
          style: {
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            color: "rgb(248, 113, 113)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
            backdropFilter: "blur(5px)",
          },
        });
      }
    } catch (error) {
      // Axios errors have a response property
      if (axios.isAxiosError(error) && error.response) {
        // Try to get the error message from server response
        const serverMessage =
          error.response.data?.error || "Unknown server error";
        toast.error(serverMessage, {
          style: {
            backgroundColor: "rgba(239, 68, 68, 0.1)", // red-500/10
            color: "rgb(248, 113, 113)", // red-400
            border: "1px solid rgba(239, 68, 68, 0.2)", // red-500/20
            backdropFilter: "blur(5px)",
          },
        });
      } else {
        // Other errors (network, etc.)
        toast.error(error.message, {
          style: {
            backgroundColor: "rgba(239, 68, 68, 0.1)", // red-500/10
            color: "rgb(248, 113, 113)", // red-400
            border: "1px solid rgba(239, 68, 68, 0.2)", // red-500/20
            backdropFilter: "blur(5px)",
          },
        });
      }
    } finally {
      // Reset loading state for this specific button
      setLoadingStates((prev) => ({ ...prev, [buttonKey]: false }));
      clickedButtons.current?.delete(buttonKey);
    }
  };

  useEffect(() => {
    if (!attendanceData?.studentAttendanceData) return;

    const newEvents: AttendanceEvent[] = [];

    Object.entries(attendanceData.studentAttendanceData).forEach(
      ([dateStr, sessions]) => {
        const year = parseInt(dateStr.substring(0, 4), 10);
        const month = parseInt(dateStr.substring(4, 6), 10) - 1;
        const day = parseInt(dateStr.substring(6, 8), 10);

        Object.entries(sessions).forEach(([sessionKey, sessionData]) => {
          if (!sessionData.course) return;

          const courseId = sessionData.course.toString();
          const courseName =
            attendanceData.courses?.[courseId]?.name || "Unknown Course";

          const sessionInfo = attendanceData.sessions?.[sessionKey] || {
            name: `Session ${sessionKey}`,
          };
          const sessionName = sessionInfo.name;

          let attendanceStatus = "normal";
          let attendanceLabel = "Present";
          let statusColor = "blue";

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
              attendanceLabel = "Other Leave";
              statusColor = "teal";
              break;
          }

          const date = new Date(year, month, day);

          newEvents.push({
            title: courseName,
            date,
            sessionName,
            sessionKey,
            type: attendanceStatus,
            status: attendanceLabel,
            statusColor,
            courseId,
          });
        });
      }
    );

    setEvents(newEvents);
  }, [attendanceData]);

  const filteredEvents = useMemo(() => {
    if (filter === "all") return events;
    if (filter === "present")
      return events.filter((e) => e.status === "Present");
    if (filter === "absent") return events.filter((e) => e.status === "Absent");
    if (filter === "dutyLeave")
      return events.filter((e) => e.status === "Duty Leave");
    if (filter === "otherLeave")
      return events.filter((e) => e.status === "Other Leave");
    return events;
  }, [events, filter]);

  const handlePreviousMonth = () => {
    setCurrentMonth((prevMonth) => {
      if (prevMonth === 0) {
        const newYear = currentYear - 1;
        if (newYear >= 2018) {
          setCurrentYear(newYear);
        }
        return 11;
      }
      return prevMonth - 1;
    });
  };

  const handleNextMonth = () => {
    setCurrentMonth((prevMonth) => {
      if (prevMonth === 11) {
        const newYear = currentYear + 1;
        if (newYear <= new Date().getFullYear()) {
          setCurrentYear(newYear);
        }
        return 0;
      }
      return prevMonth + 1;
    });
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    setSelectedDate(today);
  };

  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const yearOptions = useMemo(() => {
    const currentYearNum = new Date().getFullYear();
    return Array.from(
      { length: currentYearNum + 1 - 2018 + 1 },
      (_, i) => 2018 + i
    );
  }, []);

  const getDaysInMonth = useCallback((year: number, month: number): number => {
    return new Date(year, month + 1, 0).getDate();
  }, []);

  const getFirstDayOfMonth = useCallback(
    (year: number, month: number): number => {
      return new Date(year, month, 1).getDay();
    },
    []
  );

  const isSameDay = useCallback((date1: Date, date2: Date): boolean => {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }, []);

  const isToday = useCallback(
    (date: Date): boolean => {
      const today = new Date();
      return isSameDay(date, today);
    },
    [isSameDay]
  );

  const getEventStatus = useCallback(
    (date: Date): string | null => {
      const dateEvents = filteredEvents.filter((event) =>
        isSameDay(event.date, date)
      );
      if (dateEvents.length === 0) return null;

      const hasAbsent = dateEvents.some((event) => event.status === "Absent");
      const hasPresent = dateEvents.some((event) => event.status === "Present");
      const hasDutyLeave = dateEvents.some(
        (event) => event.status === "Duty Leave"
      );
      const hasOtherLeave = dateEvents.some(
        (event) => event.status === "Other Leave"
      );

      if (hasAbsent) return "absent";
      if (hasOtherLeave) return "otherLeave";
      if (hasDutyLeave) return "dutyLeave";
      if (hasPresent) return "present";

      return "normal";
    },
    [filteredEvents, isSameDay]
  );

  const selectedDateEvents = useMemo(() => {
    const getDateEvents = (date: Date): AttendanceEvent[] => {
      return filteredEvents.filter((event) => isSameDay(event.date, date));
    };

    return getDateEvents(selectedDate) || [];
  }, [selectedDate, filteredEvents, isSameDay]);

  const formatSessionName = (sessionName: string): string => {
    const romanToOrdinal: Record<string, string> = {
      I: "1st hour",
      II: "2nd hour",
      III: "3rd hour",
      IV: "4th hour",
      V: "5th hour",
      VI: "6th hour",
      VII: "7th hour",
    };
    if (romanToOrdinal[sessionName]) {
      return romanToOrdinal[sessionName];
    }
    return sessionName;
  };

  const calendarCells = useMemo(() => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDayOfMonth = getFirstDayOfMonth(currentYear, currentMonth);

    const leadingEmptyCells = Array(firstDayOfMonth)
      .fill(null)
      .map((_, index) => (
        <div key={`empty-leading-${index}`} className="h-10 w-full" />
      ));

    const dayCells = Array(daysInMonth)
      .fill(null)
      .map((_, index) => {
        const date = new Date(currentYear, currentMonth, index + 1);
        const status = getEventStatus(date);
        const hasEvents =
          filteredEvents.filter((event) => isSameDay(event.date, date)).length >
          0;
        const isSelected = isSameDay(date, selectedDate);

        let className =
          "h-10 w-10 mx-auto rounded-full flex items-center justify-center text-sm cursor-pointer transition-all duration-200 hover:scale-104 ";

        if (isSelected) {
          className +=
            "bg-primary text-primary-foreground font-medium shadow-lg scale-110";
        } else if (status === "absent") {
          className +=
            "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30";
        } else if (status === "otherLeave") {
          className +=
            "bg-teal-500/20 text-teal-400 hover:bg-teal-500/30 border border-teal-500/30";
        } else if (status === "dutyLeave") {
          className +=
            "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border border-yellow-500/30";
        } else if (status === "present") {
          className +=
            "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30";
        } else if (hasEvents) {
          className += "ring-1 ring-gray-500/30 hover:ring-gray-500/50";
        } else {
          className += "hover:bg-accent/50";
        }

        if (isToday(date)) {
          className +=
            " ring-2 ring-offset-1 ring-offset-background ring-primary";
        }

        return (
          <div
            key={`day-${index}`}
            className="flex items-center justify-center"
            onClick={() => {
              const dateString = date.toISOString();
              sessionStorage.setItem("selected_date", dateString);
              setSelectedDate(date);
              setCurrentMonth(date.getMonth());
              setCurrentYear(date.getFullYear());
            }}
          >
            <div className={className}>{index + 1}</div>
          </div>
        );
      });

    return [...leadingEmptyCells, ...dayCells];
  }, [
    currentYear,
    currentMonth,
    selectedDate,
    filteredEvents,
    getDaysInMonth,
    getFirstDayOfMonth,
    getEventStatus,
    isSameDay,
    isToday,
  ]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <Card className="overflow-hidden border border-border/40 shadow-md backdrop-blur-sm custom-container">
        <CardHeader className="pb-2 flex flex-row items-center justify-between max-sm:justify-center space-y-0 border-b border-border/40 calendar-trouble">
          <div className="flex items-center gap-2 max-md:flex-wrap max-md:justify-center">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[130px] h-9 bg-background/60 border-border/60 text-sm capitalize custom-dropdown">
                <SelectValue>
                  {filter === "all"
                    ? "All"
                    : filter.charAt(0).toUpperCase() + filter.slice(1)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-background/90 border-border/60 backdrop-blur-md custom-dropdown max-h-70">
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="present">Present</SelectItem>
                <SelectItem value="absent">Absent</SelectItem>
                <SelectItem value="dutyLeave">Duty Leave</SelectItem>
                <SelectItem value="otherLeave">Other Leave</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={currentMonth.toString()}
              onValueChange={(value) => setCurrentMonth(parseInt(value, 10))}
            >
              <SelectTrigger className="w-[130px] h-9 bg-background/60 border-border/60 text-sm capitalize custom-dropdown">
                <SelectValue>{monthNames[currentMonth]}</SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-background/90 border-border/60 backdrop-blur-md custom-dropdown max-h-70">
                {monthNames.map((month, index) => (
                  <SelectItem
                    key={month}
                    value={index.toString()}
                    className={
                      currentMonth === index
                        ? "bg-white/5 mt-0.5"
                        : "capitalize"
                    }
                  >
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={currentYear.toString()}
              onValueChange={(value) => {
                const newYear = parseInt(value, 10);
                if (newYear >= 2018 && newYear <= new Date().getFullYear()) {
                  setCurrentYear(newYear);
                }
              }}
            >
              <SelectTrigger className="w-[90px] h-9 bg-background/60 border-border/60 text-sm custom-dropdown">
                <SelectValue>{currentYear}</SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-background/90 border-border/60 max-h-70 backdrop-blur-md custom-dropdown">
                {yearOptions.map((year) => (
                  <SelectItem
                    key={year}
                    value={year.toString()}
                    className={
                      currentYear === year ? "bg-white/5 mt-0.5" : "mt-0.5"
                    }
                  >
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePreviousMonth}
              className="h-9 w-9 rounded-lg bg-accent/50 flex justify-center items-center"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNextMonth}
              className="h-9 w-9 rounded-lg bg-accent/50 flex justify-center items-center"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-7 mb-2">
            {daysOfWeek.map((day, index) => (
              <div
                key={index}
                className="text-xs font-medium text-muted-foreground text-center py-2"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 pb-2">{calendarCells}</div>

          <div className="flex flex-wrap gap-4 mt-6 text-muted-foreground text-xs justify-center border-t border-border/40 pt-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-red-500/20 border border-red-500/30" />
              <span>absent</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-teal-500/20 border border-teal-500/30" />
              <span>other leave</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-yellow-500/20 border border-yellow-500/30" />
              <span>duty leave</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-blue-500/20 border border-blue-500/30" />
              <span>present</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full outline-2 outline-primary" />
              <span>today</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. EVENTS LIST CARD */}
      <Card className="overflow-hidden border-border/40 shadow-sm bg-card/50 flex flex-col h-[500px] lg:h-auto">
        <CardHeader className="border-b border-border/40 py-4 px-6 bg-muted/20">
          <CardTitle className="text-sm flex items-center justify-between font-semibold">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-primary" />
              {selectedDate.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </div>
            <Badge variant="secondary" className="font-normal text-xs bg-background/80">
              {selectedDateEvents.length} Sessions
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 flex-1 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedDate.toString()}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="h-full absolute inset-0"
            >
              {selectedDateEvents.length > 0 ? (
                <ScrollArea className="h-full">
                  <div className="flex flex-col gap-3 p-4">
                    {selectedDateEvents.map((event, index) => {
                      // --- STATUS & STYLE LOGIC START ---
                      let badgeClass = "text-muted-foreground border-border";
                      let Icon = Clock;
                      
                      // Default Card Style
                      let cardStyle = "border-border/40 bg-card hover:bg-accent/30 hover:border-border/60";

                      if (event.status === "Present") {
                        badgeClass = "text-green-500 border-green-500/20 bg-green-500/10";
                        Icon = CheckCircle2;
                        // Green Effect
                        cardStyle = "border-green-500/50 bg-green-500/5 hover:bg-green-500/10 hover:border-green-500";
                      } else if (event.status === "Absent") {
                        badgeClass = "text-red-500 border-red-500/20 bg-red-500/10";
                        Icon = AlertCircle;
                        // Red Effect
                        cardStyle = "border-red-500/50 bg-red-500/5 hover:bg-red-500/10 hover:border-red-500"; 
                      } else if (event.status === "Duty Leave") {
                        badgeClass = "text-yellow-500 border-yellow-500/20 bg-yellow-500/10";
                        // CHANGE: Yellow Effect for Duty Leave
                        cardStyle = "border-yellow-500/50 bg-yellow-500/5 hover:bg-yellow-500/10 hover:border-yellow-500";
                      } else if (event.status.includes("Leave")) {
                        // Catch all for other leaves (Teal)
                        badgeClass = "text-teal-500 border-teal-500/20 bg-teal-500/10";
                        cardStyle = "border-teal-500/50 bg-teal-500/5 hover:bg-teal-500/10 hover:border-teal-500";
                      }
                      // --- STATUS & STYLE LOGIC END ---

                      const isTracked = trackingData?.some(
                        (data) =>
                          data.course === event.title &&
                          data.session === event.sessionName &&
                          data.date === event.date.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }) &&
                          data.semester === semester &&
                          data.year === year
                      );

                      const buttonKey = `${event.title}-${event.date.toISOString().split("T")[0]}-${event.sessionName}`;
                      const uniqueLoadingKey = `${event.title}-${event.date.toLocaleDateString('en-IN', {timeZone: 'Asia/Kolkata'})}-${event.sessionName}`;
                      const isLoading = loadingStates[uniqueLoadingKey];

                      return (
                        <motion.div
                          key={`event-${event.sessionKey}-${index}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className={`group flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border transition-all gap-4 ${cardStyle}`}
                        >
                          {/* Info */}
                          <div className="flex flex-col gap-1.5">
                            <h4 className="font-semibold text-sm text-foreground leading-tight capitalize">
                              {event.title.toLowerCase()}
                            </h4>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="bg-background/50 px-1.5 py-0.5 rounded border border-border/30">
                                {event.sessionName ? formatSessionName(event.sessionName) : `Session ${event.sessionKey}`}
                              </span>
                              <Badge variant="outline" className={`h-5 px-1.5 gap-1 font-medium ${badgeClass}`}>
                                <Icon className="w-3 h-3" />
                                {event.status}
                              </Badge>
                            </div>
                          </div>

                          {/* Action */}
                          {event.status === "Absent" && (
                            <div className="flex-shrink-0">
                              {isTracked ? (
                                <Link href="/tracking" className="w-full sm:w-auto">
                                  {/* CHANGE: Made button visible with background and outline */}
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="w-full h-8 text-xs gap-1.5 bg-green-500/10 border-green-500/30 text-green-500 hover:text-green-400 hover:bg-green-500/20 hover:border-green-500/50 transition-all"
                                  >
                                    <span>View Details</span>
                                    <ArrowUpRight className="w-3 h-3" />
                                  </Button>
                                </Link>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={isLoading}
                                  onClick={() => {
                                    if (clickedButtons.current?.has(buttonKey)) return;
                                    clickedButtons.current?.add(buttonKey);
                                    if (user?.id) {
                                      handleWriteTracking(
                                        user.id,
                                        user.username,
                                        event.title,
                                        event.date.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }),
                                        event.status,
                                        event.sessionName
                                      );
                                    }
                                  }}
                                  className={`w-full sm:w-auto h-8 text-xs gap-1.5 border-dashed transition-all
                                    ${isLoading ? "opacity-70 cursor-wait" : "hover:border-red-500/50 hover:text-red-500 hover:bg-red-500/5"}
                                  `}
                                >
                                  {isLoading ? (
                                    <>Loading...</>
                                  ) : (
                                    <>
                                      <Plus className="w-3.5 h-3.5" />
                                      Add to Tracking
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center px-6">
                  <div className="rounded-full bg-accent/30 p-4 mb-3 ring-1 ring-border/50">
                    <CalendarIcon className="h-6 w-6 text-muted-foreground/60" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">No Events Found</h3>
                  <p className="text-xs text-muted-foreground mt-1 mb-4 max-w-[200px]">
                    Enjoy your free time! No classes recorded for this date.
                  </p>
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={goToToday}>
                    Jump to Today
                  </Button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}