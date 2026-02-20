"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// ---- TYPES ----

type SchoolRow = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
};

// ---- COMPONENT ----

export default function SchoolsTab() {
  const router = useRouter();
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [filteredSchools, setFilteredSchools] = useState<SchoolRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load schools on mount
  useEffect(() => {
    let isMounted = true;

    async function loadSchools() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/admin/schools");
        if (!res.ok) throw new Error("Failed to load schools");
        const body = await res.json();

        if (!isMounted) return;

        const mapped: SchoolRow[] = (body.schools || []).map((row: any) => ({
          id: row.id,
          name: row.name,
          address: row.address ?? null,
          phone: row.phone ?? null,
          start_time: row.start_time ?? null,
          end_time: row.end_time ?? null,
          notes: row.notes ?? null,
        }));

        setSchools(mapped);
        setFilteredSchools(mapped);
      } catch (err: any) {
        console.error("Error loading schools:", err);
        if (!isMounted) return;
        setError("Failed to load schools. Please try again.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadSchools();

    return () => {
      isMounted = false;
    };
  }, []);

  // Search filter
  useEffect(() => {
    const s = search.trim().toLowerCase();
    if (!s) {
      setFilteredSchools(schools);
      return;
    }

    setFilteredSchools(
      schools.filter((sc) => {
        return (
          sc.name.toLowerCase().includes(s) ||
          (sc.address && sc.address.toLowerCase().includes(s))
        );
      }),
    );
  }, [search, schools]);

  // Delete handler
  const handleDeleteSchool = async (sc: SchoolRow) => {
    const confirmed = window.confirm(
      `Delete school "${sc.name}"? This will remove it from routes and stops that reference it.`,
    );
    if (!confirmed) return;

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/admin/schools?id=${sc.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to delete school.");
      }

      setSchools((prev) => prev.filter((s) => s.id !== sc.id));
      setFilteredSchools((prev) => prev.filter((s) => s.id !== sc.id));
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Failed to delete school.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Schools</h2>
          <p className="text-xs text-slate-400">
            Manage school profiles (names, addresses, bell times, notes). Routes
            and students can reference these schools.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search by name or address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-xs rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500"
          />
          <button
            onClick={() => router.push("/admin/schools/new")}
            className="btn-primary whitespace-nowrap px-3 py-1.5 text-xs"
          >
            + Add school
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
            Loading schools...
          </div>
        ) : filteredSchools.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">
            No schools found. Click &ldquo;Add school&rdquo; to create one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs text-slate-200">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80">
                  <th className="px-3 py-2 font-semibold">School</th>
                  <th className="px-3 py-2 font-semibold">Address</th>
                  <th className="px-3 py-2 font-semibold">Phone</th>
                  <th className="px-3 py-2 font-semibold">Start / End</th>
                  <th className="px-3 py-2 font-semibold">Notes</th>
                  <th className="px-3 py-2 text-right font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredSchools.map((sc) => (
                  <tr
                    key={sc.id}
                    className="border-b border-slate-900/60 hover:bg-slate-900/50"
                  >
                    {/* School name */}
                    <td className="px-3 py-2 text-xs font-medium">
                      {sc.name}
                    </td>

                    {/* Address */}
                    <td className="px-3 py-2 text-[11px] text-slate-300">
                      {sc.address || (
                        <span className="text-slate-500">&mdash;</span>
                      )}
                    </td>

                    {/* Phone - click to call if present */}
                    <td className="px-3 py-2 text-[11px] text-slate-300">
                      {sc.phone ? (
                        (() => {
                          const digits = sc.phone.replace(/\D/g, "");
                          const label =
                            digits.length === 10
                              ? `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
                              : sc.phone;

                          return (
                            <a
                              href={`tel:${digits || sc.phone}`}
                              className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-100 ring-1 ring-emerald-500/50 transition hover:bg-emerald-500/25 active:scale-[0.97]"
                              title="Tap to call school"
                            >
                              <span className="truncate max-w-[160px]">
                                {label}
                              </span>
                            </a>
                          );
                        })()
                      ) : (
                        <span className="text-slate-500">&mdash;</span>
                      )}
                    </td>

                    {/* Start / End */}
                    <td className="px-3 py-2 text-[11px] text-slate-300">
                      {sc.start_time || sc.end_time ? (
                        <>
                          {sc.start_time || "&mdash;"}{" "}
                          <span className="text-slate-500">to</span>{" "}
                          {sc.end_time || "&mdash;"}
                        </>
                      ) : (
                        <span className="text-slate-500">&mdash;</span>
                      )}
                    </td>

                    {/* Notes */}
                    <td className="px-3 py-2 text-[11px] text-slate-300">
                      <span className="line-clamp-2 max-w-xs">
                        {sc.notes || (
                          <span className="text-slate-500">&mdash;</span>
                        )}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-2 text-right text-[11px]">
                      <div className="inline-flex gap-1.5">
                        <button
                          onClick={() =>
                            router.push(`/admin/schools/${sc.id}`)
                          }
                          className="btn-ghost px-3 py-1 text-[11px]"
                        >
                          View / Edit
                        </button>
                        <button
                          onClick={() => handleDeleteSchool(sc)}
                          className="btn-ghost px-3 py-1 text-[11px] text-rose-300 hover:text-rose-200"
                          title="Delete school"
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
