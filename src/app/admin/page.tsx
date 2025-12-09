"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import RoutesTab from "./_components/RoutesTab";
import AdminDashboardTab from "./_components/AdminDashboardTab";


// =====================
//  CONSTANTS & HELPERS
// =====================

const ADMIN_TAB_STORAGE_KEY = "transafe_admin_active_tab";
const ADMIN_CODE = process.env.NEXT_PUBLIC_ADMIN_CODE || "";

// ---- SHARED TYPES ----

type Driver = {
  id: string;
  full_name: string;
  license_number: string | null;
  phone: string | null;
  hourly_rate: number | null;
  is_active: boolean;
  pin: string | null;
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

type TimeEntry = {
  id: string;
  driver_id: string;
  work_date: string; // YYYY-MM-DD
  start_time: string;
  end_time: string | null;
  duration_seconds: number | null;
};

type DriverTimeSummary = {
  driverId: string;
  name: string;
  license: string | null;
  dailySeconds: Record<string, number>;
  weekTotalSeconds: number;
};

// === ADMIN TAB TYPE (ANCHOR) ===
type AdminTab =
  | "dashboard"
  | "inspections"
  | "vehicles"
  | "drivers"
  | "students"
  | "schools"
  | "routes"
  | "timecards";

const ADMIN_TABS: AdminTab[] = [
  "dashboard",
  "inspections",
  "vehicles",
  "drivers",
  "students",
  "schools",
  "routes",
  "timecards",
];


function isValidAdminTab(value: any): value is AdminTab {
  return typeof value === "string" && ADMIN_TABS.includes(value as AdminTab);
}

function formatDateTime(iso: string | null) {
  if (!iso) return "N/A";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function formatPhone(phone: string | null): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getWeekStart(date: Date): Date {
  const day = date.getDay(); // 0 (Sun) – 6 (Sat)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - day);
}

function formatYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

function formatPretty(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDuration(seconds: number): string {
  const secs = Math.max(0, Math.floor(seconds));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(
    2,
    "0",
  )}:${String(s).padStart(2, "0")}`;
}

// ======================================================
//                      ADMIN PAGE
// ======================================================


export default function AdminPage() {
  const router = useRouter();

  const ADMIN_CODE = "032072"; // or any secret you like

  const [accessCodeInput, setAccessCodeInput] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");

  
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [inspections, setInspections] = useState<InspectionSummary[]>([]);

  const [driverSearch, setDriverSearch] = useState("");
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [inspectionSearch, setInspectionSearch] = useState("");

  const [loading, setLoading] = useState(false);

  const [loadingInspections, setLoadingInspections] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit driver
  const [editingDriverId, setEditingDriverId] = useState<string | null>(null);
  const [editDriverName, setEditDriverName] = useState("");
  const [editDriverLicense, setEditDriverLicense] = useState("");
  const [editDriverPhone, setEditDriverPhone] = useState("");
  const [editDriverHourly, setEditDriverHourly] = useState("");

  // New vehicle
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

  // ---------------- TAB SYNC (HASH + LOCAL STORAGE) ----------------

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1) Try the URL hash first: /admin#students, /admin#drivers, etc.
    const rawHash = window.location.hash; // e.g. "#students"
    const hash = rawHash.replace("#", "").toLowerCase() || null;

    if (isValidAdminTab(hash)) {
      setActiveTab(hash);
      window.localStorage.setItem(ADMIN_TAB_STORAGE_KEY, hash);
      return;
    }

    // 2) Otherwise, restore from localStorage
    const saved = window.localStorage.getItem(ADMIN_TAB_STORAGE_KEY);
    if (isValidAdminTab(saved)) {
      setActiveTab(saved);
      if (!window.location.hash) {
        window.location.hash = `#${saved}`;
      }
      return;
    }

      // 3) Fallback: dashboard
    setActiveTab("dashboard");
    window.localStorage.setItem(ADMIN_TAB_STORAGE_KEY, "dashboard");
    if (!window.location.hash) {
      window.location.hash = "#dashboard";
    }

  }, []);

  const setTabAndRemember = (tab: AdminTab) => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ADMIN_TAB_STORAGE_KEY, tab);
      window.location.hash = `#${tab}`;
    }
  };

  // ---------------- AUTH RESTORE ----------------

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("transafe_admin_unlocked");
    if (stored === "true") {
      setIsAuthenticated(true);
    }
  }, []);

  // ---------------- INSPECTIONS LOADER ----------------

  const refreshInspectionsInternal = async () => {
    setLoadingInspections(true);
    setError(null);

    try {
      const { data, error: inspErr } = await supabase
        .from("inspections")
        .select("*");

      if (inspErr) throw inspErr;

      let mapped: InspectionSummary[] = (data || []).map((row: any) => ({
        id: row.id,
        inspection_type:
          (row.inspection_type ??
            row.type ??
            "pre") as "pre" | "post",
        shift: row.shift ?? row.shift_name ?? null,
        submitted_at: row.submitted_at ?? row.created_at ?? null,
        inspection_date: row.inspection_date ?? row.date ?? null,
        overall_status: row.overall_status ?? row.status ?? null,
        driver_name:
          row.driver_name ??
          row.driver ??
          row.driver_full_name ??
          (row.driver_id ? `Driver ${row.driver_id}` : "Unknown driver"),
        vehicle_label:
          row.vehicle_label ??
          row.vehicle ??
          row.vehicle_label_full ??
          (row.vehicle_id ? `Vehicle ${row.vehicle_id}` : null),
      }));

      // Newest first (top of list)
      mapped = mapped.sort((a, b) => {
        const aTime = new Date(
          a.submitted_at || a.inspection_date || 0,
        ).getTime();
        const bTime = new Date(
          b.submitted_at || b.inspection_date || 0,
        ).getTime();
        return bTime - aTime;
      });

      setInspections(mapped);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Failed to load inspections.");
    } finally {
      setLoadingInspections(false);
    }
  };

  const refreshInspections = async () => {
    if (!isAuthenticated) return;
    await refreshInspectionsInternal();
  };

  // ---------------- LOAD DRIVERS & VEHICLES WHEN AUTHED ----------------

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
        setError(err.message ?? "Failed to load data.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isAuthenticated]);

  // ---------------- AUTH HANDLERS ----------------

  const handleAccess = () => {
    if (ADMIN_CODE && accessCodeInput.trim() === ADMIN_CODE.trim()) {
      setIsAuthenticated(true);
      setError(null);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("transafe_admin_unlocked", "true");
      }
    } else {
      setError("Invalid admin access code.");
    }
  };

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("transafe_admin_unlocked");
    }

    setIsAuthenticated(false);
    setAccessCodeInput("");
    setDrivers([]);
    setVehicles([]);
    setInspections([]);
    setEditingDriverId(null);
    setEditingVehicleId(null);
    setError(null);
    setActiveTab("inspections");

    router.push("/");
  };

  // ---------------- DRIVER HANDLERS ----------------

  const startEditDriver = (driver: Driver) => {
    setEditingDriverId(driver.id);
    setEditDriverName(driver.full_name);
    setEditDriverLicense(driver.license_number ?? "");
    setEditDriverPhone(driver.phone ?? "");
    setEditDriverHourly(
      driver.hourly_rate != null ? String(driver.hourly_rate) : "",
    );
  };

  const cancelEditDriver = () => {
    setEditingDriverId(null);
    setEditDriverName("");
    setEditDriverLicense("");
    setEditDriverPhone("");
    setEditDriverHourly("");
  };

  const saveEditDriver = async () => {
    if (!editingDriverId || !editDriverName.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const hourly =
        editDriverHourly.trim() === ""
          ? null
          : Number(editDriverHourly.trim());

      const payload = {
        full_name: editDriverName.trim(),
        license_number: editDriverLicense.trim() || null,
        phone: editDriverPhone.trim() || null,
        hourly_rate: Number.isNaN(hourly) ? null : hourly,
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

  const handleSetDriverPin = async (driver: Driver) => {
    const newPin = window.prompt(
      `Enter a new PIN for ${driver.full_name} (4–6 digits).\nLeave blank to cancel.`,
    );
    if (newPin === null) return;
    const trimmed = newPin.trim();
    if (!trimmed) return;

    const pinRegex = /^[0-9]{4,6}$/;
    if (!pinRegex.test(trimmed)) {
      alert("PIN must be 4–6 digits (numbers only).");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: updateErr } = await supabase
        .from("drivers")
        .update({ pin: trimmed })
        .eq("id", driver.id);

      if (updateErr) throw updateErr;

      setDrivers((prev) =>
        prev.map((d) => (d.id === driver.id ? { ...d, pin: trimmed } : d)),
      );

      alert(`PIN updated for ${driver.full_name}.`);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Failed to update driver PIN.");
      alert("Failed to update PIN. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ---------------- VEHICLE HANDLERS ----------------

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

      setVehicles((prev) =>
        [...prev, data as Vehicle].sort((a, b) =>
          a.label.localeCompare(b.label),
        ),
      );

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

  // ---------------- FILTERED DATA ----------------

   const filteredDrivers = useMemo(() => {
    const query = driverSearch.trim().toLowerCase();
    if (!query) return drivers;
    return drivers.filter((d) =>
      (d.full_name ?? "").toLowerCase().includes(query),
    );
  }, [drivers, driverSearch]);

  const filteredVehicles = useMemo(() => {
    const query = vehicleSearch.trim().toLowerCase();
    if (!query) return vehicles;

    return vehicles.filter((v) => {
      const label = (v.label || "").toLowerCase();
      const make = (v.make || "").toLowerCase();
      const model = (v.model || "").toLowerCase();
      const plate = (v.plate || "").toLowerCase();
      const year = v.year ? String(v.year).toLowerCase() : "";

      return (
        label.includes(query) ||
        make.includes(query) ||
        model.includes(query) ||
        plate.includes(query) ||
        year.includes(query)
      );
    });
  }, [vehicles, vehicleSearch]);

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

  // ---------------- CSV EXPORT ----------------

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
    link.setAttribute("download", `transafe_inspections_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ---------------- AUTH SCREEN ----------------

  if (!isAuthenticated) {
    return (
      <div className="space-y-4">
        <section className="card">
          <h1 className="mb-2 text-xl font-semibold">Admin Portal</h1>
          <p className="text-sm text-slate-200/80">
            Enter the Transafe admin access code to manage drivers, vehicles,
            inspection records, students, and timecards.
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

  // ---------------- MAIN ADMIN UI ----------------

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
              Manage{" "}
              <span className="font-semibold">Inspections</span>,{" "}
              <span className="font-semibold">Vehicles</span>,{" "}
              <span className="font-semibold">Drivers</span>,{" "}
              <span className="font-semibold">Students</span>, and{" "}
              <span className="font-semibold">Timecards</span> for your 7D
              operation.
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
          {(
            [
              { id: "dashboard", label: "Dashboard" },
              { id: "inspections", label: "Inspections" },
              { id: "vehicles", label: "Vehicles" },
              { id: "drivers", label: "Drivers" },
              { id: "students", label: "Students" },
              { id: "schools", label: "Schools" },
              { id: "routes", label: "Routes" },
              { id: "timecards", label: "Timecards" },
            ] as { id: AdminTab; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTabAndRemember(tab.id)}
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

      {/*DASHBOARD TAB */}
      {activeTab === "dashboard" && <AdminDashboardTab />}

      {/* DRIVERS TAB */}
      {activeTab === "drivers" && (
        <section className="space-y-4" id="drivers">
          <section className="card flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">
                Drivers
              </h2>
              <p className="text-[11px] text-slate-400">
                Manage your driver roster, search by name, click to call, and
                open a detail page to edit full driver information.
              </p>
            </div>
            <Link
              href="/admin/drivers/new"
              className="btn-primary px-4 py-2 text-xs font-semibold"
            >
              + Add driver
            </Link>
          </section>

          <section className="card space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
                  Driver roster
                </h3>
                <p className="text-[11px] text-slate-400">
                  Search and scroll through all drivers. Header stays visible
                  while you scroll.
                </p>
              </div>
              <span className="text-[11px] text-slate-400">
                {filteredDrivers.length} of {drivers.length} total
              </span>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-200">
                Search drivers
              </label>
              <input
                type="text"
                value={driverSearch}
                onChange={(e) => setDriverSearch(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                placeholder="Type a driver name…"
              />
            </div>

            <div className="relative overflow-hidden rounded-2xl bg-slate-950/40">
              <div className="max-h-[460px] overflow-auto text-[11px] sm:text-xs">
                {filteredDrivers.length === 0 ? (
                  <p className="p-3 text-[11px] text-slate-400">
                    No drivers match your search.
                  </p>
                ) : (
                  <table className="min-w-full border-separate border-spacing-0">
                    <thead>
                      <tr className="bg-slate-900/90 text-slate-200">
                        <th className="sticky top-0 border-b border-slate-800 px-3 py-2 text-left text-[11px] font-semibold backdrop-blur">
                          Name
                        </th>
                        <th className="sticky top-0 border-b border-slate-800 px-3 py-2 text-left text-[11px] font-semibold backdrop-blur">
                          License #
                        </th>
                        <th className="sticky top-0 border-b border-slate-800 px-3 py-2 text-left text-[11px] font-semibold backdrop-blur">
                          Phone
                        </th>
                        <th className="sticky top-0 border-b border-slate-800 px-3 py-2 text-right text-[11px] font-semibold backdrop-blur">
                          Hourly rate
                        </th>
                        <th className="sticky top-0 border-b border-slate-800 px-3 py-2 text-left text-[11px] font-semibold backdrop-blur">
                          Status
                        </th>
                        <th className="sticky top-0 border-b border-slate-800 px-3 py-2 text-left text-[11px] font-semibold backdrop-blur">
                          PIN
                        </th>
                        <th className="sticky top-0 border-b border-slate-800 px-3 py-2 text-right text-[11px] font-semibold backdrop-blur">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDrivers.map((driver, idx) => {
                        const phoneDigits = (driver.phone || "").replace(
                          /\D/g,
                          "",
                        );

                        return (
                          <tr
                            key={driver.id}
                            className={`border-b border-slate-800/60 transition hover:bg-slate-900/80 ${
                              idx % 2 === 0
                                ? "bg-slate-950/70"
                                : "bg-slate-900/60"
                            }`}
                          >
                            <td className="px-3 py-2 text-slate-100">
                              {driver.full_name}
                            </td>
                            <td className="px-3 py-2 text-slate-100">
                              {driver.license_number || "N/A"}
                            </td>
                            <td className="px-3 py-2 text-slate-100">
                              {driver.phone && phoneDigits.length === 10 ? (
                                <a
                                  href={`tel:${phoneDigits}`}
                                  className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-100 ring-1 ring-emerald-500/50 transition hover:bg-emerald-500/25 active:scale-[0.97]"
                                >
                                  <span className="text-[12px]">📞</span>
                                  <span>{formatPhone(driver.phone)}</span>
                                </a>
                              ) : driver.phone ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-700/40 px-2.5 py-1 text-[11px] text-slate-100">
                                  <span>{driver.phone}</span>
                                </span>
                              ) : (
                                <span className="text-slate-500 text-[11px]">
                                  No number
                                </span>
                              )}
                            </td>

                            <td className="px-3 py-2 text-right text-slate-100">
                              {driver.hourly_rate != null
                                ? `$${driver.hourly_rate.toFixed(2)}`
                                : "—"}
                            </td>
                            <td className="px-3 py-2 text-slate-100">
                              {driver.is_active ? (
                                <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">
                                  Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full bg-slate-500/20 px-2 py-0.5 text-[11px] font-semibold text-slate-200">
                                  Inactive
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-slate-100">
                              {driver.pin ? (
                                <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-200 ring-1 ring-emerald-500/40">
                                  PIN set
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200 ring-1 ring-amber-500/40">
                                  PIN not set
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <div className="flex flex-wrap items-center justify-end gap-1.5">
                                <Link
                                  href={`/admin/drivers/${driver.id}`}
                                  className="btn-ghost px-3 py-1 text-[11px]"
                                >
                                  View / Edit
                                </Link>
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
                                  onClick={() => handleSetDriverPin(driver)}
                                  className="btn-ghost px-3 py-1 text-[11px]"
                                  disabled={loading}
                                >
                                  Set / Reset PIN
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {loading && (
                <div className="border-t border-slate-800/80 bg-slate-950/80 px-3 py-2 text-[11px] text-slate-400">
                  Working… please wait a moment.
                </div>
              )}
            </div>
          </section>
        </section>
      )}

      {/* ROUTES */}
      {activeTab === "routes" && (
        <RoutesTab />
      )}
      
      {/* VEHICLES TAB */}
      {activeTab === "vehicles" && (
        <section className="space-y-4">
          {/* Vehicles header + add button */}
          <section className="card flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">
                Vehicles
              </h2>
              <p className="text-[11px] text-slate-400">
                Manage your fleet. This list feeds the vehicle dropdown in the Driver Portal.
              </p>
            </div>

            <div className="flex flex-col items-end gap-1 text-right">
              <span className="text-[11px] text-slate-400">
                {filteredVehicles.length} of {vehicles.length} total
              </span>
              <Link
                href="/admin/vehicles/new"
                className="btn-primary px-4 py-2 text-xs font-semibold"
              >
                + Add vehicle
              </Link>
            </div>
          </section>

          {/* Vehicle roster */}
          <section className="card space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
                  Fleet roster
                </h3>
                <p className="text-[11px] text-slate-400">
                  Scroll to view all vehicles. Header stays visible while you scroll.
                </p>
              </div>
              <div className="space-y-1 sm:w-64">
                <label className="text-[11px] font-medium text-slate-200">
                  Search vehicles
                </label>
                <input
                  type="text"
                  value={vehicleSearch}
                  onChange={(e) => setVehicleSearch(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                  placeholder="Filter by label, plate, make, model, or year…"
                />
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl bg-slate-950/40">
              <div className="max-h-[420px] overflow-auto text-[11px] sm:text-xs">
                {filteredVehicles.length === 0 ? (
                  <p className="p-3 text-[11px] text-slate-400">
                    No vehicles match your search.
                  </p>
                ) : (
                  <table className="min-w-full border-separate border-spacing-0">
                    <thead>
                      <tr className="bg-slate-900/90 text-slate-200">
                        <th className="sticky top-0 border-b border-slate-800 px-3 py-2 text-left text-[11px] font-semibold backdrop-blur">
                          Vehicle
                        </th>
                        <th className="sticky top-0 border-b border-slate-800 px-3 py-2 text-left text-[11px] font-semibold backdrop-blur">
                          Label
                        </th>
                        <th className="sticky top-0 border-b border-slate-800 px-3 py-2 text-left text-[11px] font-semibold backdrop-blur">
                          Plate
                        </th>
                        <th className="sticky top-0 border-b border-slate-800 px-3 py-2 text-left text-[11px] font-semibold backdrop-blur">
                          VIN
                        </th>
                        <th className="sticky top-0 border-b border-slate-800 px-3 py-2 text-left text-[11px] font-semibold backdrop-blur">
                          Status
                        </th>
                        <th className="sticky top-0 border-b border-slate-800 px-3 py-2 text-right text-[11px] font-semibold backdrop-blur">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredVehicles.map((vehicle, idx) => {
                        const isEditing = editingVehicleId === vehicle.id;

                        return (
                          <>
                            <tr
                              key={vehicle.id}
                              className={`border-b border-slate-800/60 transition hover:bg-slate-900/80 ${
                                idx % 2 === 0
                                  ? "bg-slate-950/70"
                                  : "bg-slate-900/60"
                              }`}
                            >
                              <td className="px-3 py-2 text-slate-100">
                                {vehicle.year || vehicle.make || vehicle.model ? (
                                  <>
                                    {vehicle.year ?? ""}{" "}
                                    {vehicle.make ?? ""}{" "}
                                    {vehicle.model ?? ""}
                                  </>
                                ) : (
                                  <span className="text-slate-500">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-slate-100">
                                {vehicle.label}
                              </td>
                              <td className="px-3 py-2 text-slate-100">
                                {vehicle.plate || "N/A"}
                              </td>
                              <td className="px-3 py-2 text-slate-100">
                                {vehicle.vin || (
                                  <span className="text-slate-500">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-slate-100">
                                {vehicle.is_active ? (
                                  <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">
                                    Active
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center rounded-full bg-slate-500/20 px-2 py-0.5 text-[11px] font-semibold text-slate-200">
                                    Inactive
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <div className="flex flex-wrap items-center justify-end gap-1.5">
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
                                    onClick={() =>
                                      handleDeleteVehicle(vehicle)
                                    }
                                    className="btn-ghost px-3 py-1 text-[11px] text-red-300 hover:text-red-200"
                                    disabled={loading}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {isEditing && (
                              <tr key={`${vehicle.id}-edit`}>
                                <td
                                  colSpan={6}
                                  className="px-3 pb-3 pt-0 align-top"
                                >
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
                                            setEditVehicleLabel(
                                              e.target.value,
                                            )
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
                                            setEditVehicleYear(
                                              e.target.value,
                                            )
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
                                            setEditVehicleMake(
                                              e.target.value,
                                            )
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
                                            setEditVehicleModel(
                                              e.target.value,
                                            )
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
                                            setEditVehiclePlate(
                                              e.target.value,
                                            )
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
                                            setEditVehicleVin(
                                              e.target.value,
                                            )
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
                                          loading ||
                                          !editVehicleLabel.trim()
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
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {loading && (
                <div className="border-t border-slate-800/80 bg-slate-950/80 px-3 py-2 text-[11px] text-slate-400">
                  Working… please wait a moment.
                </div>
              )}
            </div>
          </section>
        </section>
      )}


      {/* INSPECTIONS TAB */}
      {activeTab === "inspections" && (
        <section className="space-y-4">
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
                            <Link
                              href={`/inspection/${rec.id}?from=admin-inspections`}
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

      {/* STUDENTS TAB */}
      {activeTab === "students" && <StudentsAdminSection />}

      {/* SCHOOLS TAB */}
      {activeTab === "schools" && <SchoolsAdminSection />}

      {/* TIMECARDS TAB */}
      {activeTab === "timecards" && (
        <TimecardsAdminSection drivers={drivers} />
      )}
    </div>
  );
}

// ======================================================
//              STUDENTS ADMIN SUBCOMPONENT
// ======================================================

type StudentRow = {
  id: string;
  full_name: string;
  student_id: string | null;
  pickup_address: string;
  is_active: boolean;

  // NEW – primary guardian inline on student
  primary_guardian_name: string | null;
  primary_guardian_phone: string | null;

  // derived from schools
  school_name: string | null;
};


function StudentsAdminSection() {
  const router = useRouter();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<StudentRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadStudents() {
      setLoading(true);
      setError(null);

      try {
        const { data: studentData, error: studentErr } = await supabase
        .from("students")
        .select(
          "id, full_name, student_id, pickup_address, is_active, school_id, primary_guardian_name, primary_guardian_phone",
        )
        .order("full_name", { ascending: true });

        if (studentErr) throw studentErr;

        const rawStudents = (studentData || []) as any[];

        const { data: schoolsData, error: schoolErr } = await supabase
          .from("schools")
          .select("id, name");

        if (schoolErr) throw schoolErr;

        const schoolMap = new Map<string, string>();
        (schoolsData || []).forEach((s: any) => {
          if (s.id && s.name) schoolMap.set(s.id, s.name);
        });

      const mapped: StudentRow[] = rawStudents.map((row) => ({
        id: row.id,
        full_name: row.full_name,
        student_id: row.student_id,
        pickup_address: row.pickup_address,
        is_active: row.is_active,

        primary_guardian_name: row.primary_guardian_name ?? null,
        primary_guardian_phone: row.primary_guardian_phone ?? null,

        school_name: row.school_id ? schoolMap.get(row.school_id) ?? null : null,
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

   useEffect(() => {
    const raw = search.trim().toLowerCase();

    // If search box is empty, show all students
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
        const phoneDigits = (st.primary_guardian_phone || "").replace(/\D/g, "");

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


  const handleDeleteStudent = async (st: StudentRow) => {
  const confirmed = window.confirm(
    `Delete student "${st.full_name}"? This will remove them from routes and guardian links.`
  );
  if (!confirmed) return;

  try {
    setLoading(true);
    setError(null);

    // 1) Remove joins (if you don’t have ON DELETE CASCADE)
    await supabase.from("student_guardians").delete().eq("student_id", st.id);

    // 2) Remove route stops referencing this student (if no CASCADE)
    await supabase.from("route_stops").delete().eq("student_id", st.id);

    // 3) Delete student
    const { error: delErr } = await supabase.from("students").delete().eq("id", st.id);
    if (delErr) throw delErr;

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
            placeholder="Search by student, ID, school, address, or guardian phone…"
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

      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 shadow-lg shadow-black/40">
        {loading ? (
          <div className="py-10 text-center text-sm text-slate-400">
            Loading students...
          </div>
        ) : error ? (
          <div className="py-6 text-center text-sm text-rose-400">{error}</div>
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
                <th className="px-3 py-2 font-semibold text-right">Actions</th>
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
                      {st.student_id || <span className="text-slate-500">—</span>}
                    </td>

                    {/* Primary guardian */}
                    <td className="px-3 py-2 text-[11px] text-slate-300">
                      {st.primary_guardian_name && st.primary_guardian_phone ? (
                        (() => {
                          const digits = st.primary_guardian_phone.replace(/\D/g, "");
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
                              <span className="text-[12px]">📞</span>
                              <span className="truncate max-w-[220px]">
                                {st.primary_guardian_name} • {label}
                              </span>
                            </a>
                          );
                        })()
                      ) : (
                        <span className="text-slate-500">No primary guardian</span>
                      )}
                    </td>

                    {/* School */}
                    <td className="px-3 py-2 text-[11px] text-slate-300">
                      {st.school_name || <span className="text-slate-500">—</span>}
                    </td>

                    {/* Pickup address */}
                    <td className="px-3 py-2 text-[11px] text-slate-300">
                      <span className="line-clamp-2 max-w-xs">{st.pickup_address}</span>
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
                          onClick={() => router.push(`/admin/students/${st.id}`)}
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

// ======================================================
//              SCHOOLS ADMIN SUBCOMPONENT
// ======================================================

type SchoolRow = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
};


function SchoolsAdminSection() {
  const router = useRouter();
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [filteredSchools, setFilteredSchools] = useState<SchoolRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadSchools() {
      setLoading(true);
      setError(null);

      try {
        const { data, error: schoolErr } = await supabase
          .from("schools")
          .select("id, name, address, phone, start_time, end_time, notes")
          .order("name", { ascending: true });

        if (schoolErr) throw schoolErr;

        if (!isMounted) return;

        const mapped: SchoolRow[] = (data || []).map((row: any) => ({
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

  const handleDeleteSchool = async (sc: SchoolRow) => {
    const confirmed = window.confirm(
      `Delete school "${sc.name}"? This will remove it from routes and stops that reference it.`,
    );
    if (!confirmed) return;

    try {
      setLoading(true);
      setError(null);

      // If you don't have ON DELETE CASCADE, you might need to
      // delete route_stops referencing this school first.
      await supabase.from("route_stops").delete().eq("school_id", sc.id);

      const { error: delErr } = await supabase
        .from("schools")
        .delete()
        .eq("id", sc.id);

      if (delErr) throw delErr;

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

      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 shadow-lg shadow-black/40">
        {loading ? (
          <div className="py-10 text-center text-sm text-slate-400">
            Loading schools...
          </div>
        ) : error ? (
          <div className="py-6 text-center text-sm text-rose-400">{error}</div>
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
                      {sc.address || <span className="text-slate-500">—</span>}
                    </td>

                    {/* Phone – click to call if present */}
                    <td className="px-3 py-2 text-[11px] text-slate-300">
                      {sc.phone ? (
                        (() => {
                          const digits = sc.phone.replace(/\D/g, "");
                          const label =
                            digits.length === 10
                              ? `${digits.slice(0, 3)}-${digits.slice(
                                  3,
                                  6,
                                )}-${digits.slice(6)}`
                              : sc.phone;

                          return (
                            <a
                              href={`tel:${digits || sc.phone}`}
                              className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-100 ring-1 ring-emerald-500/50 transition hover:bg-emerald-500/25 active:scale-[0.97]"
                              title="Tap to call school"
                            >
                              <span className="text-[12px]">📞</span>
                              <span className="truncate max-w-[160px]">
                                {label}
                              </span>
                            </a>
                          );
                        })()
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>

                    {/* Start / End */}
                    <td className="px-3 py-2 text-[11px] text-slate-300">
                      {sc.start_time || sc.end_time ? (
                        <>
                          {sc.start_time || "—"}{" "}
                          <span className="text-slate-500">to</span>{" "}
                          {sc.end_time || "—"}
                        </>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>

                    {/* Notes */}
                    <td className="px-3 py-2 text-[11px] text-slate-300">
                      <span className="line-clamp-2 max-w-xs">
                        {sc.notes || <span className="text-slate-500">—</span>}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-2 text-right text-[11px]">
                      <div className="inline-flex gap-1.5">
                        <button
                          onClick={() => router.push(`/admin/schools/${sc.id}`)}
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


// ======================================================
//              TIMECARDS ADMIN SUBCOMPONENT
// ======================================================

function TimecardsAdminSection({ drivers }: { drivers: Driver[] }) {
  const [summaries, setSummaries] = useState<DriverTimeSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [weekStart, setWeekStart] = useState<string>(() => {
    const start = getWeekStart(new Date());
    return formatYMD(start);
  });

  const weekDays = useMemo(() => {
    const start = new Date(`${weekStart}T00:00:00`);
    if (Number.isNaN(start.getTime())) return [];

    const days: { date: string; pretty: string; label: string }[] = [];

    for (let i = 0; i < 7; i += 1) {
      const d = new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate() + i,
      );

      days.push({
        date: formatYMD(d),
        pretty: formatPretty(d),
        label: WEEKDAY_LABELS[i],
      });
    }

    return days;
  }, [weekStart]);

  const weekPrettyRange = useMemo(() => {
    if (weekDays.length === 0) return "";
    const first = weekDays[0];
    const last = weekDays[weekDays.length - 1];
    return `${first.pretty} – ${last.pretty}`;
  }, [weekDays]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        if (!drivers || drivers.length === 0 || weekDays.length === 0) {
          setSummaries([]);
          setLoading(false);
          return;
        }

        const weekStartStr = weekDays[0].date;
        const weekEndStr = weekDays[weekDays.length - 1].date;

        const { data: timeData, error: timeErr } = await supabase
          .from("driver_time_entries")
          .select(
            "id, driver_id, work_date, start_time, end_time, duration_seconds",
          )
          .gte("work_date", weekStartStr)
          .lte("work_date", weekEndStr);

        if (timeErr) throw timeErr;

        const entries = (timeData as TimeEntry[]) || [];
        const now = new Date();

        const byDriver: Record<string, DriverTimeSummary> = {};
        for (const d of drivers) {
          byDriver[d.id] = {
            driverId: d.id,
            name: d.full_name,
            license: d.license_number,
            dailySeconds: {},
            weekTotalSeconds: 0,
          };
        }

        for (const entry of entries) {
          const summary = byDriver[entry.driver_id];
          if (!summary) continue;

          let dur: number;
          if (entry.end_time) {
            dur =
              entry.duration_seconds ??
              Math.max(
                0,
                Math.floor(
                  (new Date(entry.end_time).getTime() -
                    new Date(entry.start_time).getTime()) /
                    1000,
                ),
              );
          } else {
            dur = Math.max(
              0,
              Math.floor(
                (now.getTime() - new Date(entry.start_time).getTime()) / 1000,
              ),
            );
          }

          const key = entry.work_date;
          summary.dailySeconds[key] = (summary.dailySeconds[key] ?? 0) + dur;
          summary.weekTotalSeconds += dur;
        }

        setSummaries(Object.values(byDriver));
      } catch (err: any) {
        console.error(err);
        setError(
          err?.message ??
            "Failed to load timecards. Please refresh or try again.",
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [drivers, weekDays]);

  const handleShiftWeek = (deltaWeeks: number) => {
    const current = new Date(`${weekStart}T00:00:00`);
    if (Number.isNaN(current.getTime())) return;

    const shifted = new Date(
      current.getFullYear(),
      current.getMonth(),
      current.getDate() + deltaWeeks * 7,
    );
    const start = getWeekStart(shifted);
    setWeekStart(formatYMD(start));
  };

  return (
    <div className="space-y-4">
      <section className="card space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold md:text-lg">
              Driver Timecards
            </h2>
            <p className="text-sm text-slate-300">
              Live daily and weekly hours for each driver, Sunday to Saturday.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:items-end">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleShiftWeek(-1)}
                className="btn-ghost px-3 py-1 text-xs"
              >
                ◀ Previous week
              </button>
              <button
                type="button"
                onClick={() => handleShiftWeek(1)}
                className="btn-ghost px-3 py-1 text-xs"
              >
                Next week ▶
              </button>
            </div>

            <Link
              href="/admin/timecards/live"
              className="btn-ghost px-3 py-1 text-[11px]"
            >
              Live Clock →
            </Link>
          </div>
        </div>

        <p className="text-sm text-slate-400">
          Week of{" "}
          <span className="font-semibold text-slate-100">
            {weekPrettyRange}
          </span>{" "}
          (Sun–Sat)
        </p>
      </section>

      {error && (
        <section className="card border border-red-500/50 bg-red-950/40">
          <p className="text-sm font-medium text-red-200">{error}</p>
        </section>
      )}

      <section className="card space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">
            Weekly hours by driver
          </h3>
          {loading && <span className="text-xs text-slate-400">Loading…</span>}
        </div>

        {(!drivers || drivers.length === 0) && !loading ? (
          <p className="text-sm text-slate-400">
            No active drivers found. Add drivers in the Drivers tab to see
            timecards here.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl bg-slate-950/40">
            <table className="min-w-full border-separate border-spacing-0 text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-900/80 text-slate-200">
                  <th className="border-b border-slate-800 px-3 py-2 text-left font-semibold">
                    Driver
                  </th>
                  <th className="border-b border-slate-800 px-3 py-2 text-left font-semibold">
                    License #
                  </th>
                  {weekDays.map((d) => (
                    <th
                      key={d.date}
                      className="border-b border-slate-800 px-3 py-2 text-right font-semibold"
                    >
                      <span className="block text-[11px] font-normal uppercase tracking-[0.12em] text-slate-400">
                        {d.label}
                      </span>
                      <span className="text-[11px] sm:text-xs">
                        {d.pretty}
                      </span>
                    </th>
                  ))}
                  <th className="border-b border-slate-800 px-3 py-2 text-right font-semibold">
                    Weekly total
                  </th>
                  <th className="border-b border-slate-800 px-3 py-2 text-right font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((s) => (
                  <tr
                    key={s.driverId}
                    className="odd:bg-slate-950/60 even:bg-slate-900/60"
                  >
                    <td className="px-3 py-2 text-slate-100">
                      {s.name || "Unknown"}
                    </td>
                    <td className="px-3 py-2 text-slate-100">
                      {s.license || "—"}
                    </td>
                    {weekDays.map((d) => {
                      const secs = s.dailySeconds[d.date] ?? 0;
                      return (
                        <td
                          key={d.date}
                          className="px-3 py-2 text-right font-mono text-[11px] text-slate-100 sm:text-xs"
                        >
                          {secs > 0 ? formatDuration(secs) : "00:00:00"}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right font-mono text-[11px] text-emerald-200 sm:text-xs">
                      {formatDuration(s.weekTotalSeconds)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/admin/timecards/${s.driverId}/${weekDays[0]?.date}`}
                        className="btn-ghost px-3 py-1 text-[11px] sm:text-xs"
                      >
                        View timecard
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-slate-400 sm:text-sm">
          Timecards are calculated from pre-trip (clock start) and post-trip
          (clock stop) inspections stored in the driver time entries table.
        </p>
      </section>
    </div>
  );
}
