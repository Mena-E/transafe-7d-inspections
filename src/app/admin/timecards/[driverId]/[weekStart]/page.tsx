"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Driver = {
  id: string;
  full_name: string;
  license_number: string | null;
  is_active: boolean;
  created_at: string;
};

type TimeEntry = {
  id: string;
  driver_id: string;
  work_date: string; // YYYY-MM-DD
  start_time: string;
  end_time: string | null;
  duration_seconds: number | null;
};

function formatDuration(seconds: number): string {
  const secs = Math.max(0, Math.floor(seconds));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(
    2,
    "0",
  )}:${String(s).padStart(2, "0")}`;
}

function formatPretty(d: Date): string {
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

const WEEKDAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export default function TimecardDetailPage() {
  const router = useRouter();

  // ✅ Read route params with useParams (works in "use client" page)
  const params = useParams<{
    driverId?: string;
    weekStart?: string;
  }>();

  const driverId = (params?.driverId as string) || "";
  const weekStartParam = (params?.weekStart as string) || "";

  const [driver, setDriver] = useState<Driver | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Build Mon–Fri week from the weekStart param we get from the URL
  const weekDays = useMemo(() => {
    if (!weekStartParam) return [];
    const startDate = new Date(weekStartParam);
    if (Number.isNaN(startDate.getTime())) return [];

    const days: { date: string; pretty: string; label: string }[] = [];
    for (let i = 0; i < 5; i += 1) {
      const d = new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate() + i,
      );
      days.push({
        date: formatYMD(d),
        pretty: formatPretty(d),
        label: WEEKDAY_LABELS[i],
      });
    }
    return days;
  }, [weekStartParam]);

  const weekPrettyRange = useMemo(() => {
    if (weekDays.length === 0) return "";
    const first = weekDays[0];
    const last = weekDays[weekDays.length - 1];
    return `${first.pretty} – ${last.pretty}`;
  }, [weekDays]);

  // Load driver + time entries
  useEffect(() => {
    const load = async () => {
      if (!driverId || weekDays.length === 0) {
        setError("Missing driver or week information.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // 1) Driver record
        const { data: driverData, error: drvErr } = await supabase
          .from("drivers")
          .select("*")
          .eq("id", driverId)
          .maybeSingle();

        if (drvErr) throw drvErr;
        if (!driverData) {
          setError("Driver not found.");
          setLoading(false);
          return;
        }
        setDriver(driverData as Driver);

        // 2) Time entries for that week
        const weekStartStr = weekDays[0].date;
        const weekEndStr = weekDays[weekDays.length - 1].date;

        const { data: timeData, error: timeErr } = await supabase
          .from("driver_time_entries")
          .select(
            "id, driver_id, work_date, start_time, end_time, duration_seconds",
          )
          .eq("driver_id", driverId)
          .gte("work_date", weekStartStr)
          .lte("work_date", weekEndStr)
          .order("start_time", { ascending: true });

        if (timeErr) throw timeErr;

        setEntries((timeData as TimeEntry[]) || []);
      } catch (err: any) {
        console.error(err);
        setError(
          err?.message ??
            "Failed to load timecard. Please go back and try again.",
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [driverId, weekDays]);

  // Compute daily + weekly totals
  const { dailySeconds, weeklyTotalSeconds } = useMemo(() => {
    const daily: Record<string, number> = {};
    let weekTotal = 0;

    if (!weekDays || weekDays.length === 0) {
      return { dailySeconds: daily, weeklyTotalSeconds: 0 };
    }

    const today = new Date();

    for (const entry of entries) {
      let dur: number;
      if (entry.end_time) {
        dur =
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
        // Open session: count up to "now" in this view
        dur = Math.max(
          0,
          Math.floor(
            (today.getTime() - new Date(entry.start_time).getTime()) / 1000,
          ),
        );
      }

      const key = entry.work_date;
      daily[key] = (daily[key] ?? 0) + dur;
      weekTotal += dur;
    }

    return { dailySeconds: daily, weeklyTotalSeconds: weekTotal };
  }, [entries, weekDays]);

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <section className="card">
          <p className="text-sm text-slate-200">Loading timecard…</p>
        </section>
      </div>
    );
  }

  if (error || !driver || weekDays.length === 0) {
    return (
      <div className="space-y-4">
        <section className="card space-y-3">
          <h1 className="text-lg font-semibold">Timecard unavailable</h1>
          <p className="text-sm text-red-300">
            {error || "Could not load this timecard."}
          </p>
          <button
            type="button"
            onClick={() => router.back()}
            className="btn-ghost w-full max-w-xs text-sm"
          >
            Back to Admin
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top controls (hidden when printing) */}
      <section className="card flex items-center justify-between gap-2 print:hidden">
        <button
          type="button"
          onClick={() => router.back()}
          className="btn-ghost px-3 py-1 text-sm"
        >
          ← Back to Timecards
        </button>
        <button
          type="button"
          onClick={handlePrint}
          className="btn-primary px-4 py-2 text-sm"
        >
          Print / Save as PDF
        </button>
      </section>

      {/* Center “document” */}
      <section className="card mx-auto max-w-3xl bg-slate-950/80 p-4 text-slate-100 print:max-w-none print:bg-white print:p-6 print:text-black">
        {/* Brand header */}
        <header className="mb-4 flex flex-col items-start gap-2 border-b border-slate-700 pb-3 text-sm print:border-slate-300">
          <div className="flex w-full flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300 print:text-emerald-700">
                Transafe Transportation LLC
              </p>
              <p className="text-sm font-semibold">
                Weekly Driver Timecard (7D Pupil Transportation)
              </p>
            </div>
            <div className="text-right text-[11px] text-slate-300 print:text-slate-700">
              <p>675 VFW Parkway, Suite 103</p>
              <p>Chestnut Hill, MA 02467</p>
              <p>Tel: (617) 991-9152</p>
              <p>www.transafetransport.com</p>
            </div>
          </div>
        </header>

        {/* Driver + week info */}
        <section className="mb-4 grid gap-3 text-sm sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 print:text-slate-600">
              Driver information
            </p>
            <p>
              <span className="font-semibold">Name:</span>{" "}
              <span>{driver.full_name}</span>
            </p>
            <p>
              <span className="font-semibold">License #:</span>{" "}
              <span>{driver.license_number || "N/A"}</span>
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 print:text-slate-600">
              Week information
            </p>
            <p>
              <span className="font-semibold">Week of:</span>{" "}
              <span>{weekPrettyRange}</span>
            </p>
            <p>
              <span className="font-semibold">Period (Mon–Fri):</span>{" "}
              <span>
                {weekDays[0].date} – {weekDays[weekDays.length - 1].date}
              </span>
            </p>
          </div>
        </section>

        {/* Hours table */}
        <section className="mb-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 print:text-slate-600">
            Daily hours summary
          </p>
          <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-950/60 text-sm print:border-slate-300 print:bg-white">
            <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr className="bg-slate-900/80 text-xs text-slate-200 print:bg-slate-100 print:text-slate-900">
                  <th className="border-b border-slate-700 px-3 py-2 text-left font-semibold print:border-slate-300">
                    Day
                  </th>
                  <th className="border-b border-slate-700 px-3 py-2 text-left font-semibold print:border-slate-300">
                    Date
                  </th>
                  <th className="border-b border-slate-700 px-3 py-2 text-right font-semibold print:border-slate-300">
                    Hours (HH:MM:SS)
                  </th>
                </tr>
              </thead>
              <tbody>
                {weekDays.map((d, idx) => {
                  const secs = dailySeconds[d.date] ?? 0;
                  return (
                    <tr
                      key={d.date}
                      className={
                        idx % 2 === 0
                          ? "bg-slate-950/40 print:bg-white"
                          : "bg-slate-900/40 print:bg-slate-50"
                      }
                    >
                      <td className="border-b border-slate-800 px-3 py-2 text-sm print:border-slate-200">
                        {d.label}
                      </td>
                      <td className="border-b border-slate-800 px-3 py-2 text-sm print:border-slate-200">
                        {d.pretty} ({d.date})
                      </td>
                      <td className="border-b border-slate-800 px-3 py-2 text-right font-mono text-sm print:border-slate-200">
                        {formatDuration(secs)}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-slate-900/80 text-slate-100 print:bg-slate-100 print:text-slate-900">
                  <td className="px-3 py-2 text-sm font-semibold">
                    Weekly total
                  </td>
                  <td className="px-3 py-2 text-sm" />
                  <td className="px-3 py-2 text-right font-mono text-sm font-semibold">
                    {formatDuration(weeklyTotalSeconds)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Certification & signatures */}
        <section className="mt-4 space-y-4 text-sm">
          <p className="text-xs text-slate-300 print:text-slate-700">
            I certify that this timecard accurately reflects the hours worked
            operating a 7D school pupil transport vehicle for Transafe
            Transportation LLC during the period shown above.
          </p>

          <div className="grid gap-6 text-sm sm:grid-cols-2">
            <div className="space-y-4">
              <div>
                <p className="border-b border-dotted border-slate-500 pb-4 print:border-slate-500">
                  &nbsp;
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400 print:text-slate-600">
                  Driver signature
                </p>
              </div>
              <div>
                <p className="border-b border-dotted border-slate-500 pb-4 print:border-slate-500">
                  &nbsp;
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400 print:text-slate-600">
                  Date
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="border-b border-dotted border-slate-500 pb-4 print:border-slate-500">
                  &nbsp;
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400 print:text-slate-600">
                  Supervisor / admin signature
                </p>
              </div>
              <div>
                <p className="border-b border-dotted border-slate-500 pb-4 print:border-slate-500">
                  &nbsp;
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400 print:text-slate-600">
                  Date
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer note */}
        <footer className="mt-6 border-t border-slate-700 pt-2 text-[10px] text-slate-400 print:border-slate-300 print:text-slate-600">
          <p>
            Internal record for Transafe Transportation LLC. Retain with driver
            payroll and compliance documentation.
          </p>
        </footer>
      </section>
    </div>
  );
}
