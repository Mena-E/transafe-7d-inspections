"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

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

  // form state
  const [fullName, setFullName] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupCity, setPickupCity] = useState("");
  const [pickupState, setPickupState] = useState("MA");
  const [pickupZip, setPickupZip] = useState("");
  const [schoolId, setSchoolId] = useState<string | "">("");
  const [isActive, setIsActive] = useState(true);

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
        const { data, error } = await supabase
          .from("schools")
          .select("id, name")
          .order("name", { ascending: true });

        if (error) throw error;
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

  // --- load student once we know PK + authed ---
  useEffect(() => {
    if (!isAuthed || !studentIdPk) return;

    const loadStudent = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error } = await supabase
          .from("students")
          .select(
            `
              id,
              full_name,
              student_id,
              pickup_address,
              pickup_city,
              pickup_state,
              pickup_zip,
              school_id,
              is_active,
              created_at
            `,
          )
          .eq("id", studentIdPk)
          .maybeSingle();

        if (error) throw error;
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
      } catch (err: any) {
        console.error(err);
        setError(err.message ?? "Failed to load student.");
      } finally {
        setLoading(false);
      }
    };

    loadStudent();
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
      const payload = {
        full_name: fullName.trim(),
        student_id: studentNumber.trim() || null,
        pickup_address: pickupAddress.trim(),
        pickup_city: pickupCity.trim() || null,
        pickup_state: pickupState.trim() || null,
        pickup_zip: pickupZip.trim() || null,
        school_id: schoolId || null,
        is_active: isActive,
      };

      const { error } = await supabase
        .from("students")
        .update(payload)
        .eq("id", studentIdPk);

      if (error) throw error;

      setSuccessMessage("Student profile updated.");
      setTimeout(() => setSuccessMessage(null), 2500);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Failed to update student.");
    } finally {
      setSaving(false);
    }
  };

  const handleBackToStudents = () => {
  // Force the admin page to reopen on the Students tab
  if (typeof window !== "undefined") {
    window.localStorage.setItem("transafe_admin_last_tab", "students");
  }
  router.push("/admin");
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
        <p className="text-sm text-slate-200">Redirecting to admin login…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="card flex items-center justify-between">
        <button
          type="button"
          onClick={handleBackToStudents}
          className="text-[11px] text-emerald-300 hover:text-emerald-200"
        >
          ← Back to Students
        </button>
        <span className="text-[11px] text-slate-400">
          Student detail &amp; profile
        </span>
      </section>

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
    </div>
  );
}
