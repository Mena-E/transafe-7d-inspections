"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type School = {
  id: string;
  name: string;
};

type Student = {
  id: string;
  full_name: string;
  student_id: string | null;
  pickup_address: string;
  pickup_city: string | null;
  pickup_state: string | null;
  pickup_zip: string | null;
  school_id: string | null;
  is_active: boolean;
  created_at: string;
  primary_guardian_name: string| null,
  primary_guardian_phone: string| null,
  primary_guardian_relationship: string | null,
};

type GuardianWithLink = {
  linkId: string; // id from student_guardians
  id: string; // guardian.id
  full_name: string;
  phone: string | null;
  email: string | null;
  preferred_contact_method: string | null;
  relationship: string | null;
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default function AdminStudentDetailPage({ params }: PageProps) {
  const router = useRouter();

  // because params is now a Promise in Next 15/16
  const [studentIdPk, setStudentIdPk] = useState<string | null>(null);

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);

  const [schools, setSchools] = useState<School[]>([]);
  const [loadingSchools, setLoadingSchools] = useState(false);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // --- guardians state ---
  const [guardians, setGuardians] = useState<GuardianWithLink[]>([]);
  const [loadingGuardians, setLoadingGuardians] = useState(false);
  const [showGuardianForm, setShowGuardianForm] = useState(false);
  const [savingGuardian, setSavingGuardian] = useState(false);

  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [guardianRelationship, setGuardianRelationship] = useState("");
  const [guardianPreferredContact, setGuardianPreferredContact] = useState<
    "call" | "text" | "email"
  >("call");

  // form state
  const [fullName, setFullName] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [primaryGuardianName, setPrimaryGuardianName] = useState("");
  const [pickupCity, setPickupCity] = useState("");
  const [pickupState, setPickupState] = useState("MA");
  const [pickupZip, setPickupZip] = useState("");
  const [schoolId, setSchoolId] = useState<string | "">("");
  const [isActive, setIsActive] = useState(true);
  const [primaryGuardianPhone, setPrimaryGuardianPhone] = useState("");
  const [primaryGuardianRelationship, setPrimaryGuardianRelationship] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");

  // --- unwrap params Promise once on mount ---
  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const resolved = await params;
        if (isMounted) {
          setStudentIdPk(resolved.id);
        }
      } catch (err) {
        console.error("Failed to resolve params", err);
        setError("Invalid student URL.");
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [params]);

  // --- admin gate ---
  useEffect(() => {
    if (typeof window === "undefined") return;

    const unlocked =
      window.localStorage.getItem("transafe_admin_unlocked") === "true";

    if (!unlocked) {
      router.push("/admin");
      return;
    }

    setIsAuthed(true);
    setCheckingAuth(false);
  }, [router]);

  // --- load schools once authed ---
  useEffect(() => {
    if (!isAuthed) return;

    const loadSchools = async () => {
      setLoadingSchools(true);
      try {
        const res = await fetch("/api/admin/schools");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load schools.");
        setSchools((json.schools as School[]) || []);
      } catch (err: any) {
        console.error(err);
        setError(err.message ?? "Failed to load schools.");
      } finally {
        setLoadingSchools(false);
      }
    };

    loadSchools();
  }, [isAuthed]);

  // --- load student once we know PK + authed ---
  useEffect(() => {
    if (!isAuthed || !studentIdPk) return;

    const loadStudent = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/admin/students?id=${studentIdPk}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load student.");
        const data = json.student;
        if (!data) {
          setError("Student not found.");
          return;
        }

        const s = data as Student;
        setFullName(s.full_name ?? "");
        setStudentNumber(s.student_id ?? "");
        setPickupAddress(s.pickup_address ?? "");
        setPickupCity(s.pickup_city ?? "");
        setPickupState(s.pickup_state ?? "MA");
        setPickupZip(s.pickup_zip ?? "");
        setSchoolId(s.school_id ?? "");
        setIsActive(s.is_active);
        setPrimaryGuardianName(s.primary_guardian_name ?? "");
        setPrimaryGuardianPhone(s.primary_guardian_phone ?? "");
        setPrimaryGuardianRelationship(s.primary_guardian_relationship ?? "");
      } catch (err: any) {
        console.error(err);
        setError(err.message ?? "Failed to load student.");
      } finally {
        setLoading(false);
      }
    };

    loadStudent();
  }, [isAuthed, studentIdPk]);

  // --- load guardians for this student ---
  useEffect(() => {
    if (!isAuthed || !studentIdPk) return;

    const loadGuardians = async () => {
      setLoadingGuardians(true);
      try {
        const res = await fetch(`/api/admin/guardians?student_id=${studentIdPk}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load guardians.");
        setGuardians((json.guardians as GuardianWithLink[]) || []);
      } catch (err: any) {
        console.error(err);
        setError(err.message ?? "Failed to load guardians.");
      } finally {
        setLoadingGuardians(false);
      }
    };

    loadGuardians();
  }, [isAuthed, studentIdPk]);

  const selectedSchoolName = useMemo(() => {
    if (!schoolId) return "";
    const s = schools.find((sch) => sch.id === schoolId);
    return s?.name ?? "";
  }, [schoolId, schools]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentIdPk) return;

    if (!fullName.trim() || !pickupAddress.trim()) {
      setError("Student name and pickup address are required.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // ⬇️ REPLACE your current payload with this:
        const payload: Record<string, any> = {
        full_name: fullName.trim(),
        student_id: studentNumber.trim() || null,
        pickup_address: pickupAddress.trim(),
        pickup_city: pickupCity.trim() || null,
        pickup_state: pickupState.trim() || null,
        pickup_zip: pickupZip.trim() || null,
        school_id: schoolId || null,
        is_active: isActive,

        // 👇 make sure these state variables exist on this page
        primary_guardian_name: primaryGuardianName.trim() || null,
        primary_guardian_phone: primaryGuardianPhone.replace(/\D/g, "") || null,
        primary_guardian_relationship: primaryGuardianRelationship.trim() || null,
        };


      const res = await fetch("/api/admin/students", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: studentIdPk, ...payload }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update student.");

       // ✅ redirect to Students tab
      router.push("/admin#students");
      return;

      setSuccessMessage("Student profile updated.");
      setTimeout(() => setSuccessMessage(null), 2500);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Failed to update student.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddGuardian = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentIdPk) return;

    if (!guardianName.trim() || !guardianPhone.trim()) {
      setError("Guardian name and phone are required.");
      return;
    }

    setSavingGuardian(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/guardians", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: studentIdPk,
          full_name: guardianName.trim(),
          phone: guardianPhone.trim(),
          email: guardianEmail.trim() || null,
          preferred_contact_method: guardianPreferredContact,
          relationship: guardianRelationship.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to add guardian.");

      const g = json.guardian;

      // Update local state
      setGuardians((prev) => [
        ...prev,
        {
          linkId: g.linkId,
          id: g.id,
          full_name: g.full_name,
          phone: g.phone,
          email: g.email,
          preferred_contact_method: g.preferred_contact_method,
          relationship: g.relationship,
        },
      ]);

      // Reset form
      setGuardianName("");
      setGuardianPhone("");
      setGuardianEmail("");
      setGuardianRelationship("");
      setGuardianPreferredContact("call");
      setShowGuardianForm(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Failed to add guardian.");
    } finally {
      setSavingGuardian(false);
    }
  };

  const handleRemoveGuardian = async (linkId: string) => {
    const confirmed = window.confirm(
      "Remove this guardian from the student? The guardian record itself will remain in the system."
    );
    if (!confirmed) return;

    setSavingGuardian(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/guardians?link_id=${linkId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to remove guardian.");

      setGuardians((prev) => prev.filter((g) => g.linkId !== linkId));
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Failed to remove guardian.");
    } finally {
      setSavingGuardian(false);
    }
  };

  if (checkingAuth || !studentIdPk) {
    return (
      <div className="card">
        <p className="text-sm text-slate-200">Loading student…</p>
      </div>
    );
  }

  if (!isAuthed) {
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
      {/* Header / Back link */}
      <section className="card flex items-center justify-between">
        <Link
          href="/admin?tab=students"
          className="text-[11px] text-emerald-300 hover:text-emerald-200"
        >
          ← Back to Students
        </Link>
        <span className="text-[11px] text-slate-400">
          Student detail &amp; profile
        </span>
      </section>

      {/* Student core info */}
      <section className="card space-y-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-base font-semibold text-slate-50">
            Edit student
          </h1>
          <p className="text-[11px] text-slate-400">
            Update the student&apos;s pickup address, student ID, assigned
            school, and active status.
          </p>
        </div>

        {error && (
          <p className="text-xs font-medium text-red-400">{error}</p>
        )}
        {successMessage && (
          <p className="text-xs font-medium text-emerald-400">
            {successMessage}
          </p>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[11px] font-medium text-slate-200">
              Student full name<span className="text-red-400"> *</span>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
              placeholder="e.g. Jane Doe"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-medium text-slate-200">
              Student ID (district)
            </label>
            <input
              type="text"
              value={studentNumber}
              onChange={(e) => setStudentNumber(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
              placeholder="e.g. 123456"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-medium text-slate-200">
              Home / pickup address
              <span className="text-red-400"> *</span>
            </label>
            <input
              type="text"
              value={pickupAddress}
              onChange={(e) => setPickupAddress(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
              placeholder="Street address"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <label className="text-[11px] font-medium text-slate-200">
                City
              </label>
              <input
                type="text"
                value={pickupCity}
                onChange={(e) => setPickupCity(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                placeholder="e.g. Boston"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-medium text-slate-200">
                State
              </label>
              <input
                type="text"
                value={pickupState}
                onChange={(e) => setPickupState(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                placeholder="MA"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-medium text-slate-200">
                ZIP
              </label>
              <input
                type="text"
                value={pickupZip}
                onChange={(e) => setPickupZip(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                placeholder="e.g. 02135"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-medium text-slate-200">
              Assigned school
            </label>
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
            <p className="text-[11px] text-slate-400">
              {loadingSchools
                ? "Loading schools…"
                : selectedSchoolName
                ? `Current: ${selectedSchoolName}`
                : "You can manage schools directly in Supabase for now."}
            </p>
          </div>

          <div className="space-y-2">
            <section className="mt-2 space-y-2 rounded-xl bg-slate-950/40 p-3">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                    Primary guardian & contact
                </h2>
                <p className="text-[11px] text-slate-400">
                    This guardian will be shown to drivers as the main tap-to-call contact.
                </p>

                <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-2">
                    <label className="text-[11px] font-medium text-slate-200">
                        Guardian name
                    </label>
                    <input
                        type="text"
                        value={primaryGuardianName}
                        onChange={(e) => setPrimaryGuardianName(e.target.value)}
                        className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                        placeholder="e.g. Jane Doe"
                    />
                    </div>

                    <div className="space-y-2">
                    <label className="text-[11px] font-medium text-slate-200">
                        Phone (tap-to-call)
                    </label>
                    <input
                        type="tel"
                        value={primaryGuardianPhone}
                        onChange={(e) => setPrimaryGuardianPhone(e.target.value)}
                        className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                        placeholder="e.g. (617) 555-1234"
                    />
                    </div>

                    <div className="space-y-2">
                    <label className="text-[11px] font-medium text-slate-200">
                        Relationship
                    </label>
                    <input
                        type="text"
                        value={primaryGuardianRelationship}
                        onChange={(e) => setPrimaryGuardianRelationship(e.target.value)}
                        className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                        placeholder="e.g. Mother, Case Worker"
                    />
                    </div>
                </div>
                </section>

            <label className="text-[11px] font-medium text-slate-200">
              Status
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsActive(true)}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold transition active:scale-[0.97] ${
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
                className={`rounded-full px-3 py-1 text-[11px] font-semibold transition active:scale-[0.97] ${
                  !isActive
                    ? "bg-amber-500 text-slate-950 shadow"
                    : "bg-slate-900 text-slate-100 ring-1 ring-white/10 hover:bg-slate-800"
                }`}
              >
                Inactive
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary px-4 py-2 text-xs font-semibold"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </section>

      {/* Guardians & contacts */}
      <section className="card space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-50">
              Guardians &amp; contacts
            </h2>
            <p className="text-[11px] text-slate-400">
              Add parents, case workers, or other contacts for this student.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowGuardianForm((v) => !v)}
            className="btn-ghost px-3 py-1 text-[11px]"
          >
            {showGuardianForm ? "Cancel" : "+ Add guardian"}
          </button>
        </div>

        {loadingGuardians ? (
          <p className="text-[11px] text-slate-400">Loading guardians…</p>
        ) : guardians.length === 0 ? (
          <p className="text-[11px] text-slate-400">
            No guardians linked yet. Use &ldquo;Add guardian&rdquo; to create one.
          </p>
        ) : (
          <div className="space-y-2">
            {guardians.map((g) => {
              const digits = (g.phone || "").replace(/\D/g, "");
              const canCall = digits.length === 10;
              return (
                <div
                  key={g.linkId}
                  className="flex flex-col gap-2 rounded-xl bg-slate-950/60 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-100">
                        {g.full_name}
                      </span>
                      {g.relationship && (
                        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
                          {g.relationship}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {g.phone &&
                        (canCall ? (
                          <a
                            href={`tel:${digits}`}
                            className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-100 ring-1 ring-emerald-500/40"
                          >
                            <span>📞</span>
                            <span>{g.phone}</span>
                          </a>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-700/40 px-2.5 py-1 text-[11px] text-slate-100">
                            <span>{g.phone}</span>
                          </span>
                        ))}
                      {g.email && (
                        <a
                          href={`mailto:${g.email}`}
                          className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2.5 py-1 text-[11px] font-semibold text-sky-100 ring-1 ring-sky-500/40"
                        >
                          <span>✉️</span>
                          <span className="max-w-[160px] truncate">
                            {g.email}
                          </span>
                        </a>
                      )}
                      {g.preferred_contact_method && (
                        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-slate-300">
                          Prefers {g.preferred_contact_method}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => handleRemoveGuardian(g.linkId)}
                      className="btn-ghost px-3 py-1 text-[11px] text-rose-300 hover:text-rose-200"
                      disabled={savingGuardian}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {showGuardianForm && (
          <form
            onSubmit={handleAddGuardian}
            className="mt-2 space-y-3 rounded-xl bg-slate-950/70 p-3"
          >
            <p className="text-[11px] font-semibold text-slate-200">
              Add new guardian
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-[11px] text-slate-200">
                  Full name<span className="text-red-400"> *</span>
                </label>
                <input
                  type="text"
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-slate-200">
                  Relationship
                </label>
                <input
                  type="text"
                  value={guardianRelationship}
                  onChange={(e) => setGuardianRelationship(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                  placeholder="e.g. Mother, Case Worker"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <label className="text-[11px] text-slate-200">
                  Phone<span className="text-red-400"> *</span>
                </label>
                <input
                  type="text"
                  value={guardianPhone}
                  onChange={(e) => setGuardianPhone(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                  placeholder="e.g. 6175551234"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-slate-200">
                  Email
                </label>
                <input
                  type="email"
                  value={guardianEmail}
                  onChange={(e) => setGuardianEmail(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                  placeholder="optional"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-slate-200">
                  Preferred contact
                </label>
                <select
                  value={guardianPreferredContact}
                  onChange={(e) =>
                    setGuardianPreferredContact(
                      e.target.value as "call" | "text" | "email"
                    )
                  }
                  className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                >
                  <option value="call">Call</option>
                  <option value="text">Text</option>
                  <option value="email">Email</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowGuardianForm(false)}
                className="btn-ghost px-3 py-1 text-[11px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingGuardian}
                className="btn-primary px-4 py-1.5 text-[11px]"
              >
                {savingGuardian ? "Saving…" : "Save guardian"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
