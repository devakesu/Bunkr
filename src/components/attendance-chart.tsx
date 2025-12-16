"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { formatCourseCode } from "@/utils/formatter";
import { AttendanceReport } from "@/types";
import { useAttendanceSettings } from "@/providers/attendance-settings";

interface AttendanceChartProps {
  attendanceData?: AttendanceReport;
}

// Custom Label Component (Rendered on top)
const CustomTargetLabel = (props: any) => {
  const { viewBox, value } = props;
  // Position in top-right corner
  const x = viewBox.width - 5; 
  const y = viewBox.y; 

  return (
    <g style={{ pointerEvents: 'none' }}>
      {/* Background box for contrast */}
      <rect 
        x={x - 85} 
        y={y - 12} 
        width="90" 
        height="24" 
        fill="rgba(20, 20, 20, 0.95)" 
        rx="4" 
        stroke="#f59e0b" // Amber border
        strokeWidth="1"
      />
      {/* Text Label */}
      <text 
        x={x - 40} 
        y={y + 5} 
        fill="#f59e0b" // Amber text
        textAnchor="middle" 
        fontSize="12"
        fontWeight="bold"
      >
        Target: {value}%
      </text>
    </g>
  );
};

export function AttendanceChart({ attendanceData }: AttendanceChartProps) {
  const { targetPercentage } = useAttendanceSettings();

  const data = useMemo(() => {
    if (
      !attendanceData ||
      !attendanceData.studentAttendanceData ||
      !attendanceData.courses
    ) {
      return [];
    }

    const courseAttendance: Record<
      string,
      { present: number; absent: number; total: number; name: string }
    > = {};

    interface CourseSession {
      course: number | null;
      attendance: number | null;
    }

    Object.entries(attendanceData.courses).forEach(([courseId, course]) => {
      const code = formatCourseCode(course.code);
      courseAttendance[courseId] = {
        present: 0,
        absent: 0,
        total: 0,
        name: code,
      };
    });

    Object.values(attendanceData.studentAttendanceData).forEach((dateData) => {
      Object.values(dateData).forEach((session: CourseSession) => {
        if (
          session.course !== null &&
          courseAttendance[session.course.toString()]
        ) {
          if (session.attendance === 110 || session.attendance === 225) {
            courseAttendance[session.course].present += 1;
            courseAttendance[session.course].total += 1;
          } else if (session.attendance === 111) {
            courseAttendance[session.course].absent += 1;
            courseAttendance[session.course].total += 1;
          }
        }
      });
    });

    return Object.values(courseAttendance)
      .filter((course) => course.total > 0)
      .map((course) => ({
        ...course,
        percentage: Math.round((course.present / course.total) * 100) || 0,
      }))
      .sort((a, b) => a.percentage - b.percentage);
  }, [attendanceData]);

  const getBarSize = () => {
    const courseCount = data.length;
    if (courseCount <= 5) return 40;
    if (courseCount <= 8) return 30;
    return 20;
  };

  // --- 1. Dynamic Y-Axis Scaling (Multiples of 5) ---
  const minPercentage = data.length > 0 ? Math.min(...data.map(d => d.percentage)) : 0;
  const lowestRelevant = Math.min(minPercentage, targetPercentage);
  
  // Round down to nearest multiple of 5, then subtract 5 for padding
  // e.g. 83 -> 80 -> 75
  const calculatedMin = Math.floor(lowestRelevant / 5) * 5 - 5;
  const yAxisMin = Math.max(0, calculatedMin);

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 30, right: 10, left: -20, bottom: 5 }}
          barSize={getBarSize()}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.2} />
          
          <XAxis
            dataKey="name"
            interval={0}
            textAnchor="end"
            angle={-45}
            height={60}
            tick={{ fontSize: 11, fill: "#888" }}
            tickMargin={10}
          />
          
          <YAxis 
            domain={[yAxisMin, 100]} 
            type="number"
            // Force ticks to be multiples of 5
            allowDecimals={false}
            tickCount={Math.ceil((100 - yAxisMin) / 5) + 1}
            tickFormatter={(value) => `${value}%`}
            tick={{ fontSize: 11, fill: "#888" }}
            axisLine={false}
            tickLine={false}
          />
          
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(20, 20, 20, 0.95)",
              border: "1px solid #333",
              borderRadius: "8px",
              fontSize: "13px",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.5)",
            }}
            // FIX: Ensure text is white
            itemStyle={{ color: "#ffffff" }}
            labelStyle={{ color: "#a1a1aa", marginBottom: '0.25rem' }}
            cursor={{ fill: "rgba(255, 255, 255, 0.05)" }}
            formatter={(value: number, name: string, props: any) => {
              const { present, total } = props.payload;
              return [`${value}% (${present}/${total})`, "Attendance"];
            }}
          />
          
          <Bar dataKey="percentage" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.percentage < targetPercentage ? "#ef4444" : "#10b981"} 
                fillOpacity={0.9}
              />
            ))}
          </Bar>

          {/* FIX: ReferenceLine placed LAST ensures label is on top of bars */}
          <ReferenceLine 
            y={targetPercentage} 
            stroke="#f59e0b" 
            strokeDasharray="5 3"
            strokeWidth={2}
            strokeOpacity={1}
            label={<CustomTargetLabel value={targetPercentage} />}
            isFront={true} // Recharts prop to force render on top
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}