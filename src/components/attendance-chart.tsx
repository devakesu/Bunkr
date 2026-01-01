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
import { AttendanceReport, TrackAttendance, Course } from "@/types";
import { useAttendanceSettings } from "@/providers/attendance-settings";

const formatCourseCode = (code: string) => {
  if (!code) return "";
  return code.length > 10 ? code.substring(0, 10) + "..." : code;
};

interface AttendanceChartProps {
  attendanceData?: AttendanceReport;
  trackingData?: TrackAttendance[];
  coursesData?: { courses: Record<string, Course> };
}

const HatchedBarShape = (props: any) => {
  const { x, y, width, height, fill, stroke } = props;
  const radius = 4;

  if (!height || height <= 0) return null;

  const pathD = `
    M ${x},${y + height}
    L ${x},${y + radius}
    Q ${x},${y} ${x + radius},${y}
    L ${x + width - radius},${y}
    Q ${x + width},${y} ${x + width},${y + radius}
    L ${x + width},${y + height}
  `;

  return (
    <g>
      <path d={`${pathD} Z`} fill={fill} stroke="none" />
      <path d={pathD} fill="none" stroke={stroke} strokeWidth={1} />
    </g>
  );
};

const BottomBarShape = (props: any) => {
  const { fill, x, y, width, height, payload } = props;
  
  if (!height || height <= 0) return null;

  // Check payload to see if there is an extra percentage stacked on top
  const hasTopStack = payload && payload.extraPercentage > 0;
  const radius = hasTopStack ? 0 : 4;

  const pathD = `
    M ${x},${y + height}
    L ${x},${y + radius}
    Q ${x},${y} ${x + radius},${y}
    L ${x + width - radius},${y}
    Q ${x + width},${y} ${x + width},${y + radius}
    L ${x + width},${y + height}
    Z
  `;

  return <path d={pathD} fill={fill} stroke={fill} strokeWidth={1} />;
};

const CustomTargetLabel = (props: any) => {
  const { viewBox, value } = props;
  const x = viewBox.width - 5;
  const y = viewBox.y;

  return (
    <g style={{ pointerEvents: 'none' }}>
      <rect
        x={x - 85}
        y={y - 12}
        width="90"
        height="24"
        fill="rgba(20, 20, 20, 0.95)"
        rx="4"
        stroke="#f59e0b"
        strokeWidth="1"
      />
      <text
        x={x - 40}
        y={y + 5}
        fill="#f59e0b"
        textAnchor="middle"
        fontSize="12"
        fontWeight="bold"
      >
        Target: {value}%
      </text>
    </g>
  );
};

export function AttendanceChart({ attendanceData, trackingData, coursesData }: AttendanceChartProps) {
  const { targetPercentage } = useAttendanceSettings();
  
  const safeTarget = Number(targetPercentage) > 0 ? Number(targetPercentage) : 75;

  const data = useMemo(() => {
    if (!coursesData?.courses || !attendanceData?.studentAttendanceData) {
      return [];
    }

    const courseAttendance: Record<string, any> = {};

    // 1. Initialize Courses
    Object.entries(coursesData.courses).forEach(([courseId, course]) => {
      const code = formatCourseCode(course.code || course.name);
      const c = course as any;
      courseAttendance[courseId] = {
        id: courseId,
        present: 0,
        absent: 0,
        total: 0,
        selfPresent: 0,
        selfTotal: 0, 
        name: code,
        fullName: course.name,
        startDate: c.usersubgroup?.start_date ? new Date(c.usersubgroup.start_date) : undefined,
        endDate: c.usersubgroup?.end_date ? new Date(c.usersubgroup.end_date) : undefined
      };
    });

    // 2. Process Official Data
    Object.entries(attendanceData.studentAttendanceData).forEach(([dateStr, dateData]) => {
      const sessionDate = new Date(dateStr);
      Object.values(dateData).forEach((session: any) => {
        if (session.course !== null && courseAttendance[session.course.toString()]) {
          const stats = courseAttendance[session.course.toString()];
          if (stats.startDate && sessionDate < stats.startDate) return;
          if (stats.endDate && sessionDate > stats.endDate) return;

          const status = session.attendance;
          if (status === 110 || status === 225 || status === 112) {
            stats.present += 1;
            stats.total += 1;
          } else if (status === 111) {
            stats.absent += 1;
            stats.total += 1;
          }
        }
      });
    });

    // 3. Process Tracking Data
    if (trackingData) {
      Object.values(courseAttendance).forEach((courseStats: any) => {
        const courseTracks = trackingData.filter(t => t.course === courseStats.fullName);
        
        // Separate Extra vs Correction
        const extras = courseTracks.filter(t => (t as any).status === 'extra');
        const corrections = courseTracks.filter(t => (t as any).status !== 'extra');

        // Only count as "Present" if the user marked it as Present (110) or Duty Leave (225)
        const extraPresent = extras.filter(t => t.attendance === 110 || t.attendance === 225).length;
        const correctionPresent = corrections.filter(t => t.attendance === 110 || t.attendance === 225).length;

        courseStats.selfPresent = extraPresent + correctionPresent;
        courseStats.selfTotal = extras.length; // Only Extras increase the denominator
      });
    }

    // 4. Calculate Percentages (Updated to 2 decimal places)
    return Object.values(courseAttendance)
      .filter((course: any) => (course.total + course.selfTotal) > 0)
      .map((course: any) => {
        
        // Use toFixed(2) for higher precision instead of Math.round
        const officialPct = course.total > 0 ? parseFloat(((course.present / course.total) * 100).toFixed(2)) : 0;
        
        const mergedPresent = course.present + course.selfPresent;
        const mergedTotal = course.total + course.selfTotal;
        
        const mergedPct = mergedTotal > 0 ? parseFloat(((mergedPresent / mergedTotal) * 100).toFixed(2)) : 0;

        const extraPct = Math.max(0, parseFloat((mergedPct - officialPct).toFixed(2)));

        return {
          ...course,
          officialPercentage: officialPct,
          extraPercentage: extraPct,
          totalPercentage: mergedPct, 
          mergedPresent,
          mergedTotal,
          present: course.present,
          total: course.total,
          selfPresent: course.selfPresent,
          selfTotal: course.selfTotal
        };
      })
      .sort((a: any, b: any) => a.totalPercentage - b.totalPercentage);
  }, [attendanceData, trackingData, coursesData]);

  const getBarSize = () => {
    const courseCount = data.length;
    if (courseCount <= 5) return 40;
    if (courseCount <= 8) return 30;
    return 20;
  };

  const barHeights = data.map(d => d.totalPercentage);
  const nonZeroHeights = barHeights.filter(h => h > 0);

  let minRef = safeTarget;
  if (nonZeroHeights.length > 0) {
      minRef = Math.min(Math.min(...nonZeroHeights), safeTarget);
  }

  const calculatedMin = Math.floor(minRef / 5) * 5 - 5;
  const yAxisMin = Math.max(0, calculatedMin);

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 30, right: 10, left: -20, bottom: 5 }}
          barSize={getBarSize()}
        >
          {/* Patterns for the Hatched Bar */}
          <defs>
            <pattern id="striped-green" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
              <rect width="8" height="8" fill="#10b981" fillOpacity="0.25" />
              <line x1="0" y="0" x2="0" y2="8" stroke="#10b981" strokeWidth="4" strokeOpacity={0.4} />
            </pattern>
            <pattern id="striped-red" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
              <rect width="8" height="8" fill="#ef4444" fillOpacity="0.25" />
              <line x1="0" y="0" x2="0" y2="8" stroke="#ef4444" strokeWidth="4" strokeOpacity={0.4} />
            </pattern>
          </defs>

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
            allowDecimals={false}
            allowDataOverflow={true}
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
            itemStyle={{ color: "#ffffff", padding: 0 }}
            labelStyle={{ color: "#a1a1aa", marginBottom: '0.5rem' }}
            cursor={{ fill: "rgba(255, 255, 255, 0.05)" }}
            formatter={(value: number, name: string) => null} 
            content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload;
                  return (
                    <div className="bg-[#141414] border border-[#333] p-3 rounded-lg shadow-xl text-xs">
                      <p className="text-gray-400 mb-2 font-medium">{d.fullName}</p>
                      
                      {/* Official Stats */}
                      <div className="flex justify-between gap-4 mb-1">
                        <span className="text-gray-500">Official:</span>
                        <span className={`font-mono font-bold ${d.officialPercentage < safeTarget ? 'text-red-400' : 'text-green-400'}`}>
                          {d.officialPercentage}% <span className="text-gray-600 font-normal">({d.present}/{d.total})</span>
                        </span>
                      </div>

                      {/* Tracked Stats */}
                      {(d.selfPresent > 0 || d.selfTotal > 0) && (
                          <div className="flex justify-between gap-4">
                            <span className="text-primary">+ Tracked:</span>
                            <span className={`font-mono font-bold ${d.totalPercentage < safeTarget ? 'text-red-400' : 'text-green-400'}`}>
                              {d.totalPercentage}% <span className="text-gray-600 font-normal">({d.mergedPresent}/{d.mergedTotal})</span>
                            </span>
                          </div>
                      )}
                    </div>
                  );
                }
                return null;
            }}
          />
          
          {/* BAR 1: OFFICIAL (Bottom Layer) */}
          <Bar 
            dataKey="officialPercentage" 
            stackId="a" 
            isAnimationActive={false} 
            shape={<BottomBarShape />} 
          >
            {data.map((entry: any, index: number) => {
              const color = entry.officialPercentage < safeTarget ? "#ef4444" : "#10b981";
              return <Cell key={`cell-off-${index}`} fill={color} />;
            })}
          </Bar>

          {/* BAR 2: EXTRA (Top Layer - Hatched) */}
          <Bar 
            dataKey="extraPercentage" 
            stackId="a" 
            isAnimationActive={false} 
            shape={<HatchedBarShape />}
          >
             {data.map((entry: any, index: number) => {
                const isSafe = entry.totalPercentage >= safeTarget;
                const fillUrl = isSafe ? "url(#striped-green)" : "url(#striped-red)";
                const strokeColor = isSafe ? "#10b981" : "#ef4444";
                
                return (
                  <Cell
                    key={`cell-ext-${index}`}
                    fill={fillUrl}
                    stroke={strokeColor} 
                  />
               );
             })}
          </Bar>

          <ReferenceLine
            y={safeTarget}
            stroke="#f59e0b"
            strokeDasharray="5 3"
            strokeWidth={2}
            strokeOpacity={1}
            label={<CustomTargetLabel value={safeTarget} />}
            isFront={true}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}