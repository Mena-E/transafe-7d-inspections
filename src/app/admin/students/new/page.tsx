"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type School = { id: string; name: string };

export default function AdminStudentNewPage() {
  const router = useRouter();

  // --- admin gate (reuse your localStorage flag) ---
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const unlocked = window.localStorage.getItem("transafe_admin_unlocked") === "true";
    if (!unlocked) {
      router.push("/admin");
      return;
    }
    setIsAuthed(true);
    setCheckingAuth(false);
  }, [router]);

  // --- form state: student ---
  const [fullName, setFullName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupCity, setPickupCity] = useState("");
  const [pickupState, setPickupState] = useState("MA");
  const [pickupZip, setPickupZip] = useState("");
  const [schoolId, setSchoolId] = useState<string | "">("");
  const [isActive, setIsActive] = useState(true);
  const [notes, setNotes] = useState("");

  // --- form state: primary guardian (optional but encouraged) ---
  const [pgName, setPgName] = useState("");
  const [pgPhone, setPgPhone] = useState("");
  const [pgEmail, setPgEmail] = useState("");
  const [pgPref, setPgPref] = useState<"call" | "text" | "email">("call");
  const [pgRelationship, setPgRelationship] = useState("Primary");

  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- load schools for dropdown ---
  useEffect(() => {
    if (!isAuthed) return;
    (async () => {
      const res = await fetch("/api/admin/schools");
      const json = await res.json();
      if (!res.ok) {
        console.error(json.error);
        setError("Failed to load schools.");
        return;
      }
      setSchools((json.schools as School[]) ?? []);
    })();
  }, [isAuthed]);

  const normalizePhone = (raw: string) => raw.replace(/\D/g, "");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // --- basic validation ---
    if (!fullName.trim()) return setError("Student name is required.");
    if (!pickupAddress.trim()) return setError("Pickup address is required.");

    // if guardian provided ANYTHING, require name + 10-digit phone
    const guardianProvided = !!(pgName.trim() || pgPhone.trim() || pgEmail.trim());
    if (guardianProvided) {
      if (!pgName.trim()) return setError("Primary guardian name is required.");
      const digits = normalizePhone(pgPhone);
      if (digits.length !== 10) return setError("Primary guardian phone must be 10 digits.");
    }

    setLoading(true);
    try {
      // 1) create student
      // ⬇️ REPLACE your current studentPayload with this:
        const studentPayload: Record<string, any> = {
        full_name: fullName.trim(),
        student_id: studentId.trim() || null,
        pickup_address: pickupAddress.trim(),
        pickup_city: pickupCity.trim() || null,
        pickup_state: pickupState.trim() || null,
        pickup_zip: pickupZip.trim() || null,
        school_id: schoolId || null,
        is_active: isActive,
        notes: notes.trim() || null,

        // 👇 primary guardian fields stored on students table
        primary_guardian_name: pgName.trim() || null,
        primary_guardian_phone: normalizePhone(pgPhone) || null,
        primary_guardian_relationship: (pgRelationship || "").trim() || null,
        };


      const apiPayload: Record<string, any> = { ...studentPayload };

      // 2) if guardian info present, include it in the API call
      if (guardianProvided) {
        const digits = normalizePhone(pgPhone);
        apiPayload.guardian = {
          full_name: pgName.trim(),
          phone: digits,
          email: pgEmail.trim() || null,
          preferred_contact_method: pgPref,
          relationship: pgRelationship || "Primary",
        };
      }

      const res = await fetch("/api/admin/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiPayload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create student.");

      // 3) redirect to Students tab
      router.replace("/admin#students");
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Failed to create student.");
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="card">
        <p className="text-sm text-slate-200">Loading…</p>
      </div>
    );
  }
  if (!isAuthed) {
    return (
      <div className="card">
        <p className="text-sm text-slate-200">Redirecting to admin login…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="card flex items-center justify-between">
        <Link href="/admin#students" className="text-[11px] text-emerald-300 hover:text-emerald-200">
          ← Back to Students
        </Link>
        <span className="text-[11px] text-slate-400">Create new student</span>
      </section>

      <section className="card space-y-6">
        <div>
          <h1 className="text-base font-semibold text-slate-50">New student</h1>
          <p className="text-[11px] text-slate-400">
            Enter the student’s details and (optionally) their primary guardian now.
          </p>
        </div>

        {error && <p className="text-xs font-medium text-red-400">{error}</p>}

        <form onSubmit={handleCreate} className="space-y-8">
          {/* STUDENT INFO */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">
              Student information
            </h2>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-200">
                  Full name <span className="text-red-400">*</span>
                </label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                  placeholder="e.g. Jane Doe"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-200">Student ID (district)</label>
                <input
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                  placeholder="e.g. 123456"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-200">
                Home / pickup address <span className="text-red-400">*</span>
              </label>
              <input
                value={pickupAddress}
                onChange={(e) => setPickupAddress(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                placeholder="Street address"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <input
                value={pickupCity}
                onChange={(e) => setPickupCity(e.target.value)}
                placeholder="City"
                className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
              />
              <input
                value={pickupState}
                onChange={(e) => setPickupState(e.target.value)}
                placeholder="State"
                className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
              />
              <input
                value={pickupZip}
                onChange={(e) => setPickupZip(e.target.value)}
                placeholder="ZIP"
                className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-200">School</label>
                <select
                  value={schoolId}
                  onChange={(e) => setSchoolId(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                >
                  <option value="">Select a school (optional)</option>
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-200">Status</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsActive(true)}
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                      isActive
                        ? "bg-emerald-500 text-slate-950 shadow"
                        : "bg-slate-900 text-slate-100 ring-1 ring-white/10 hover:bg-slate-800"
                    }`}
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsActive(false)}
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                      !isActive
                        ? "bg-amber-500 text-slate-950 shadow"
                        : "bg-slate-900 text-slate-100 ring-1 ring-white/10 hover:bg-slate-800"
                    }`}
                  >
                    Inactive
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-200">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                rows={3}
                placeholder="Behavior, wheelchair, language, etc."
              />
            </div>
          </div>

          {/* PRIMARY GUARDIAN */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">
              Primary guardian (optional, but recommended)
            </h2>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-200">Full name</label>
                <input
                  value={pgName}
                  onChange={(e) => setPgName(e.target.value)}
                  placeholder="e.g. Yashika Young"
                  className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-200">Phone</label>
                <input
                  value={pgPhone}
                  onChange={(e) => setPgPhone(e.target.value)}
                  placeholder="857-555-1212"
                  className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <input
                value={pgEmail}
                onChange={(e) => setPgEmail(e.target.value)}
                placeholder="Email (optional)"
                className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
              />
              <select
                value={pgPref}
                onChange={(e) => setPgPref(e.target.value as "call" | "text" | "email")}
                className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
              >
                <option value="call">Preferred: Call</option>
                <option value="text">Preferred: Text</option>
                <option value="email">Preferred: Email</option>
              </select>
              <input
                value={pgRelationship}
                onChange={(e) => setPgRelationship(e.target.value)}
                placeholder='Relationship (e.g. "Mother")'
                className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
              />
            </div>

            <p className="text-[11px] text-slate-400">
              If you leave guardian fields blank now, you can add them later from the student’s page.
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={loading} className="btn-primary px-4 py-2 text-xs font-semibold">
              {loading ? "Saving…" : "Save student"}
            </button>
            <Link href="/admin#students" className="btn-ghost px-4 py-2 text-xs">
              Cancel
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}
