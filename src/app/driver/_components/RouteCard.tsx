"use client";

import { useMemo } from "react";
import StopCard, { type RouteStopForDriver, type AttendanceStatus } from "./StopCard";

type DriverRouteSummary = {
  id: string;
  name: string;
  direction: "AM" | "MIDDAY" | "PM";
  is_active: boolean;
  effective_start_date: string | null;
  effective_end_date: string | null;
};

type RouteCardProps = {
  route: DriverRouteSummary;
  stops: RouteStopForDriver[];
  driverId: string;
  completingRouteId: string | null;
  onMarkComplete: (routeId: string) => void;
  onAttendanceChange: (studentId: string, status: AttendanceStatus) => void;
  attendanceMap: Record<string, AttendanceStatus>;
};

export default function RouteCard({
  route,
  stops,
  driverId,
  completingRouteId,
  onMarkComplete,
  onAttendanceChange,
  attendanceMap,
}: RouteCardProps) {
  // Calculate attendance progress
  const { totalStudents, confirmedStudents } = useMemo(() => {
    let total = 0;
    let confirmed = 0;

    for (const stop of stops) {
      const studentNames =
        stop.household_students.length > 0
          ? stop.household_students
          : stop.student_name
            ? [stop.student_name]
            : [];

      if (studentNames.length === 0) continue;

      for (let idx = 0; idx < studentNames.length; idx++) {
        const studentId =
          stop.household_student_ids?.[idx] ||
          stop.student_id ||
          `${stop.id}-${idx}`;
        total++;
        const compositeKey = `${studentId}:${stop.id}`;
        if (attendanceMap[compositeKey] || attendanceMap[studentId]) {
          confirmed++;
        }
      }
    }

    return { totalStudents: total, confirmedStudents: confirmed };
  }, [stops, attendanceMap]);

  const allConfirmed = totalStudents > 0 && confirmedStudents === totalStudents;

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
            {route.direction === "AM"
              ? "Morning route"
              : route.direction === "MIDDAY"
                ? "Midday route"
                : "Afternoon route"}
          </p>
          <h3 className="text-lg font-semibold text-slate-50">{route.name}</h3>
        </div>
        <div className="text-xs text-slate-300 text-right">
          {route.effective_start_date && (
            <span>
              Starts:{" "}
              <span className="font-medium text-slate-100">
                {route.effective_start_date}
              </span>
            </span>
          )}
          {route.effective_end_date && (
            <span>
              {" "}
              • Ends:{" "}
              <span className="font-medium text-slate-100">
                {route.effective_end_date}
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Attendance progress */}
      {totalStudents > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300">
              Attendance: {confirmedStudents}/{totalStudents} students confirmed
            </span>
            {allConfirmed && (
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-200 ring-1 ring-emerald-500/40">
                All confirmed
              </span>
            )}
          </div>
          <div className="h-1.5 rounded-full bg-slate-800">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                allConfirmed ? "bg-emerald-500" : "bg-amber-500"
              }`}
              style={{
                width: `${totalStudents > 0 ? (confirmedStudents / totalStudents) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-white/10" />

      {/* Stops list */}
      {stops.length === 0 ? (
        <p className="mt-1 text-sm text-slate-300">
          No stops have been added to this route yet. Contact the office if this
          looks wrong.
        </p>
      ) : (
        <div className="space-y-2">
          {stops.map((stop) => (
            <StopCard
              key={stop.id}
              stop={stop}
              routeDirection={route.direction}
              driverId={driverId}
              routeId={route.id}
              onAttendanceChange={onAttendanceChange}
              existingAttendance={attendanceMap}
            />
          ))}
        </div>
      )}

      {/* Route complete button */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => onMarkComplete(route.id)}
          disabled={
            (!!completingRouteId && completingRouteId === route.id) ||
            (totalStudents > 0 && !allConfirmed)
          }
          className={`w-full rounded-xl border px-4 py-2.5 text-sm font-semibold transition active:scale-[0.97] ${
            completingRouteId === route.id
              ? "cursor-wait border-emerald-500/60 bg-emerald-900/40 text-emerald-100"
              : totalStudents > 0 && !allConfirmed
                ? "cursor-not-allowed border-slate-600/40 bg-slate-900/30 text-slate-500"
                : "border-emerald-500/40 bg-slate-900/60 text-emerald-200 hover:bg-emerald-500/10"
          }`}
        >
          {completingRouteId === route.id
            ? "Marking route as complete..."
            : totalStudents > 0 && !allConfirmed
              ? `Confirm all ${totalStudents} students before completing`
              : "Mark this route as complete for today"}
        </button>
        <p className="mt-1 text-[11px] text-slate-400">
          {totalStudents > 0 && !allConfirmed
            ? `${totalStudents - confirmedStudents} student(s) still need attendance confirmation.`
            : "Once marked complete, this route will disappear from today's list."}
        </p>
      </div>
    </div>
  );
}
