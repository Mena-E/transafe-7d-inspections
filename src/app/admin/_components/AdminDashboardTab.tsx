"use client";

import { useEffect, useState } from "react";

type DashboardCounts = {
  drivers: number;
  vehicles: number;
  students: number;
  schools: number;
  routes: number;
  inspections: number;
};

type RecentInspection = {
  id: string;
  driver_name: string | null;
  vehicle_label: string | null;
  inspection_type: string | null;
  shift: string | null;
  overall_status: string | null;
  submitted_at: string | null;
};

function formatStatusPill(status: string | null) {
  if (!status) {
    return (
      <span className="inline-flex rounded-full bg-slate-700/70 px-2 py-0.5 text-[10px] font-semibold text-slate-100">
        N/A
      </span>
    );
  }

  const s = status.toLowerCase();
  if (s === "pass") {
    return (
      <span className="inline-flex rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-200 ring-1 ring-emerald-500/50">
        PASS
      </span>
    );
  }
  if (s === "fail") {
    return (
      <span className="inline-flex rounded-full bg-red-600/30 px-2 py-0.5 text-[10px] font-semibold text-red-100 ring-1 ring-red-500/60">
        FAIL
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-slate-700/70 px-2 py-0.5 text-[10px] font-semibold text-slate-100">
      {status.toUpperCase()}
    </span>
  );
}

function formatInspectionType(type: string | null) {
  if (!type) return "—";
  return type === "pre" ? "Pre-trip" : type === "post" ? "Post-trip" : type;
}

function formatShortDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminDashboardTab() {
  const [counts, setCounts] = useState<DashboardCounts | null>(null);
  const [recentInspections, setRecentInspections] = useState<RecentInspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/admin/dashboard");
        if (!res.ok) throw new Error("Failed to load dashboard data");
        const body = await res.json();

        setCounts(body.counts);
        setRecentInspections(body.recentInspections || []);
      } catch (err: any) {
        console.error("Error loading admin dashboard:", err);
        setError(err?.message || "Failed to load dashboard data.");
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  return (
    <div className="space-y-4">
      {/* Top summary / error state */}
      {error && (
        <section className="card border border-red-500/60 bg-red-950/40">
          <p className="text-xs font-semibold text-red-100">
            {error} Please check your Supabase tables and try refreshing.
          </p>
        </section>
      )}

      {/* KPI cards */}
      <section className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Drivers", key: "drivers" as const, hint: "Active + inactive" },
          {
            label: "Vehicles",
            key: "vehicles" as const,
            hint: "Fleet feeding Driver Portal",
          },
          {
            label: "Students",
            key: "students" as const,
            hint: "Riding your 7D routes",
          },
          { label: "Schools", key: "schools" as const, hint: "District partners" },
          {
            label: "Routes",
            key: "routes" as const,
            hint: "Active AM / PM routes",
          },
          {
            label: "Inspections",
            key: "inspections" as const,
            hint: "Total records",
          },
        ].map((item) => (
          <div
            key={item.key}
            className="card flex flex-col justify-between bg-slate-950/70 px-3 py-3"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              {item.label}
            </p>
            <p className="mt-1 text-2xl font-bold text-emerald-300">
              {loading || !counts ? "…" : counts[item.key].toLocaleString()}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">{item.hint}</p>
          </div>
        ))}
      </section>

      {/* Activity snapshot */}
      <section className="card space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">
              Recent inspection activity
            </h2>
            <p className="text-[11px] text-slate-400">
              Last few inspection submissions from the Driver Portal.
            </p>
          </div>
          {loading && (
            <span className="text-[11px] text-slate-400">Loading…</span>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl bg-slate-950/50">
          {recentInspections.length === 0 && !loading ? (
            <p className="px-3 py-4 text-[11px] text-slate-400">
              No inspections found yet. Once drivers start submitting pre- and
              post-trip forms, the latest entries will appear here.
            </p>
          ) : (
            <table className="min-w-full border-separate border-spacing-0 text-[11px]">
              <thead>
                <tr className="bg-slate-900/90 text-slate-200">
                  <th className="border-b border-slate-800 px-3 py-2 text-left font-semibold">
                    When
                  </th>
                  <th className="border-b border-slate-800 px-3 py-2 text-left font-semibold">
                    Driver
                  </th>
                  <th className="border-b border-slate-800 px-3 py-2 text-left font-semibold">
                    Vehicle
                  </th>
                  <th className="border-b border-slate-800 px-3 py-2 text-left font-semibold">
                    Type / Shift
                  </th>
                  <th className="border-b border-slate-800 px-3 py-2 text-left font-semibold">
                    Status
                  </th>
                  <th className="border-b border-slate-800 px-3 py-2 text-right font-semibold">
                    Open
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentInspections.map((insp, idx) => (
                  <tr
                    key={insp.id}
                    className={`border-b border-slate-900/70 ${
                      idx % 2 === 0
                        ? "bg-slate-950/70"
                        : "bg-slate-900/70"
                    }`}
                  >
                   <td className="px-3 py-2 text-slate-200">
                    {formatShortDate(insp.submitted_at)}
                   </td>

                    <td className="px-3 py-2 text-slate-100">
                      {insp.driver_name || "Unknown driver"}
                    </td>
                    <td className="px-3 py-2 text-slate-200">
                      {insp.vehicle_label || "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-200">
                      {formatInspectionType(insp.inspection_type)}{" "}
                      {insp.shift ? (
                        <span className="text-slate-500">
                          • {insp.shift}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      {formatStatusPill(insp.overall_status)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <a
                        href={`/inspection/${insp.id}?from=admin-dashboard`}
                        className="btn-ghost px-3 py-1 text-[11px]"
                      >
                        View form
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
