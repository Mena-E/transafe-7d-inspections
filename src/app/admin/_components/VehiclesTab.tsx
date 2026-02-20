"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Vehicle = {
  id: string;
  label: string;
  year: number | null;
  make: string | null;
  model: string | null;
  plate: string | null;
  vin: string | null;
  is_active: boolean;
  created_at: string;
};

type VehiclesTabProps = {
  vehicles: Vehicle[];
  setVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
};

export default function VehiclesTab({ vehicles, setVehicles }: VehiclesTabProps) {
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredVehicles = useMemo(() => {
    const query = vehicleSearch.trim().toLowerCase();
    if (!query) return vehicles;
    return vehicles.filter((v) => {
      const label = (v.label || "").toLowerCase();
      const make = (v.make || "").toLowerCase();
      const model = (v.model || "").toLowerCase();
      const plate = (v.plate || "").toLowerCase();
      const year = v.year ? String(v.year).toLowerCase() : "";
      return label.includes(query) || make.includes(query) || model.includes(query) || plate.includes(query) || year.includes(query);
    });
  }, [vehicles, vehicleSearch]);

  const handleToggleVehicleActive = async (vehicle: Vehicle) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/vehicles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: vehicle.id, is_active: !vehicle.is_active }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to update vehicle.");
      }
      const body = await res.json();
      setVehicles((prev) => prev.map((v) => (v.id === vehicle.id ? (body.vehicle as Vehicle) : v)));
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Failed to update vehicle.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVehicle = async (vehicle: Vehicle) => {
    const confirmed = window.confirm(`Delete vehicle "${vehicle.label}"? This cannot be undone.`);
    if (!confirmed) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/vehicles?id=${vehicle.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to delete vehicle.");
      }
      setVehicles((prev) => prev.filter((v) => v.id !== vehicle.id));
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Failed to delete vehicle.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-4">
      <section className="card flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">Vehicles</h2>
          <p className="text-[11px] text-slate-400">Manage your fleet. This list feeds the vehicle dropdown in the Driver Portal.</p>
        </div>
        <div className="flex flex-col items-end gap-1 text-right">
          <span className="text-[11px] text-slate-400">{filteredVehicles.length} of {vehicles.length} total</span>
          <Link href="/admin/vehicles/new" className="btn-primary px-4 py-2 text-xs font-semibold">+ Add vehicle</Link>
        </div>
      </section>

      {error && (
        <section className="card border border-red-500/50 bg-red-950/40">
          <p className="text-xs font-medium text-red-200">{error}</p>
        </section>
      )}

      <section className="card space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">Fleet roster</h3>
            <p className="text-[11px] text-slate-400">Scroll to view all vehicles.</p>
          </div>
          <div className="space-y-1 sm:w-64">
            <label className="text-[11px] font-medium text-slate-200">Search vehicles</label>
            <input
              type="text"
              value={vehicleSearch}
              onChange={(e) => setVehicleSearch(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
              placeholder="Filter by label, plate, make, model, or year..."
            />
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-slate-950/40">
          <div className="max-h-[420px] overflow-auto text-[11px] sm:text-xs">
            {filteredVehicles.length === 0 ? (
              <p className="p-3 text-[11px] text-slate-400">No vehicles match your search.</p>
            ) : (
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-slate-900/90 text-slate-200">
                    <th className="sticky top-0 border-b border-slate-800 px-3 py-2 text-left text-[11px] font-semibold backdrop-blur">Vehicle</th>
                    <th className="sticky top-0 border-b border-slate-800 px-3 py-2 text-left text-[11px] font-semibold backdrop-blur">Label</th>
                    <th className="sticky top-0 border-b border-slate-800 px-3 py-2 text-left text-[11px] font-semibold backdrop-blur">Plate</th>
                    <th className="sticky top-0 border-b border-slate-800 px-3 py-2 text-left text-[11px] font-semibold backdrop-blur">VIN</th>
                    <th className="sticky top-0 border-b border-slate-800 px-3 py-2 text-left text-[11px] font-semibold backdrop-blur">Status</th>
                    <th className="sticky top-0 border-b border-slate-800 px-3 py-2 text-right text-[11px] font-semibold backdrop-blur">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVehicles.map((vehicle, idx) => (
                    <tr key={vehicle.id} className={`border-b border-slate-800/60 transition hover:bg-slate-900/80 ${idx % 2 === 0 ? "bg-slate-950/70" : "bg-slate-900/60"}`}>
                      <td className="px-3 py-2 text-slate-100">
                        {vehicle.year || vehicle.make || vehicle.model ? (
                          <>{vehicle.year ?? ""} {vehicle.make ?? ""} {vehicle.model ?? ""}</>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-100">{vehicle.label}</td>
                      <td className="px-3 py-2 text-slate-100">{vehicle.plate || "N/A"}</td>
                      <td className="px-3 py-2 text-slate-100">{vehicle.vin || <span className="text-slate-500">—</span>}</td>
                      <td className="px-3 py-2 text-slate-100">
                        {vehicle.is_active ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">Active</span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-slate-500/20 px-2 py-0.5 text-[11px] font-semibold text-slate-200">Inactive</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <Link href={`/admin/vehicles/${vehicle.id}`} className="btn-ghost px-3 py-1 text-[11px]">View / Edit</Link>
                          <button type="button" onClick={() => handleToggleVehicleActive(vehicle)} className="btn-ghost px-3 py-1 text-[11px]" disabled={loading}>
                            {vehicle.is_active ? "Deactivate" : "Activate"}
                          </button>
                          <button type="button" onClick={() => handleDeleteVehicle(vehicle)} className="btn-ghost px-3 py-1 text-[11px] text-red-300 hover:text-red-200" disabled={loading}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {loading && (
            <div className="border-t border-slate-800/80 bg-slate-950/80 px-3 py-2 text-[11px] text-slate-400">Working... please wait a moment.</div>
          )}
        </div>
      </section>
    </section>
  );
}
