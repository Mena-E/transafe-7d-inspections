// src/app/admin/timecards/[driverId]/[weekStart]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type TimeEntry = {
  id: string;
  driver_id: string;
  work_date: string; // YYYY-MM-DD
  start_time: string;
  end_time: string | null;
  duration_seconds: number | null;
};

type Driver = {
  id: string;
  full_name: string;
  license_number: string | null;
};

type DaySummary = {
  date: string;
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
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(iso: string | null): string {
  if (!iso) return "--:--";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatWeekRangeLabelFromYMD(weekStartYmd: string): string {
  const [y, m, d] = weekStartYmd.split("-").map(Number);
  const sunday = new Date(y, (m ?? 1) - 1, d ?? 1);
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

function getWeekEndYmdFromStart(weekStartYmd: string): string {
  const [y, m, d] = weekStartYmd.split("-").map(Number);
  const sunday = new Date(y, (m ?? 1) - 1, d ?? 1);
  const saturday = new Date(
    sunday.getFullYear(),
    sunday.getMonth(),
    sunday.getDate() + 6,
  );
  const yy = saturday.getFullYear();
  const mm = String(saturday.getMonth() + 1).padStart(2, "0");
  const dd = String(saturday.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export default function AdminDriverTimecardDetailPage() {
  const router = useRouter();
  const params = useParams<{ driverId: string; weekStart: string }>();

  const driverId = params.driverId;
  const weekStartYmd = params.weekStart;

  const [driver, setDriver] = useState<Driver | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load driver info
  useEffect(() => {
    if (!driverId) return;

    const loadDriver = async () => {
      try {
        const { data, error: drvErr } = await supabase
          .from("drivers")
          .select("id, full_name, license_number")
          .eq("id", driverId)
          .maybeSingle();

        if (drvErr) throw drvErr;
        setDriver((data as Driver) || null);
      } catch (err: any) {
        console.error(err);
        setError(
          err?.message ?? "Failed to load driver details for this timecard.",
        );
      }
    };

    void loadDriver();
  }, [driverId]);

  // Load time entries for this driver in this Sun–Sat week
  useEffect(() => {
    if (!driverId || !weekStartYmd) return;

    const loadEntries = async () => {
      setLoading(true);
      setError(null);

      try {
        const weekEndYmd = getWeekEndYmdFromStart(weekStartYmd);

        const { data, error: timeErr } = await supabase
          .from("driver_time_entries")
          .select(
            "id, driver_id, work_date, start_time, end_time, duration_seconds",
          )
          .eq("driver_id", driverId)
          .gte("work_date", weekStartYmd)
          .lte("work_date", weekEndYmd)
          .order("work_date", { ascending: true })
          .order("start_time", { ascending: true });

        if (timeErr) throw timeErr;

        setEntries((data as TimeEntry[]) || []);
      } catch (err: any) {
        console.error(err);
        setError(
          err?.message ??
            "Failed to load time entries for this driver and week.",
        );
      } finally {
        setLoading(false);
      }
    };

    void loadEntries();
  }, [driverId, weekStartYmd]);

  // Build Sun–Sat day list from weekStartYmd
  const weekDays = useMemo(() => {
    if (!weekStartYmd) return [];

    const [y, m, d] = weekStartYmd.split("-").map(Number);
    const sunday = new Date(y, (m ?? 1) - 1, d ?? 1);

    const days: string[] = [];
    for (let i = 0; i < 7; i += 1) {
      const dd = new Date(
        sunday.getFullYear(),
        sunday.getMonth(),
        sunday.getDate() + i,
      );
      const yy = dd.getFullYear();
      const mm = String(dd.getMonth() + 1).padStart(2, "0");
      const day = String(dd.getDate()).padStart(2, "0");
      days.push(`${yy}-${mm}-${day}`);
    }

    return days;
  }, [weekStartYmd]);

  // Group by day for display
  const daySummaries: DaySummary[] = useMemo(() => {
    if (weekDays.length === 0) return [];

    const map = new Map<string, DaySummary>();
    const now = new Date();

    // Initialize all days in the week with 0, even if no entries
    for (const d of weekDays) {
      map.set(d, {
        date: d,
        entries: [],
        totalSeconds: 0,
      });
    }

    for (const entry of entries) {
      const base = map.get(entry.work_date);
      if (!base) continue;

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
        duration = Math.max(
          0,
          Math.floor(
            (now.getTime() - new Date(entry.start_time).getTime()) / 1000,
          ),
        );
      }

      base.entries.push(entry);
      base.totalSeconds += duration;
    }

    return Array.from(map.values()).sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
    );
  }, [entries, weekDays]);

  const weekTotalSeconds = useMemo(
    () => daySummaries.reduce((sum, d) => sum + d.totalSeconds, 0),
    [daySummaries],
  );

  const weekLabel = useMemo(
    () => (weekStartYmd ? formatWeekRangeLabelFromYMD(weekStartYmd) : ""),
    [weekStartYmd],
  );

  const handleBackToTimecards = () => {
    router.push("/admin#timecards");
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <section className="card flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold md:text-xl">
            Driver Timecard – Weekly Detail
          </h1>
          <p className="text-sm text-slate-200/80">
            {driver ? (
              <>
                {driver.full_name} •{" "}
                <span className="text-xs text-slate-300">
                  License #: {driver.license_number ?? "N/A"}
                </span>
              </>
            ) : (
              <span className="text-xs text-slate-300">Loading driver…</span>
            )}
          </p>
          <p className="text-xs text-slate-400">
            Week of{" "}
            <span className="font-semibold text-slate-100">
              {weekLabel || "—"}
            </span>{" "}
            (Sun–Sat)
          </p>
          <p className="text-xs text-slate-400">
            Weekly total:{" "}
            <span className="font-mono font-semibold text-emerald-200">
              {formatDuration(weekTotalSeconds)}
            </span>
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-2 md:items-end">
          <button
            type="button"
            onClick={handleBackToTimecards}
            className="btn-ghost px-3 py-1 text-xs"
          >
            ← Back to Timecards
          </button>
          <Link
            href="/admin"
            className="btn-ghost px-3 py-1 text-xs"
          >
            Admin dashboard
          </Link>
        </div>
      </section>

      {error && (
        <section className="card border border-red-500/50 bg-red-950/40">
          <p className="text-xs font-medium text-red-200">{error}</p>
        </section>
      )}

      {loading && (
        <section className="card">
          <p className="text-sm text-slate-200">Loading time entries…</p>
        </section>
      )}

      {/* Day-by-day breakdown */}
      <section className="space-y-3">
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
              {day.entries.length === 0 ? (
                <p className="text-[11px] text-slate-500">
                  No time entries for this day.
                </p>
              ) : (
                day.entries.map((entry) => {
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
                        (now.getTime() -
                          new Date(entry.start_time).getTime()) /
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
                })
              )}
            </div>
          </section>
        ))}
      </section>

      {/* Hint footer */}
      <section className="card">
        <p className="text-[11px] text-slate-400">
          Time entries are created from driver pre-trip (clock start) and
          post-trip (clock stop) inspections. Use this weekly view for payroll
          review, audits, and resolving disputes about hours worked.
        </p>
      </section>
    </div>
  );
}
