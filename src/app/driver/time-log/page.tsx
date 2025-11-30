"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type TimeEntry = {
  id: string;
  driver_id: string;
  work_date: string; // YYYY-MM-DD
  start_time: string;
  end_time: string | null;
  duration_seconds: number | null;
};

type DriverSession = {
  driverId: string;
  driverName: string;
  licenseNumber: string | null;
};

type DaySummary = {
  date: string; // YYYY-MM-DD
  entries: TimeEntry[];
  totalSeconds: number;
};

function formatDuration(totalSeconds: number): string {
  const secs = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(
    2,
    "0",
  )}:${String(s).padStart(2, "0")}`;
}

function formatDateNice(ymd: string): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const d = new Date(year, (month ?? 1) - 1, day ?? 1);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(iso: string | null): string {
  if (!iso) return "--:--";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--";
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Start of the week (Sunday–Saturday)
function getSundayOfWeek(date: Date): Date {
  const day = date.getDay(); // 0 (Sun) – 6 (Sat), where 0 is Sunday
  // Subtract the day index to get back to Sunday
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - day);
}

function formatWeekRangeLabel(sunday: Date): string {
  const saturday = new Date(
    sunday.getFullYear(),
    sunday.getMonth(),
    sunday.getDate() + 6,
  );

  const startStr = sunday.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const endStr = saturday.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  return `${startStr} – ${endStr}`;
}

export default function DriverTimeLogPage() {
  const router = useRouter();

  const [driver, setDriver] = useState<DriverSession | null>(null);
  const [loadingDriver, setLoadingDriver] = useState(true);

  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 0 = current week, -1 = previous week, +1 = next week, etc.
  const [weekOffset, setWeekOffset] = useState(0);

  // Compute the Sunday of the displayed week based on the offset (Sun–Sat)
  const weekStart = useMemo(() => {
    const baseSunday = getSundayOfWeek(new Date());
    return new Date(
      baseSunday.getFullYear(),
      baseSunday.getMonth(),
      baseSunday.getDate() + weekOffset * 7,
    );
  }, [weekOffset]);

  const weekLabel = useMemo(
    () => formatWeekRangeLabel(weekStart),
    [weekStart],
  );

  const weekStartYMD = useMemo(() => {
    const y = weekStart.getFullYear();
    const m = String(weekStart.getMonth() + 1).padStart(2, "0");
    const d = String(weekStart.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [weekStart]);

  const weekEndYMD = useMemo(() => {
    const saturday = new Date(
      weekStart.getFullYear(),
      weekStart.getMonth(),
      weekStart.getDate() + 6,
    );
    const y = saturday.getFullYear();
    const m = String(saturday.getMonth() + 1).padStart(2, "0");
    const d = String(saturday.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [weekStart]);

  // Restore driver from localStorage (same keys used by Driver Portal)
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const stored = window.localStorage.getItem("transafeDriverSession");
      if (stored) {
        const parsed = JSON.parse(stored) as {
          driverId: string;
          driverName: string;
          licenseNumber: string | null;
        };

        if (parsed.driverId && parsed.driverName) {
          setDriver({
            driverId: parsed.driverId,
            driverName: parsed.driverName,
            licenseNumber: parsed.licenseNumber,
          });
          setLoadingDriver(false);
          return;
        }
      }

      // Fallback: older keys
      const fallbackId = window.localStorage.getItem("transafeDriverId");
      const fallbackName = window.localStorage.getItem("transafeDriverName");

      if (fallbackId && fallbackName) {
        setDriver({
          driverId: fallbackId,
          driverName: fallbackName,
          licenseNumber: null,
        });
      }
    } catch (err) {
      console.error("Failed to restore driver in Time Log", err);
    } finally {
      setLoadingDriver(false);
    }
  }, []);

  // Load entries for the selected week (Mon–Fri)
  useEffect(() => {
    if (!driver?.driverId) return;

    const load = async () => {
      setLoadingEntries(true);
      setError(null);

      try {
        const { data, error: timeErr } = await supabase
          .from("driver_time_entries")
          .select(
            "id, driver_id, work_date, start_time, end_time, duration_seconds",
          )
          .eq("driver_id", driver.driverId)
          .gte("work_date", weekStartYMD)
          .lte("work_date", weekEndYMD)
          .order("work_date", { ascending: false })
          .order("start_time", { ascending: true });

        if (timeErr) throw timeErr;

        setEntries((data as TimeEntry[]) || []);
      } catch (err: any) {
        console.error(err);
        setError(
          err?.message ??
            "Could not load your time log. Please try again or contact your supervisor.",
        );
      } finally {
        setLoadingEntries(false);
      }
    };

    void load();
  }, [driver?.driverId, weekStartYMD, weekEndYMD]);

  // Group by day for display
  const daySummaries: DaySummary[] = useMemo(() => {
    if (!entries || entries.length === 0) return [];
    const map = new Map<string, DaySummary>();

    for (const entry of entries) {
      const existing = map.get(entry.work_date);
      let duration = 0;

      if (entry.end_time) {
        duration =
          entry.duration_seconds ??
          Math.max(
            0,
            Math.floor(
              (new Date(entry.end_time).getTime() -
                new Date(entry.start_time).getTime()) /
                1000,
            ),
          );
      } else {
        // Open session – compute until now
        const now = new Date();
        duration = Math.max(
          0,
          Math.floor(
            (now.getTime() - new Date(entry.start_time).getTime()) / 1000,
          ),
        );
      }

      if (!existing) {
        map.set(entry.work_date, {
          date: entry.work_date,
          entries: [entry],
          totalSeconds: duration,
        });
      } else {
        existing.entries.push(entry);
        existing.totalSeconds += duration;
      }
    }

    // Sort by date descending (most recent first)
    return Array.from(map.values()).sort((a, b) =>
      a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
    );
  }, [entries]);

  // Total hours for the week
  const weekTotalSeconds = useMemo(
    () => daySummaries.reduce((sum, d) => sum + d.totalSeconds, 0),
    [daySummaries],
  );

  const handleBackToPortal = () => {
    router.push("/driver");
  };

  const goToPreviousWeek = () => setWeekOffset((prev) => prev - 1);
  const goToNextWeek = () => setWeekOffset((prev) => prev + 1);
  const goToThisWeek = () => setWeekOffset(0);

  if (loadingDriver) {
    return (
      <div className="space-y-4 max-w-xl mx-auto">
        <section className="card">
          <p className="text-sm text-slate-200">Loading driver session…</p>
        </section>
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="space-y-4 max-w-xl mx-auto">
        <section className="card space-y-3">
          <h1 className="text-lg font-semibold">Time Log</h1>
          <p className="text-sm text-slate-200/80">
            We couldn&apos;t find an active driver session.
          </p>
          <p className="text-xs text-slate-400">
            Please go back to the driver portal, sign in with your name and
            vehicle, then return to the Time Log.
          </p>
          <button
            type="button"
            onClick={() => router.push("/driver")}
            className="btn-primary w-full text-sm"
          >
            Go to Driver Portal
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      {/* Top back button */}
      <section className="card flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleBackToPortal}
          className="btn-ghost px-3 py-1 text-xs"
        >
          ← Back to Driver Portal
        </button>
        <p className="text-[11px] text-slate-400">
          Review your daily hours and total for this week.
        </p>
      </section>
      {/* Header */}
      <section className="card flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold sm:text-xl">Time Log</h1>
          <p className="text-sm text-slate-200/80">
            {driver.driverName} •{" "}
            <span className="text-xs text-slate-300">
              License #: {driver.licenseNumber ?? "N/A"}
            </span>
          </p>
          <p className="text-xs text-slate-400">
            Week of{" "}
            <span className="font-semibold text-slate-100">
              {weekLabel}
            </span>{" "}
            (Sun–Sat)
          </p>

        </div>

        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <div className="rounded-2xl bg-slate-900 px-3 py-2 text-center sm:text-right ring-1 ring-slate-600/70">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Total hrs this week
            </p>
            <p className="font-mono text-sm font-semibold text-slate-50">
              {formatDuration(weekTotalSeconds)}
            </p>
          </div>

          <div className="flex flex-wrap gap-1 justify-start sm:justify-end">
            <button
              type="button"
              onClick={goToPreviousWeek}
              className="btn-ghost px-2 py-1 text-[11px]"
            >
              ◀ Previous week
            </button>
            <button
              type="button"
              onClick={goToThisWeek}
              className="btn-ghost px-2 py-1 text-[11px]"
            >
              This week
            </button>
            <button
              type="button"
              onClick={goToNextWeek}
              className="btn-ghost px-2 py-1 text-[11px]"
            >
              Next week ▶
            </button>
          </div>

        </div>
      </section>

      {error && (
        <section className="card border border-red-500/50 bg-red-950/40">
          <p className="text-xs font-medium text-red-200">{error}</p>
        </section>
      )}

      {/* Time entries */}
      <section className="space-y-3">
        {loadingEntries && (
          <section className="card">
            <p className="text-sm text-slate-200">Loading time entries…</p>
          </section>
        )}

        {!loadingEntries && daySummaries.length === 0 && !error && (
          <section className="card">
            <p className="text-sm text-slate-200/90">
              No time entries found for this week.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Once you submit pre-trip and post-trip inspections tied to your
              daily shifts, your timecard sessions for this week will appear
              here.
            </p>
          </section>
        )}

        {daySummaries.map((day) => (
          <section
            key={day.date}
            className="card space-y-2 rounded-2xl bg-slate-950/70"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-50">
                  {formatDateNice(day.date)}
                </p>
                <p className="text-[11px] text-slate-400">
                  {day.entries.length} session
                  {day.entries.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Daily total
                </p>
                <p className="font-mono text-sm font-semibold text-emerald-200">
                  {formatDuration(day.totalSeconds)}
                </p>
              </div>
            </div>

            <div className="space-y-2 rounded-xl bg-slate-950/80 p-2">
              {day.entries.map((entry) => {
                const isOpen = !entry.end_time;

                let computedSeconds = 0;
                if (entry.end_time) {
                  computedSeconds =
                    entry.duration_seconds ??
                    Math.max(
                      0,
                      Math.floor(
                        (new Date(entry.end_time).getTime() -
                          new Date(entry.start_time).getTime()) /
                          1000,
                      ),
                    );
                } else {
                  const now = new Date();
                  computedSeconds = Math.max(
                    0,
                    Math.floor(
                      (now.getTime() - new Date(entry.start_time).getTime()) /
                        1000,
                    ),
                  );
                }

                const duration = formatDuration(computedSeconds);

                return (
                  <div
                    key={entry.id}
                    className="flex flex-col gap-1 rounded-lg border border-white/5 bg-slate-900/80 px-2 py-2 text-xs sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                  >
                    <div className="flex gap-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
                          Start
                        </p>
                        <p className="font-mono text-[13px] text-slate-50">
                          {formatTime(entry.start_time)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
                          End
                        </p>
                        <p className="font-mono text-[13px] text-slate-50">
                          {entry.end_time ? formatTime(entry.end_time) : "—"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
                          Duration
                        </p>
                        <p className="font-mono text-[13px] text-emerald-200">
                          {duration}
                        </p>
                      </div>
                      {isOpen && (
                        <span className="inline-flex items-center rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-200">
                          Open session
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </section>

      {/* Small hint footer */}
      <section className="card">
        <p className="text-[11px] text-slate-400">
          Your time entries are created automatically when you complete{" "}
          <span className="font-semibold text-slate-200">
            pre-trip (clock start)
          </span>{" "}
          and{" "}
          <span className="font-semibold text-slate-200">
            post-trip (clock stop)
          </span>{" "}
          inspections in the Driver Portal.
        </p>
      </section>
    </div>
  );
}
