// src/app/driver/inspections/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type DriverSession = {
  driverId: string;
  driverName: string;
  licenseNumber: string | null;
};

type InspectionRecord = {
  id: string;
  driver_id: string | null;
  driver_name: string;
  vehicle_label: string | null;
  inspection_type: "pre" | "post";
  shift: string | null;
  submitted_at: string | null;
  inspection_date: string | null;
  overall_status: string | null;
};

function formatDateTime(iso: string | null) {
  if (!iso) return "N/A";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export default function DriverInspectionHistoryPage() {
  const router = useRouter();

  const [driver, setDriver] = useState<DriverSession | null>(null);
  const [loadingDriver, setLoadingDriver] = useState(true);

  const [inspections, setInspections] = useState<InspectionRecord[]>([]);
  const [loadingInspections, setLoadingInspections] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore driver from localStorage (same pattern as Time Log + Driver Portal)
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

      // Fallback legacy keys
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
      console.error("Failed to restore driver for inspection history", err);
    } finally {
      setLoadingDriver(false);
    }
  }, []);

  // Load last 90 days of inspections for this driver
  useEffect(() => {
    if (!driver?.driverId && !driver?.driverName) return;

    const loadInspections = async () => {
      setLoadingInspections(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (driver.driverId) {
          params.set("driverId", driver.driverId);
        } else {
          params.set("driverName", driver.driverName);
        }

        const res = await fetch(`/api/driver/inspections?${params}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load inspections");

        setInspections((json.inspections as InspectionRecord[]) || []);
      } catch (err: any) {
        console.error(err);
        setError(
          err?.message ??
            "Could not load your inspection history. Please try again or contact your supervisor.",
        );
      } finally {
        setLoadingInspections(false);
      }
    };

    void loadInspections();
  }, [driver?.driverId, driver?.driverName]);

  const recordCountLabel = useMemo(() => {
    if (loadingInspections) return "Loading…";
    if (inspections.length === 0) return "No records in last 90 days";
    if (inspections.length === 1) return "1 record in last 90 days";
    return `${inspections.length} records in last 90 days`;
  }, [inspections.length, loadingInspections]);

  const handleBackToPortal = () => {
    router.push("/driver");
  };

  if (loadingDriver) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        <section className="card">
          <p className="text-sm text-slate-200">
            Loading driver session…
          </p>
        </section>
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        <section className="card space-y-3">
          <h1 className="text-lg font-semibold">Inspection History</h1>
          <p className="text-sm text-slate-200/80">
            We couldn&apos;t find an active driver session.
          </p>
          <p className="text-xs text-slate-400">
            Please go back to the driver portal, sign in with your name and
            vehicle, then return to the Inspection History page.
          </p>
          <button
            type="button"
            onClick={handleBackToPortal}
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
      {/* Header */}
      <section className="card flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold sm:text-xl">
            Inspection History
          </h1>
          <p className="text-sm text-slate-200/80">
            {driver.driverName} •{" "}
            <span className="text-xs text-slate-300">
              License #: {driver.licenseNumber ?? "N/A"}
            </span>
          </p>
          <p className="text-[11px] text-slate-400">
            View your submitted pre-trip and post-trip inspections from the
            last 90 days.
          </p>
          <p className="text-[11px] font-medium text-slate-300">
            {recordCountLabel}
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <button
            type="button"
            onClick={handleBackToPortal}
            className="btn-ghost px-3 py-1 text-xs"
          >
            ← Back to Driver Portal
          </button>
        </div>
      </section>

      {error && (
        <section className="card border border-red-500/50 bg-red-950/40">
          <p className="text-xs font-medium text-red-200">{error}</p>
        </section>
      )}

      {/* History list */}
      <section className="card space-y-3">
        {loadingInspections && (
          <p className="text-sm text-slate-200">Loading inspections…</p>
        )}

        {!loadingInspections && inspections.length === 0 && !error && (
          <p className="text-sm text-slate-200/90">
            You don&apos;t have any inspection submissions in the last 90 days.
          </p>
        )}

        {inspections.length > 0 && (
          <div className="max-h-[460px] space-y-2 overflow-y-auto rounded-2xl bg-slate-950/40 p-2 text-xs">
            {inspections.map((rec) => (
              <div
                key={rec.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-slate-900/80 p-2 hover:bg-slate-900"
              >
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-semibold text-slate-100">
                    {rec.inspection_type === "pre" ? "Pre-trip" : "Post-trip"} •{" "}
                    {formatDateTime(rec.submitted_at || rec.inspection_date)}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Vehicle: {rec.vehicle_label ?? "N/A"}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Shift: {rec.shift || "N/A"} • Status:{" "}
                    {rec.overall_status
                      ? rec.overall_status.toUpperCase()
                      : "N/A"}
                  </p>
                </div>
                <Link
                    href={`/inspection/${rec.id}?from=driver-history`}
                    className="btn-ghost shrink-0 px-3 py-1 text-[11px]"
                    >
                Open form
                </Link>

              </div>
            ))}
          </div>
        )}
      </section>

      {/* Hint footer */}
      <section className="card">
        <p className="text-[11px] text-slate-400">
          Inspection history is kept for at least{" "}
          <span className="font-semibold text-slate-200">90 days</span> for
          audit and compliance. For older records, please contact your
          supervisor or the Transafe office.
        </p>
      </section>
    </div>
  );
}
