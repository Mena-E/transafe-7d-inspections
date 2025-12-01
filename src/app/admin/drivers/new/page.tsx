"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

export default function AdminAddDriverPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [license, setLicense] = useState("");
  const [phone, setPhone] = useState("");
  const [hourly, setHourly] = useState(""); // string, convert to number on submit
  const [pin, setPin] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Driver name is required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const hourlyNum =
        hourly.trim() === "" ? null : Number(hourly.trim());
      const payload: any = {
        full_name: name.trim(),
        license_number: license.trim() || null,
        phone: phone.trim() || null,
        hourly_rate: Number.isNaN(hourlyNum) ? null : hourlyNum,
        is_active: true,
      };

      // Optional: allow setting PIN at creation
      if (pin.trim()) {
        payload.pin = pin.trim();
      }

      const { error: insertErr } = await supabase
        .from("drivers")
        .insert(payload);

      if (insertErr) throw insertErr;

      // On success, go back to admin Drivers tab
      router.push("/admin#drivers");
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ?? "Failed to create driver. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 max-w-xl mx-auto">
      {/* Header */}
      <section className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Add new driver</h1>
          <p className="text-sm text-slate-300">
            Create a driver profile with name, license, phone, PIN, and hourly pay.
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <Link
            href="/admin#drivers"
            className="btn-ghost px-3 py-1 text-[11px]"
          >
            ← Back to Drivers
          </Link>
        </div>
      </section>

      {error && (
        <section className="card border border-red-500/50 bg-red-950/40">
          <p className="text-xs font-medium text-red-200">{error}</p>
        </section>
      )}

      {/* Form */}
      <section className="card space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-100">
            Full name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
            placeholder="e.g. Julio Duarte"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-100">
            Driver&apos;s license #
          </label>
          <input
            type="text"
            value={license}
            onChange={(e) => setLicense(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
            placeholder="License number"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-100">
            Phone number
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
            placeholder="e.g. 617-991-9152"
          />
          <p className="text-[11px] text-slate-400">
            This will be used for the one-tap Call button in the admin portal.
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-100">
            Hourly pay (USD)
          </label>
          <input
            type="number"
            step="0.01"
            value={hourly}
            onChange={(e) => setHourly(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
            placeholder="e.g. 30.00"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-100">
            Driver PIN (optional)
          </label>
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
            placeholder="4–6 digit PIN"
          />
          <p className="text-[11px] text-slate-400">
            You can also set or reset the PIN later from the Drivers list.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          className="btn-primary w-full text-sm"
          disabled={loading || !name.trim()}
        >
          {loading ? "Saving driver..." : "Save driver"}
        </button>
      </section>
    </div>
  );
}
