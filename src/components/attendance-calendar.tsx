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
  Briefcase,
  Sparkles,
  Trash2,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AttendanceReport, AttendanceEvent } from "@/types/attendance";
import { useUser } from "@/hooks/users/user";
import axios from "axios";
import { getToken } from "@/utils/auth";
import { toast } from "sonner";
import { useTrackingData } from "@/hooks/tracker/useTrackingData";
import { useFetchSemester, useFetchAcademicYear } from "@/hooks/users/settings";
import { useTrackingCount } from "@/hooks/tracker/useTrackingCount";

interface AttendanceCalendarProps {
  attendanceData: AttendanceReport | undefined;
}

interface ExtendedAttendanceEvent extends AttendanceEvent {
  isExtra?: boolean;
  remarks?: string;
  rawSession?: string; 
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
  const [events, setEvents] = useState<ExtendedAttendanceEvent[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

  const clickedButtons = useRef<Set<string>>(new Set());

  const { data: semester } = useFetchSemester();
  const { data: year } = useFetchAcademicYear();

  const accessToken = getToken();
  const { data: user } = useUser();
  const { data: count, refetch: refetchCount } = useTrackingCount(
    user,
    accessToken
  );
  const { data: trackingData, refetch: refetchTrackData } = useTrackingData(
    user,
    accessToken
  );

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

  const formatDateForDB = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const handleDeleteTrackData = async (
    username: string, 
    session: string, 
    course: string, 
    date: string
  ) => {
    const buttonKey = `delete-${username}-${session}-${course}-${date}`;
    setLoadingStates((prev) => ({ ...prev, [buttonKey]: true }));

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
        toast.success("Record deleted");
        await Promise.all([refetchTrackData(), refetchCount()]);
      } else {
        toast.error(res.data.error || "Error deleting the record");
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Network error occurred");
    } finally {
      setLoadingStates((prev) => ({ ...prev, [buttonKey]: false }));
    }
  };

  const handleWriteTracking = async (
    userId: number,
    username: string,
    sessionTitle: string,
    dateStr: string,
    status: string,
    sessionName: string,
    attendanceCode: number, 
    remarks: string         
  ) => {
    const buttonKey = `${sessionTitle}-${dateStr}-${sessionName}`;
    setLoadingStates((prev) => ({ ...prev, [buttonKey]: true }));

    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_SUPABASE_API_URL}/add-to-tracking`,
        {
          id: userId,
          username,
          course: sessionTitle,
          date: dateStr,
          status, 
          session: sessionName,
          semester,
          year,
          attendance: attendanceCode, 
          remarks: remarks,           
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
        toast.error(response.data.error.toString());
      }
    } catch (error: any) {
       toast.error("Failed to add record");
    } finally {
      setLoadingStates((prev) => ({ ...prev, [buttonKey]: false }));
      clickedButtons.current?.delete(buttonKey);
    }
  };

  const getSessionNumber = useCallback((name: string): number => {
    if (!name) return 999;
    const clean = name.toString().toLowerCase().replace(/session/g, "").replace(/hour/g, "").trim();
    const map: Record<string, number> = {
        "i": 1, "ii": 2, "iii": 3, "iv": 4, "v": 5, "vi": 6, "vii": 7, "viii": 8,
        "first": 1, "second": 2, "third": 3, "fourth": 4, "fifth": 5,
        "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8
    };
    if (map[clean]) return map[clean];
    const numbers = name.match(/\d+/);
    if (numbers) return parseInt(numbers[0], 10);
    return 999;
  }, []);

  const derivedTimetable = useMemo(() => {
    if (!attendanceData?.studentAttendanceData) return {};
    const schedule: Record<number, Record<string, number>> = {};

    Object.entries(attendanceData.studentAttendanceData).forEach(([dateStr, sessions]) => {
        const y = parseInt(dateStr.substring(0, 4));
        const m = parseInt(dateStr.substring(4, 6)) - 1;
        const d = parseInt(dateStr.substring(6, 8));
        const dayIdx = new Date(y, m, d).getDay();

        if (!schedule[dayIdx]) schedule[dayIdx] = {};

        Object.values(sessions).forEach((s: any) => {
            if (!s.course) return;
            const courseId = String(s.course);
            const name = s.session || "";
            const num = getSessionNumber(name);
            if (num > 0 && num < 10) {
                if (!schedule[dayIdx][courseId] || num < schedule[dayIdx][courseId]) {
                    schedule[dayIdx][courseId] = num;
                }
            }
        });
    });
    return schedule;
  }, [attendanceData, getSessionNumber]);

  const formatSessionName = (sessionName: string): string => {
    const clean = sessionName.toString().replace(/Session/gi, "").trim();
    const ordinalMap: Record<string, string> = {
      "I": "1st Hour", "1st": "1st Hour", "1": "1st Hour",
      "II": "2nd Hour", "2nd": "2nd Hour", "2": "2nd Hour",
      "III": "3rd Hour", "3rd": "3rd Hour", "3": "3rd Hour",
      "IV": "4th Hour", "4th": "4th Hour", "4": "4th Hour",
      "V": "5th Hour", "5th": "5th Hour", "5": "5th Hour",
      "VI": "6th Hour", "6th": "6th Hour", "6": "6th Hour",
      "VII": "7th Hour", "7th": "7th Hour", "7": "7th Hour",
      "VIII": "8th Hour", "8th": "8th Hour", "8": "8th Hour",
    };
    if (ordinalMap[clean] || ordinalMap[clean.toUpperCase()]) {
        return ordinalMap[clean] || ordinalMap[clean.toUpperCase()];
    }
    const num = parseInt(clean, 10);
    if (!isNaN(num) && num > 0) {
        const j = num % 10;
        const k = num % 100;
        if (j === 1 && k !== 11) return `${num}st Hour`;
        if (j === 2 && k !== 12) return `${num}nd Hour`;
        if (j === 3 && k !== 13) return `${num}rd Hour`;
        return `${num}th Hour`;
    }
    return sessionName.includes("Session") ? sessionName : `Session ${sessionName}`;
  };

  useEffect(() => {
    if (!attendanceData?.studentAttendanceData) return;
    const newEvents: ExtendedAttendanceEvent[] = [];
    Object.entries(attendanceData.studentAttendanceData).forEach(
      ([dateStr, sessions]) => {
        const year = parseInt(dateStr.substring(0, 4), 10);
        const month = parseInt(dateStr.substring(4, 6), 10) - 1;
        const day = parseInt(dateStr.substring(6, 8), 10);
        const dateObj = new Date(year, month, day);
        const dayIdx = dateObj.getDay();
        const dailySessions = Object.entries(sessions).sort((a, b) => Number(a[0]) - Number(b[0]));

        dailySessions.forEach(([sessionKey, sessionData], index) => {
          if (!sessionData.course) return;
          const courseId = sessionData.course.toString();
          const courseName = attendanceData.courses?.[courseId]?.name || "Unknown Course";
          let sessionName = (sessionData as any).session;
          const num = getSessionNumber(sessionName || "");
          
          if (!sessionName || num > 20) {
             const typicalHour = derivedTimetable[dayIdx]?.[courseId];
             if (typicalHour) {
                 sessionName = String(typicalHour); 
             } else {
                 sessionName = String(index + 1); 
             }
          }

          let attendanceStatus = "normal";
          let attendanceLabel = "Present";
          let statusColor = "blue";

          switch (sessionData.attendance) {
            case 110: attendanceStatus = "normal"; attendanceLabel = "Present"; statusColor = "blue"; break;
            case 111: attendanceStatus = "important"; attendanceLabel = "Absent"; statusColor = "red"; break;
            case 225: attendanceStatus = "normal"; attendanceLabel = "Duty Leave"; statusColor = "yellow"; break;
            case 112: attendanceStatus = "important"; attendanceLabel = "Other Leave"; statusColor = "teal"; break;
          }

          newEvents.push({
            title: courseName,
            date: dateObj,
            sessionName, 
            rawSession: sessionName, 
            sessionKey, 
            type: attendanceStatus,
            status: attendanceLabel,
            statusColor,
            courseId,
            isExtra: false, 
          });
        });
      }
    );
    setEvents(newEvents);
  }, [attendanceData, derivedTimetable, getSessionNumber]); 

  const filteredEvents = useMemo(() => {
    if (filter === "all") return events;
    if (filter === "present") return events.filter((e) => e.status === "Present");
    if (filter === "absent") return events.filter((e) => e.status === "Absent");
    if (filter === "dutyLeave") return events.filter((e) => e.status === "Duty Leave");
    if (filter === "otherLeave") return events.filter((e) => e.status === "Other Leave");
    return events;
  }, [events, filter]);

  const handlePreviousMonth = () => { setCurrentMonth((p) => p === 0 ? 11 : p - 1); if(currentMonth === 0) setCurrentYear(y => y-1); };
  const handleNextMonth = () => { setCurrentMonth((p) => p === 11 ? 0 : p + 1); if(currentMonth === 11) setCurrentYear(y => y+1); };
  const goToToday = () => { const t = new Date(); setCurrentYear(t.getFullYear()); setCurrentMonth(t.getMonth()); setSelectedDate(t); };

  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthNames = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ];
  const yearOptions = useMemo(() => Array.from({ length: new Date().getFullYear() + 1 - 2018 + 1 }, (_, i) => 2018 + i), []);

  const getDaysInMonth = useCallback((year: number, month: number) => new Date(year, month + 1, 0).getDate(), []);
  const getFirstDayOfMonth = useCallback((year: number, month: number) => new Date(year, month, 1).getDay(), []);
  const isSameDay = useCallback((d1: Date, d2: Date) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate(), []);
  const isToday = useCallback((d: Date) => isSameDay(d, new Date()), [isSameDay]);

  const getEventStatus = useCallback(
    (date: Date): string | null => {
      const dateEvents = filteredEvents.filter((event) => isSameDay(event.date, date));
      const dbDateStr = formatDateForDB(date);
      
      const hasExtra = trackingData?.some(t => {
         let tDate = t.date; 
         if (tDate.includes('/')) {
            const [d,m,y] = tDate.split('/');
            tDate = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
         }
         return tDate === dbDateStr && t.status === 'extra';
      });

      if (dateEvents.length === 0 && !hasExtra) return null;
      if (dateEvents.some((e) => e.status === "Absent")) return "absent";
      if (dateEvents.some((e) => e.status === "Other Leave")) return "otherLeave";
      if (dateEvents.some((e) => e.status === "Duty Leave")) return "dutyLeave";
      if (dateEvents.some((e) => e.status === "Present")) return "present";
      if (hasExtra) return "normal"; 
      return "normal";
    },
    [filteredEvents, isSameDay, trackingData]
  );

  const selectedDateEvents = useMemo(() => {
    const official = filteredEvents.filter((event) => isSameDay(event.date, selectedDate));
    const dbDateStr = formatDateForDB(selectedDate);
    const extra: ExtendedAttendanceEvent[] = [];
    
    if (trackingData) {
        trackingData.forEach(t => {
            let tDate = t.date; 
            if (tDate.includes('/')) {
                const [d,m,y] = tDate.split('/');
                tDate = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
            }
            if (tDate === dbDateStr && t.status === 'extra') {
                let label = "Present";
                if (t.attendance === 111) label = "Absent";
                else if (t.attendance === 225) label = "Duty Leave";
                
                extra.push({
                    title: t.course,
                    date: selectedDate,
                    sessionName: t.session,
                    rawSession: t.session, 
                    sessionKey: `extra-${t.course}-${t.session}`, 
                    type: "normal",
                    status: label,
                    statusColor: "blue", 
                    courseId: "extra",
                    isExtra: true,
                    remarks: t.remarks
                });
            }
        });
    }
    const merged = [...official, ...extra];
    return merged.sort((a, b) => {
        return getSessionNumber(a.sessionName) - getSessionNumber(b.sessionName);
    });
  }, [selectedDate, filteredEvents, isSameDay, trackingData, getSessionNumber]);

  const calendarCells = useMemo(() => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDayOfMonth = getFirstDayOfMonth(currentYear, currentMonth);
    const leadingEmptyCells = Array(firstDayOfMonth).fill(null).map((_, index) => <div key={`empty-leading-${index}`} className="h-10 w-full" />);
    const dayCells = Array(daysInMonth).fill(null).map((_, index) => {
        const date = new Date(currentYear, currentMonth, index + 1);
        const status = getEventStatus(date);
        const hasEvents = selectedDateEvents.length > 0 ? isSameDay(date, selectedDate) : status !== null;
        const isSelected = isSameDay(date, selectedDate);
        let className = "h-10 w-10 mx-auto rounded-full flex items-center justify-center text-sm cursor-pointer transition-all duration-200 hover:scale-104 ";
        if (isSelected) className += "bg-primary text-primary-foreground font-medium shadow-lg scale-110";
        else if (status === "absent") className += "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30";
        else if (status === "otherLeave") className += "bg-teal-500/20 text-teal-400 hover:bg-teal-500/30 border border-teal-500/30";
        else if (status === "dutyLeave") className += "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border border-yellow-500/30";
        else if (status === "present") className += "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30";
        else if (status === "normal") className += "bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 border border-indigo-500/30";
        else if (hasEvents) className += "ring-1 ring-gray-500/30 hover:ring-gray-500/50";
        else className += "hover:bg-accent/50";
        if (isToday(date)) className += " ring-2 ring-offset-1 ring-offset-background ring-primary";
        return (
          <div key={`day-${index}`} className="flex items-center justify-center" onClick={() => {
              const dateString = date.toISOString();
              sessionStorage.setItem("selected_date", dateString);
              setSelectedDate(date);
              setCurrentMonth(date.getMonth());
              setCurrentYear(date.getFullYear());
            }}>
            <div className={className}>{index + 1}</div>
          </div>
        );
      });
    return [...leadingEmptyCells, ...dayCells];
  }, [currentYear, currentMonth, selectedDate, filteredEvents, getDaysInMonth, getFirstDayOfMonth, getEventStatus, isSameDay, isToday, selectedDateEvents]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* 1. LEFT CARD (Calendar) */}
      <Card className="overflow-hidden border border-border/40 shadow-md backdrop-blur-sm custom-container h-full flex flex-col">
        {/* FIX: Centered items on mobile, spread on desktop. flex-wrap handles overflow. */}
        <CardHeader className="pb-2 flex flex-row flex-wrap items-center justify-center sm:justify-between gap-2 border-b border-border/40">
          
          {/* FIX: max-sm:contents allows Filter/Month/Year to be direct children of the flex container on mobile */}
          <div className="flex items-center gap-2 max-sm:contents">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[130px] h-9 bg-background/60 border-border/60 text-sm capitalize custom-dropdown">
                <SelectValue>{filter === "all" ? "All" : filter.charAt(0).toUpperCase() + filter.slice(1)}</SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-background/90 border-border/60 backdrop-blur-md custom-dropdown max-h-70">
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="present">Present</SelectItem>
                <SelectItem value="absent">Absent</SelectItem>
                <SelectItem value="dutyLeave">Duty Leave</SelectItem>
                <SelectItem value="otherLeave">Other Leave</SelectItem>
              </SelectContent>
            </Select>

            <Select value={currentMonth.toString()} onValueChange={(value) => setCurrentMonth(parseInt(value, 10))}>
              <SelectTrigger className="w-[130px] h-9 bg-background/60 border-border/60 text-sm capitalize custom-dropdown">
                <SelectValue>{monthNames[currentMonth]}</SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-background/90 border-border/60 backdrop-blur-md custom-dropdown max-h-70">
                {monthNames.map((month, index) => (
                  <SelectItem key={month} value={index.toString()} className={currentMonth === index ? "bg-white/5 mt-0.5" : "capitalize"}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={currentYear.toString()} onValueChange={(value) => { const newYear = parseInt(value, 10); if (newYear >= 2018) setCurrentYear(newYear); }}>
              <SelectTrigger className="w-[90px] h-9 bg-background/60 border-border/60 text-sm custom-dropdown">
                <SelectValue>{currentYear}</SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-background/90 border-border/60 max-h-70 backdrop-blur-md custom-dropdown">
                {yearOptions.map((year) => (
                  <SelectItem key={year} value={year.toString()} className={currentYear === year ? "bg-white/5 mt-0.5" : "mt-0.5"}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* NAVIGATION BUTTONS */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={handlePreviousMonth} className="h-9 w-9 rounded-lg bg-accent/50 flex justify-center items-center"><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={handleNextMonth} className="h-9 w-9 rounded-lg bg-accent/50 flex justify-center items-center"><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        
        <CardContent className="p-4 flex-1 flex flex-col h-full">
          <div className="grid grid-cols-7 mb-2 shrink-0">
            {daysOfWeek.map((day, index) => <div key={index} className="text-xs font-medium text-muted-foreground text-center py-2">{day}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1 pb-2 flex-1 auto-rows-[1fr]" style={{ gridAutoRows: '1fr' }}>{calendarCells}</div>
          <div className="flex flex-wrap gap-4 mt-6 text-muted-foreground text-xs justify-center border-t border-border/40 pt-4 shrink-0">
            <div className="flex items-center gap-2"><div className="h-3 w-3 rounded-full bg-red-500/20 border border-red-500/30" /><span>absent</span></div>
            <div className="flex items-center gap-2"><div className="h-3 w-3 rounded-full bg-teal-500/20 border border-teal-500/30" /><span>other leave</span></div>
            <div className="flex items-center gap-2"><div className="h-3 w-3 rounded-full bg-yellow-500/20 border border-yellow-500/30" /><span>duty leave</span></div>
            <div className="flex items-center gap-2"><div className="h-3 w-3 rounded-full bg-blue-500/20 border border-blue-500/30" /><span>present</span></div>
            <div className="flex items-center gap-2"><div className="h-3 w-3 rounded-full outline-2 outline-primary" /><span>today</span></div>
          </div>
        </CardContent>
      </Card>

      {/* 2. RIGHT CARD (Events List) */}
      <Card className="overflow-hidden border-border/40 shadow-sm bg-card/50 flex flex-col h-full">
        <CardHeader className="border-b border-border/40 py-4 px-6 bg-muted/20">
          <CardTitle className="text-sm flex items-center justify-between font-semibold">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-primary" />
              {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </div>
            <Badge variant="secondary" className="font-normal text-xs bg-background/80">{selectedDateEvents.length} Sessions</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 flex-1 flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedDate.toString()}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col"
            >
              {selectedDateEvents.length > 0 ? (
                <div className="flex flex-col gap-3 p-4">
                  {selectedDateEvents.map((event, index) => {
                    let badgeClass = "text-muted-foreground border-border";
                    let Icon = Clock;
                    let cardStyle = "border-border/40 bg-card hover:bg-accent/30 hover:border-border/60";

                    if (event.status === "Present") {
                      badgeClass = "text-green-500 border-green-500/20 bg-green-500/10";
                      Icon = CheckCircle2;
                      cardStyle = "border-green-500/50 bg-green-500/5 hover:bg-green-500/10 hover:border-green-500";
                    } else if (event.status === "Absent") {
                      badgeClass = "text-red-500 border-red-500/20 bg-red-500/10";
                      Icon = AlertCircle;
                      cardStyle = "border-red-500/50 bg-red-500/5 hover:bg-red-500/10 hover:border-red-500"; 
                    } else if (event.status === "Duty Leave") {
                      badgeClass = "text-yellow-500 border-yellow-500/20 bg-yellow-500/10";
                      cardStyle = "border-yellow-500/50 bg-yellow-500/5 hover:bg-yellow-500/10 hover:border-yellow-500";
                    } else if (event.status.includes("Leave")) {
                      badgeClass = "text-teal-500 border-teal-500/20 bg-teal-500/10";
                      cardStyle = "border-teal-500/50 bg-teal-500/5 hover:bg-teal-500/10 hover:border-teal-500";
                    }

                    const dbDate = formatDateForDB(selectedDate);
                    
                    const trackedRecord = trackingData?.find(
                      (data) => {
                         let tDate = data.date;
                         if (tDate.includes('/')) {
                            const [d,m,y] = tDate.split('/');
                            tDate = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
                         }
                         return data.course === event.title &&
                                data.session === event.rawSession && 
                                (tDate === dbDate) &&
                                data.semester === semester &&
                                data.year === year;
                      }
                    );

                    const deleteKey = `delete-${user?.username}-${event.rawSession}-${event.title}-${dbDate}`;
                    const isDeleting = loadingStates[deleteKey];

                    // Use YYYY-MM-DD for API calls
                    const apiDate = dbDate; 
                    const buttonKey = `${event.title}-${apiDate}-${event.rawSession}`;
                    const isLoading = loadingStates[buttonKey];

                    return (
                      <motion.div
                        key={`event-${event.sessionKey}-${index}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={`group flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border transition-all gap-4 ${cardStyle}`}
                      >
                        <div className="flex flex-col gap-1.5">
                          <h4 className="font-semibold text-sm text-foreground leading-tight capitalize flex items-center gap-2">
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

                        {/* RIGHT SIDE */}
                        {event.isExtra ? (
                            <div className="flex-shrink-0 w-full sm:w-auto flex items-center justify-end gap-2">
                                <Badge variant="outline" className="text-[10px] h-6 px-2 bg-indigo-500/10 text-indigo-400 border-indigo-500/20 gap-1.5">
                                    <Sparkles className="w-3 h-3" />
                                    Self-Marked
                                </Badge>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-6 w-6 text-red-400 hover:text-red-500 hover:bg-red-500/10"
                                  disabled={isDeleting}
                                  onClick={() => handleDeleteTrackData(
                                    user?.username || "", 
                                    event.rawSession || event.sessionName, // Prefer raw
                                    event.title, 
                                    apiDate
                                  )}
                                >
                                  {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                                </Button>
                            </div>
                        ) : (
                            event.status === "Absent" && (
                              <div className="flex-shrink-0 w-full sm:w-auto">
                                {trackedRecord ? (
                                  <div className="flex items-center gap-2 w-full">
                                    <Link href="/tracking" className="flex-1 sm:w-auto">
                                      <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="w-full h-8 text-xs gap-1.5 bg-green-500/10 border-green-500/30 text-green-500 hover:text-green-400 hover:bg-green-500/20 hover:border-green-500/50 transition-all"
                                      >
                                        <span className="truncate max-w-[200px] sm:max-w-none">
                                          {trackedRecord.remarks || "View Details"}
                                        </span>
                                        <ArrowUpRight className="w-3 h-3 shrink-0" />
                                      </Button>
                                    </Link>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-8 w-8 text-red-400 hover:text-red-500 hover:bg-red-500/10"
                                      disabled={isDeleting}
                                      onClick={() => handleDeleteTrackData(
                                        user?.username || "", 
                                        trackedRecord.session, // Use exact from DB
                                        trackedRecord.course, 
                                        trackedRecord.date
                                      )}
                                    >
                                      {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2 w-full">
                                    {/* MARK DL */}
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
                                            apiDate, // YYYY-MM-DD
                                            "correction", 
                                            event.rawSession || event.sessionName, // Prefer raw
                                            225, 
                                            "Duty Leave"
                                          ); 
                                        } 
                                      }} 
                                      className={`w-full sm:w-auto h-auto min-h-[32px] py-1.5 text-xs gap-1.5 border-dashed transition-all ${isLoading ? "opacity-70 cursor-wait" : "border-yellow-500/40 text-yellow-600 hover:bg-yellow-500/10 hover:border-yellow-500 hover:text-yellow-700 dark:text-yellow-500"}`}
                                    >
                                      {isLoading ? "..." : <><Briefcase className="w-3 h-3 shrink-0" /><span className="truncate">Mark DL</span></>}
                                    </Button>

                                    {/* MARK PRESENT */}
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
                                            apiDate, // YYYY-MM-DD
                                            "correction", 
                                            event.rawSession || event.sessionName, // Prefer raw
                                            110, 
                                            "Incorrectly marked absent"
                                          ); 
                                        } 
                                      }} 
                                      className={`w-full sm:w-auto h-auto min-h-[32px] py-1.5 text-xs gap-1.5 border-dashed transition-all ${isLoading ? "opacity-70 cursor-wait" : "border-green-500/40 text-green-600 hover:bg-green-500/10 hover:border-green-500 hover:text-green-700 dark:text-green-500"}`}
                                    >
                                      {isLoading ? "..." : <><CheckCircle2 className="w-3 h-3 shrink-0" /><span className="truncate">Mark Present</span></>}
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center flex-1 text-center px-6 py-12">
                  <div className="rounded-full bg-accent/30 p-4 mb-3 ring-1 ring-border/50"><CalendarIcon className="h-6 w-6 text-muted-foreground/60" /></div>
                  <h3 className="text-sm font-semibold text-foreground">No Classes Found</h3>
                  <p className="text-xs text-muted-foreground mt-1 mb-4 max-w-[200px]">Enjoy your free time! No classes recorded for this date.</p>
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={goToToday}>Jump to Today</Button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}