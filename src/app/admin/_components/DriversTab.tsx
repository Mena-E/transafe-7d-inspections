"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Driver = {
  id: string;
  full_name: string;
  license_number: string | null;
  phone: string | null;
  hourly_rate: number | null;
  is_active: boolean;
  pin: string | null;
  created_at: string;
};

function formatPhone(phone: string | null): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

type DriversTabProps = {
  drivers: Driver[];
  setDrivers: React.Dispatch<React.SetStateAction<Driver[]>>;
};

export default function DriversTab({ drivers, setDrivers }: DriversTabProps) {
  const [driverSearch, setDriverSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredDrivers = useMemo(() => {
    const query = driverSearch.trim().toLowerCase();
    if (!query) return drivers;
    return drivers.filter((d) =>
      (d.full_name ?? "").toLowerCase().includes(query),
    );
  }, [drivers, driverSearch]);

  const handleToggleDriverActive = async (driver: Driver) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/drivers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: driver.id, is_active: !driver.is_active }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to update driver.");
      }
      const body = await res.json();
      setDrivers((prev) =>
        prev.map((d) => (d.id === driver.id ? (body.driver as Driver) : d)),
      );
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Failed to update driver.");
    } finally {
      setLoading(false);
    }
  };

  const handleSetDriverPin = async (driver: Driver) => {
    const newPin = window.prompt(
      `Enter a new PIN for ${driver.full_name} (4-6 digits).\nLeave blank to cancel.`,
    );
    if (newPin === null) return;
    const trimmed = newPin.trim();
    if (!trimmed) return;

    const pinRegex = /^[0-9]{4,6}$/;
    if (!pinRegex.test(trimmed)) {
      alert("PIN must be 4-6 digits (numbers only).");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/drivers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: driver.id, pin: trimmed }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to update PIN.");
      }
      setDrivers((prev) =>
        prev.map((d) => (d.id === driver.id ? { ...d, pin: trimmed } : d)),
      );
      alert(`PIN updated for ${driver.full_name}.`);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Failed to update driver PIN.");
      alert("Failed to update PIN. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-4" id="drivers">
      <section className="card flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">
            Drivers
          </h2>
          <p className="text-[11px] text-slate-400">
            Manage your driver roster, search by name, click to call, and
            open a detail page to edit full driver information.
          </p>
        </div>
        <Link
          href="/admin/drivers/new"
          className="btn-primary px-4 py-2 text-xs font-semibold"
        >
          + Add driver
        </Link>
      </section>

      {error && (
        <section className="card border border-red-500/50 bg-red-950/40">
          <p className="text-xs font-medium text-red-200">{error}</p>
        </section>
      )}

      <section className="card space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
              Driver roster
            </h3>
            <p className="text-[11px] text-slate-400">
              Search and scroll through all drivers.
            </p>
          </div>
          <span className="text-[11px] text-slate-400">
            {filteredDrivers.length} of {drivers.length} total
          </span>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-200">
            Search drivers
          </label>
          <input
            type="text"
            value={driverSearch}
            onChange={(e) => setDriverSearch(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
            placeholder="Type a driver name..."
          />
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-slate-950/40">
          <div className="max-h-[460px] overflow-auto text-[11px] sm:text-xs">
            {filteredDrivers.length === 0 ? (
              <p className="p-3 text-[11px] text-slate-400">
                No drivers match your search.
              </p>
            ) : (
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-slate-900/90 text-slate-200">
                    <th className="sticky top-0 border-b border-slate-800 px-3 py-2 text-left text-[11px] font-semibold backdrop-blur">Name</th>
                    <th className="sticky top-0 border-b border-slate-800 px-3 py-2 text-left text-[11px] font-semibold backdrop-blur">License #</th>
                    <th className="sticky top-0 border-b border-slate-800 px-3 py-2 text-left text-[11px] font-semibold backdrop-blur">Phone</th>
                    <th className="sticky top-0 border-b border-slate-800 px-3 py-2 text-right text-[11px] font-semibold backdrop-blur">Hourly rate</th>
                    <th className="sticky top-0 border-b border-slate-800 px-3 py-2 text-left text-[11px] font-semibold backdrop-blur">Status</th>
                    <th className="sticky top-0 border-b border-slate-800 px-3 py-2 text-left text-[11px] font-semibold backdrop-blur">PIN</th>
                    <th className="sticky top-0 border-b border-slate-800 px-3 py-2 text-right text-[11px] font-semibold backdrop-blur">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDrivers.map((driver, idx) => {
                    const phoneDigits = (driver.phone || "").replace(/\D/g, "");
                    return (
                      <tr
                        key={driver.id}
                        className={`border-b border-slate-800/60 transition hover:bg-slate-900/80 ${
                          idx % 2 === 0 ? "bg-slate-950/70" : "bg-slate-900/60"
                        }`}
                      >
                        <td className="px-3 py-2 text-slate-100">{driver.full_name}</td>
                        <td className="px-3 py-2 text-slate-100">{driver.license_number || "N/A"}</td>
                        <td className="px-3 py-2 text-slate-100">
                          {driver.phone && phoneDigits.length === 10 ? (
                            <a
                              href={`tel:${phoneDigits}`}
                              className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-100 ring-1 ring-emerald-500/50 transition hover:bg-emerald-500/25 active:scale-[0.97]"
                            >
                              <span>{formatPhone(driver.phone)}</span>
                            </a>
                          ) : driver.phone ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-700/40 px-2.5 py-1 text-[11px] text-slate-100">
                              <span>{driver.phone}</span>
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px]">No number</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-100">
                          {driver.hourly_rate != null ? `$${driver.hourly_rate.toFixed(2)}` : "—"}
                        </td>
                        <td className="px-3 py-2 text-slate-100">
                          {driver.is_active ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">Active</span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-slate-500/20 px-2 py-0.5 text-[11px] font-semibold text-slate-200">Inactive</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-100">
                          {driver.pin ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-200 ring-1 ring-emerald-500/40">PIN set</span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200 ring-1 ring-amber-500/40">PIN not set</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            <Link href={`/admin/drivers/${driver.id}`} className="btn-ghost px-3 py-1 text-[11px]">View / Edit</Link>
                            <button type="button" onClick={() => handleToggleDriverActive(driver)} className="btn-ghost px-3 py-1 text-[11px]" disabled={loading}>
                              {driver.is_active ? "Deactivate" : "Activate"}
                            </button>
                            <button type="button" onClick={() => handleSetDriverPin(driver)} className="btn-ghost px-3 py-1 text-[11px]" disabled={loading}>
                              Set / Reset PIN
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          {loading && (
            <div className="border-t border-slate-800/80 bg-slate-950/80 px-3 py-2 text-[11px] text-slate-400">
              Working... please wait a moment.
            </div>
          )}
        </div>
      </section>
    </section>
  );
}
