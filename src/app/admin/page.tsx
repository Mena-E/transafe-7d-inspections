"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import RoutesTab from "./_components/RoutesTab";
import AdminDashboardTab from "./_components/AdminDashboardTab";
import DriversTab from "./_components/DriversTab";
import VehiclesTab from "./_components/VehiclesTab";
import InspectionsTab from "./_components/InspectionsTab";
import StudentsTab from "./_components/StudentsTab";
import SchoolsTab from "./_components/SchoolsTab";
import TimecardsTab from "./_components/TimecardsTab";
import HouseholdsTab from "./_components/HouseholdsTab";
import AttendanceTab from "./_components/AttendanceTab";

// =====================
//  CONSTANTS & TYPES
// =====================

const ADMIN_TAB_STORAGE_KEY = "transafe_admin_active_tab";

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

type AdminTab =
  | "dashboard"
  | "inspections"
  | "vehicles"
  | "drivers"
  | "students"
  | "schools"
  | "routes"
  | "timecards"
  | "households"
  | "attendance";

const ADMIN_TABS: AdminTab[] = [
  "dashboard",
  "inspections",
  "vehicles",
  "drivers",
  "students",
  "schools",
  "routes",
  "timecards",
  "households",
  "attendance",
];

function isValidAdminTab(value: any): value is AdminTab {
  return typeof value === "string" && ADMIN_TABS.includes(value as AdminTab);
}

// ======================================================
//                      ADMIN PAGE
// ======================================================

export default function AdminPage() {
  const router = useRouter();

  const [accessCodeInput, setAccessCodeInput] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---------------- TAB SYNC (HASH + LOCAL STORAGE) ----------------

  useEffect(() => {
    if (typeof window === "undefined") return;

    const rawHash = window.location.hash;
    const hash = rawHash.replace("#", "").toLowerCase() || null;

    if (isValidAdminTab(hash)) {
      setActiveTab(hash);
      window.localStorage.setItem(ADMIN_TAB_STORAGE_KEY, hash);
      return;
    }

    const saved = window.localStorage.getItem(ADMIN_TAB_STORAGE_KEY);
    if (isValidAdminTab(saved)) {
      setActiveTab(saved);
      if (!window.location.hash) {
        window.location.hash = `#${saved}`;
      }
      return;
    }

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

  // ---------------- LOAD DRIVERS & VEHICLES WHEN AUTHED ----------------

  useEffect(() => {
    if (!isAuthenticated) return;

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [driversRes, vehiclesRes] = await Promise.all([
          fetch("/api/admin/drivers"),
          fetch("/api/admin/vehicles"),
        ]);

        if (!driversRes.ok) throw new Error("Failed to load drivers");
        if (!vehiclesRes.ok) throw new Error("Failed to load vehicles");

        const driversBody = await driversRes.json();
        const vehiclesBody = await vehiclesRes.json();

        setDrivers(driversBody.drivers as Driver[]);
        setVehicles(vehiclesBody.vehicles as Vehicle[]);
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

  const handleAccess = async () => {
    try {
      const res = await fetch("/api/auth/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessCode: accessCodeInput.trim() }),
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error || "Invalid admin access code.");
        return;
      }

      setIsAuthenticated(true);
      setError(null);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("transafe_admin_unlocked", "true");
      }
    } catch (err: any) {
      setError("Failed to validate access code. Please try again.");
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
    setError(null);
    setActiveTab("dashboard");

    router.push("/");
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
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAccess();
            }}
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
              Transafe Admin Portal
            </h1>
            <p className="text-xs text-slate-200/80">
              Manage{" "}
              <span className="font-semibold">Inspections</span>,{" "}
              <span className="font-semibold">Vehicles</span>,{" "}
              <span className="font-semibold">Drivers</span>,{" "}
              <span className="font-semibold">Students</span>,{" "}
              <span className="font-semibold">Attendance</span>, and{" "}
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
            { id: "households", label: "Households" },
            { id: "attendance", label: "Attendance" },
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

      {/* Tab content */}
      {activeTab === "dashboard" && <AdminDashboardTab />}
      {activeTab === "drivers" && (
        <DriversTab drivers={drivers} setDrivers={setDrivers} />
      )}
      {activeTab === "routes" && <RoutesTab />}
      {activeTab === "vehicles" && (
        <VehiclesTab vehicles={vehicles} setVehicles={setVehicles} />
      )}
      {activeTab === "inspections" && <InspectionsTab />}
      {activeTab === "students" && <StudentsTab />}
      {activeTab === "schools" && <SchoolsTab />}
      {activeTab === "timecards" && <TimecardsTab drivers={drivers} />}
      {activeTab === "households" && <HouseholdsTab />}
      {activeTab === "attendance" && <AttendanceTab />}
    </div>
  );
}
