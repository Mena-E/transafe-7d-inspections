// src/app/admin/routes/new/page.tsx
// === ROUTES: NEW ROUTE PAGE (ROUTE-ONLY WORKFLOW) ===
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type School = {
  id: string;
  name: string | null;
};

type Direction = "AM" | "MIDDAY" | "PM";

export default function NewRoutePage() {
  const router = useRouter();

  // -------- ROUTE FORM FIELDS --------
  const [name, setName] = useState("");
  const [direction, setDirection] = useState<Direction | "">("");
  const [schoolId, setSchoolId] = useState<string>("");
  const [effectiveStartDate, setEffectiveStartDate] = useState("");
  const [effectiveEndDate, setEffectiveEndDate] = useState("");
  const [ratePerMile, setRatePerMile] = useState("");
  const [estimatedRoundTripMileage, setEstimatedRoundTripMileage] =
    useState("");
  const [effectiveDailyRate, setEffectiveDailyRate] = useState("");
  const [isActive, setIsActive] = useState(true);

  // -------- SCHOOLS (READ-ONLY DROPDOWN) --------
  const [schools, setSchools] = useState<School[]>([]);
  const [loadingSchools, setLoadingSchools] = useState(false);

  // -------- UI STATE --------
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load schools once on mount
  useEffect(() => {
    let isMounted = true;

    async function loadSchools() {
      setLoadingSchools(true);
      try {
        const res = await fetch("/api/admin/schools");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load schools.");
        if (!isMounted) return;

        setSchools((json.schools || []) as School[]);
      } catch (err: any) {
        console.error("Error loading schools:", err);
        if (!isMounted) return;
        setError("Failed to load schools list. You can still create a route.");
      } finally {
        if (isMounted) setLoadingSchools(false);
      }
    }

    loadSchools();

    return () => {
      isMounted = false;
    };
  }, []);

  // -------- HANDLERS --------

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Route name is required.");
      return;
    }
    if (!direction) {
      setError("Please select AM, PM or MIDDAY for direction.");
      return;
    }
    if (!effectiveStartDate) {
      setError("Effective start date is required.");
      return;
    }

    setSaving(true);
    try {
      const ratePerMileNumber =
        ratePerMile.trim() === "" ? null : Number(ratePerMile);
      const estMileageNumber =
        estimatedRoundTripMileage.trim() === ""
          ? null
          : Number(estimatedRoundTripMileage);
      const dailyRateNumber =
        effectiveDailyRate.trim() === "" ? null : Number(effectiveDailyRate);

      const payload = {
        name: name.trim(),
        direction,
        school_id: schoolId || null,
        effective_start_date: effectiveStartDate,
        effective_end_date: effectiveEndDate || null,
        rate_per_mile: Number.isNaN(ratePerMileNumber)
          ? null
          : ratePerMileNumber,
        estimated_round_trip_mileage: Number.isNaN(estMileageNumber)
          ? null
          : estMileageNumber,
        effective_daily_rate: Number.isNaN(dailyRateNumber)
          ? null
          : dailyRateNumber,
        is_active: isActive,
      };

      const res = await fetch("/api/admin/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create route.");

      // After save, go back to Admin Routes tab
      router.push("/admin#routes");
    } catch (err: any) {
      console.error("Error creating route:", err);
      setError(err?.message ?? "Failed to create route. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // -------- RENDER --------

  return (
    <div className="space-y-4">
      {/* Top bar / breadcrumb */}
      <section className="card flex items-center justify-between gap-2">
        <div className="space-y-1">
          <h1 className="text-base font-semibold text-slate-100">New route</h1>
          <p className="text-xs text-slate-400">
            Create a new AM/MIDDAY/PM route and set effective dates, primary school,
            and pricing.
          </p>
        </div>

        <Link
          href="/admin#routes"
          className="btn-ghost px-3 py-1.5 text-[11px]"
        >
          ← Back to Routes
        </Link>
      </section>

      {error && (
        <section className="card border border-rose-500/60 bg-rose-950/40">
          <p className="text-xs font-medium text-rose-100">{error}</p>
        </section>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="card space-y-4">
        {/* Basic info */}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-200">
              Route name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
              placeholder='e.g. "Brookline – AM Route 1"'
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-200">
              Direction <span className="text-rose-400">*</span>
            </label>
         <select
            value={direction}
            onChange={(e) =>
                setDirection(e.target.value as Direction | "")
            }
            className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
            >
            <option value="">Select direction</option>
            <option value="AM">AM (Morning)</option>
            <option value="MIDDAY">(Midday)</option>
            <option value="PM">PM (Afternoon)</option>
          </select>

          </div>

          {/* School dropdown (no quick add) */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-200">
              Primary school (optional)
            </label>
            <select
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
            >
              <option value="">
                {loadingSchools ? "Loading schools…" : "No specific school"}
              </option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name || "Unnamed school"}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-500">
              To add or edit schools, use the Schools admin workflow
              (we&apos;ll wire that up as a separate tab).
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-200">
              Active status
            </label>
            <div className="flex items-center gap-2 text-xs text-slate-200">
              <input
                id="is-active-checkbox"
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border border-white/20 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
              />
              <label htmlFor="is-active-checkbox" className="select-none">
                Route is active
              </label>
            </div>
          </div>
        </div>

        {/* Dates */}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-200">
              Effective start date <span className="text-rose-400">*</span>
            </label>
            <input
              type="date"
              value={effectiveStartDate}
              onChange={(e) => setEffectiveStartDate(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-200">
              Effective end date (optional)
            </label>
            <input
              type="date"
              value={effectiveEndDate}
              onChange={(e) => setEffectiveEndDate(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
            />
          </div>
        </div>

        {/* Pricing & mileage */}
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-200">
              Rate per mile (optional)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={ratePerMile}
              onChange={(e) => setRatePerMile(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
              placeholder="e.g. 3.50"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-200">
              Est. round-trip mileage (optional)
            </label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={estimatedRoundTripMileage}
              onChange={(e) => setEstimatedRoundTripMileage(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
              placeholder="e.g. 45.0"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-200">
              Effective daily rate (optional)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={effectiveDailyRate}
              onChange={(e) => setEffectiveDailyRate(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
              placeholder="e.g. 250.00"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <p className="text-[11px] text-slate-400">
            After saving, you&apos;ll be taken back to the Routes tab to manage
            stops and assignments. Schools are managed in a separate admin
            workflow.
          </p>
          <div className="flex gap-2">
            <Link
              href="/admin#routes"
              className="btn-ghost px-4 py-2 text-[11px]"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary px-5 py-2 text-[11px] font-semibold"
            >
              {saving ? "Saving…" : "Save route"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
