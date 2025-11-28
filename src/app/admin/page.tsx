"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Driver = {
  id: string;
  full_name: string;
  license_number: string | null;
  is_active: boolean;
  created_at: string;
};

type Vehicle = {
  id: string;
  label: string;
  year: number | null;
  make: string | null;
  model: string | null;
  plate: string | null;
  vin: string | null;
  is_active: boolean;
  created_at: string;
};

type InspectionSummary = {
  id: string;
  driver_name: string;
  vehicle_label: string | null;
  inspection_type: "pre" | "post";
  shift: string | null;
  submitted_at: string | null;
  inspection_date: string | null;
  overall_status: string | null;
};

const ADMIN_CODE = process.env.NEXT_PUBLIC_ADMIN_ACCESS_CODE || "";

function formatDateTime(iso: string | null) {
  if (!iso) return "N/A";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

type AdminTab = "drivers" | "vehicles" | "inspections";

export default function AdminPage() {
  const router = useRouter();

  const [accessCodeInput, setAccessCodeInput] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [activeTab, setActiveTab] = useState<AdminTab>("inspections");

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [inspections, setInspections] = useState<InspectionSummary[]>([]);

  const [loading, setLoading] = useState(false);
  const [loadingInspections, setLoadingInspections] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New driver form
  const [newDriverName, setNewDriverName] = useState("");
  const [newDriverLicense, setNewDriverLicense] = useState("");

  // Edit driver
  const [editingDriverId, setEditingDriverId] = useState<string | null>(null);
  const [editDriverName, setEditDriverName] = useState("");
  const [editDriverLicense, setEditDriverLicense] = useState("");

  // New vehicle form
  const [vehicleLabel, setVehicleLabel] = useState("");
  const [vehicleYear, setVehicleYear] = useState("");
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [vehicleVin, setVehicleVin] = useState("");

  // Edit vehicle
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [editVehicleLabel, setEditVehicleLabel] = useState("");
  const [editVehicleYear, setEditVehicleYear] = useState("");
  const [editVehicleMake, setEditVehicleMake] = useState("");
  const [editVehicleModel, setEditVehicleModel] = useState("");
  const [editVehiclePlate, setEditVehiclePlate] = useState("");
  const [editVehicleVin, setEditVehicleVin] = useState("");

  // Inspections search
  const [inspectionSearch, setInspectionSearch] = useState("");

  // Restore admin auth from localStorage so Back from inspection keeps portal unlocked
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("transafe_admin_unlocked");
    if (stored === "true") {
      setIsAuthenticated(true);
    }
  }, []);

  // Load drivers, vehicles, inspections once authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: driverData, error: driverErr } = await supabase
          .from("drivers")
          .select("*")
          .order("full_name", { ascending: true });

        if (driverErr) throw driverErr;

        const { data: vehicleData, error: vehicleErr } = await supabase
          .from("vehicles")
          .select("*")
          .order("label", { ascending: true });

        if (vehicleErr) throw vehicleErr;

        setDrivers(driverData as Driver[]);
        setVehicles(vehicleData as Vehicle[]);

        await refreshInspectionsInternal();
      } catch (err: any) {
        console.error(err);
        setError(err.message ?? "Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isAuthenticated]);

  const refreshInspectionsInternal = async () => {
    setLoadingInspections(true);
    try {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const { data: inspData, error: inspErr } = await supabase
        .from("inspections")
        .select(
          "id,driver_name,vehicle_label,inspection_type,shift,submitted_at,inspection_date,overall_status",
        )
        .gte("submitted_at", ninetyDaysAgo.toISOString())
        .order("submitted_at", { ascending: false })
        .limit(500);

      if (inspErr) throw inspErr;
      setInspections((inspData as InspectionSummary[]) || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Failed to load inspection history");
    } finally {
      setLoadingInspections(false);
    }
  };

  const refreshInspections = async () => {
    if (!isAuthenticated) return;
    await refreshInspectionsInternal();
  };

  const handleAccess = () => {
    if (accessCodeInput.trim() === ADMIN_CODE.trim() && ADMIN_CODE) {
      setIsAuthenticated(true);
      setError(null);

      // Persist admin unlock in localStorage
      if (typeof window !== "undefined") {
        window.localStorage.setItem("transafe_admin_unlocked", "true");
      }
    } else {
      setError("Invalid admin access code.");
    }
  };

  const handleLogout = () => {
    // Clear admin session from localStorage
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("transafe_admin_unlocked");
    }

    // Clear admin session and sensitive state
    setIsAuthenticated(false);
    setAccessCodeInput("");
    setDrivers([]);
    setVehicles([]);
    setInspections([]);
    setEditingDriverId(null);
    setEditingVehicleId(null);
    setError(null);

    // Return to landing page
    router.push("/");
  };

  // ---------- DRIVER HANDLERS ----------

  const handleAddDriver = async () => {
    if (!newDriverName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const payload = {
        full_name: newDriverName.trim(),
        license_number: newDriverLicense.trim() || null,
      };

      const { data, error: insertErr } = await supabase
        .from("drivers")
        .insert(payload)
        .select()
        .single();

      if (insertErr) throw insertErr;

      setDrivers((prev) => [...prev, data as Driver].sort((a, b) =>
        a.full_name.localeCompare(b.full_name),
      ));
      setNewDriverName("");
      setNewDriverLicense("");
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Failed to add driver.");
    } finally {
      setLoading(false);
    }
  };

  const startEditDriver = (driver: Driver) => {
    setEditingDriverId(driver.id);
    setEditDriverName(driver.full_name);
    setEditDriverLicense(driver.license_number ?? "");
  };

  const cancelEditDriver = () => {
    setEditingDriverId(null);
    setEditDriverName("");
    setEditDriverLicense("");
  };

  const saveEditDriver = async () => {
    if (!editingDriverId || !editDriverName.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const payload = {
        full_name: editDriverName.trim(),
        license_number: editDriverLicense.trim() || null,
      };

      const { data, error: updateErr } = await supabase
        .from("drivers")
        .update(payload)
        .eq("id", editingDriverId)
        .select()
        .single();

      if (updateErr) throw updateErr;

      setDrivers((prev) =>
        prev
          .map((d) => (d.id === editingDriverId ? (data as Driver) : d))
          .sort((a, b) => a.full_name.localeCompare(b.full_name)),
      );

      cancelEditDriver();
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Failed to update driver.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleDriverActive = async (driver: Driver) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: updateErr } = await supabase
        .from("drivers")
        .update({ is_active: !driver.is_active })
        .eq("id", driver.id)
        .select()
        .single();

      if (updateErr) throw updateErr;

      setDrivers((prev) =>
        prev.map((d) => (d.id === driver.id ? (data as Driver) : d)),
      );
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Failed to update driver.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDriver = async (driver: Driver) => {
    const confirmed = window.confirm(
      `Delete driver "${driver.full_name}"? This cannot be undone.`,
    );
    if (!confirmed) return;

    setLoading(true);
       setError(null);
    try {
      const { error: deleteErr } = await supabase
        .from("drivers")
        .delete()
        .eq("id", driver.id);

      if (deleteErr) throw deleteErr;

      setDrivers((prev) => prev.filter((d) => d.id !== driver.id));
      if (editingDriverId === driver.id) {
        cancelEditDriver();
      }
    } catch (err: any) {
      console.error(err);
      setError(
        err.message ??
          "Failed to delete driver. Check if they are referenced elsewhere.",
      );
    } finally {
      setLoading(false);
    }
  };

  // ---------- VEHICLE HANDLERS ----------

  const handleAddVehicle = async () => {
    if (!vehicleLabel.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const payload = {
        label: vehicleLabel.trim(),
        year: vehicleYear ? Number(vehicleYear) : null,
        make: vehicleMake || null,
        model: vehicleModel || null,
        plate: vehiclePlate || null,
        vin: vehicleVin || null,
      };

      const { data, error: insertErr } = await supabase
        .from("vehicles")
        .insert(payload)
        .select()
        .single();

      if (insertErr) throw insertErr;

      setVehicles((prev) => [...prev, data as Vehicle].sort((a, b) =>
        a.label.localeCompare(b.label),
      ));

      setVehicleLabel("");
      setVehicleYear("");
      setVehicleMake("");
      setVehicleModel("");
      setVehiclePlate("");
      setVehicleVin("");
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Failed to add vehicle.");
    } finally {
      setLoading(false);
    }
  };

  const startEditVehicle = (vehicle: Vehicle) => {
    setEditingVehicleId(vehicle.id);
    setEditVehicleLabel(vehicle.label);
    setEditVehicleYear(vehicle.year ? String(vehicle.year) : "");
    setEditVehicleMake(vehicle.make ?? "");
    setEditVehicleModel(vehicle.model ?? "");
    setEditVehiclePlate(vehicle.plate ?? "");
    setEditVehicleVin(vehicle.vin ?? "");
  };

  const cancelEditVehicle = () => {
    setEditingVehicleId(null);
    setEditVehicleLabel("");
    setEditVehicleYear("");
    setEditVehicleMake("");
    setEditVehicleModel("");
    setEditVehiclePlate("");
    setEditVehicleVin("");
  };

  const saveEditVehicle = async () => {
    if (!editingVehicleId || !editVehicleLabel.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const payload = {
        label: editVehicleLabel.trim(),
        year: editVehicleYear ? Number(editVehicleYear) : null,
        make: editVehicleMake || null,
        model: editVehicleModel || null,
        plate: editVehiclePlate || null,
        vin: editVehicleVin || null,
      };

      const { data, error: updateErr } = await supabase
        .from("vehicles")
        .update(payload)
        .eq("id", editingVehicleId)
        .select()
        .single();

      if (updateErr) throw updateErr;

      setVehicles((prev) =>
        prev
          .map((v) => (v.id === editingVehicleId ? (data as Vehicle) : v))
          .sort((a, b) => a.label.localeCompare(b.label)),
      );

      cancelEditVehicle();
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Failed to update vehicle.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleVehicleActive = async (vehicle: Vehicle) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: updateErr } = await supabase
        .from("vehicles")
        .update({ is_active: !vehicle.is_active })
        .eq("id", vehicle.id)
        .select()
        .single();

      if (updateErr) throw updateErr;

      setVehicles((prev) =>
        prev.map((v) => (v.id === vehicle.id ? (data as Vehicle) : v)),
      );
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Failed to update vehicle.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVehicle = async (vehicle: Vehicle) => {
    const confirmed = window.confirm(
      `Delete vehicle "${vehicle.label}"? This cannot be undone.`,
    );
    if (!confirmed) return;

    setLoading(true);
    setError(null);
    try {
      const { error: deleteErr } = await supabase
        .from("vehicles")
        .delete()
        .eq("id", vehicle.id);

      if (deleteErr) throw deleteErr;

      setVehicles((prev) => prev.filter((v) => v.id !== vehicle.id));
      if (editingVehicleId === vehicle.id) {
        cancelEditVehicle();
      }
    } catch (err: any) {
      console.error(err);
      setError(
        err.message ??
          "Failed to delete vehicle. Check if it is referenced elsewhere.",
      );
    } finally {
      setLoading(false);
    }
  };

  // ---------- INSPECTIONS FILTER & EXPORT ----------

  const filteredInspections = useMemo(() => {
    if (!inspectionSearch.trim()) return inspections;
    const q = inspectionSearch.trim().toLowerCase();

    return inspections.filter((rec) => {
      const driver = rec.driver_name?.toLowerCase() ?? "";
      const vehicle = rec.vehicle_label?.toLowerCase() ?? "";
      const type =
        rec.inspection_type === "pre"
          ? "pre-trip"
          : rec.inspection_type === "post"
            ? "post-trip"
            : "";
      const shift = rec.shift?.toLowerCase() ?? "";
      const status = rec.overall_status?.toLowerCase() ?? "";
      const date = (rec.submitted_at || rec.inspection_date || "")
        .toLowerCase()
        .slice(0, 10);

      return (
        driver.includes(q) ||
        vehicle.includes(q) ||
        type.includes(q) ||
        shift.includes(q) ||
        status.includes(q) ||
        date.includes(q)
      );
    });
  }, [inspectionSearch, inspections]);

  const handleExportCsv = () => {
    if (filteredInspections.length === 0) {
      alert("No inspection records to export.");
      return;
    }

    const header = [
      "id",
      "submitted_at",
      "driver_name",
      "vehicle_label",
      "inspection_type",
      "shift",
      "overall_status",
    ];

    const rows = filteredInspections.map((rec) => [
      rec.id,
      rec.submitted_at || rec.inspection_date || "",
      rec.driver_name || "",
      rec.vehicle_label || "",
      rec.inspection_type === "pre" ? "pre-trip" : "post-trip",
      rec.shift || "",
      rec.overall_status || "",
    ]);

    const csvLines = [
      header.join(","),
      ...rows.map((row) =>
        row
          .map((field) => {
            const str = String(field ?? "");
            if (str.includes(",") || str.includes('"') || str.includes("\n")) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          })
          .join(","),
      ),
    ];

    const csvContent = csvLines.join("\n");
    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    const today = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.setAttribute(
      "download",
      `transafe_inspections_${today}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ---------- AUTH SCREEN ----------

  if (!isAuthenticated) {
    return (
      <div className="space-y-4">
        <section className="card">
          <h1 className="mb-2 text-xl font-semibold">Admin Portal</h1>
          <p className="text-sm text-slate-200/80">
            Enter the Transafe admin access code to manage drivers, vehicles,
            and inspection records.
          </p>
        </section>

        <section className="card space-y-3">
          <label className="block text-sm font-medium text-slate-100">
            Admin access code
          </label>
          <input
            type="password"
            value={accessCodeInput}
            onChange={(e) => setAccessCodeInput(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
            placeholder="Enter access code"
          />
          <button
            type="button"
            onClick={handleAccess}
            className="btn-primary mt-1 w-full"
          >
            Unlock Admin Portal
          </button>
          {error && (
            <p className="text-xs font-medium text-red-400">{error}</p>
          )}
          <p className="mt-1 text-[11px] text-slate-400">
            For production, we&apos;ll replace this simple code gate with proper
            authentication.
          </p>
        </section>
      </div>
    );
  }

  // ---------- MAIN ADMIN UI ----------

  return (
    <div className="space-y-4">
      {/* Header */}
      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="mb-1 text-xl font-semibold">
              Transafe Admin Dashboard
            </h1>
            <p className="text-xs text-slate-200/80">
              Manage <span className="font-semibold">Drivers</span>,{" "}
              <span className="font-semibold">Vehicles</span>, and{" "}
              <span className="font-semibold">Inspection records</span> for up
              to 90 days.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-200">
              Admin unlocked
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="btn-ghost px-3 py-1 text-[11px]"
            >
              Log out
            </button>
          </div>
        </div>
      </section>

      {error && (
        <section className="card border border-red-500/50 bg-red-950/40">
          <p className="text-xs font-medium text-red-200">{error}</p>
        </section>
      )}

      {/* Tab navigation */}
      <section className="card flex flex-wrap gap-2">
        {([
          { id: "inspections", label: "Inspections" },
          { id: "vehicles", label: "Vehicles" },
          { id: "drivers", label: "Drivers" },
          
        ] as { id: AdminTab; label: string }[]).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-2xl px-4 py-2 text-xs font-semibold transition active:scale-[0.97] ${
              activeTab === tab.id
                ? "bg-emerald-500 text-slate-950 shadow"
                : "bg-slate-900 text-slate-100 ring-1 ring-white/10 hover:bg-slate-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </section>

      {/* DRIVERS TAB */}
      {activeTab === "drivers" && (
        <section className="space-y-4">
          {/* Add new driver */}
          <section className="card space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">
                Drivers
              </h2>
              <span className="text-[11px] text-slate-400">
                {drivers.length} total
              </span>
            </div>

            <div className="space-y-2 rounded-xl bg-slate-950/50 p-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-slate-100">
                  Add new driver
                </label>
                <span className="text-[10px] text-slate-400">
                  This will appear in the Driver Portal sign-in.
                </span>
              </div>
              <input
                type="text"
                value={newDriverName}
                onChange={(e) => setNewDriverName(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                placeholder="Full name"
              />
              <input
                type="text"
                value={newDriverLicense}
                onChange={(e) => setNewDriverLicense(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                placeholder="Driver's license number"
              />
              <button
                type="button"
                onClick={handleAddDriver}
                className="btn-primary w-full text-sm"
                disabled={loading || !newDriverName.trim()}
              >
                + Add driver
              </button>
            </div>
          </section>

          {/* Driver list / profiles */}
          <section className="card space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
                Driver profiles
              </h3>
              <p className="text-[11px] text-slate-400">
                Click a driver to view and edit their profile.
              </p>
            </div>

            <div className="max-h-[420px] space-y-2 overflow-y-auto rounded-xl bg-slate-950/40 p-2 text-xs">
              {drivers.length === 0 ? (
                <p className="text-slate-400">No drivers yet.</p>
              ) : (
                drivers.map((driver) => {
                  const isEditing = editingDriverId === driver.id;
                  return (
                    <div
                      key={driver.id}
                      className="rounded-lg bg-slate-900/80 p-2 hover:bg-slate-900"
                    >
                      {/* Collapsed header */}
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-100">
                            {driver.full_name}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            License: {driver.license_number || "N/A"}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            Status:{" "}
                            {driver.is_active ? "Active" : "Inactive"}
                          </p>
                        </div>
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              isEditing
                                ? cancelEditDriver()
                                : startEditDriver(driver)
                            }
                            className="btn-ghost px-3 py-1 text-[11px]"
                            disabled={loading}
                          >
                            {isEditing ? "Close" : "View / Edit"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleToggleDriverActive(driver)
                            }
                            className="btn-ghost px-3 py-1 text-[11px]"
                            disabled={loading}
                          >
                            {driver.is_active
                              ? "Deactivate"
                              : "Activate"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDriver(driver)}
                            className="btn-ghost px-3 py-1 text-[11px] text-red-300 hover:text-red-200"
                            disabled={loading}
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {/* Expanded edit form */}
                      {isEditing && (
                        <div className="mt-2 space-y-2 rounded-xl bg-slate-950/80 p-3">
                          <p className="text-[11px] font-semibold text-slate-200">
                            Edit driver profile
                          </p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div className="space-y-1">
                              <label className="text-[11px] text-slate-300">
                                Full name
                              </label>
                              <input
                                type="text"
                                value={editDriverName}
                                onChange={(e) =>
                                  setEditDriverName(e.target.value)
                                }
                                className="w-full rounded-xl border border-white/15 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[11px] text-slate-300">
                                Driver&apos;s license #
                              </label>
                              <input
                                type="text"
                                value={editDriverLicense}
                                onChange={(e) =>
                                  setEditDriverLicense(e.target.value)
                                }
                                className="w-full rounded-xl border border-white/15 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                              />
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 pt-1">
                            <button
                              type="button"
                              onClick={saveEditDriver}
                              className="btn-primary px-4 py-1.5 text-[11px]"
                              disabled={
                                loading || !editDriverName.trim()
                              }
                            >
                              Save changes
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditDriver}
                              className="btn-ghost px-4 py-1.5 text-[11px]"
                              disabled={loading}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {loading && (
            <p className="text-[11px] text-slate-400">
              Working… please wait a moment.
            </p>
          )}
        </section>
      )}

      {/* VEHICLES TAB */}
      {activeTab === "vehicles" && (
        <section className="space-y-4">
          {/* Add new vehicle */}
          <section className="card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">
                Vehicles
              </h2>
              <span className="text-[11px] text-slate-400">
                {vehicles.length} total
              </span>
            </div>

            <div className="space-y-2 rounded-xl bg-slate-950/50 p-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-slate-100">
                  Add new vehicle
                </label>
                <span className="text-[10px] text-slate-400">
                  This list feeds the vehicle dropdown in the Driver Portal.
                </span>
              </div>
              <input
                type="text"
                value={vehicleLabel}
                onChange={(e) => setVehicleLabel(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                placeholder="Label (e.g. 2025 Kia Carnival - Plate 123ABC)"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  value={vehicleYear}
                  onChange={(e) => setVehicleYear(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                  placeholder="Year"
                />
                <input
                  type="text"
                  value={vehicleMake}
                  onChange={(e) => setVehicleMake(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                  placeholder="Make"
                />
                <input
                  type="text"
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                  placeholder="Model"
                />
                <input
                  type="text"
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                  placeholder="Plate"
                />
              </div>
              <input
                type="text"
                value={vehicleVin}
                onChange={(e) => setVehicleVin(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                placeholder="VIN (optional)"
              />
              <button
                type="button"
                onClick={handleAddVehicle}
                className="btn-primary w-full text-sm"
                disabled={loading || !vehicleLabel.trim()}
              >
                + Add vehicle
              </button>
            </div>
          </section>

          {/* Vehicle list / profiles */}
          <section className="card space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
                Vehicle profiles
              </h3>
              <p className="text-[11px] text-slate-400">
                Click a vehicle to view and edit details.
              </p>
            </div>

            <div className="max-h-[420px] space-y-2 overflow-y-auto rounded-xl bg-slate-950/40 p-2 text-xs">
              {vehicles.length === 0 ? (
                <p className="text-slate-400">No vehicles yet.</p>
              ) : (
                vehicles.map((vehicle) => {
                  const isEditing = editingVehicleId === vehicle.id;
                  return (
                    <div
                      key={vehicle.id}
                      className="rounded-lg bg-slate-900/80 p-2 hover:bg-slate-900"
                    >
                      {/* Collapsed header */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="max-w-[70%]">
                          <p className="text-sm font-semibold text-slate-100">
                            {vehicle.year ?? ""} {vehicle.make ?? ""}{" "}
                            {vehicle.model ?? ""}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            Label: {vehicle.label}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            Plate: {vehicle.plate || "N/A"} •{" "}
                            {vehicle.is_active ? "Active" : "Inactive"}
                          </p>
                        </div>
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              isEditing
                                ? cancelEditVehicle()
                                : startEditVehicle(vehicle)
                            }
                            className="btn-ghost px-3 py-1 text-[11px]"
                            disabled={loading}
                          >
                            {isEditing ? "Close" : "View / Edit"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleToggleVehicleActive(vehicle)
                            }
                            className="btn-ghost px-3 py-1 text-[11px]"
                            disabled={loading}
                          >
                            {vehicle.is_active
                              ? "Deactivate"
                              : "Activate"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteVehicle(vehicle)}
                            className="btn-ghost px-3 py-1 text-[11px] text-red-300 hover:text-red-200"
                            disabled={loading}
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {/* Expanded edit form */}
                      {isEditing && (
                        <div className="mt-2 space-y-2 rounded-xl bg-slate-950/80 p-3">
                          <p className="text-[11px] font-semibold text-slate-200">
                            Edit vehicle profile
                          </p>
                          <div className="grid gap-2 md:grid-cols-2">
                            <div className="space-y-1">
                              <label className="text-[11px] text-slate-300">
                                Label
                              </label>
                              <input
                                type="text"
                                value={editVehicleLabel}
                                onChange={(e) =>
                                  setEditVehicleLabel(e.target.value)
                                }
                                className="w-full rounded-xl border border-white/15 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[11px] text-slate-300">
                                Year
                              </label>
                              <input
                                type="number"
                                value={editVehicleYear}
                                onChange={(e) =>
                                  setEditVehicleYear(e.target.value)
                                }
                                className="w-full rounded-xl border border-white/15 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[11px] text-slate-300">
                                Make
                              </label>
                              <input
                                type="text"
                                value={editVehicleMake}
                                onChange={(e) =>
                                  setEditVehicleMake(e.target.value)
                                }
                                className="w-full rounded-xl border border-white/15 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[11px] text-slate-300">
                                Model
                              </label>
                              <input
                                type="text"
                                value={editVehicleModel}
                                onChange={(e) =>
                                  setEditVehicleModel(e.target.value)
                                }
                                className="w-full rounded-xl border border-white/15 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[11px] text-slate-300">
                                Plate
                              </label>
                              <input
                                type="text"
                                value={editVehiclePlate}
                                onChange={(e) =>
                                  setEditVehiclePlate(e.target.value)
                                }
                                className="w-full rounded-xl border border-white/15 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[11px] text-slate-300">
                                VIN
                              </label>
                              <input
                                type="text"
                                value={editVehicleVin}
                                onChange={(e) =>
                                  setEditVehicleVin(e.target.value)
                                }
                                className="w-full rounded-xl border border-white/15 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                              />
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 pt-1">
                            <button
                              type="button"
                              onClick={saveEditVehicle}
                              className="btn-primary px-4 py-1.5 text-[11px]"
                              disabled={
                                loading || !editVehicleLabel.trim()
                              }
                            >
                              Save changes
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditVehicle}
                              className="btn-ghost px-4 py-1.5 text-[11px]"
                              disabled={loading}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {loading && (
            <p className="text-[11px] text-slate-400">
              Working… please wait a moment.
            </p>
          )}
        </section>
      )}

      {/* INSPECTIONS TAB */}
      {activeTab === "inspections" && (
        <section className="space-y-4">
          {/* Header + search + actions */}
          <section className="card space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
                  Inspection submissions (last 90 days)
                </h2>
                <p className="text-[11px] text-slate-400">
                  Search, review, print, or export all driver pre- and post-trip
                  inspections.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={refreshInspections}
                  className="btn-ghost px-3 py-1 text-[11px]"
                  disabled={loadingInspections}
                >
                  {loadingInspections ? "Refreshing…" : "Refresh"}
                </button>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="btn-ghost px-3 py-1 text-[11px]"
                >
                  Export CSV
                </button>
              </div>
            </div>

            {/* Search bar */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-200">
                Search inspections
              </label>
              <input
                type="text"
                value={inspectionSearch}
                onChange={(e) => setInspectionSearch(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                placeholder="Filter by driver, vehicle, date (YYYY-MM-DD), shift, status, or type (pre / post)…"
              />
            </div>
          </section>

          {/* Table + summary */}
          <section className="card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-slate-400">
                Showing{" "}
                <span className="font-semibold text-slate-100">
                  {filteredInspections.length}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-slate-100">
                  {inspections.length}
                </span>{" "}
                records in the last 90 days.
              </p>
              <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                <div className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span>Pass</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  <span>Fail</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-slate-500" />
                  <span>Other / N/A</span>
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl bg-slate-950/40">
              <div className="max-h-[460px] overflow-auto text-[11px]">
                {filteredInspections.length === 0 && !loadingInspections ? (
                  <p className="p-3 text-[11px] text-slate-400">
                    No inspections match your search in the last 90 days.
                  </p>
                ) : (
                  <table className="min-w-full border-separate border-spacing-0">
                    <thead>
                      <tr className="bg-slate-900/90 text-slate-200">
                        <th className="sticky top-0 border-b border-slate-800 px-2 py-2 text-left text-[11px] font-semibold backdrop-blur">
                          Date / time
                        </th>
                        <th className="sticky top-0 border-b border-slate-800 px-2 py-2 text-left text-[11px] font-semibold backdrop-blur">
                          Driver
                        </th>
                        <th className="sticky top-0 border-b border-slate-800 px-2 py-2 text-left text-[11px] font-semibold backdrop-blur">
                          Vehicle
                        </th>
                        <th className="sticky top-0 border-b border-slate-800 px-2 py-2 text-left text-[11px] font-semibold backdrop-blur">
                          Type
                        </th>
                        <th className="sticky top-0 border-b border-slate-800 px-2 py-2 text-left text-[11px] font-semibold backdrop-blur">
                          Shift
                        </th>
                        <th className="sticky top-0 border-b border-slate-800 px-2 py-2 text-left text-[11px] font-semibold backdrop-blur">
                          Status
                        </th>
                        <th className="sticky top-0 border-b border-slate-800 px-2 py-2 text-left text-[11px] font-semibold backdrop-blur">
                          View
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInspections.map((rec, idx) => (
                        <tr
                          key={rec.id}
                          className={`border-b border-slate-800/60 transition hover:bg-slate-900/80 ${
                            idx % 2 === 0
                              ? "bg-slate-950/70"
                              : "bg-slate-900/60"
                          }`}
                        >
                          <td className="px-2 py-1 text-slate-100">
                            {formatDateTime(
                              rec.submitted_at || rec.inspection_date,
                            )}
                          </td>
                          <td className="px-2 py-1 text-slate-100">
                            {rec.driver_name}
                          </td>
                          <td className="px-2 py-1 text-slate-200">
                            {rec.vehicle_label ?? "N/A"}
                          </td>
                          <td className="px-2 py-1">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                rec.inspection_type === "pre"
                                  ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/40"
                                  : "bg-sky-500/15 text-sky-200 ring-1 ring-sky-500/40"
                              }`}
                            >
                              {rec.inspection_type === "pre"
                                ? "Pre-trip"
                                : "Post-trip"}
                            </span>
                          </td>
                          <td className="px-2 py-1 text-slate-200">
                            {rec.shift ?? "N/A"}
                          </td>
                          <td className="px-2 py-1">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                rec.overall_status === "fail"
                                  ? "bg-red-700/80 text-red-50"
                                  : rec.overall_status === "pass"
                                  ? "bg-emerald-700/80 text-emerald-50"
                                  : "bg-slate-700/80 text-slate-50"
                              }`}
                            >
                              {rec.overall_status
                                ? rec.overall_status.toUpperCase()
                                : "N/A"}
                            </span>
                          </td>
                          <td className="px-2 py-1">
                            {/* NOTE: no target="_blank" so it opens in same tab */}
                            <Link
                              href={`/inspection/${rec.id}`}
                              className="btn-ghost px-2 py-1 text-[11px]"
                            >
                              Open form
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {loadingInspections && (
                <div className="border-t border-slate-800/80 bg-slate-950/80 px-3 py-2 text-[11px] text-slate-400">
                  Loading inspections…
                </div>
              )}
            </div>
          </section>
        </section>
      )}
    </div>
  );
}
