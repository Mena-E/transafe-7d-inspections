"use client";

import { useEffect, useMemo, useState } from "react";

// ---- TYPES ----

type AttendanceRecord = {
  id: string;
  student_name: string;
  route_name: string;
  route_direction: string | null;
  driver_name: string;
  record_date: string;
  status: string;
  recorded_at: string;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
};

type FilterSchool = { id: string; name: string };
type FilterRoute = { id: string; name: string };
type FilterDriver = { id: string; full_name: string };

// ---- HELPERS ----

function formatYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

function formatDateTime(iso: string | null) {
  if (!iso) return "N/A";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function getDefaultStartDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return formatYMD(d);
}

function getDefaultEndDate(): string {
  return formatYMD(new Date());
}

// Status badge color mapping
function getStatusBadgeClasses(status: string): string {
  const s = status.toLowerCase();
  if (s === "picked_up" || s === "dropped_off") {
    return "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/40";
  }
  if (s === "absent") {
    return "bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/40";
  }
  if (s === "no_show") {
    return "bg-red-500/15 text-red-200 ring-1 ring-red-500/40";
  }
  return "bg-slate-700/50 text-slate-200 ring-1 ring-slate-600/40";
}

// ---- COMPONENT ----

export default function AttendanceTab() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [startDate, setStartDate] = useState(getDefaultStartDate);
  const [endDate, setEndDate] = useState(getDefaultEndDate);
  const [schoolId, setSchoolId] = useState("");
  const [routeId, setRouteId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [studentSearch, setStudentSearch] = useState("");

  // Filter dropdown data
  const [schools, setSchools] = useState<FilterSchool[]>([]);
  const [routes, setRoutes] = useState<FilterRoute[]>([]);
  const [drivers, setDrivers] = useState<FilterDriver[]>([]);

  // Load filter dropdown data on mount
  useEffect(() => {
    async function loadFilterData() {
      try {
        const [schoolsRes, routesRes, driversRes] = await Promise.all([
          fetch("/api/admin/schools"),
          fetch("/api/admin/routes"),
          fetch("/api/admin/drivers"),
        ]);

        if (schoolsRes.ok) {
          const body = await schoolsRes.json();
          setSchools((body.schools || []) as FilterSchool[]);
        }
        if (routesRes.ok) {
          const body = await routesRes.json();
          setRoutes((body.routes || []) as FilterRoute[]);
        }
        if (driversRes.ok) {
          const body = await driversRes.json();
          setDrivers((body.drivers || []).map((d: any) => ({ id: d.id, full_name: d.full_name })) as FilterDriver[]);
        }
      } catch (err) {
        console.error("Error loading filter data:", err);
      }
    }

    loadFilterData();
  }, []);

  // Load attendance records
  useEffect(() => {
    let isMounted = true;

    async function loadAttendance() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);
        if (schoolId) params.set("schoolId", schoolId);
        if (routeId) params.set("routeId", routeId);
        if (driverId) params.set("driverId", driverId);
        if (statusFilter) params.set("status", statusFilter);
        if (studentSearch.trim())
          params.set("studentSearch", studentSearch.trim());

        const res = await fetch(
          `/api/admin/attendance?${params.toString()}`,
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Failed to load attendance records.");
        }

        const data = await res.json();

        if (!isMounted) return;

        const mapped: AttendanceRecord[] = (
          data.records ||
          data ||
          []
        ).map((row: any) => ({
          id: row.id,
          student_name: row.student_name || "Unknown",
          route_name: row.route_name || "N/A",
          route_direction: row.route_direction ?? null,
          driver_name: row.driver_name || "N/A",
          record_date: row.record_date || "",
          status: row.status || "unknown",
          recorded_at: row.recorded_at || "",
          latitude: row.latitude ?? null,
          longitude: row.longitude ?? null,
          notes: row.notes ?? null,
        }));

        setRecords(mapped);
      } catch (err: any) {
        console.error("Error loading attendance:", err);
        if (isMounted)
          setError(err.message ?? "Failed to load attendance records.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadAttendance();

    return () => {
      isMounted = false;
    };
  }, [startDate, endDate, schoolId, routeId, driverId, statusFilter, studentSearch]);

  // Summary stats
  const summaryStats = useMemo(() => {
    const total = records.length;
    const presentStatuses = ["picked_up", "dropped_off"];
    const presentCount = records.filter((r) =>
      presentStatuses.includes(r.status.toLowerCase()),
    ).length;
    const absentCount = records.filter(
      (r) => r.status.toLowerCase() === "absent",
    ).length;
    const noShowCount = records.filter(
      (r) => r.status.toLowerCase() === "no_show",
    ).length;
    const attendanceRate =
      total > 0 ? ((presentCount / total) * 100).toFixed(1) : "0.0";

    return { total, attendanceRate, absentCount, noShowCount };
  }, [records]);

  // CSV export
  const handleExportCsv = () => {
    if (records.length === 0) {
      alert("No attendance records to export.");
      return;
    }

    const header = [
      "id",
      "record_date",
      "student_name",
      "route_name",
      "route_direction",
      "driver_name",
      "status",
      "recorded_at",
      "latitude",
      "longitude",
      "notes",
    ];

    const rows = records.map((rec) => [
      rec.id,
      rec.record_date,
      rec.student_name,
      rec.route_name,
      rec.route_direction || "",
      rec.driver_name,
      rec.status,
      rec.recorded_at,
      rec.latitude != null ? String(rec.latitude) : "",
      rec.longitude != null ? String(rec.longitude) : "",
      rec.notes || "",
    ]);

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
    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `transafe_attendance_${startDate || "start"}_to_${endDate || "end"}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <section className="card space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">
              Attendance Reports
            </h2>
            <p className="text-[11px] text-slate-400">
              View and export student attendance records with filtering by date,
              school, route, driver, and status.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportCsv}
            className="btn-ghost px-3 py-1 text-[11px]"
            disabled={records.length === 0}
          >
            Export CSV
          </button>
        </div>
      </section>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
            Total Records
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-100">
            {summaryStats.total}
          </p>
        </div>
        <div className="card text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
            Attendance Rate
          </p>
          <p className="mt-1 text-2xl font-bold text-emerald-300">
            {summaryStats.attendanceRate}%
          </p>
        </div>
        <div className="card text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
            Absent
          </p>
          <p className="mt-1 text-2xl font-bold text-amber-300">
            {summaryStats.absentCount}
          </p>
        </div>
        <div className="card text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
            No-Show
          </p>
          <p className="mt-1 text-2xl font-bold text-red-300">
            {summaryStats.noShowCount}
          </p>
        </div>
      </div>

      {/* Filters */}
      <section className="card space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
          Filters
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {/* Start date */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-200">
              Start date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
            />
          </div>

          {/* End date */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-200">
              End date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
            />
          </div>

          {/* School dropdown */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-200">
              School
            </label>
            <select
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
            >
              <option value="">All schools</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Route dropdown */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-200">
              Route
            </label>
            <select
              value={routeId}
              onChange={(e) => setRouteId(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
            >
              <option value="">All routes</option>
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Driver dropdown */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-200">
              Driver
            </label>
            <select
              value={driverId}
              onChange={(e) => setDriverId(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
            >
              <option value="">All drivers</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* Status select */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-200">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
            >
              <option value="">All statuses</option>
              <option value="picked_up">Picked Up</option>
              <option value="dropped_off">Dropped Off</option>
              <option value="absent">Absent</option>
              <option value="no_show">No-Show</option>
            </select>
          </div>

          {/* Student name search */}
          <div className="space-y-1 sm:col-span-2">
            <label className="text-[11px] font-medium text-slate-200">
              Student name
            </label>
            <input
              type="text"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="Search by student name..."
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
            />
          </div>
        </div>
      </section>

      {/* Error */}
      {error && (
        <section className="card border border-red-500/50 bg-red-950/40">
          <p className="text-xs font-medium text-red-200">{error}</p>
        </section>
      )}

      {/* Table */}
      <section className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-slate-400">
            Showing{" "}
            <span className="font-semibold text-slate-100">
              {records.length}
            </span>{" "}
            attendance records.
          </p>
          {loading && (
            <span className="text-[11px] text-slate-400">Loading...</span>
          )}
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-slate-950/40">
          <div className="max-h-[460px] overflow-auto text-[11px]">
            {records.length === 0 && !loading ? (
              <p className="p-3 text-[11px] text-slate-400">
                No attendance records match your filters.
              </p>
            ) : (
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-slate-900/90 text-slate-200">
                    <th className="sticky top-0 border-b border-slate-800 px-2 py-2 text-left text-[11px] font-semibold backdrop-blur">
                      Date
                    </th>
                    <th className="sticky top-0 border-b border-slate-800 px-2 py-2 text-left text-[11px] font-semibold backdrop-blur">
                      Student
                    </th>
                    <th className="sticky top-0 border-b border-slate-800 px-2 py-2 text-left text-[11px] font-semibold backdrop-blur">
                      Route
                    </th>
                    <th className="sticky top-0 border-b border-slate-800 px-2 py-2 text-left text-[11px] font-semibold backdrop-blur">
                      Direction
                    </th>
                    <th className="sticky top-0 border-b border-slate-800 px-2 py-2 text-left text-[11px] font-semibold backdrop-blur">
                      Driver
                    </th>
                    <th className="sticky top-0 border-b border-slate-800 px-2 py-2 text-left text-[11px] font-semibold backdrop-blur">
                      Status
                    </th>
                    <th className="sticky top-0 border-b border-slate-800 px-2 py-2 text-left text-[11px] font-semibold backdrop-blur">
                      Time Recorded
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((rec, idx) => (
                    <tr
                      key={rec.id}
                      className={`border-b border-slate-800/60 transition hover:bg-slate-900/80 ${
                        idx % 2 === 0
                          ? "bg-slate-950/70"
                          : "bg-slate-900/60"
                      }`}
                    >
                      <td className="px-2 py-1 text-slate-100">
                        {rec.record_date}
                      </td>
                      <td className="px-2 py-1 text-slate-100">
                        {rec.student_name}
                      </td>
                      <td className="px-2 py-1 text-slate-200">
                        {rec.route_name}
                      </td>
                      <td className="px-2 py-1 text-slate-200">
                        {rec.route_direction ? (
                          <span className="inline-flex items-center rounded-full bg-slate-700/50 px-2 py-0.5 text-[10px] font-semibold text-slate-100">
                            {rec.route_direction}
                          </span>
                        ) : (
                          <span className="text-slate-500">&mdash;</span>
                        )}
                      </td>
                      <td className="px-2 py-1 text-slate-200">
                        {rec.driver_name}
                      </td>
                      <td className="px-2 py-1">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${getStatusBadgeClasses(rec.status)}`}
                        >
                          {rec.status.replace(/_/g, " ").toUpperCase()}
                        </span>
                      </td>
                      <td className="px-2 py-1 text-slate-200">
                        {formatDateTime(rec.recorded_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {loading && (
            <div className="border-t border-slate-800/80 bg-slate-950/80 px-3 py-2 text-[11px] text-slate-400">
              Loading attendance records...
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
