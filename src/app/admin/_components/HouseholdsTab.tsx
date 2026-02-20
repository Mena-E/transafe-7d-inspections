"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";

// ---- TYPES ----

type HouseholdRow = {
  id: string;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  primary_guardian_name: string | null;
  primary_guardian_phone: string | null;
  is_active: boolean;
  student_count: number;
  students: { id: string; full_name: string }[];
};

// ---- HELPERS ----

function formatPhone(phone: string | null): string {
  if (!phone) return "\u2014";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

// ---- COMPONENT ----

export default function HouseholdsTab() {
  const [households, setHouseholds] = useState<HouseholdRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Load households on mount
  useEffect(() => {
    let isMounted = true;

    async function loadHouseholds() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/admin/households");
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Failed to load households.");
        }
        const data = await res.json();

        if (!isMounted) return;

        const mapped: HouseholdRow[] = (data.households || data || []).map(
          (row: any) => ({
            id: row.id,
            address: row.address || "",
            city: row.city ?? null,
            state: row.state ?? null,
            zip: row.zip ?? null,
            primary_guardian_name: row.primary_guardian_name ?? null,
            primary_guardian_phone: row.primary_guardian_phone ?? null,
            is_active: row.is_active ?? true,
            student_count: row.student_count ?? row.students?.length ?? 0,
            students: (row.students || []).map((s: any) => ({
              id: s.id,
              full_name: s.full_name,
            })),
          }),
        );

        setHouseholds(mapped);
      } catch (err: any) {
        console.error("Error loading households:", err);
        if (isMounted) setError(err.message ?? "Failed to load households.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadHouseholds();

    return () => {
      isMounted = false;
    };
  }, []);

  // Filtered households
  const filteredHouseholds = useMemo(() => {
    if (!search.trim()) return households;
    const q = search.trim().toLowerCase();

    return households.filter((h) => {
      const address = h.address.toLowerCase();
      const city = (h.city || "").toLowerCase();
      const guardian = (h.primary_guardian_name || "").toLowerCase();
      const phone = (h.primary_guardian_phone || "").replace(/\D/g, "");
      const searchDigits = q.replace(/\D/g, "");

      const textMatch =
        address.includes(q) ||
        city.includes(q) ||
        guardian.includes(q);

      const phoneMatch =
        searchDigits.length > 0 && phone.includes(searchDigits);

      return textMatch || phoneMatch;
    });
  }, [search, households]);

  // Toggle expand
  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Households</h2>
          <p className="text-xs text-slate-400">
            Manage household addresses, guardians, and student groupings.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search by address or guardian name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-xs rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500"
          />
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
            Loading households...
          </div>
        ) : filteredHouseholds.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">
            No households found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs text-slate-200">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80">
                  <th className="px-3 py-2 font-semibold">Address</th>
                  <th className="px-3 py-2 font-semibold">City / State / ZIP</th>
                  <th className="px-3 py-2 font-semibold">Guardian Name</th>
                  <th className="px-3 py-2 font-semibold">Guardian Phone</th>
                  <th className="px-3 py-2 font-semibold">Students</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 text-right font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredHouseholds.map((h) => {
                  const isExpanded = expandedId === h.id;
                  const phoneDigits = (h.primary_guardian_phone || "").replace(
                    /\D/g,
                    "",
                  );

                  return (
                    <Fragment key={h.id}>
                      <tr
                        className="border-b border-slate-900/60 hover:bg-slate-900/50"
                      >
                        {/* Address */}
                        <td className="px-3 py-2 text-xs font-medium">
                          {h.address || (
                            <span className="text-slate-500">&mdash;</span>
                          )}
                        </td>

                        {/* City / State / ZIP */}
                        <td className="px-3 py-2 text-[11px] text-slate-300">
                          {[h.city, h.state, h.zip]
                            .filter(Boolean)
                            .join(", ") || (
                            <span className="text-slate-500">&mdash;</span>
                          )}
                        </td>

                        {/* Guardian Name */}
                        <td className="px-3 py-2 text-[11px] text-slate-300">
                          {h.primary_guardian_name || (
                            <span className="text-slate-500">&mdash;</span>
                          )}
                        </td>

                        {/* Guardian Phone - click to call */}
                        <td className="px-3 py-2 text-[11px] text-slate-300">
                          {h.primary_guardian_phone &&
                          phoneDigits.length >= 10 ? (
                            <a
                              href={`tel:${phoneDigits}`}
                              className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-100 ring-1 ring-emerald-500/50 transition hover:bg-emerald-500/25 active:scale-[0.97]"
                              title="Tap to call guardian"
                            >
                              <span className="truncate max-w-[160px]">
                                {formatPhone(h.primary_guardian_phone)}
                              </span>
                            </a>
                          ) : (
                            <span className="text-slate-500">&mdash;</span>
                          )}
                        </td>

                        {/* Students count */}
                        <td className="px-3 py-2 text-[11px] text-slate-300">
                          <button
                            type="button"
                            onClick={() => toggleExpand(h.id)}
                            className="inline-flex items-center gap-1 rounded-full bg-slate-700/40 px-2.5 py-1 text-[11px] font-semibold text-slate-100 transition hover:bg-slate-700/60"
                          >
                            {h.student_count} student
                            {h.student_count !== 1 ? "s" : ""}
                            <span className="text-[10px]">
                              {isExpanded ? "\u25B2" : "\u25BC"}
                            </span>
                          </button>
                        </td>

                        {/* Status */}
                        <td className="px-3 py-2 text-[11px]">
                          {h.is_active ? (
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
                          <button
                            type="button"
                            onClick={() => toggleExpand(h.id)}
                            className="btn-ghost px-3 py-1 text-[11px]"
                          >
                            {isExpanded ? "Collapse" : "Expand"}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded student list */}
                      {isExpanded && h.students.length > 0 && (
                        <tr key={`${h.id}-students`}>
                          <td
                            colSpan={7}
                            className="bg-slate-900/40 px-6 py-3"
                          >
                            <div className="space-y-1">
                              <p className="text-[11px] font-semibold text-slate-300">
                                Students in this household:
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {h.students.map((st) => (
                                  <Link
                                    key={st.id}
                                    href={`/admin/students/${st.id}`}
                                    className="inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-200 ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/20"
                                  >
                                    {st.full_name}
                                  </Link>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}

                      {isExpanded && h.students.length === 0 && (
                        <tr key={`${h.id}-empty`}>
                          <td
                            colSpan={7}
                            className="bg-slate-900/40 px-6 py-3"
                          >
                            <p className="text-[11px] text-slate-500">
                              No students linked to this household yet.
                            </p>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
