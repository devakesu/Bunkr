"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { AddAttendanceDialog } from "@/components/attendance/AddAttendanceDialog";
import { useAttendanceReport } from "@/hooks/courses/attendance";
import { useTrackingData } from "@/hooks/tracker/useTrackingData";
import { useFetchCourses } from "@/hooks/courses/courses";

interface AddRecordTriggerProps {
  user: any;
  onSuccess: () => Promise<void>;
}

export function AddRecordTrigger({ user, onSuccess }: AddRecordTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const { data: attendanceData, refetch: refetchAttendance } = useAttendanceReport({ 
    enabled: isOpen 
  });
  
  const { data: trackingData, refetch: refetchTracking } = useTrackingData(user, { 
    enabled: isOpen 
  });
  
  const { data: coursesData } = useFetchCourses({ 
    enabled: isOpen 
  });

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
        className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md font-semibold gap-2 border-0 cursor-pointer"
      >
        <Plus className="h-4 w-4" />
        <span className="max-sm:hidden">Add Record</span>
        <span className="sm:hidden">Add</span>
      </Button>

      <AddAttendanceDialog 
         open={isOpen} 
         onOpenChange={setIsOpen}
         attendanceData={attendanceData}
         trackingData={trackingData || []}
         coursesData={coursesData}
         user={user}
         onSuccess={handleSuccess}
      />
    </>
  );
}