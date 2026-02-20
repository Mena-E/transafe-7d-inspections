"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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
      setTodayRoutes(body.routes ?? []);
      setTodayRouteStops(body.stopsMap ?? {});

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

  // When session becomes ready, load time and routes
  useEffect(() => {
    if (!isSessionReady || !currentDriver?.id) return;
    loadTimeForToday(currentDriver.id);
    loadTodayRoutes(currentDriver.id);
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

  const handleAttendanceChange = (studentId: string, status: AttendanceStatus) => {
    setAttendanceMap((prev) => ({ ...prev, [studentId]: status }));
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
      <section className="card flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h1 className="mb-1 text-lg font-semibold md:text-xl">
            Driver Portal
          </h1>
          <p className="text-sm text-slate-200/80">
            Signed in as{" "}
            <span className="font-semibold text-emerald-200">
              {driverName.trim()}
            </span>
          </p>
          <p className="text-xs text-slate-300">
            License #: {currentDriver?.license_number ?? "N/A"}
          </p>
          {selectedVehicle ? (
            <>
              <p className="mt-1 text-sm font-semibold text-emerald-200">
                Vehicle ID: {selectedVehicle.label}
              </p>
              <p className="text-xs font-medium text-slate-100">
                Plate: {selectedVehicle.plate || "N/A"}
              </p>
              {vehicleMainLine && (
                <p className="text-[11px] text-slate-400">
                  Year/Make/Model: {vehicleMainLine}
                </p>
              )}
            </>
          ) : (
            <p className="mt-1 text-sm font-medium text-slate-100">
              Vehicle: {vehicleMainLine}
            </p>
          )}
        </div>

        <div className="flex w-full flex-col gap-2 md:w-auto md:items-end">
          <div className="w-full rounded-2xl bg-slate-900 px-3 py-2 text-center md:text-right ring-1 ring-emerald-500/60">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
              Today&apos;s hours
            </p>
            <p className="font-mono text-lg font-semibold text-emerald-300">
              {formatDuration(displaySeconds)}
            </p>
          </div>
        </div>
      </section>

      {/* Pre / Post selection */}
      <section className="card space-y-3">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Inspections
          </p>
          <p className="text-sm text-slate-200/90">
            Choose <span className="font-semibold">Pre Trip</span> to start
            your shift, and{" "}
            <span className="font-semibold">Post Trip</span> to close it out.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Link
            href="/driver/pre-trip"
            className="block w-full rounded-2xl bg-emerald-600 px-4 py-3 text-center text-sm font-semibold text-slate-950 shadow-md ring-1 ring-emerald-400/70 hover:bg-emerald-500 hover:ring-emerald-300 active:scale-[0.97] sm:text-base"
          >
            Pre Trip Inspection
          </Link>

          <Link
            href="/driver/post-trip"
            className="block w-full rounded-2xl bg-slate-800 px-4 py-3 text-center text-sm font-semibold text-slate-50 shadow-md ring-1 ring-slate-500/70 hover:bg-slate-700 hover:ring-slate-400 active:scale-[0.97] sm:text-base"
          >
            Post Trip Inspection
          </Link>
        </div>

        <p className="text-[11px] leading-snug text-slate-400">
          Tapping a tab will open the full checklist on its own page. Your time
          clock remains linked to your inspections as before.
        </p>
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

      {/* Today's routes */}
      <section className="card space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold uppercase tracking-[0.16em] text-slate-200">
              Today&apos;s routes
            </h2>
            <p className="text-xs text-slate-300">
              Based on your weekly route assignments for today.
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

        {!todayRoutesLoading &&
          !todayRoutesError &&
          todayRoutes.length === 0 && (
            <p className="text-sm text-slate-200">
              You have no active routes assigned for today.
            </p>
          )}

        {todayRoutes.length > 0 && (
          <div className="space-y-4">
            {todayRoutes.map((route) => (
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

      {/* Inspections info */}
      <section className="card space-y-2">
        <h2 className="text-sm font-semibold text-slate-50">
          Daily inspections
        </h2>
        <p className="text-sm text-slate-300">
          Use the{" "}
          <span className="font-semibold text-emerald-300">
            Pre Trip Inspection
          </span>{" "}
          and{" "}
          <span className="font-semibold text-slate-200">
            Post Trip Inspection
          </span>{" "}
          buttons above to complete your daily checks. Your time clock will
          still start after a completed pre-trip and stop after a completed
          post-trip.
        </p>
        <p className="text-[11px] text-slate-400">
          If something looks wrong or you have trouble submitting an inspection,
          contact the Transafe office.
        </p>
      </section>

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
