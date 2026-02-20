// src/app/admin/schools/new/page.tsx
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewSchoolPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");


  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("School name is required.");
      return;
    }

    setSaving(true);
    try {
       const payload = {
        name: name.trim(),
        address: address.trim() || null,
        phone: phone.trim() || null,
        start_time: startTime || null,
        end_time: endTime || null,
        notes: notes.trim() || null,
      };

      const res = await fetch("/api/admin/schools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create school.");

      // After save, go back to Schools tab
      router.push("/admin#schools");
    } catch (err: any) {
      console.error("Error creating school:", err);
      setError(err?.message ?? "Failed to create school. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="card flex items-center justify-between gap-2">
        <div className="space-y-1">
          <h1 className="text-base font-semibold text-slate-100">
            Add new school
          </h1>
          <p className="text-xs text-slate-400">
            Create a school profile with address, bell times, and notes. Routes
            and students can reference these schools.
          </p>
        </div>

        <Link
          href="/admin#schools"
          className="btn-ghost px-3 py-1.5 text-[11px]"
        >
          ← Back to Schools
        </Link>
      </section>

      {error && (
        <section className="card border border-rose-500/60 bg-rose-950/40">
          <p className="text-xs font-medium text-rose-100">{error}</p>
        </section>
      )}

      <form onSubmit={handleSubmit} className="card space-y-4">
               <div className="grid gap-3 md:grid-cols-2">
          {/* Name */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-200">
              School name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
              placeholder="e.g. Baker Elementary School"
            />
          </div>

          {/* Address */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-200">
              Address (optional)
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
              placeholder="123 School St, Town, MA"
            />
          </div>

          {/* Phone */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-200">
              Phone (optional)
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
              placeholder="e.g. 617-555-1234"
            />
          </div>

          {/* Start time */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-200">
              School day start time (optional)
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
            />
          </div>

          {/* End time */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-200">
              School day end time (optional)
            </label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-200">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
            placeholder="Any special instructions or notes about this school…"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Link
            href="/admin#schools"
            className="btn-ghost px-4 py-2 text-[11px]"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary px-5 py-2 text-[11px] font-semibold"
          >
            {saving ? "Saving…" : "Save school"}
          </button>
        </div>
      </form>
    </div>
  );
}
