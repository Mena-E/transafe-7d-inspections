"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { useRouter } from "next/navigation";
import DriverLoginForm from "./_components/DriverLoginForm";
import RouteCard from "./_components/RouteCard";
import type { RouteStopForDriver, AttendanceStatus } from "./_components/StopCard";

const DRIVER_APP_VERSION = "v0.2.0 — 2026-02-20";

// ==== TYPES ====

type Driver = {
  id: string;
  full_name: string;
  license_number: string | null;
  is_active: boolean;
  pin: string | null;
  created_at: string;
};

type Vehicle = {
  id: string;
  label: string;
  year: number | null;
  make: string | null;
  model: string | null;
  plate: string | null;
  vin: string | null;
  is_active: boolean;
  created_at: string;
};

type TimeEntry = {
  id: string;
  work_date: string;
  start_time: string;
  end_time: string | null;
  duration_seconds: number | null;
};

type DriverRouteSummary = {
  id: string;
  name: string;
  direction: "AM" | "MIDDAY" | "PM";
  is_active: boolean;
  effective_start_date: string | null;
  effective_end_date: string | null;
};

// Format seconds as HH:MM:SS
function formatDuration(totalSeconds: number): string {
  const secs = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  const seconds = secs % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const ONE_HOUR_MS = 60 * 60 * 1000;

function findNextPickupTime(
  stopsMap: Record<string, RouteStopForDriver[]>,
  attendanceState: Record<string, AttendanceStatus>,
): Date | null {
  const now = new Date();
  let earliest: Date | null = null;

  for (const stops of Object.values(stopsMap)) {
    for (const stop of stops) {
      if (stop.stop_type !== "pickup_home" && stop.stop_type !== "pickup_school") continue;
      if (!stop.planned_time) continue;

      const studentIds =
        stop.household_student_ids.length > 0
          ? stop.household_student_ids
          : stop.student_id
            ? [stop.student_id]
            : [];

      if (studentIds.length === 0) continue;

      const allConfirmed = studentIds.every((sid) => {
        const compositeKey = `${sid}:${stop.id}`;
        return attendanceState[compositeKey] || attendanceState[sid];
      });

      if (allConfirmed) continue;

      const parts = stop.planned_time.split(":");
      const pickupDate = new Date();
      pickupDate.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);

      if (pickupDate.getTime() <= now.getTime()) continue;

      if (!earliest || pickupDate.getTime() < earliest.getTime()) {
        earliest = pickupDate;
      }
    }
  }

  return earliest;
}

export default function DriverPage() {
  const router = useRouter();

  const [currentDriver, setCurrentDriver] = useState<Driver | null>(null);
  const [driverName, setDriverName] = useState("");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  // Time tracking state
  const [clockBaseSeconds, setClockBaseSeconds] = useState(0);
  const [activeSince, setActiveSince] = useState<Date | null>(null);
  const [displaySeconds, setDisplaySeconds] = useState(0);

  // Auto-pause state
  const [clockPaused, setClockPaused] = useState<{
    resumeAt: Date;
    nextPickupTime: string;
  } | null>(null);
  const pauseCheckedRef = useRef(false);

  // Today's routes state
  const [todayRoutesLoading, setTodayRoutesLoading] = useState(false);
  const [todayRoutesError, setTodayRoutesError] = useState<string | null>(null);
  const [todayRoutes, setTodayRoutes] = useState<DriverRouteSummary[]>([]);
  const [todayRouteStops, setTodayRouteStops] = useState<
    Record<string, RouteStopForDriver[]>
  >({});
  const [completingRouteId, setCompletingRouteId] = useState<string | null>(null);

  // Attendance state
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceStatus>>({});

  // Per-shift inspection gate
  type ShiftStatus = {
    preTripDone: boolean;
    postTripDone: boolean;
    checking: boolean;
  };
  const [shiftStatus, setShiftStatus] = useState<Record<string, ShiftStatus>>({
    AM: { preTripDone: false, postTripDone: false, checking: true },
    PM: { preTripDone: false, postTripDone: false, checking: true },
  });
  const [originalRouteCounts, setOriginalRouteCounts] = useState<{ AM: number; PM: number }>({ AM: 0, PM: 0 });

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedVehicleId),
    [vehicles, selectedVehicleId],
  );

  const vehicleMainLine = useMemo(() => {
    if (!selectedVehicle) return "Unknown vehicle";
    const parts = [
      selectedVehicle.year ?? "",
      selectedVehicle.make ?? "",
      selectedVehicle.model ?? "",
    ]
      .map((p) => (p == null ? "" : String(p)))
      .join(" ")
      .trim();
    return parts || selectedVehicle.label;
  }, [selectedVehicle]);

  // Restore previous driver session from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;

    const restoreSession = async () => {
      const stored = window.localStorage.getItem("transafeDriverSession");
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as {
            driverId: string;
            driverName: string;
            licenseNumber: string | null;
            vehicleId: string;
          };

          if (!parsed.driverId || !parsed.driverName) return;

          setCurrentDriver({
            id: parsed.driverId,
            full_name: parsed.driverName,
            license_number: parsed.licenseNumber,
            is_active: true,
            pin: null,
            created_at: "",
          });

          setDriverName(parsed.driverName);
          if (parsed.vehicleId) setSelectedVehicleId(parsed.vehicleId);
          setIsSessionReady(true);
          return;
        } catch (err) {
          console.error("Failed to restore driver session", err);
        }
      }
    };

    void restoreSession();
  }, []);

  // Load active vehicles
  useEffect(() => {
    const loadVehicles = async () => {
      setLoadingVehicles(true);
      try {
        const res = await fetch("/api/admin/vehicles");
        if (!res.ok) throw new Error("Failed to load vehicles");
        const body = await res.json();
        const activeVehicles = (body.vehicles || [])
          .filter((v: Vehicle) => v.is_active)
          .sort((a: Vehicle, b: Vehicle) => a.label.localeCompare(b.label));
        setVehicles(activeVehicles);
      } catch (err: any) {
        console.error(err);
      } finally {
        setLoadingVehicles(false);
      }
    };

    loadVehicles();
  }, []);

  const loadTimeForToday = async (driverId: string) => {
    const todayStr = getTodayDateString();
    try {
      const res = await fetch(`/api/driver/time?driverId=${driverId}&date=${todayStr}`);
      if (!res.ok) return;
      const body = await res.json();

      setClockBaseSeconds(body.baseSeconds ?? 0);
      setActiveSince(body.activeSince ? new Date(body.activeSince) : null);
      setDisplaySeconds(body.baseSeconds ?? 0);
    } catch (err: any) {
      console.error("Failed to load driver time summary", err);
    }
  };

  // Load today's routes
  const loadTodayRoutes = async (driverId: string) => {
    setTodayRoutesLoading(true);
    setTodayRoutesError(null);

    try {
      const res = await fetch(`/api/driver/routes?driverId=${driverId}`);
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to load routes");
      }
      const body = await res.json();
      const routes: DriverRouteSummary[] = body.routes ?? [];
      setTodayRoutes(routes);
      setTodayRouteStops(body.stopsMap ?? {});

      // Use server-provided total counts (includes already-completed routes)
      if (body.totalRouteCounts) {
        setOriginalRouteCounts(body.totalRouteCounts);
      }

      // Load existing attendance for today
      if (body.attendance) {
        setAttendanceMap(body.attendance);
      }
    } catch (err: any) {
      console.error("Failed to load today's routes for driver", err);
      setTodayRoutesError(
        err?.message ?? "Failed to load today's routes. Please contact admin.",
      );
    } finally {
      setTodayRoutesLoading(false);
    }
  };

  // Check per-shift inspection status (pre and post for AM and PM)
  const checkShiftInspections = async (driverId: string) => {
    setShiftStatus((prev) => ({
      AM: { ...prev.AM, checking: true },
      PM: { ...prev.PM, checking: true },
    }));
    try {
      const today = getTodayDateString();
      const base = `/api/driver/inspections?driverId=${driverId}&date=${today}`;
      const [amPre, amPost, pmPre, pmPost] = await Promise.all([
        fetch(`${base}&type=pre&shift=AM`).then((r) => r.ok ? r.json() : { inspections: [] }),
        fetch(`${base}&type=post&shift=AM`).then((r) => r.ok ? r.json() : { inspections: [] }),
        fetch(`${base}&type=pre&shift=PM`).then((r) => r.ok ? r.json() : { inspections: [] }),
        fetch(`${base}&type=post&shift=PM`).then((r) => r.ok ? r.json() : { inspections: [] }),
      ]);
      setShiftStatus({
        AM: {
          preTripDone: (amPre.inspections ?? []).length > 0,
          postTripDone: (amPost.inspections ?? []).length > 0,
          checking: false,
        },
        PM: {
          preTripDone: (pmPre.inspections ?? []).length > 0,
          postTripDone: (pmPost.inspections ?? []).length > 0,
          checking: false,
        },
      });
    } catch {
      setShiftStatus({
        AM: { preTripDone: false, postTripDone: false, checking: false },
        PM: { preTripDone: false, postTripDone: false, checking: false },
      });
    }
  };

  // When session becomes ready, load time, routes, and check shift inspections
  useEffect(() => {
    if (!isSessionReady || !currentDriver?.id) return;
    loadTimeForToday(currentDriver.id);
    loadTodayRoutes(currentDriver.id);
    checkShiftInspections(currentDriver.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSessionReady, currentDriver?.id]);

  // Re-check shift inspections when the page regains focus (e.g. returning from pre-trip/post-trip page)
  useEffect(() => {
    if (!isSessionReady || !currentDriver?.id) return;
    const onFocus = () => {
      checkShiftInspections(currentDriver.id);
      loadTimeForToday(currentDriver.id);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSessionReady, currentDriver?.id]);

  // Tick displaySeconds when active
  useEffect(() => {
    if (!activeSince) {
      setDisplaySeconds(clockBaseSeconds);
      return;
    }

    const startMs = activeSince.getTime();
    const update = () => {
      const elapsed = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
      setDisplaySeconds(clockBaseSeconds + elapsed);
    };

    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [activeSince, clockBaseSeconds]);

  // Auto-resume timer
  useEffect(() => {
    if (!clockPaused || !currentDriver?.id) return;

    const doResume = async () => {
      try {
        await fetch("/api/driver/time", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ driver_id: currentDriver.id, action: "resume" }),
        });
        await loadTimeForToday(currentDriver.id);
        setClockPaused(null);
      } catch (err) {
        console.error("Failed to auto-resume clock:", err);
      }
    };

    const msUntilResume = clockPaused.resumeAt.getTime() - Date.now();

    if (msUntilResume <= 0) {
      doResume();
      return;
    }

    const timer = setTimeout(doResume, msUntilResume);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clockPaused, currentDriver?.id]);

  // Restore pause state after page load / refresh
  useEffect(() => {
    if (!isSessionReady || !currentDriver?.id) return;
    if (todayRoutesLoading) return;
    if (pauseCheckedRef.current) return;

    pauseCheckedRef.current = true;

    if (activeSince !== null) return;
    if (clockBaseSeconds === 0) return;
    if (todayRoutes.length === 0) return;

    const nextPickup = findNextPickupTime(todayRouteStops, attendanceMap);
    if (!nextPickup) return;

    const resumeAt = new Date(Math.max(nextPickup.getTime() - ONE_HOUR_MS, Date.now()));

    setClockPaused({
      resumeAt,
      nextPickupTime: nextPickup.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSessionReady, currentDriver?.id, todayRoutesLoading, activeSince, clockBaseSeconds, todayRoutes, todayRouteStops, attendanceMap]);

  // Login handler
  const handleLoginSuccess = (
    driver: Driver,
    vehicleId: string,
  ) => {
    setCurrentDriver(driver);
    setDriverName(driver.full_name);
    setSelectedVehicleId(vehicleId);
    setIsSessionReady(true);
    setSubmitMessage(null);
    setError(null);
  };

  const handleLogout = () => {
    setIsSessionReady(false);
    setCurrentDriver(null);
    setDriverName("");
    setSelectedVehicleId("");
    setSubmitMessage(null);
    setError(null);
    setClockBaseSeconds(0);
    setActiveSince(null);
    setDisplaySeconds(0);
    setClockPaused(null);
    pauseCheckedRef.current = false;
    setAttendanceMap({});

    if (typeof window !== "undefined") {
      window.localStorage.removeItem("transafeDriverId");
      window.localStorage.removeItem("transafeDriverName");
      window.localStorage.removeItem("transafeDriverSession");
    }

    router.push("/");
  };

  const handleMarkRouteComplete = async (routeId: string) => {
    if (!currentDriver) {
      setTodayRoutesError("Your driver session is not fully loaded yet.");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to mark this route as COMPLETE for today? Once confirmed, it will disappear from today's list on this device.",
    );
    if (!confirmed) return;

    setCompletingRouteId(routeId);

    try {
      const res = await fetch("/api/driver/complete-route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driver_id: currentDriver.id,
          route_id: routeId,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to mark route complete");
      }

      setTodayRoutes((prev) => prev.filter((r) => r.id !== routeId));
      setTodayRouteStops((prev) => {
        const copy = { ...prev };
        delete copy[routeId];
        return copy;
      });
    } catch (err: any) {
      console.error("Failed to mark route as complete", err);
      setTodayRoutesError(
        "Could not mark route as complete. Please try again or contact admin.",
      );
    } finally {
      setCompletingRouteId(null);
    }
  };

  const handleAttendanceChange = async (compositeKey: string, status: AttendanceStatus) => {
    const updatedMap = { ...attendanceMap, [compositeKey]: status };
    setAttendanceMap(updatedMap);

    // Check for auto-pause only on drop-offs when clock is running
    if (status !== "dropped_off" || !activeSince || !currentDriver?.id) return;

    const nextPickup = findNextPickupTime(todayRouteStops, updatedMap);
    if (!nextPickup) return;

    const gapMs = nextPickup.getTime() - Date.now();
    if (gapMs <= ONE_HOUR_MS) return;

    try {
      await fetch("/api/driver/time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driver_id: currentDriver.id, action: "pause" }),
      });

      const resumeAt = new Date(nextPickup.getTime() - ONE_HOUR_MS);

      setClockPaused({
        resumeAt,
        nextPickupTime: nextPickup.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }),
      });
      setActiveSince(null);
      await loadTimeForToday(currentDriver.id);
    } catch (err) {
      console.error("Failed to auto-pause clock:", err);
    }
  };

  // 1) Pre-session screen - login form
  if (!isSessionReady) {
    return (
      <DriverLoginForm
        onLoginSuccess={handleLoginSuccess}
        vehicles={vehicles}
        loadingVehicles={loadingVehicles}
      />
    );
  }

  // 2) Session ready - main driver view
  return (
    <div className="space-y-5">
      {/* Header with live clock */}
      <section className="card space-y-3">
        <h1 className="text-base font-semibold uppercase tracking-[0.16em] text-slate-200">
          Driver Portal
        </h1>

        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="text-base font-semibold text-emerald-200 sm:text-lg">
              {driverName.trim()}
              <span className="ml-2 text-sm font-normal text-slate-300">
                Lic #{currentDriver?.license_number ?? "N/A"}
              </span>
            </p>
            {selectedVehicle ? (
              <div className="space-y-0.5 text-sm sm:text-base">
                <p className="text-slate-100">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Bus </span>
                  <span className="font-semibold">{selectedVehicle.label}</span>
                  <span className="mx-1.5 text-slate-500">&middot;</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Plate </span>
                  <span>{selectedVehicle.plate || "N/A"}</span>
                </p>
                {vehicleMainLine && (
                  <p className="text-slate-300">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Vehicle </span>
                    {vehicleMainLine}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-100">{vehicleMainLine}</p>
            )}
          </div>

          <div className="shrink-0 rounded-2xl bg-slate-900 px-4 py-3 text-center ring-1 ring-emerald-500/60">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
              Today&apos;s hours
            </p>
            <p className="font-mono text-xl font-semibold text-emerald-300 sm:text-2xl">
              {formatDuration(displaySeconds)}
            </p>
          </div>
        </div>
      </section>

      {/* Quick nav */}
      <section className="card px-2 py-2">
        <nav className="grid grid-cols-3 gap-2 text-xs sm:text-sm">
          <Link
            href="/driver/time-log"
            className="flex items-center justify-center rounded-xl bg-slate-900 px-3 py-2 font-semibold text-slate-100 ring-1 ring-white/10 hover:bg-slate-800 active:scale-[0.97]"
          >
            Time Log
          </Link>
          <Link
            href="/driver/inspections"
            className="flex items-center justify-center rounded-xl bg-slate-900 px-3 py-2 font-semibold text-slate-100 ring-1 ring-white/10 hover:bg-slate-800 active:scale-[0.97]"
          >
            Inspections History
          </Link>
          <Link
            href="/driver/help"
            className="flex items-center justify-center rounded-xl bg-slate-900 px-3 py-2 font-semibold text-slate-100 ring-1 ring-white/10 hover:bg-slate-800 active:scale-[0.97]"
          >
            Help
          </Link>
        </nav>
      </section>

      {/* Today's routes — per-shift gating */}
      <section className="card space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold uppercase tracking-[0.16em] text-slate-200">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </h2>
            <p className="text-xs text-slate-300">
              Your route assignments for today.
            </p>
          </div>
          {todayRoutesLoading && (
            <p className="text-xs text-slate-300">Loading...</p>
          )}
        </div>

        {todayRoutesError && (
          <p className="text-sm font-medium text-rose-300">
            {todayRoutesError}
          </p>
        )}

        {/* Auto-pause banner */}
        {clockPaused && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/30 px-4 py-4 space-y-2">
            <p className="text-sm font-semibold text-amber-200">
              Clock paused
            </p>
            <p className="text-xs text-amber-100/70">
              Next pickup at {clockPaused.nextPickupTime}. Clock resumes
              automatically at{" "}
              {clockPaused.resumeAt.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })}
              .
            </p>
            <p className="text-xs text-amber-100/70">
              Only mark the route as complete after the last student has been
              dropped off.
            </p>
          </div>
        )}

        {/* AM Shift Section */}
        {(() => {
          const amRoutes = todayRoutes.filter(
            (r) => r.direction === "AM" || r.direction === "MIDDAY"
          );
          const status = shiftStatus.AM;
          const allAmDone = originalRouteCounts.AM > 0 && amRoutes.length === 0;

          return (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                AM Shift
              </h3>

              {status.checking && (
                <p className="text-xs text-slate-400">Checking AM status...</p>
              )}

              {/* Gate: AM pre-trip needed */}
              {!status.checking && !status.preTripDone && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-950/30 px-4 py-4 text-center space-y-3">
                  <p className="text-sm font-semibold text-amber-200">
                    Complete your AM Pre-Trip Inspection
                  </p>
                  <p className="text-xs text-amber-100/70">
                    Submit your AM pre-trip inspection to unlock your morning routes.
                  </p>
                  <Link
                    href="/driver/pre-trip?shift=AM"
                    className="inline-block rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-slate-950 shadow-md ring-1 ring-emerald-400/70 hover:bg-emerald-500 active:scale-[0.97]"
                  >
                    Start AM Pre-Trip
                  </Link>
                </div>
              )}

              {/* AM routes visible after pre-trip */}
              {!status.checking && status.preTripDone && !allAmDone && (
                <>
                  {amRoutes.length === 0 && !todayRoutesLoading && (
                    <p className="text-sm text-slate-200">
                      No AM routes assigned for today.
                    </p>
                  )}
                  {amRoutes.length > 0 && (
                    <div className="space-y-4">
                      {amRoutes.map((route) => (
                        <RouteCard
                          key={route.id}
                          route={route}
                          stops={todayRouteStops[route.id] || []}
                          driverId={currentDriver?.id ?? ""}
                          completingRouteId={completingRouteId}
                          onMarkComplete={handleMarkRouteComplete}
                          onAttendanceChange={handleAttendanceChange}
                          attendanceMap={attendanceMap}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Gate: AM post-trip needed */}
              {!status.checking && status.preTripDone && allAmDone && !status.postTripDone && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-950/30 px-4 py-4 text-center space-y-3">
                  <p className="text-sm font-semibold text-amber-200">
                    Submit your AM Post-Trip Inspection
                  </p>
                  <p className="text-xs text-amber-100/70">
                    All AM routes are complete. Please submit your AM post-trip inspection.
                  </p>
                  <Link
                    href="/driver/post-trip?shift=AM"
                    className="inline-block rounded-xl bg-slate-700 px-6 py-2.5 text-sm font-semibold text-slate-50 shadow-md ring-1 ring-slate-500/70 hover:bg-slate-600 active:scale-[0.97]"
                  >
                    Start AM Post-Trip
                  </Link>
                </div>
              )}

              {/* AM shift complete */}
              {!status.checking && status.postTripDone && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-4 py-3 text-center">
                  <p className="text-sm font-semibold text-emerald-300">
                    AM shift complete
                  </p>
                </div>
              )}
            </div>
          );
        })()}

        {/* PM Shift Section */}
        {(() => {
          const pmRoutes = todayRoutes.filter((r) => r.direction === "PM");
          const status = shiftStatus.PM;
          const amStatus = shiftStatus.AM;
          const allPmDone = originalRouteCounts.PM > 0 && pmRoutes.length === 0;
          const amShiftComplete = amStatus.preTripDone && amStatus.postTripDone;

          return (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                PM Shift
              </h3>

              {status.checking && (
                <p className="text-xs text-slate-400">Checking PM status...</p>
              )}

              {/* Gate: AM shift must be complete before PM pre-trip */}
              {!status.checking && !status.preTripDone && !amShiftComplete && (
                <div className="rounded-xl border border-slate-500/30 bg-slate-900/40 px-4 py-4 text-center space-y-2">
                  <p className="text-sm font-semibold text-slate-300">
                    PM shift locked
                  </p>
                  <p className="text-xs text-slate-400">
                    Complete your AM pre-trip and post-trip inspections before starting your PM shift.
                  </p>
                </div>
              )}

              {/* Gate: PM pre-trip needed (AM shift is done) */}
              {!status.checking && !status.preTripDone && amShiftComplete && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-950/30 px-4 py-4 text-center space-y-3">
                  <p className="text-sm font-semibold text-amber-200">
                    Complete your PM Pre-Trip Inspection
                  </p>
                  <p className="text-xs text-amber-100/70">
                    Submit your PM pre-trip inspection to unlock your afternoon routes.
                  </p>
                  <Link
                    href="/driver/pre-trip?shift=PM"
                    className="inline-block rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-slate-950 shadow-md ring-1 ring-emerald-400/70 hover:bg-emerald-500 active:scale-[0.97]"
                  >
                    Start PM Pre-Trip
                  </Link>
                </div>
              )}

              {/* PM routes visible after pre-trip */}
              {!status.checking && status.preTripDone && !allPmDone && (
                <>
                  {pmRoutes.length === 0 && !todayRoutesLoading && (
                    <p className="text-sm text-slate-200">
                      No PM routes assigned for today.
                    </p>
                  )}
                  {pmRoutes.length > 0 && (
                    <div className="space-y-4">
                      {pmRoutes.map((route) => (
                        <RouteCard
                          key={route.id}
                          route={route}
                          stops={todayRouteStops[route.id] || []}
                          driverId={currentDriver?.id ?? ""}
                          completingRouteId={completingRouteId}
                          onMarkComplete={handleMarkRouteComplete}
                          onAttendanceChange={handleAttendanceChange}
                          attendanceMap={attendanceMap}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Gate: PM post-trip needed */}
              {!status.checking && status.preTripDone && allPmDone && !status.postTripDone && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-950/30 px-4 py-4 text-center space-y-3">
                  <p className="text-sm font-semibold text-amber-200">
                    Submit your PM Post-Trip Inspection
                  </p>
                  <p className="text-xs text-amber-100/70">
                    All PM routes are complete. Please submit your PM post-trip inspection.
                  </p>
                  <Link
                    href="/driver/post-trip?shift=PM"
                    className="inline-block rounded-xl bg-slate-700 px-6 py-2.5 text-sm font-semibold text-slate-50 shadow-md ring-1 ring-slate-500/70 hover:bg-slate-600 active:scale-[0.97]"
                  >
                    Start PM Post-Trip
                  </Link>
                </div>
              )}

              {/* PM shift complete */}
              {!status.checking && status.postTripDone && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-4 py-3 text-center">
                  <p className="text-sm font-semibold text-emerald-300">
                    PM shift complete
                  </p>
                </div>
              )}
            </div>
          );
        })()}
      </section>

      {error && (
        <section className="card border border-red-500/50 bg-red-950/40">
          <p className="text-xs font-medium text-red-200">{error}</p>
        </section>
      )}

      {submitMessage && (
        <section className="card border-emerald-500/60 bg-emerald-900/20">
          <p className="text-xs font-medium text-emerald-100">
            {submitMessage}
          </p>
        </section>
      )}

      {/* Sign-out footer */}
      <section className="mt-2 border-t border-slate-800 pt-3 text-[11px] text-slate-500">
        <button
          type="button"
          onClick={handleLogout}
          className="font-semibold text-slate-200 underline-offset-2 hover:underline"
        >
          Sign out of app
        </button>
        <p className="mt-1 leading-snug text-slate-500">
          This only signs you out of the Transafe app. It does not clock you
          out. Your work hours are tracked separately when you start and end
          your shifts.
        </p>
      </section>
      <footer className="mt-8 pt-4 border-t border-slate-800/60 text-center text-[11px] text-slate-500/70">
        <span className="font-mono tracking-wide uppercase">
          Build {DRIVER_APP_VERSION}
        </span>
      </footer>
    </div>
  );
}
