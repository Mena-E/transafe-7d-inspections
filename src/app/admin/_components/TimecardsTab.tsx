"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

// ---- TYPES ----

type Driver = {
  id: string;
  full_name: string;
  license_number: string | null;
  is_active: boolean;
};

type TimeEntry = {
  id: string;
  driver_id: string;
  work_date: string; // YYYY-MM-DD
  start_time: string;
  end_time: string | null;
  duration_seconds: number | null;
};

type DriverTimeSummary = {
  driverId: string;
  name: string;
  license: string | null;
  dailySeconds: Record<string, number>;
  weekTotalSeconds: number;
};

type TimecardsTabProps = {
  drivers: Driver[];
};

// ---- HELPERS ----

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getWeekStart(date: Date): Date {
  const day = date.getDay(); // 0 (Sun) - 6 (Sat)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - day);
}

function formatYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

function formatPretty(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDuration(seconds: number): string {
  const secs = Math.max(0, Math.floor(seconds));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ---- COMPONENT ----

export default function TimecardsTab({ drivers }: TimecardsTabProps) {
  const [summaries, setSummaries] = useState<DriverTimeSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [weekStart, setWeekStart] = useState<string>(() => {
    const start = getWeekStart(new Date());
    return formatYMD(start);
  });

  const weekDays = useMemo(() => {
    const start = new Date(`${weekStart}T00:00:00`);
    if (Number.isNaN(start.getTime())) return [];

    const days: { date: string; pretty: string; label: string }[] = [];

    for (let i = 0; i < 7; i += 1) {
      const d = new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate() + i,
      );

      days.push({
        date: formatYMD(d),
        pretty: formatPretty(d),
        label: WEEKDAY_LABELS[i],
      });
    }

    return days;
  }, [weekStart]);

  const weekPrettyRange = useMemo(() => {
    if (weekDays.length === 0) return "";
    const first = weekDays[0];
    const last = weekDays[weekDays.length - 1];
    return `${first.pretty} \u2013 ${last.pretty}`;
  }, [weekDays]);

  // Load time entries
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        if (!drivers || drivers.length === 0 || weekDays.length === 0) {
          setSummaries([]);
          setLoading(false);
          return;
        }

        const weekStartStr = weekDays[0].date;
        const weekEndStr = weekDays[weekDays.length - 1].date;

        const res = await fetch(`/api/admin/timecards?weekStart=${weekStartStr}&weekEnd=${weekEndStr}`);
        if (!res.ok) throw new Error("Failed to load timecards");
        const body = await res.json();

        const entries = (body.entries as TimeEntry[]) || [];
        const now = new Date();

        const byDriver: Record<string, DriverTimeSummary> = {};
        for (const d of drivers) {
          byDriver[d.id] = {
            driverId: d.id,
            name: d.full_name,
            license: d.license_number,
            dailySeconds: {},
            weekTotalSeconds: 0,
          };
        }

        for (const entry of entries) {
          const summary = byDriver[entry.driver_id];
          if (!summary) continue;

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
            dur = Math.max(
              0,
              Math.floor(
                (now.getTime() - new Date(entry.start_time).getTime()) / 1000,
              ),
            );
          }

          const key = entry.work_date;
          summary.dailySeconds[key] = (summary.dailySeconds[key] ?? 0) + dur;
          summary.weekTotalSeconds += dur;
        }

        setSummaries(Object.values(byDriver));
      } catch (err: any) {
        console.error(err);
        setError(
          err?.message ??
            "Failed to load timecards. Please refresh or try again.",
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [drivers, weekDays]);

  // Week navigation
  const handleShiftWeek = (deltaWeeks: number) => {
    const current = new Date(`${weekStart}T00:00:00`);
    if (Number.isNaN(current.getTime())) return;

    const shifted = new Date(
      current.getFullYear(),
      current.getMonth(),
      current.getDate() + deltaWeeks * 7,
    );
    const start = getWeekStart(shifted);
    setWeekStart(formatYMD(start));
  };

  // CSV export
  const handleExportTimecardsCsv = () => {
    if (!weekDays.length || !summaries.length) {
      alert("No timecard data to export for this week.");
      return;
    }

    // Build header: Driver, License, each day, Weekly total
    const header = [
      "Driver",
      "License",
      ...weekDays.map((d) => `${d.label} (${d.date})`),
      "Weekly total",
    ];

    // Build rows for each driver
    const rows = summaries.map((s) => {
      const dayValues = weekDays.map((d) => {
        const secs = s.dailySeconds[d.date] ?? 0;
        return formatDuration(secs);
      });

      return [
        s.name || "Unknown",
        s.license || "",
        ...dayValues,
        formatDuration(s.weekTotalSeconds),
      ];
    });

    // CSV string with proper escaping
    const csvLines = [
      header.join(","),
      ...rows.map((row) =>
        row
          .map((field) => {
            const str = String(field ?? "");
            if (str.includes(",") || str.includes('"') || str.includes("\n")) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          })
          .join(","),
      ),
    ];

    const csvContent = csvLines.join("\n");

    // Trigger browser download
    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    const today = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.setAttribute("download", `transafe_timecards_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <section className="card space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold md:text-lg">
              Driver Timecards
            </h2>
            <p className="text-sm text-slate-300">
              Live daily and weekly hours for each driver, Sunday to Saturday.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:items-end">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleShiftWeek(-1)}
                className="btn-ghost px-3 py-1 text-xs"
              >
                &#9664; Previous week
              </button>
              <button
                type="button"
                onClick={() => handleShiftWeek(1)}
                className="btn-ghost px-3 py-1 text-xs"
              >
                Next week &#9654;
              </button>
            </div>

            <Link
              href="/admin/timecards/live"
              className="btn-ghost px-3 py-1 text-[11px]"
            >
              Live Clock &rarr;
            </Link>
          </div>
        </div>

        <p className="text-sm text-slate-400">
          Week of{" "}
          <span className="font-semibold text-slate-100">
            {weekPrettyRange}
          </span>{" "}
          (Sun&ndash;Sat)
        </p>
      </section>

      {error && (
        <section className="card border border-red-500/50 bg-red-950/40">
          <p className="text-sm font-medium text-red-200">{error}</p>
        </section>
      )}

      <section className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">
            Weekly hours by driver
          </h3>
          <div className="flex items-center gap-2">
            {loading && (
              <span className="text-xs text-slate-400">Loading...</span>
            )}
            <button
              type="button"
              onClick={handleExportTimecardsCsv}
              className="btn-ghost px-3 py-1 text-[11px] sm:text-xs"
              disabled={summaries.length === 0}
            >
              Export CSV
            </button>
          </div>
        </div>

        {(!drivers || drivers.length === 0) && !loading ? (
          <p className="text-sm text-slate-400">
            No active drivers found. Add drivers in the Drivers tab to see
            timecards here.
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
                  {weekDays.map((d) => (
                    <th
                      key={d.date}
                      className="border-b border-slate-800 px-3 py-2 text-right font-semibold"
                    >
                      <span className="block text-[11px] font-normal uppercase tracking-[0.12em] text-slate-400">
                        {d.label}
                      </span>
                      <span className="text-[11px] sm:text-xs">
                        {d.pretty}
                      </span>
                    </th>
                  ))}
                  <th className="border-b border-slate-800 px-3 py-2 text-right font-semibold">
                    Weekly total
                  </th>
                  <th className="border-b border-slate-800 px-3 py-2 text-right font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((s) => (
                  <tr
                    key={s.driverId}
                    className="odd:bg-slate-950/60 even:bg-slate-900/60"
                  >
                    <td className="px-3 py-2 text-slate-100">
                      {s.name || "Unknown"}
                    </td>
                    <td className="px-3 py-2 text-slate-100">
                      {s.license || "\u2014"}
                    </td>
                    {weekDays.map((d) => {
                      const secs = s.dailySeconds[d.date] ?? 0;
                      return (
                        <td
                          key={d.date}
                          className="px-3 py-2 text-right font-mono text-[11px] text-slate-100 sm:text-xs"
                        >
                          {secs > 0 ? formatDuration(secs) : "00:00:00"}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right font-mono text-[11px] text-emerald-200 sm:text-xs">
                      {formatDuration(s.weekTotalSeconds)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/admin/timecards/${s.driverId}/${weekDays[0]?.date}`}
                        className="btn-ghost px-3 py-1 text-[11px] sm:text-xs"
                      >
                        View timecard
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-slate-400 sm:text-sm">
          Timecards are calculated from pre-trip (clock start) and post-trip
          (clock stop) inspections stored in the driver time entries table.
        </p>
      </section>
    </div>
  );
}
