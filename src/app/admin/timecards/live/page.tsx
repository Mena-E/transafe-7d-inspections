// src/app/admin/timecards/live/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Driver = {
  id: string;
  full_name: string;
  license_number: string | null;
  is_active: boolean;
};

type LiveClockRow = {
  entryId: string;
  driverId: string;
  driverName: string;
  license: string | null;
  workDate: string;
  startTime: string;
};

// Format seconds as HH:MM:SS
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

export default function AdminLiveClockPage() {
  const [rows, setRows] = useState<LiveClockRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ticks every second so elapsed times update live
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const todayStr = getTodayDateString();

        // Load drivers and open time entries for today in parallel
        const [{ data: driversData, error: drvErr }, { data: openData, error: openErr }] =
          await Promise.all([
            supabase
              .from("drivers")
              .select("id, full_name, license_number, is_active"),
            supabase
              .from("driver_time_entries")
              .select("id, driver_id, work_date, start_time, end_time")
              .eq("work_date", todayStr)
              .is("end_time", null),
          ]);

        if (drvErr) throw drvErr;
        if (openErr) throw openErr;

        const driversById: Record<string, Driver> = {};
        (driversData as Driver[] | null)?.forEach((d) => {
          driversById[d.id] = d;
        });

        const mapped: LiveClockRow[] =
          (openData as any[] | null)?.map((entry) => {
            const driver = driversById[entry.driver_id];
            return {
              entryId: entry.id,
              driverId: entry.driver_id,
              driverName: driver?.full_name ?? "Unknown driver",
              license: driver?.license_number ?? null,
              workDate: entry.work_date,
              startTime: entry.start_time,
            };
          }) ?? [];

        // Sort by driver name to keep view stable
        mapped.sort((a, b) => a.driverName.localeCompare(b.driverName));

        setRows(mapped);
      } catch (err: any) {
        console.error(err);
        setError(
          err?.message ??
            "Failed to load live clock. Please refresh or try again.",
        );
      } finally {
        setLoading(false);
      }
    };

    // Initial load
    load();

    // Auto-refresh every 30 seconds to catch new clock-ins/outs
    const intervalId = setInterval(load, 30000);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <section className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            Live Clock – Drivers on the Clock
          </h1>
          <p className="text-sm text-slate-300">
            Shows only drivers with an open time entry today (Pre-trip started,
            Post-trip not yet completed).
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <Link
            href="/admin#timecards"
            className="btn-ghost px-3 py-1 text-[11px]"
          >
            ← Back to Timecards
          </Link>
        </div>
      </section>

      {error && (
        <section className="card border border-red-500/50 bg-red-950/40">
          <p className="text-xs font-medium text-red-200">{error}</p>
        </section>
      )}

      {/* Live table */}
      <section className="card space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">
            Currently on the clock
          </h2>
          {loading && (
            <span className="text-xs text-slate-400">Loading…</span>
          )}
        </div>

        {rows.length === 0 && !loading ? (
          <p className="text-sm text-slate-400">
            No drivers are currently on the clock for today.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl bg-slate-950/40">
            <table className="min-w-full border-separate border-spacing-0 text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-900/80 text-slate-200">
                  <th className="border-b border-slate-800 px-3 py-2 text-left font-semibold">
                    Driver
                  </th>
                  <th className="border-b border-slate-800 px-3 py-2 text-left font-semibold">
                    License #
                  </th>
                  <th className="border-b border-slate-800 px-3 py-2 text-left font-semibold">
                    Work date
                  </th>
                  <th className="border-b border-slate-800 px-3 py-2 text-left font-semibold">
                    Clock started
                  </th>
                  <th className="border-b border-slate-800 px-3 py-2 text-right font-semibold">
                    Elapsed time
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const startMs = new Date(row.startTime).getTime();
                  const elapsedSeconds = Math.max(
                    0,
                    Math.floor((now - startMs) / 1000),
                  );

                  return (
                    <tr
                      key={row.entryId}
                      className="odd:bg-slate-950/60 even:bg-slate-900/60"
                    >
                      <td className="px-3 py-2 text-slate-100">
                        {row.driverName}
                      </td>
                      <td className="px-3 py-2 text-slate-100">
                        {row.license || "—"}
                      </td>
                      <td className="px-3 py-2 text-slate-200">
                        {row.workDate}
                      </td>
                      <td className="px-3 py-2 text-slate-200">
                        {new Date(row.startTime).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[11px] text-emerald-200 sm:text-xs">
                        {formatDuration(elapsedSeconds)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-[11px] text-slate-400 sm:text-xs">
          This view auto-refreshes every{" "}
          <span className="font-semibold text-slate-100">30 seconds</span> and
          the elapsed clocks update every{" "}
          <span className="font-semibold text-slate-100">1 second</span>.
          Drivers disappear from this list once they complete a Post-trip
          inspection.
        </p>
      </section>
    </div>
  );
}
