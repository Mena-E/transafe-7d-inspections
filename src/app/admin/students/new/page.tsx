"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type School = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
};

const ADMIN_FLAG_KEY = "transafe_admin_unlocked";

export default function AdminNewStudentPage() {
  const router = useRouter();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);

  // Schools for dropdown
  const [schools, setSchools] = useState<School[]>([]);
  const [loadingSchools, setLoadingSchools] = useState(false);

  // Form state
  const [fullName, setFullName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupCity, setPickupCity] = useState("");
  const [pickupState, setPickupState] = useState("MA");
  const [pickupZip, setPickupZip] = useState("");
  const [schoolId, setSchoolId] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ---- Admin gate: same behavior as Drivers/other admin pages ----
  useEffect(() => {
    if (typeof window === "undefined") return;

    const unlocked = window.localStorage.getItem(ADMIN_FLAG_KEY);
    if (unlocked === "true") {
      setIsAuthed(true);
      setCheckingAuth(false);
    } else {
      // Not unlocked – bounce back to /admin
      setIsAuthed(false);
      setCheckingAuth(false);
      router.replace("/admin");
    }
  }, [router]);

  // ---- Load schools once authed ----
  useEffect(() => {
    if (!isAuthed) return;

    const loadSchools = async () => {
      setLoadingSchools(true);
      setError(null);
      try {
        const { data, error: schoolErr } = await supabase
          .from("schools")
          .select("id, name, address, city, state, zip")
          .order("name", { ascending: true });

        if (schoolErr) throw schoolErr;
        setSchools((data as School[]) || []);
      } catch (err: any) {
        console.error(err);
        setError(err.message ?? "Failed to load schools.");
      } finally {
        setLoadingSchools(false);
      }
    };

    loadSchools();
  }, [isAuthed]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !pickupAddress.trim()) {
      setError("Student name and pickup address are required.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const payload = {
        full_name: fullName.trim(),
        student_id: studentId.trim() || null,
        pickup_address: pickupAddress.trim(),
        pickup_city: pickupCity.trim() || null,
        pickup_state: pickupState.trim() || null,
        pickup_zip: pickupZip.trim() || null,
        school_id: schoolId || null,
        is_active: true,
      };

      const { error: insertErr } = await supabase
        .from("students")
        .insert(payload)
        .select()
        .single();

      if (insertErr) throw insertErr;

      setSuccessMessage("Student added successfully.");
      // Small delay so the user sees the message, then go back
      setTimeout(() => {
        router.push("/admin#students");
      }, 600);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Failed to add student. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="card">
        <p className="text-sm text-slate-200">Checking admin access…</p>
      </div>
    );
  }

  if (!isAuthed) {
    // We already redirected, this is just a safety message
    return (
      <div className="card">
        <p className="text-sm text-slate-200">
          Redirecting to admin login…
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top bar: back link */}
      <section className="card flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] text-slate-400">
            <button
              type="button"
              onClick={() => router.push("/admin#students")}
              className="text-emerald-300 hover:text-emerald-200"
            >
              ← Back to Students
            </button>
          </p>
          <h1 className="mt-1 text-lg font-semibold text-slate-100">
            Add new student
          </h1>
          <p className="text-xs text-slate-300">
            Capture the core details the district sends you so you can later
            build routes, group students, and assign them to drivers.
          </p>
        </div>
      </section>

      {/* Form */}
      <section className="card">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic details */}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-200">
                Student full name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                placeholder="e.g. Jane Doe"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-200">
                District student ID
              </label>
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                placeholder="e.g. 123456"
              />
            </div>
          </div>

          {/* Pickup address */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-200">
              Home / pickup address <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={pickupAddress}
              onChange={(e) => setPickupAddress(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
              placeholder="Street address"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-200">
                City
              </label>
              <input
                type="text"
                value={pickupCity}
                onChange={(e) => setPickupCity(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                placeholder="e.g. Boston"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-200">
                State
              </label>
              <input
                type="text"
                value={pickupState}
                onChange={(e) => setPickupState(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                placeholder="e.g. MA"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-200">
                ZIP
              </label>
              <input
                type="text"
                value={pickupZip}
                onChange={(e) => setPickupZip(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                placeholder="e.g. 02135"
              />
            </div>
          </div>

          {/* School selector */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-200">
              Assigned school
            </label>
            <select
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
            >
              <option value="">
                {loadingSchools
                  ? "Loading schools…"
                  : "Select a school (optional)"}
              </option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400">
              You can manage schools in the database directly for now. Later
              we can add a dedicated Schools tab.
            </p>
          </div>

          {/* Status / notes */}
          <div className="rounded-xl bg-slate-950/60 p-3 text-[11px] text-slate-400">
            New students are created as{" "}
            <span className="font-semibold text-emerald-300">Active</span> by
            default. You’ll be able to deactivate them later from the Students
            tab once we wire up the full list and detail view.
          </div>

          {/* Messages */}
          {error && (
            <p className="text-xs font-medium text-red-400">{error}</p>
          )}
          {successMessage && (
            <p className="text-xs font-medium text-emerald-400">
              {successMessage}
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary px-4 py-2 text-xs font-semibold disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save student"}
            </button>
            <Link
              href="/admin#students"
              className="btn-ghost px-4 py-2 text-xs font-semibold"
            >
              Cancel
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}
