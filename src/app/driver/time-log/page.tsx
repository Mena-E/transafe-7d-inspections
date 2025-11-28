"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type TimeEntry = {
  id: string;
  work_date: string; // YYYY-MM-DD
  start_time: string;
  end_time: string | null;
  duration_seconds: number | null;
};

type DailySummary = {
  date: string;        // YYYY-MM-DD
  label: string;       // "Mon", "Tue"...
  baseSeconds: number; // completed time
};

function formatDuration(totalSeconds: number): string {
  const secs = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  const seconds = secs % 60;

  const hh = hours.toString().padStart(2, "0");
  const mm = minutes.toString().padStart(2, "0");
  const ss = seconds.toString().padStart(2, "0");

  return `${hh}:${mm}:${ss}`;
}

function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Monday of the current week
function getWeekStartDate(): Date {
  const now = new Date();
  const day = now.getDay(); // 0 (Sun) - 6 (Sat)
  const diff = (day + 6) % 7; // 0 for Monday, ... 6 for Sunday
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
}

function formatDateShort(d: Date): string {
  // e.g. "Nov 27"
  const month = d.toLocaleString(undefined, { month: "short" });
  const day = d.getDate();
  return `${month} ${day}`;
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

export default function DriverTimeLogPage() {
  const router = useRouter();

  const [driverId, setDriverId] = useState<string | null>(null);
  const [driverName, setDriverName] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dailySummaries, setDailySummaries] = useState<DailySummary[]>([]);
  const [todayActiveStart, setTodayActiveStart] = useState<Date | null>(null);
  const [todayBaseSeconds, setTodayBaseSeconds] = useState(0);

  const todayStr = getTodayDateString();

  // Compute week dates (Mon–Fri) once
  const weekDays = useMemo(() => {
    const monday = getWeekStartDate();
    const days: { date: string; label: string; pretty: string }[] = [];
    for (let i = 0; i < 5; i += 1) {
      const d = new Date(
        monday.getFullYear(),
        monday.getMonth(),
        monday.getDate() + i,
      );
      const year = d.getFullYear();
      const month = `${d.getMonth() + 1}`.padStart(2, "0");
      const day = `${d.getDate()}`.padStart(2, "0");
      const dateStr = `${year}-${month}-${day}`;
      days.push({
        date: dateStr,
        label: WEEKDAY_LABELS[i],
        pretty: formatDateShort(d),
      });
    }
    return days;
  }, []);

  // Get week range as strings for query
  const weekStartStr = weekDays[0]?.date;
  const weekEndStr = weekDays[weekDays.length - 1]?.date;

  // On mount, load driver info from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = window.localStorage.getItem("transafeDriverId");
    const name = window.localStorage.getItem("transafeDriverName");
    setDriverId(id);
    setDriverName(name);
  }, []);

  // Load weekly time entries once driverId is known
  useEffect(() => {
    const load = async () => {
      if (!driverId || !weekStartStr || !weekEndStr) return;
      setLoading(true);
      setError(null);

      try {
        const { data, error: timeErr } = await supabase
          .from("driver_time_entries")
          .select("id, work_date, start_time, end_time, duration_seconds")
          .eq("driver_id", driverId)
          .gte("work_date", weekStartStr)
          .lte("work_date", weekEndStr)
          .order("start_time", { ascending: true });

        if (timeErr) throw timeErr;

        const entries = (data as TimeEntry[]) || [];

        // Initialize map for each weekday with 0 base seconds
        const base: Record<string, number> = {};
        weekDays.forEach((d) => {
          base[d.date] = 0;
        });

        let activeStart: Date | null = null;

        for (const entry of entries) {
          const wd = entry.work_date;
          if (!base[wd]) {
            base[wd] = 0;
          }

          if (entry.end_time) {
            const dur =
              entry.duration_seconds ??
              Math.max(
                0,
                Math.floor(
                  (new Date(entry.end_time).getTime() -
                    new Date(entry.start_time).getTime()) /
                    1000,
                ),
              );
            base[wd] += dur;
          } else {
            // Open (running) session. We only care if it's today.
            if (wd === todayStr) {
              activeStart = new Date(entry.start_time);
            }
          }
        }

        // Build daily summary for UI
        const summaries: DailySummary[] = weekDays.map((day, idx) => ({
          date: day.date,
          label: WEEKDAY_LABELS[idx],
          baseSeconds: base[day.date] ?? 0,
        }));

        setDailySummaries(summaries);
        setTodayBaseSeconds(base[todayStr] ?? 0);
        setTodayActiveStart(activeStart);
      } catch (err: any) {
        console.error(err);
        setError(
          err?.message ?? "Failed to load weekly time log. Please try again.",
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [driverId, weekStartStr, weekEndStr, weekDays, todayStr]);

  // Live ticking: if there's an open session today, update that day's display
  const [tickSeconds, setTickSeconds] = useState(0);

  useEffect(() => {
    if (!todayActiveStart) {
      setTickSeconds(0);
      return;
    }

    const startMs = todayActiveStart.getTime();

    const update = () => {
      const now = Date.now();
      const delta = Math.max(0, Math.floor((now - startMs) / 1000));
      setTickSeconds(delta);
    };

    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [todayActiveStart]);

  // Build display daily seconds and weekly total
  const dailyDisplaySeconds = useMemo(() => {
    const map: Record<string, number> = {};
    dailySummaries.forEach((d) => {
      map[d.date] = d.baseSeconds;
    });

    if (todayActiveStart) {
      map[todayStr] = (map[todayStr] ?? 0) + tickSeconds;
    }

    return map;
  }, [dailySummaries, todayStr, tickSeconds, todayActiveStart]);

  const weeklyTotalSeconds = useMemo(() => {
    return Object.values(dailyDisplaySeconds).reduce(
      (sum, secs) => sum + secs,
      0,
    );
  }, [dailyDisplaySeconds]);

  // If driver is not known, prompt them to sign in at Driver Portal
  if (!driverId) {
    return (
      <div className="space-y-4">
        <section className="card">
          <h1 className="mb-2 text-2xl font-semibold">Driver Time Log</h1>
          <p className="text-base text-slate-200/80">
            To view your time log, please sign in through the Driver Portal.
          </p>
        </section>

        <section className="card space-y-3">
          <p className="text-sm text-slate-300">
            It looks like we don&apos;t have an active driver session on this
            device.
          </p>
          <Link href="/driver" className="btn-primary w-full text-base">
            Go to Driver Portal
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <section className="card flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="mb-1 text-2xl font-semibold">Driver Time Log</h1>
          <p className="text-sm text-slate-200/80">
            {driverName ? (
              <>
                Showing hours for{" "}
                <span className="font-semibold text-emerald-200">
                  {driverName}
                </span>
                .
              </>
            ) : (
              "Showing hours for current driver."
            )}
          </p>
          <p className="text-sm text-slate-400">
            Week of{" "}
            <span className="font-semibold">
              {weekDays[0]?.pretty} – {weekDays[weekDays.length - 1]?.pretty}
            </span>{" "}
            (Mon–Fri)
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="rounded-2xl bg-slate-900 px-4 py-2 text-right ring-1 ring-emerald-500/60">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
              Weekly total
            </p>
            <p className="font-mono text-2xl font-semibold text-emerald-300">
              {formatDuration(weeklyTotalSeconds)}
            </p>
          </div>
          {/* ✅ Use history back so we return to the *logged-in* driver screen */}
                    <button
            type="button"
            onClick={() => router.push("/driver?from=time-log")}
            className="btn-ghost px-3 py-1 text-sm"
          >
            Back to Driver Portal
          </button>
        </div>
      </section>

      {error && (
        <section className="card border border-red-500/50 bg-red-950/40">
          <p className="text-sm font-medium text-red-200">{error}</p>
        </section>
      )}

      {/* Weekly table */}
      <section className="card space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold uppercase tracking-[0.16em] text-slate-300">
            Hours worked (Mon–Fri)
          </h2>
          {loading && (
            <span className="text-sm text-slate-400">Loading…</span>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl bg-slate-950/40">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="bg-slate-900/80 text-slate-200">
                <th className="border-b border-slate-800 px-4 py-2 text-left text-sm font-semibold">
                  Day
                </th>
                <th className="border-b border-slate-800 px-4 py-2 text-left text-sm font-semibold">
                  Date
                </th>
                <th className="border-b border-slate-800 px-4 py-2 text-right text-sm font-semibold">
                  Hours (HH:MM:SS)
                </th>
              </tr>
            </thead>
            <tbody>
              {weekDays.map((day, idx) => {
                const label = WEEKDAY_LABELS[idx];
                const secs = dailyDisplaySeconds[day.date] ?? 0;
                return (
                  <tr
                    key={day.date}
                    className={
                      idx % 2 === 0
                        ? "bg-slate-950/60"
                        : "bg-slate-900/60"
                    }
                  >
                    <td className="px-4 py-2 text-slate-100">{label}</td>
                    <td className="px-4 py-2 text-slate-200">
                      {day.pretty} ({day.date})
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-slate-100">
                      {formatDuration(secs)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!loading && !error && weeklyTotalSeconds === 0 && (
          <p className="text-sm text-slate-400">
            No time entries recorded for this week yet.
          </p>
        )}

        <p className="text-sm text-slate-400">
          Time entries are based on your pre-trip (clock start) and post-trip
          (clock stop) submissions. Records are stored for up to 2 years and
          will later support viewing past weeks and months.
        </p>
      </section>
    </div>
  );
}
