"use client";

import { useState, useEffect, useMemo } from "react";

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

type DriverLoginFormProps = {
  onLoginSuccess: (driver: {
    id: string;
    full_name: string;
    license_number: string | null;
    is_active: boolean;
    pin: string | null;
    created_at: string;
  }, vehicleId: string) => void;
  vehicles: Vehicle[];
  loadingVehicles: boolean;
};

export default function DriverLoginForm({
  onLoginSuccess,
  vehicles,
  loadingVehicles,
}: DriverLoginFormProps) {
  const [driverName, setDriverName] = useState("");
  const [driverPin, setDriverPin] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingDriverLookup, setLoadingDriverLookup] = useState(false);

  // Prefill login form from the last used driver
  useEffect(() => {
    if (typeof window === "undefined") return;

    const saved = window.localStorage.getItem("transafeRecentDriver");
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as {
        driverName?: string;
        vehicleId?: string;
      };

      if (parsed.driverName && !driverName) {
        setDriverName(parsed.driverName);
      }
      if (parsed.vehicleId && !selectedVehicleId) {
        setSelectedVehicleId(parsed.vehicleId);
      }
    } catch (err) {
      console.error("Failed to prefill recent driver", err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStartSession = async () => {
    const normalizeName = (name: string) =>
      name.trim().replace(/\s+/g, " ");

    const inputName = normalizeName(driverName);

    if (!inputName || !selectedVehicleId) {
      setError("Please enter your name, PIN, and select a vehicle.");
      return;
    }

    if (!driverPin.trim()) {
      setError("Please enter your PIN.");
      return;
    }

    setError(null);
    setLoadingDriverLookup(true);

    try {
      const res = await fetch("/api/auth/driver-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driverName: inputName,
          pin: driverPin.trim(),
          vehicleId: selectedVehicleId,
        }),
      });

      const body = await res.json();

      if (!res.ok) {
        setError(body.error || "Login failed. Please try again.");
        setLoadingDriverLookup(false);
        return;
      }

      const driver = body.driver;

      if (typeof window !== "undefined") {
        const sessionPayload = {
          driverId: driver.id,
          driverName: driver.full_name,
          licenseNumber: driver.license_number,
          vehicleId: selectedVehicleId,
        };

        window.localStorage.setItem(
          "transafeDriverSession",
          JSON.stringify(sessionPayload),
        );

        window.localStorage.setItem("transafeDriverId", driver.id);
        window.localStorage.setItem("transafeDriverName", driver.full_name);

        const recentPayload = {
          driverName: driver.full_name,
          vehicleId: selectedVehicleId,
        };
        window.localStorage.setItem(
          "transafeRecentDriver",
          JSON.stringify(recentPayload),
        );
      }

      onLoginSuccess(driver, selectedVehicleId);
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ??
          "Failed to look up driver. Please check your name spelling or contact admin.",
      );
    } finally {
      setLoadingDriverLookup(false);
    }
  };

  return (
    <div className="space-y-4 max-w-md mx-auto">
      <section className="card space-y-2 text-center sm:text-left">
        <h1 className="text-xl font-semibold sm:text-2xl">Driver Portal</h1>
        <p className="text-sm text-slate-200/80">
          Enter your name, PIN, and select your assigned vehicle to begin your
          daily inspection and time clock.
        </p>
      </section>

      {error && (
        <section className="card border border-red-500/50 bg-red-950/40">
          <p className="text-xs font-medium text-red-200">{error}</p>
        </section>
      )}

      <section className="card space-y-4">
        {/* Name */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-100">
            Your full name
          </label>
          <input
            type="text"
            value={driverName}
            onChange={(e) => setDriverName(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
            placeholder="e.g. John Doe"
          />
          <p className="text-[11px] text-slate-400">
            Must match how your name is entered by the admin (e.g. &quot;Julio
            Duarte&quot;).
          </p>
        </div>

        {/* PIN */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-100">
            Driver PIN
          </label>
          <input
            id="driverPin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={driverPin}
            onChange={(e) => setDriverPin(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
            placeholder="4-6 digit PIN"
          />
          <p className="text-[11px] text-slate-400">
            This is your personal secret code. Do not share it with anyone.
          </p>
        </div>

        {/* Vehicle */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-100">
            Assigned vehicle
          </label>
          <select
            value={selectedVehicleId}
            onChange={(e) => setSelectedVehicleId(e.target.value)}
            disabled={!driverPin.trim() || loadingVehicles}
            className={`w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2 ${
              !driverPin.trim() || loadingVehicles
                ? "cursor-not-allowed opacity-60"
                : ""
            }`}
          >
            <option value="">
              {!driverPin.trim()
                ? "Enter your PIN to unlock vehicles"
                : loadingVehicles
                  ? "Loading vehicles..."
                  : "Select a vehicle"}
            </option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.label}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-slate-400">
            You must enter your PIN before choosing a vehicle. If your vehicle
            is missing, ask your admin to add it in the Admin Portal.
          </p>
        </div>

        {/* Login button */}
        <button
          type="button"
          onClick={handleStartSession}
          className="btn-primary w-full text-sm"
          disabled={
            !driverName.trim() ||
            !driverPin.trim() ||
            !selectedVehicleId ||
            loadingVehicles ||
            loadingDriverLookup
          }
        >
          {loadingDriverLookup
            ? "Checking driver..."
            : "Continue to driver dashboard"}
        </button>
      </section>
    </div>
  );
}
