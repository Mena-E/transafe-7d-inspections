"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// ---- TYPES ----

type StudentRow = {
  id: string;
  full_name: string;
  student_id: string | null;
  pickup_address: string;
  is_active: boolean;
  primary_guardian_name: string | null;
  primary_guardian_phone: string | null;
  school_name: string | null;
};

// ---- COMPONENT ----

export default function StudentsTab() {
  const router = useRouter();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<StudentRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load students on mount
  useEffect(() => {
    let isMounted = true;

    async function loadStudents() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/admin/students");
        if (!res.ok) throw new Error("Failed to load students");
        const body = await res.json();

        const mapped: StudentRow[] = (body.students || []).map((row: any) => ({
          id: row.id,
          full_name: row.full_name,
          student_id: row.student_id,
          pickup_address: row.pickup_address,
          is_active: row.is_active,
          primary_guardian_name: row.primary_guardian_name ?? null,
          primary_guardian_phone: row.primary_guardian_phone ?? null,
          school_name: row.school_name ?? null,
        }));

        if (!isMounted) return;
        setStudents(mapped);
        setFilteredStudents(mapped);
      } catch (err: any) {
        console.error("Error loading students:", err);
        if (!isMounted) return;
        setError("Failed to load students. Please try again.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadStudents();

    return () => {
      isMounted = false;
    };
  }, []);

  // Search filter
  useEffect(() => {
    const raw = search.trim().toLowerCase();

    if (!raw) {
      setFilteredStudents(students);
      return;
    }

    // Digits-only version of the search (for phone number search)
    const searchDigits = raw.replace(/\D/g, "");

    setFilteredStudents(
      students.filter((st) => {
        const fullName = (st.full_name || "").toLowerCase();
        const studentId = (st.student_id || "").toLowerCase();
        const schoolName = (st.school_name || "").toLowerCase();
        const pickup = (st.pickup_address || "").toLowerCase();
        const guardianName = (st.primary_guardian_name || "").toLowerCase();
        const phoneDigits = (st.primary_guardian_phone || "").replace(
          /\D/g,
          "",
        );

        // Text search across name, ID, school, pickup address, guardian name
        const textHaystack = `${fullName} ${studentId} ${schoolName} ${pickup} ${guardianName}`;
        const textMatch = textHaystack.includes(raw);

        // Numeric search across guardian phone digits
        const phoneMatch =
          searchDigits.length > 0 && phoneDigits.includes(searchDigits);

        return textMatch || phoneMatch;
      }),
    );
  }, [search, students]);

  // Delete handler
  const handleDeleteStudent = async (st: StudentRow) => {
    const confirmed = window.confirm(
      `Delete student "${st.full_name}"? This will remove them from routes and guardian links.`,
    );
    if (!confirmed) return;

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/admin/students?id=${st.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to delete student.");
      }

      // 4) Update UI
      setStudents((prev) => prev.filter((s) => s.id !== st.id));
      setFilteredStudents((prev) => prev.filter((s) => s.id !== st.id));
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Failed to delete student.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Students</h2>
          <p className="text-xs text-slate-400">
            Manage student records, school assignments, and route eligibility.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search by student, ID, school, address, or guardian phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-xs rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500"
          />

          <button
            onClick={() => router.push("/admin/students/new")}
            className="btn-primary whitespace-nowrap px-3 py-1.5 text-xs"
          >
            + Add student
          </button>
        </div>
      </div>

      {error && (
        <div className="card border border-red-500/50 bg-red-950/40">
          <p className="text-xs font-medium text-red-200">{error}</p>
        </div>
      )}

      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 shadow-lg shadow-black/40">
        {loading ? (
          <div className="py-10 text-center text-sm text-slate-400">
            Loading students...
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">
            No students found. Click &ldquo;Add student&rdquo; to create one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs text-slate-200">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80">
                  <th className="sticky left-0 z-10 bg-slate-900/80 px-3 py-2 font-semibold">
                    Student
                  </th>
                  <th className="px-3 py-2 font-semibold">Student ID</th>
                  <th className="px-3 py-2 font-semibold">Primary guardian</th>
                  <th className="px-3 py-2 font-semibold">School</th>
                  <th className="px-3 py-2 font-semibold">Pickup address</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold text-right">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredStudents.map((st) => (
                  <tr
                    key={st.id}
                    className="border-b border-slate-900/60 hover:bg-slate-900/50"
                  >
                    {/* Student */}
                    <td className="sticky left-0 z-10 bg-slate-950/90 px-3 py-2 text-xs font-medium">
                      {st.full_name}
                    </td>

                    {/* Student ID */}
                    <td className="px-3 py-2 text-[11px] text-slate-300">
                      {st.student_id || (
                        <span className="text-slate-500">&mdash;</span>
                      )}
                    </td>

                    {/* Primary guardian */}
                    <td className="px-3 py-2 text-[11px] text-slate-300">
                      {st.primary_guardian_name &&
                      st.primary_guardian_phone ? (
                        (() => {
                          const digits =
                            st.primary_guardian_phone.replace(/\D/g, "");
                          const label =
                            digits.length === 10
                              ? `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
                              : st.primary_guardian_phone;

                          return (
                            <a
                              href={`tel:${digits}`}
                              className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-100 ring-1 ring-emerald-500/50 transition hover:bg-emerald-500/25 active:scale-[0.97]"
                              title="Tap to call primary guardian"
                            >
                              <span className="truncate max-w-[220px]">
                                {st.primary_guardian_name} &bull; {label}
                              </span>
                            </a>
                          );
                        })()
                      ) : (
                        <span className="text-slate-500">
                          No primary guardian
                        </span>
                      )}
                    </td>

                    {/* School */}
                    <td className="px-3 py-2 text-[11px] text-slate-300">
                      {st.school_name || (
                        <span className="text-slate-500">&mdash;</span>
                      )}
                    </td>

                    {/* Pickup address */}
                    <td className="px-3 py-2 text-[11px] text-slate-300">
                      <span className="line-clamp-2 max-w-xs">
                        {st.pickup_address}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-3 py-2 text-[11px]">
                      {st.is_active ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 ring-1 ring-emerald-500/40">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-slate-700/30 px-2 py-0.5 text-[10px] font-semibold text-slate-300 ring-1 ring-slate-600/60">
                          Inactive
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-2 text-right text-[11px]">
                      <div className="inline-flex gap-1.5">
                        <button
                          onClick={() =>
                            router.push(`/admin/students/${st.id}`)
                          }
                          className="btn-ghost px-3 py-1 text-[11px]"
                        >
                          View / Edit
                        </button>
                        <button
                          onClick={() => handleDeleteStudent(st)}
                          className="btn-ghost px-3 py-1 text-[11px] text-rose-300 hover:text-rose-200"
                          title="Delete student"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
