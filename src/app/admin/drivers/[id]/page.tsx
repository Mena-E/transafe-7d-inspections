"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

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

export default function AdminDriverDetailPage() {
  const router = useRouter();
  const params = useParams();

  // `params.id` can be string | string[] | undefined, so normalize it
  const id =
    typeof params.id === "string"
      ? params.id
      : Array.isArray(params.id)
        ? params.id[0]
        : undefined;

  const [driver, setDriver] = useState<Driver | null>(null);
  const [fullName, setFullName] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Ensure admin is unlocked (simple check using same localStorage flag)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const unlocked = window.localStorage.getItem("transafe_admin_unlocked");
    if (unlocked !== "true") {
      router.replace("/admin");
    }
  }, [router]);

  function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10); // keep max 10 digits

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

    // Load driver data
  useEffect(() => {
    if (!id) return; // wait until the route param is available

    const loadDriver = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: drvErr } = await supabase
          .from("drivers")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (drvErr) throw drvErr;
        if (!data) {
          setError("Driver not found.");
          setDriver(null);
          setLoading(false);
          return;
        }

        const d = data as Driver;
        setDriver(d);
        setFullName(d.full_name);
        setLicenseNumber(d.license_number ?? "");
        setPhone(d.phone ? formatPhoneInput(d.phone) : "");
        setHourlyRate(
          d.hourly_rate != null ? d.hourly_rate.toString() : "",
        );
        setIsActive(d.is_active);
      } catch (err: any) {
        console.error(err);
        setError(err?.message ?? "Failed to load driver.");
      } finally {
        setLoading(false);
      }
    };

    void loadDriver();
  }, [id]);

  const handleSave = async () => {
    if (!fullName.trim()) {
      setError("Driver name is required.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const payload: Partial<Driver> = {
        full_name: fullName.trim(),
        license_number: licenseNumber.trim() || null,
        phone: phone.trim() || null,
        hourly_rate: hourlyRate
          ? Number.parseFloat(hourlyRate)
          : null,
        is_active: isActive,
      };

      const { data, error: updateErr } = await supabase
        .from("drivers")
        .update(payload)
        .eq("id", id)
        .select()
        .single();

      if (updateErr) throw updateErr;

      setDriver(data as Driver);
      setMessage("Driver profile updated.");
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Failed to update driver.");
    } finally {
      setSaving(false);
    }
  };

  const handleSetPin = async () => {
    if (!driver) return;

    const newPin = window.prompt(
      `Enter a new PIN for ${driver.full_name} (4–6 digits).\nLeave blank to cancel.`,
    );

    if (newPin === null) return;

    const trimmed = newPin.trim();
    if (!trimmed) return;

    const pinRegex = /^[0-9]{4,6}$/;
    if (!pinRegex.test(trimmed)) {
      alert("PIN must be 4–6 digits (numbers only).");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const { data, error: updateErr } = await supabase
        .from("drivers")
        .update({ pin: trimmed })
        .eq("id", id)
        .select()
        .single();

      if (updateErr) throw updateErr;

      setDriver(data as Driver);
      setMessage("PIN updated.");
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Failed to update PIN.");
      alert("Failed to update PIN. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!driver) return;

    const confirmed = window.confirm(
      `Delete driver "${driver.full_name}"? This cannot be undone.`,
    );
    if (!confirmed) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const { error: deleteErr } = await supabase
        .from("drivers")
        .delete()
        .eq("id", id);

      if (deleteErr) throw deleteErr;

      router.push("/admin#drivers");
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ??
          "Failed to delete driver. Check if they are referenced elsewhere.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <section className="card">
          <p className="text-sm text-slate-200">Loading driver…</p>
        </section>
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <section className="card space-y-3">
          <h1 className="text-lg font-semibold">Driver not found</h1>
          <p className="text-sm text-slate-200/80">
            We couldn&apos;t find a driver with this ID.
          </p>
          <Link
            href="/admin#drivers"
            className="btn-ghost inline-flex px-3 py-1 text-sm"
          >
            ← Back to Drivers
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Header */}
      <section className="card flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            Edit driver: {driver.full_name}
          </h1>
          <p className="text-xs text-slate-300">
            Update name, license, phone, hourly pay, status, and PIN.
          </p>
        </div>
        <Link
          href="/admin#drivers"
          className="btn-ghost px-3 py-1 text-[11px]"
        >
          ← Back to Drivers
        </Link>
      </section>

      {error && (
        <section className="card border border-red-500/50 bg-red-950/40">
          <p className="text-xs font-medium text-red-200">{error}</p>
        </section>
      )}

      {message && (
        <section className="card border border-emerald-500/50 bg-emerald-950/40">
          <p className="text-xs font-medium text-emerald-200">{message}</p>
        </section>
      )}

      {/* Form */}
      <section className="card space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-200">
            Full name
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-200">
            Driver&apos;s license #
          </label>
          <input
            type="text"
            value={licenseNumber}
            onChange={(e) => setLicenseNumber(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-200">
            Phone number
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
            className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
            placeholder="e.g. 617-555-1234"
           />

          <p className="text-[11px] text-slate-400">
            This number will be clickable from the admin drivers table.
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-200">
            Hourly rate (USD)
          </label>
          <input
            type="number"
            step="0.01"
            value={hourlyRate}
            onChange={(e) => setHourlyRate(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
            placeholder="e.g. 28.50"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-200">Status</p>
            <p className="text-[11px] text-slate-400">
              {isActive
                ? "Active drivers appear in the driver portal."
                : "Inactive drivers are hidden from the driver portal."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsActive((prev) => !prev)}
            className="btn-ghost px-3 py-1 text-[11px]"
          >
            {isActive ? "Set Inactive" : "Set Active"}
          </button>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-slate-950/60 px-3 py-2">
          <div>
            <p className="text-xs font-semibold text-slate-200">
              Driver PIN status
            </p>
            <p className="text-[11px] text-slate-400">
              We never show the PIN value, only whether it&apos;s set.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-[11px]">
              {driver.pin ? "PIN set" : "PIN not set"}
            </span>
            <button
              type="button"
              onClick={handleSetPin}
              className="btn-ghost px-3 py-1 text-[11px]"
            >
              Set / Reset PIN
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <button
            type="button"
            onClick={handleSave}
            className="btn-primary px-4 py-2 text-sm"
            disabled={saving}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="btn-ghost px-4 py-2 text-xs text-red-300 hover:text-red-200"
            disabled={saving}
          >
            Delete driver
          </button>
        </div>
      </section>
    </div>
  );
}
