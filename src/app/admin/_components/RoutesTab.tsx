// app/admin/_components/RoutesTab.tsx

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

// === ROUTES TAB COMPONENT (ANCHOR) ===

type RouteRow = {
  id: string;
  name: string;
  direction: "AM" | "MIDDAY" | "PM" | null;
  school_id: string | null;
  effective_start_date: string | null;
  effective_end_date: string | null;
  rate_per_mile: number | null;
  estimated_round_trip_mileage: number | null;
  effective_daily_rate: number | null;
  is_active: boolean;
  description: string | null;
};

type School = {
  id: string;
  name: string | null;
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString();
}

function formatMoney(value: number | null) {
  if (value == null) return "—";
  return `$${value.toFixed(2)}`;
}

function formatMileage(value: number | null) {
  if (value == null) return "—";
  return `${value.toFixed(1)} mi`;
}

export default function RoutesTab() {
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [directionFilter, setDirectionFilter] = useState<"" | "AM" | "MIDDAY" | "PM">("");
  const [schoolFilter, setSchoolFilter] = useState<string>("");

  // ---- bulk delete state ----
  const [selectedRouteIds, setSelectedRouteIds] = useState<string[]>([]);
  const [isDeletingRoutes, setIsDeletingRoutes] = useState(false);
  const [routesDeleteError, setRoutesDeleteError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        const [routesRes, schoolsRes] = await Promise.all([
          fetch("/api/admin/routes"),
          fetch("/api/admin/schools"),
        ]);

        if (!routesRes.ok) throw new Error("Failed to load routes");
        if (!schoolsRes.ok) throw new Error("Failed to load schools");

        const routesBody = await routesRes.json();
        const schoolsBody = await schoolsRes.json();

        setRoutes((routesBody.routes || []) as RouteRow[]);
        setSchools(
          (schoolsBody.schools || []).map((s: any) => ({
            id: s.id,
            name: s.name ?? null,
          }))
        );
      } catch (err: any) {
        console.error(err);
        setError("Failed to load routes.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const schoolMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of schools) {
      if (s.id) map[s.id] = s.name || "Unnamed school";
    }
    return map;
  }, [schools]);

  const filteredRoutes = useMemo(() => {
    return routes.filter((r) => {
      if (directionFilter && r.direction !== directionFilter) return false;
      if (schoolFilter && r.school_id !== schoolFilter) return false;

      if (search.trim()) {
        const needle = search.trim().toLowerCase();
        const schoolName = r.school_id ? schoolMap[r.school_id] || "" : "";
        const haystack =
          `${r.name} ${r.direction || ""} ${schoolName}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }

      return true;
    });
  }, [routes, search, directionFilter, schoolFilter, schoolMap]);

  // ---- selection helpers (applied to *visible* routes) ----
  const allVisibleSelected =
    filteredRoutes.length > 0 &&
    filteredRoutes.every((r) => selectedRouteIds.includes(r.id));

  const toggleSelectAllRoutes = () => {
    if (allVisibleSelected) {
      const visibleIds = new Set(filteredRoutes.map((r) => r.id));
      setSelectedRouteIds((prev) => prev.filter((id) => !visibleIds.has(id)));
    } else {
      const visibleIds = filteredRoutes.map((r) => r.id);
      setSelectedRouteIds((prev) => {
        const set = new Set(prev);
        visibleIds.forEach((id) => set.add(id));
        return Array.from(set);
      });
    }
  };

  const toggleRouteSelection = (routeId: string) => {
    setSelectedRouteIds((prev) =>
      prev.includes(routeId)
        ? prev.filter((id) => id !== routeId)
        : [...prev, routeId],
    );
  };

  // ---- bulk delete handler ----
  const handleDeleteSelectedRoutes = async () => {
    if (selectedRouteIds.length === 0) return;

    const confirmed = window.confirm(
      `Delete ${selectedRouteIds.length} route(s)? This will also remove related stops and assignments. This cannot be undone.`
    );
    if (!confirmed) return;

    setIsDeletingRoutes(true);
    setRoutesDeleteError(null);

    try {
      const res = await fetch("/api/admin/routes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedRouteIds }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to delete routes");
      }

      setRoutes((prev) => prev.filter((r) => !selectedRouteIds.includes(r.id)));
      setSelectedRouteIds([]);
    } catch (err: any) {
      console.error("Error deleting routes:", err);
      setRoutesDeleteError(
        err?.message ?? "Failed to delete selected routes. Please try again.",
      );
    } finally {
      setIsDeletingRoutes(false);
    }
  };

  return (
    <section id="routes-tab-section" className="space-y-4">
      {/* Header */}
      <section className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">
            Routes
          </h2>
          <p className="text-[11px] text-slate-400">
            Manage AM/MIDDAY/PM routes, effective dates, pricing, and assignments.
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          {/* Bulk delete button */}
          <button
            type="button"
            onClick={handleDeleteSelectedRoutes}
            disabled={isDeletingRoutes || selectedRouteIds.length === 0}
            className={`rounded-full px-4 py-2 text-[11px] font-semibold transition ${
              selectedRouteIds.length === 0
                ? "cursor-not-allowed border border-slate-700 bg-slate-900 text-slate-500"
                : "border border-rose-500/70 bg-rose-500/10 text-rose-100 hover:bg-rose-500 hover:text-slate-950"
            }`}
          >
            {isDeletingRoutes
              ? "Deleting routes…"
              : selectedRouteIds.length === 0
              ? "Delete selected routes"
              : `Delete ${selectedRouteIds.length} selected`}
          </button>

          {/* New route button */}
          <Link
            href="/admin/routes/new"
            className="btn-primary px-4 py-2 text-xs font-semibold"
          >
            + New route
          </Link>
        </div>
      </section>

      {/* Filters */}
      <section className="card space-y-3">
        <div className="grid gap-3 md:grid-cols-3">
          {/* Search */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-200">
              Search
            </label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by route name or school…"
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
            />
          </div>

          {/* Direction */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-200">
              Direction
            </label>
            <select
              value={directionFilter}
              onChange={(e) =>
                setDirectionFilter(e.target.value as "" | "AM" | "MIDDAY" | "PM")
              }
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
            >
              <option value="">All</option>
              <option value="AM">AM</option>
              <option value="MIDDAY">Midday</option>
              <option value="PM">PM</option>
            </select>
          </div>

          {/* School */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-200">
              School
            </label>
            <select
              value={schoolFilter}
              onChange={(e) => setSchoolFilter(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
            >
              <option value="">All schools</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name || "Unnamed school"}
                </option>
              ))}
            </select>
          </div>
        </div>

        {routesDeleteError && (
          <p className="text-[11px] font-medium text-rose-400">
            {routesDeleteError}
          </p>
        )}
      </section>

      {/* Table / list */}
      <section className="card space-y-2">
        {loading ? (
          <div className="p-3 text-[11px] text-slate-400">Loading routes…</div>
        ) : error ? (
          <div className="p-3 text-[11px] text-rose-400">{error}</div>
        ) : filteredRoutes.length === 0 ? (
          <div className="p-3 text-[11px] text-slate-400">
            No routes found. Click{" "}
            <span className="font-semibold">+ New route</span> to create one.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl bg-slate-950/40">
            <table className="min-w-full text-left text-[11px] text-slate-200">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80">
                  {/* Select-all checkbox */}
                  <th className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAllRoutes}
                      className="h-3 w-3 rounded border border-slate-500 bg-slate-900"
                    />
                  </th>
                  <th className="px-3 py-2 font-semibold">Route</th>
                  <th className="px-3 py-2 font-semibold">Direction</th>
                  <th className="px-3 py-2 font-semibold">School</th>
                  <th className="px-3 py-2 font-semibold">Effective dates</th>
                  <th className="px-3 py-2 font-semibold">Daily rate</th>
                  <th className="px-3 py-2 font-semibold">Est. mileage</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRoutes.map((route) => (
                  <tr
                    key={route.id}
                    className="border-b border-slate-900/60 hover:bg-slate-900/50"
                  >
                    {/* Row selection checkbox */}
                    <td className="px-3 py-2 align-top">
                      <input
                        type="checkbox"
                        checked={selectedRouteIds.includes(route.id)}
                        onChange={() => toggleRouteSelection(route.id)}
                        className="h-3 w-3 rounded border border-slate-500 bg-slate-900"
                      />
                    </td>

                    {/* Route name + description */}
                    <td className="px-3 py-2 align-top">
                      <div className="text-xs font-medium text-slate-100">
                        {route.name}
                      </div>
                      {route.description && (
                        <div className="mt-0.5 text-[10px] text-slate-400">
                          {route.description}
                        </div>
                      )}
                    </td>

                    {/* Direction */}
                    <td className="px-3 py-2 align-top">
                      <span className="inline-flex items-center rounded-full bg-slate-700/50 px-2 py-0.5 text-[10px] font-semibold text-slate-100">
                        {route.direction || "—"}
                      </span>
                    </td>

                    {/* School */}
                    <td className="px-3 py-2 align-top text-[11px] text-slate-300">
                      {route.school_id
                        ? schoolMap[route.school_id] || "Unknown school"
                        : "—"}
                    </td>

                    {/* Effective dates */}
                    <td className="px-3 py-2 align-top text-[11px] text-slate-300">
                      <div className="flex flex-col">
                        <span>{formatDate(route.effective_start_date)}</span>
                        <span className="text-[10px] text-slate-500">
                          to {formatDate(route.effective_end_date)}
                        </span>
                      </div>
                    </td>

                    {/* Daily rate */}
                    <td className="px-3 py-2 align-top text-[11px] text-slate-300">
                      {formatMoney(route.effective_daily_rate)}
                    </td>

                    {/* Est. mileage */}
                    <td className="px-3 py-2 align-top text-[11px] text-slate-300">
                      {formatMileage(route.estimated_round_trip_mileage)}
                    </td>

                    {/* Status */}
                    <td className="px-3 py-2 align-top">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          route.is_active
                            ? "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/40"
                            : "bg-slate-700/30 text-slate-300 ring-1 ring-slate-600/60"
                        }`}
                      >
                        {route.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-2 align-top text-right">
                      <div className="inline-flex flex-wrap gap-1.5">
                        <Link
                          href={`/admin/routes/${route.id}`}
                          className="btn-ghost px-3 py-1 text-[11px]"
                        >
                          Edit route
                        </Link>
                        <Link
                          href={`/admin/routes/${route.id}`}
                          className="btn-ghost px-3 py-1 text-[11px]"
                        >
                          Stops &amp; assignments
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
