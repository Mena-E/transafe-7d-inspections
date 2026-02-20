"use client";

import { useState, useEffect } from "react";

// ==== TYPES ====

export type RouteStopForDriver = {
  id: string;
  route_id: string;
  sequence: number;
  address: string | null;
  planned_time: string | null;
  stop_type:
    | "pickup_home"
    | "dropoff_home"
    | "pickup_school"
    | "dropoff_school"
    | "other";
  student_name: string | null;
  student_id: string | null;
  primary_guardian_name: string | null;
  primary_guardian_phone: string | null;
  name: string | null; // school name
  phone: string | null; // school phone
  household_id: string | null;
  household_students: string[]; // grouped student names for household stops
  household_student_ids: string[]; // matching student IDs for household stops
};

export type AttendanceStatus = "picked_up" | "dropped_off" | "absent" | "no_show" | "cancelled";

type AttendanceRecord = {
  student_id: string;
  status: AttendanceStatus;
};

type StopCardProps = {
  stop: RouteStopForDriver;
  routeDirection: "AM" | "MIDDAY" | "PM";
  driverId: string;
  routeId: string;
  onAttendanceChange?: (studentId: string, status: AttendanceStatus) => void;
  existingAttendance?: Record<string, AttendanceStatus>;
};

// Convert "HH:MM" or "HH:MM:SS" (24-hour) into "h:MM AM/PM"
function formatTimeTo12Hour(raw: string | null): string {
  if (!raw) return "";
  const parts = raw.split(":");
  if (parts.length < 2) return raw;
  const hour24 = parseInt(parts[0], 10);
  const minute = parts[1] ?? "00";
  if (Number.isNaN(hour24)) return raw;
  const isPM = hour24 >= 12;
  let hour12 = hour24 % 12;
  if (hour12 === 0) hour12 = 12;
  const suffix = isPM ? "PM" : "AM";
  const mm = minute.padStart(2, "0");
  return `${hour12}:${mm} ${suffix}`;
}

export default function StopCard({
  stop,
  routeDirection,
  driverId,
  routeId,
  onAttendanceChange,
  existingAttendance = {},
}: StopCardProps) {
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceStatus>>(existingAttendance);
  const [submitting, setSubmitting] = useState<string | null>(null);

  useEffect(() => {
    setAttendanceMap(existingAttendance);
  }, [existingAttendance]);

  const isHomeStop =
    stop.stop_type === "pickup_home" || stop.stop_type === "dropoff_home";
  const isSchoolStop =
    stop.stop_type === "pickup_school" || stop.stop_type === "dropoff_school";
  const isPickup =
    stop.stop_type === "pickup_home" || stop.stop_type === "pickup_school";

  let actionLabel = "Stop";
  if (stop.stop_type === "pickup_home" || stop.stop_type === "pickup_school") {
    actionLabel = "Pick up";
  } else if (
    stop.stop_type === "dropoff_home" ||
    stop.stop_type === "dropoff_school"
  ) {
    actionLabel = "Drop off";
  }

  // Build student list - use household_students if available, otherwise single student
  const studentNames =
    stop.household_students.length > 0
      ? stop.household_students
      : stop.student_name
        ? [stop.student_name]
        : [];

  const studentLabel =
    studentNames.length > 0 ? studentNames.join(", ") : "student";

  const canCallGuardian =
    isHomeStop &&
    !!stop.primary_guardian_name &&
    !!stop.primary_guardian_phone;

  const canCallSchool = isSchoolStop && !!stop.name && !!stop.phone;

  const handleAttendanceClick = async (
    studentId: string,
    studentName: string,
    status: AttendanceStatus,
  ) => {
    if (submitting) return;
    setSubmitting(studentId + status);

    try {
      // Capture GPS
      let latitude: number | undefined;
      let longitude: number | undefined;

      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 5000,
            enableHighAccuracy: false,
          }),
        );
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
      } catch {
        // GPS unavailable, proceed without
      }

      const res = await fetch("/api/driver/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: studentId,
          route_id: routeId,
          route_stop_id: stop.id,
          household_id: stop.household_id,
          driver_id: driverId,
          status,
          latitude,
          longitude,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        console.error("Failed to record attendance:", body.error);
        return;
      }

      const compositeKey = `${studentId}:${stop.id}`;
      setAttendanceMap((prev) => ({ ...prev, [compositeKey]: status, [studentId]: status }));
      onAttendanceChange?.(compositeKey, status);
    } catch (err) {
      console.error("Failed to record attendance:", err);
    } finally {
      setSubmitting(null);
    }
  };

  // Show attendance buttons on any stop that has students
  const showAttendance = studentNames.length > 0;

  return (
    <div className="flex items-start gap-3 rounded-2xl bg-slate-900/90 px-3 py-3">
      {/* Sequence number */}
      <span className="mt-1 w-7 text-sm font-semibold text-slate-400">
        {stop.sequence}.
      </span>

      {/* Main stop content */}
      <div className="flex-1 space-y-1.5">
        {/* Planned time */}
        {stop.planned_time && (
          <p className="inline-flex items-center rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200">
            Planned:{" "}
            <span className="ml-2 text-sm font-bold tracking-normal text-emerald-100">
              {formatTimeTo12Hour(stop.planned_time)}
            </span>
          </p>
        )}

        {/* Action + student name(s) */}
        <p className="text-base font-semibold text-slate-50">
          {actionLabel} {studentLabel}
        </p>

        {/* Address */}
        <p className="text-sm text-slate-200">
          {stop.address || "Address not set"}
        </p>

        {/* For school stops, show the school name */}
        {isSchoolStop && stop.name && (
          <p className="text-sm text-slate-300">
            School:{" "}
            <span className="font-medium text-slate-100">{stop.name}</span>
          </p>
        )}

        {/* Navigation buttons */}
        {stop.address && (
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                const dest = encodeURIComponent(stop.address as string);
                window.location.href = `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/70 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 active:scale-[0.97]"
            >
              <svg
                aria-hidden="true"
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 2.75C8.824 2.75 6.25 5.324 6.25 8.5C6.25 12.438 10.06 16.41 11.52 17.84C11.79 18.11 12.21 18.11 12.48 17.84C13.94 16.41 17.75 12.438 17.75 8.5C17.75 5.324 15.176 2.75 12 2.75Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle
                  cx="12"
                  cy="8.5"
                  r="2.25"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
              </svg>
              <span className="text-sm">Maps</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const dest = encodeURIComponent(stop.address as string);
                window.location.href = `https://waze.com/ul?q=${dest}&navigate=yes`;
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/70 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-200 active:scale-[0.97]"
            >
              <svg
                aria-hidden="true"
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M4.5 14.5C4.5 11.462 6.962 9 10 9H14C17.038 9 19.5 11.462 19.5 14.5C19.5 16.985 17.485 19 15 19H14L12 21L10.5 19.75"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="9.25" cy="14.5" r="1.5" fill="currentColor" />
                <circle cx="15" cy="14.5" r="1.5" fill="currentColor" />
              </svg>
              <span className="text-sm">Waze</span>
            </button>
          </div>
        )}

        {/* Contacts */}
        {(canCallGuardian || canCallSchool) && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {canCallGuardian && (
              <a
                href={`tel:${stop.primary_guardian_phone}`}
                className="inline-flex items-center rounded-full border border-emerald-500/70 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 active:scale-[0.97]"
              >
                Call guardian:{" "}
                <span className="ml-1">{stop.primary_guardian_name}</span>
              </a>
            )}
            {canCallSchool && (
              <a
                href={`tel:${stop.phone}`}
                className="inline-flex items-center rounded-full border border-emerald-500/70 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 active:scale-[0.97]"
              >
                Call school: <span className="ml-1">{stop.name}</span>
              </a>
            )}
          </div>
        )}

        {/* Attendance buttons per student */}
        {showAttendance && (
          <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Attendance
            </p>
            {studentNames.map((studentName, idx) => {
              const studentId =
                stop.household_student_ids?.[idx] ||
                stop.student_id ||
                `${stop.id}-${idx}`;
              const currentStatus =
                attendanceMap[`${studentId}:${stop.id}`] ??
                attendanceMap[studentId];
              const isSubmitting = submitting?.startsWith(studentId);

              const statusOptions: { status: AttendanceStatus; label: string; color: string; activeColor: string }[] = isPickup
                ? [
                    { status: "picked_up", label: "Picked Up", color: "border-emerald-500/40 bg-slate-900/70 text-emerald-200 hover:bg-emerald-500/10", activeColor: "border-emerald-500 bg-emerald-500 text-slate-950 shadow-lg" },
                    { status: "absent", label: "Absent", color: "border-amber-500/40 bg-slate-900/70 text-amber-200 hover:bg-amber-500/10", activeColor: "border-amber-500 bg-amber-500 text-slate-950 shadow-lg" },
                    { status: "no_show", label: "No Show", color: "border-red-500/40 bg-slate-900/70 text-red-200 hover:bg-red-500/10", activeColor: "border-red-500 bg-red-500 text-slate-950 shadow-lg" },
                    { status: "cancelled", label: "Cancelled", color: "border-slate-500/40 bg-slate-900/70 text-slate-300 hover:bg-slate-500/10", activeColor: "border-slate-400 bg-slate-500 text-slate-950 shadow-lg" },
                  ]
                : [
                    { status: "dropped_off", label: "Dropped Off", color: "border-blue-500/40 bg-slate-900/70 text-blue-200 hover:bg-blue-500/10", activeColor: "border-blue-500 bg-blue-500 text-slate-950 shadow-lg" },
                    { status: "absent", label: "Absent", color: "border-amber-500/40 bg-slate-900/70 text-amber-200 hover:bg-amber-500/10", activeColor: "border-amber-500 bg-amber-500 text-slate-950 shadow-lg" },
                    { status: "no_show", label: "No Show", color: "border-red-500/40 bg-slate-900/70 text-red-200 hover:bg-red-500/10", activeColor: "border-red-500 bg-red-500 text-slate-950 shadow-lg" },
                    { status: "cancelled", label: "Cancelled", color: "border-slate-500/40 bg-slate-900/70 text-slate-300 hover:bg-slate-500/10", activeColor: "border-slate-400 bg-slate-500 text-slate-950 shadow-lg" },
                  ];

              return (
                <div key={studentId} className="space-y-1.5">
                  <p className="text-xs font-medium text-slate-200">
                    {studentName}
                  </p>
                  <div className="flex gap-1.5">
                    {statusOptions.map((s) => (
                      <button
                        key={s.status}
                        type="button"
                        disabled={!!isSubmitting}
                        onClick={() =>
                          handleAttendanceClick(studentId, studentName, s.status)
                        }
                        className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-semibold text-center transition active:scale-[0.97] ${
                          currentStatus === s.status ? s.activeColor : s.color
                        } ${isSubmitting ? "opacity-60 cursor-wait" : ""}`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
