"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { AddAttendanceDialog } from "@/components/attendance/AddAttendanceDialog";
import { useAttendanceReport } from "@/hooks/courses/attendance";
import { useTrackingData } from "@/hooks/tracker/useTrackingData";
import { useFetchCourses } from "@/hooks/courses/courses";
import { useFetchAcademicYear, useFetchSemester } from "@/hooks/users/settings";
import type { User } from "@/types";

interface AddRecordTriggerProps {
  user: User;
  onSuccess: () => Promise<void>;
}

/**
 * Shared interface for user data passed to AddAttendanceDialog
 * This ensures type consistency across components using the dialog
 */
interface DialogUser {
  id: string;
  auth_id?: string | null;
}

export function AddRecordTrigger({ user, onSuccess }: AddRecordTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Transform user object to match AddAttendanceDialog's expected interface
  const dialogUser: DialogUser = {
    id: String(user.id),
    auth_id: "auth_id" in user 
      ? (user as User & { auth_id?: string | null }).auth_id ?? null
      : null,
  };
  
  const { data: attendanceData, refetch: refetchAttendance } = useAttendanceReport({ 
    enabled: isOpen 
  });
  
  const { data: trackingData, refetch: refetchTracking } = useTrackingData(user, { 
    enabled: isOpen 
  });
  
  const { data: coursesData } = useFetchCourses({ 
    enabled: isOpen 
  });
  
  const { data: selectedSemester } = useFetchSemester();
  const { data: selectedYear } = useFetchAcademicYear();

  // Handle local success, then bubble up
  const handleSuccess = async () => {
    await Promise.all([refetchAttendance(), refetchTracking()]);
    await onSuccess();
  };

  return (
    <>
      {/* The Trigger Button */}
      <Button
        onClick={() => setIsOpen(true)}
        className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm font-semibold gap-2 border-0 cursor-pointer"
        aria-label="Add new attendance record (Press Enter to open)"
        title="Add new attendance record"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        <span className="max-sm:hidden">Add Record</span>
        <span className="sr-only sm:hidden">Add Record</span>
      </Button>

      <AddAttendanceDialog 
         open={isOpen} 
         onOpenChange={setIsOpen}
         attendanceData={attendanceData}
         trackingData={trackingData || []}
         coursesData={coursesData}
         user={dialogUser}
         onSuccess={handleSuccess}
         selectedSemester={selectedSemester ?? undefined}
         selectedYear={selectedYear ?? undefined}
      />
    </>
  );
}