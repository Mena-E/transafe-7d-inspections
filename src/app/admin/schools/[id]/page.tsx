// src/app/admin/schools/[id]/page.tsx
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

type School = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
};

export default function EditSchoolPage() {
  const router = useRouter();
  const params = useParams();
  const schoolId = params?.id as string;

  const [school, setSchool] = useState<School | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");


  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      if (!schoolId) {
        setError("Missing school id.");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/admin/schools?id=${schoolId}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load school.");
        const data = json.school;
        if (!isMounted) return;

        const sc = data as School;
        setSchool(sc);
        setName(sc.name);
        setAddress(sc.address || "");
        setPhone(sc.phone || "");
        setStartTime(sc.start_time || "");
        setEndTime(sc.end_time || "");
        setNotes(sc.notes || "");

      } catch (err: any) {
        console.error("Error loading school:", err);
        if (!isMounted) return;
        setError(err?.message ?? "Failed to load school.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [schoolId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!schoolId) {
      setError("Missing school id.");
      return;
    }
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
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: schoolId, ...payload }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update school.");

      router.push("/admin#schools");
    } catch (err: any) {
      console.error("Error updating school:", err);
      setError(err?.message ?? "Failed to update school.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <section className="card">
          <p className="text-xs text-slate-300">Loading school…</p>
        </section>
      </div>
    );
  }

  if (error && !school) {
    return (
      <div className="space-y-4">
        <section className="card border border-rose-500/60 bg-rose-950/40">
          <p className="text-xs font-medium text-rose-100">{error}</p>
        </section>
        <Link href="/admin#schools" className="btn-ghost px-3 py-1.5 text-xs">
          ← Back to Schools
        </Link>
      </div>
    );
  }

  if (!school) {
    return (
      <div className="space-y-4">
        <section className="card">
          <p className="text-xs text-slate-300">
            School not found. It may have been deleted.
          </p>
        </section>
        <Link href="/admin#schools" className="btn-ghost px-3 py-1.5 text-xs">
          ← Back to Schools
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="card flex items-center justify-between gap-2">
        <div className="space-y-1">
          <h1 className="text-base font-semibold text-slate-100">
            Edit school
          </h1>
          <p className="text-xs text-slate-400">
            Update the school&apos;s name, address, bell times, and notes.
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
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
