"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewVehiclePage() {
  const router = useRouter();

  const [label, setLabel] = useState("");
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [plate, setPlate] = useState("");
  const [vin, setVin] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!label.trim()) {
      setError("Vehicle label is required.");
      return;
    }

    try {
      setLoading(true);

      const payload = {
        label: label.trim(),
        year: year ? Number(year) : null,
        make: make.trim() || null,
        model: model.trim() || null,
        plate: plate.trim() || null,
        vin: vin.trim() || null,
        is_active: isActive,
      };

      const res = await fetch("/api/admin/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        console.error(json.error);
        throw new Error(json.error || "Failed to create vehicle.");
      }

      // Go back to Vehicles tab on success
      router.push("/admin#vehicles");
    } catch (err: any) {
      console.error("Error creating vehicle:", err);
      setError(err?.message ?? "Failed to create vehicle. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    router.push("/admin#vehicles");
  };

  return (
    <div className="space-y-4">
      {/* Header / breadcrumb */}
      <section className="card flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
            Fleet
          </p>
          <h1 className="text-lg font-semibold text-slate-50">
            Add new vehicle
          </h1>
          <p className="text-xs text-slate-300">
            Create a new vehicle profile that drivers can select in the Driver Portal.
          </p>
        </div>

        <Link
          href="/admin#vehicles"
          className="btn-ghost px-3 py-1.5 text-[11px]"
        >
          ← Back to Vehicles
        </Link>
      </section>

      {/* Form */}
      <section className="card">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-100">
              Vehicle label <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
              placeholder="e.g. 2025 Kia Carnival – Plate 123ABC"
            />
            <p className="text-[11px] text-slate-400">
              This is what drivers will see in the vehicle dropdown.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="block text-[11px] text-slate-300">
                Year
              </label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                placeholder="2025"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] text-slate-300">
                Make
              </label>
              <input
                type="text"
                value={make}
                onChange={(e) => setMake(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                placeholder="Kia"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] text-slate-300">
                Model
              </label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                placeholder="Carnival"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] text-slate-300">
                Plate
              </label>
              <input
                type="text"
                value={plate}
                onChange={(e) => setPlate(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                placeholder="1ABC23"
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="block text-[11px] text-slate-300">
                VIN (optional)
              </label>
              <input
                type="text"
                value={vin}
                onChange={(e) => setVin(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                placeholder="Vehicle Identification Number"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsActive((prev) => !prev)}
              className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ring-1 transition ${
                isActive
                  ? "bg-emerald-500/15 text-emerald-200 ring-emerald-500/50"
                  : "bg-slate-700/40 text-slate-200 ring-slate-500/60"
              }`}
            >
              <span
                className={`mr-1 h-2 w-2 rounded-full ${
                  isActive ? "bg-emerald-400" : "bg-slate-400"
                }`}
              />
              {isActive ? "Active for Driver Portal" : "Inactive"}
            </button>
            <span className="text-[11px] text-slate-400">
              Toggle off if this vehicle should not appear for drivers yet.
            </span>
          </div>

          {error && (
            <p className="text-[11px] font-medium text-rose-300">{error}</p>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="submit"
              disabled={loading || !label.trim()}
              className="btn-primary px-4 py-2 text-xs font-semibold disabled:opacity-60"
            >
              {loading ? "Saving…" : "Save vehicle"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="btn-ghost px-4 py-2 text-xs"
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
