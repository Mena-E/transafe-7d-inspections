"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

// ---- TYPES ----

type InspectionSummary = {
  id: string;
  driver_name: string;
  vehicle_label: string | null;
  inspection_type: "pre" | "post";
  shift: string | null;
  submitted_at: string | null;
  inspection_date: string | null;
  overall_status: string | null;
};

// ---- HELPERS ----

function formatDateTime(iso: string | null) {
  if (!iso) return "N/A";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

// ---- COMPONENT ----

export default function InspectionsTab() {
  const [inspections, setInspections] = useState<InspectionSummary[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load inspections on mount
  useEffect(() => {
    let isMounted = true;

    async function loadInspections() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/admin/inspections");
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Failed to load inspections.");
        }
        const data = await res.json();

        if (!isMounted) return;

        let mapped: InspectionSummary[] = (data.inspections || data || []).map(
          (row: any) => ({
            id: row.id,
            inspection_type:
              (row.inspection_type ?? row.type ?? "pre") as "pre" | "post",
            shift: row.shift ?? row.shift_name ?? null,
            submitted_at: row.submitted_at ?? row.created_at ?? null,
            inspection_date: row.inspection_date ?? row.date ?? null,
            overall_status: row.overall_status ?? row.status ?? null,
            driver_name:
              row.driver_name ??
              row.driver ??
              row.driver_full_name ??
              (row.driver_id ? `Driver ${row.driver_id}` : "Unknown driver"),
            vehicle_label:
              row.vehicle_label ??
              row.vehicle ??
              row.vehicle_label_full ??
              (row.vehicle_id ? `Vehicle ${row.vehicle_id}` : null),
          }),
        );

        // Newest first
        mapped = mapped.sort((a, b) => {
          const aTime = new Date(
            a.submitted_at || a.inspection_date || 0,
          ).getTime();
          const bTime = new Date(
            b.submitted_at || b.inspection_date || 0,
          ).getTime();
          return bTime - aTime;
        });

        setInspections(mapped);
      } catch (err: any) {
        console.error(err);
        if (isMounted) setError(err.message ?? "Failed to load inspections.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadInspections();

    return () => {
      isMounted = false;
    };
  }, []);

  // Refresh handler
  const handleRefresh = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/inspections");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to load inspections.");
      }
      const data = await res.json();

      let mapped: InspectionSummary[] = (data.inspections || data || []).map(
        (row: any) => ({
          id: row.id,
          inspection_type:
            (row.inspection_type ?? row.type ?? "pre") as "pre" | "post",
          shift: row.shift ?? row.shift_name ?? null,
          submitted_at: row.submitted_at ?? row.created_at ?? null,
          inspection_date: row.inspection_date ?? row.date ?? null,
          overall_status: row.overall_status ?? row.status ?? null,
          driver_name:
            row.driver_name ??
            row.driver ??
            row.driver_full_name ??
            (row.driver_id ? `Driver ${row.driver_id}` : "Unknown driver"),
          vehicle_label:
            row.vehicle_label ??
            row.vehicle ??
            row.vehicle_label_full ??
            (row.vehicle_id ? `Vehicle ${row.vehicle_id}` : null),
        }),
      );

      mapped = mapped.sort((a, b) => {
        const aTime = new Date(
          a.submitted_at || a.inspection_date || 0,
        ).getTime();
        const bTime = new Date(
          b.submitted_at || b.inspection_date || 0,
        ).getTime();
        return bTime - aTime;
      });

      setInspections(mapped);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Failed to load inspections.");
    } finally {
      setLoading(false);
    }
  };

  // Filtered inspections
  const filteredInspections = useMemo(() => {
    if (!search.trim()) return inspections;
    const q = search.trim().toLowerCase();

    return inspections.filter((rec) => {
      const driver = rec.driver_name?.toLowerCase() ?? "";
      const vehicle = rec.vehicle_label?.toLowerCase() ?? "";
      const type =
        rec.inspection_type === "pre"
          ? "pre-trip"
          : rec.inspection_type === "post"
          ? "post-trip"
          : "";
      const shift = rec.shift?.toLowerCase() ?? "";
      const status = rec.overall_status?.toLowerCase() ?? "";
      const date = (rec.submitted_at || rec.inspection_date || "")
        .toLowerCase()
        .slice(0, 10);

      return (
        driver.includes(q) ||
        vehicle.includes(q) ||
        type.includes(q) ||
        shift.includes(q) ||
        status.includes(q) ||
        date.includes(q)
      );
    });
  }, [search, inspections]);

  // CSV export
  const handleExportCsv = () => {
    if (filteredInspections.length === 0) {
      alert("No inspection records to export.");
      return;
    }

    const header = [
      "id",
      "submitted_at",
      "driver_name",
      "vehicle_label",
      "inspection_type",
      "shift",
      "overall_status",
    ];

    const rows = filteredInspections.map((rec) => [
      rec.id,
      rec.submitted_at || rec.inspection_date || "",
      rec.driver_name || "",
      rec.vehicle_label || "",
      rec.inspection_type === "pre" ? "pre-trip" : "post-trip",
      rec.shift || "",
      rec.overall_status || "",
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
    const today = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.setAttribute("download", `transafe_inspections_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <section className="space-y-4">
      <section className="card space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
              Inspection submissions (last 90 days)
            </h2>
            <p className="text-[11px] text-slate-400">
              Search, review, print, or export all driver pre- and post-trip
              inspections.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              className="btn-ghost px-3 py-1 text-[11px]"
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="btn-ghost px-3 py-1 text-[11px]"
            >
              Export CSV
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-200">
            Search inspections
          </label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
            placeholder="Filter by driver, vehicle, date (YYYY-MM-DD), shift, status, or type (pre / post)..."
          />
        </div>
      </section>

      {error && (
        <section className="card border border-red-500/50 bg-red-950/40">
          <p className="text-xs font-medium text-red-200">{error}</p>
        </section>
      )}

      <section className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-slate-400">
            Showing{" "}
            <span className="font-semibold text-slate-100">
              {filteredInspections.length}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-slate-100">
              {inspections.length}
            </span>{" "}
            records in the last 90 days.
          </p>
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>Pass</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              <span>Fail</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-slate-500" />
              <span>Other / N/A</span>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-slate-950/40">
          <div className="max-h-[460px] overflow-auto text-[11px]">
            {filteredInspections.length === 0 && !loading ? (
              <p className="p-3 text-[11px] text-slate-400">
                No inspections match your search in the last 90 days.
              </p>
            ) : (
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-slate-900/90 text-slate-200">
                    <th className="sticky top-0 border-b border-slate-800 px-2 py-2 text-left text-[11px] font-semibold backdrop-blur">
                      Date / time
                    </th>
                    <th className="sticky top-0 border-b border-slate-800 px-2 py-2 text-left text-[11px] font-semibold backdrop-blur">
                      Driver
                    </th>
                    <th className="sticky top-0 border-b border-slate-800 px-2 py-2 text-left text-[11px] font-semibold backdrop-blur">
                      Vehicle
                    </th>
                    <th className="sticky top-0 border-b border-slate-800 px-2 py-2 text-left text-[11px] font-semibold backdrop-blur">
                      Type
                    </th>
                    <th className="sticky top-0 border-b border-slate-800 px-2 py-2 text-left text-[11px] font-semibold backdrop-blur">
                      Shift
                    </th>
                    <th className="sticky top-0 border-b border-slate-800 px-2 py-2 text-left text-[11px] font-semibold backdrop-blur">
                      Status
                    </th>
                    <th className="sticky top-0 border-b border-slate-800 px-2 py-2 text-left text-[11px] font-semibold backdrop-blur">
                      View
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInspections.map((rec, idx) => (
                    <tr
                      key={rec.id}
                      className={`border-b border-slate-800/60 transition hover:bg-slate-900/80 ${
                        idx % 2 === 0
                          ? "bg-slate-950/70"
                          : "bg-slate-900/60"
                      }`}
                    >
                      <td className="px-2 py-1 text-slate-100">
                        {formatDateTime(
                          rec.submitted_at || rec.inspection_date,
                        )}
                      </td>
                      <td className="px-2 py-1 text-slate-100">
                        {rec.driver_name}
                      </td>
                      <td className="px-2 py-1 text-slate-200">
                        {rec.vehicle_label ?? "N/A"}
                      </td>
                      <td className="px-2 py-1">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            rec.inspection_type === "pre"
                              ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/40"
                              : "bg-sky-500/15 text-sky-200 ring-1 ring-sky-500/40"
                          }`}
                        >
                          {rec.inspection_type === "pre"
                            ? "Pre-trip"
                            : "Post-trip"}
                        </span>
                      </td>
                      <td className="px-2 py-1 text-slate-200">
                        {rec.shift ?? "N/A"}
                      </td>
                      <td className="px-2 py-1">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            rec.overall_status === "fail"
                              ? "bg-red-700/80 text-red-50"
                              : rec.overall_status === "pass"
                              ? "bg-emerald-700/80 text-emerald-50"
                              : "bg-slate-700/80 text-slate-50"
                          }`}
                        >
                          {rec.overall_status
                            ? rec.overall_status.toUpperCase()
                            : "N/A"}
                        </span>
                      </td>
                      <td className="px-2 py-1">
                        <Link
                          href={`/inspection/${rec.id}?from=admin-inspections`}
                          className="btn-ghost px-2 py-1 text-[11px]"
                        >
                          Open form
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {loading && (
            <div className="border-t border-slate-800/80 bg-slate-950/80 px-3 py-2 text-[11px] text-slate-400">
              Loading inspections...
            </div>
          )}
        </div>
      </section>
    </section>
  );
}
