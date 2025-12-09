"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

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

export default function VehicleDetailPage() {
  const router = useRouter();
  const params = useParams();
  const vehicleId = (params?.id as string) ?? "";

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [label, setLabel] = useState("");
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [plate, setPlate] = useState("");
  const [vin, setVin] = useState("");
  const [isActive, setIsActive] = useState(true);

  // ---------------------------------------
  //  AUTH GUARD (simple – reuse admin flag)
  // ---------------------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;
    const unlocked = window.localStorage.getItem("transafe_admin_unlocked");
    if (unlocked !== "true") {
      router.push("/admin");
    }
  }, [router]);

  // ---------------------------------------
  //  LOAD VEHICLE
  // ---------------------------------------
  useEffect(() => {
    if (!vehicleId) return;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: fetchErr } = await supabase
          .from("vehicles")
          .select("*")
          .eq("id", vehicleId)
          .single();

        if (fetchErr) throw fetchErr;
        if (!data) {
          throw new Error("Vehicle not found.");
        }

        const v = data as Vehicle;
        setVehicle(v);

        // Populate form fields
        setLabel(v.label ?? "");
        setYear(v.year != null ? String(v.year) : "");
        setMake(v.make ?? "");
        setModel(v.model ?? "");
        setPlate(v.plate ?? "");
        setVin(v.vin ?? "");
        setIsActive(v.is_active);
      } catch (err: any) {
        console.error("Error loading vehicle:", err);
        setError(err?.message ?? "Failed to load vehicle.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [vehicleId]);

  // ---------------------------------------
  //  SAVE CHANGES
  // ---------------------------------------
  const handleSave = async () => {
    if (!vehicleId || !label.trim()) return;

    setSaving(true);
    setError(null);

    try {
      const payload = {
        label: label.trim(),
        year: year ? Number(year) : null,
        make: make.trim() || null,
        model: model.trim() || null,
        plate: plate.trim() || null,
        vin: vin.trim() || null,
        is_active: isActive,
      };

      const { data, error: updateErr } = await supabase
        .from("vehicles")
        .update(payload)
        .eq("id", vehicleId)
        .select()
        .single();

      if (updateErr) throw updateErr;

      const updated = data as Vehicle;
      setVehicle(updated);

      // Small toast via alert for now
      alert("Vehicle updated successfully.");
    } catch (err: any) {
      console.error("Error updating vehicle:", err);
      setError(err?.message ?? "Failed to update vehicle.");
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------
  //  DELETE VEHICLE
  // ---------------------------------------
  const handleDelete = async () => {
    if (!vehicle) return;

    const confirmed = window.confirm(
      `Delete vehicle "${vehicle.label}"? This cannot be undone.`
    );
    if (!confirmed) return;

    setSaving(true);
    setError(null);

    try {
      // If routes / stops reference this, you might need to handle that first
      const { error: deleteErr } = await supabase
        .from("vehicles")
        .delete()
        .eq("id", vehicle.id);

      if (deleteErr) throw deleteErr;

      alert("Vehicle deleted.");
      router.push("/admin#vehicles");
    } catch (err: any) {
      console.error("Error deleting vehicle:", err);
      setError(err?.message ?? "Failed to delete vehicle.");
    } finally {
      setSaving(false);
    }
  };

  const createdAtPretty =
    vehicle?.created_at &&
    !Number.isNaN(new Date(vehicle.created_at).getTime())
      ? new Date(vehicle.created_at).toLocaleString()
      : null;

  // ---------------------------------------
  //  RENDER
  // ---------------------------------------

  if (loading) {
    return (
      <div className="space-y-4">
        <section className="card">
          <p className="text-sm text-slate-200">Loading vehicle…</p>
        </section>
      </div>
    );
  }

  if (error && !vehicle) {
    return (
      <div className="space-y-4">
        <section className="card space-y-3">
          <p className="text-sm font-semibold text-rose-300">
            Unable to load vehicle
          </p>
          <p className="text-sm text-rose-200">{error}</p>
          <Link href="/admin#vehicles" className="btn-ghost text-xs">
            ← Back to Vehicles
          </Link>
        </section>
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="space-y-4">
        <section className="card space-y-3">
          <p className="text-sm font-semibold text-rose-300">
            Vehicle not found.
          </p>
          <Link href="/admin#vehicles" className="btn-ghost text-xs">
            ← Back to Vehicles
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header / breadcrumb */}
      <section className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300">
            Vehicle detail
          </p>
          <h1 className="text-lg font-semibold text-slate-50 sm:text-xl">
            {vehicle.label}
          </h1>
          <p className="text-xs text-slate-300">
            {vehicle.year || vehicle.make || vehicle.model ? (
              <>
                {vehicle.year ?? ""} {vehicle.make ?? ""} {vehicle.model ?? ""}
              </>
            ) : (
              <span className="text-slate-400">No year / make / model set</span>
            )}
          </p>
          {createdAtPretty && (
            <p className="text-[11px] text-slate-500">
              Created: <span className="font-mono">{createdAtPretty}</span>
            </p>
          )}
        </div>

        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div>
            {vehicle.is_active ? (
              <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold text-emerald-200">
                Active vehicle
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-slate-500/20 px-3 py-1 text-[11px] font-semibold text-slate-200">
                Inactive vehicle
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setIsActive((prev) => !prev)}
              className="btn-ghost px-3 py-1 text-[11px]"
              disabled={saving}
            >
              {isActive ? "Mark as inactive" : "Mark as active"}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="btn-ghost px-3 py-1 text-[11px] text-rose-300 hover:text-rose-200"
              disabled={saving}
            >
              Delete vehicle
            </button>
          </div>
          <Link
            href="/admin#vehicles"
            className="text-[11px] text-slate-300 underline-offset-2 hover:underline"
          >
            ← Back to Vehicles
          </Link>
        </div>
      </section>

      {error && (
        <section className="card border border-rose-500/50 bg-rose-950/40">
          <p className="text-xs font-medium text-rose-200">{error}</p>
        </section>
      )}

      {/* Edit form */}
      <section className="card space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">
          Edit vehicle profile
        </h2>

        <div className="grid gap-3 md:grid-cols-2">
          {/* Label */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-200">
              Label <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
              placeholder="e.g. 2025 Kia Carnival – Plate 123ABC"
            />
          </div>

          {/* Year */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-200">
              Year
            </label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
              placeholder="e.g. 2025"
            />
          </div>

          {/* Make */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-200">
              Make
            </label>
            <input
              type="text"
              value={make}
              onChange={(e) => setMake(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
              placeholder="e.g. Kia"
            />
          </div>

          {/* Model */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-200">
              Model
            </label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
              placeholder="e.g. Carnival"
            />
          </div>

          {/* Plate */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-200">
              Plate
            </label>
            <input
              type="text"
              value={plate}
              onChange={(e) => setPlate(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
              placeholder="e.g. 1ABC23"
            />
          </div>

          {/* VIN */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-200">
              VIN
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

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-xs text-slate-200">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-500 bg-slate-900 text-emerald-500"
            />
            Active vehicle (available in Driver Portal)
          </label>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            onClick={handleSave}
            className="btn-primary px-5 py-2 text-xs font-semibold"
            disabled={saving || !label.trim()}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin#vehicles")}
            className="btn-ghost px-4 py-2 text-xs"
            disabled={saving}
          >
            Cancel and go back
          </button>
        </div>
      </section>
    </div>
  );
}
