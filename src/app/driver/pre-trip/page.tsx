"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

// ==== TYPES & CONSTANTS SHARED WITH DRIVER PORTAL ====

type AnswerValue = "pass" | "fail" | "na";

type ChecklistItem = {
  id: string;
  label: string;
  category: string;
};

type ShiftType = "AM" | "Midday" | "PM" | "";

type DriverSession = {
  driverId: string;
  driverName: string;
  licenseNumber: string | null;
  vehicleId: string;
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

/**
 * Pre-trip checklist – same as on the Driver Portal
 */
const PRE_CHECKLIST: ChecklistItem[] = [
  // Lights & exterior
  {
    id: "tires",
    label: 'Tires – pressure and minimum 4/32" tread depth',
    category: "Lights & exterior",
  },
  {
    id: "headlights",
    label: "Headlights – high and low beams",
    category: "Lights & exterior",
  },
  {
    id: "directionals",
    label: "Turn signals – front and rear",
    category: "Lights & exterior",
  },
  {
    id: "stop_lights",
    label: "Brake / stop lights",
    category: "Lights & exterior",
  },
  {
    id: "reverse_lights",
    label: "Reverse lights",
    category: "Lights & exterior",
  },
  {
    id: "four_way_flashers",
    label: "Four-way hazard flashers",
    category: "Lights & exterior",
  },
  {
    id: "plate_light",
    label: "License plate light",
    category: "Lights & exterior",
  },
  {
    id: "school_bus_lights",
    label: "School bus / warning lights",
    category: "Lights & exterior",
  },

  // Controls & safety
  {
    id: "brakes",
    label: "Brakes – service and parking",
    category: "Controls & safety",
  },
  {
    id: "mirrors",
    label: "Mirrors adjusted and secure",
    category: "Controls & safety",
  },
  {
    id: "exhaust",
    label: "Exhaust system – leaks or damage",
    category: "Controls & safety",
  },
  {
    id: "fluid_leaks",
    label: "Fluid leaks under vehicle",
    category: "Controls & safety",
  },
  {
    id: "doors",
    label: "Doors – open/close properly, latches working",
    category: "Controls & safety",
  },
  {
    id: "wipers_fluid",
    label: "Windshield wipers and washer fluid",
    category: "Controls & safety",
  },
  {
    id: "horn",
    label: "Horn",
    category: "Controls & safety",
  },

  // Required equipment
  {
    id: "pupil_plates",
    label: "Front and rear pupil plates",
    category: "Required equipment",
  },
  {
    id: "state_inspection",
    label: "Annual state inspection sticker",
    category: "Required equipment",
  },
  {
    id: "semi_annual_7d",
    label: "Semi-annual 7D inspection sticker",
    category: "Required equipment",
  },
  {
    id: "chock_blocks",
    label: "Two chock blocks",
    category: "Required equipment",
  },
  {
    id: "first_aid",
    label: "First aid kit",
    category: "Required equipment",
  },
  {
    id: "fire_ext",
    label:
      "Fire extinguisher mounted and reachable by driver (2A:10BC with hose)",
    category: "Required equipment",
  },
  {
    id: "triangles",
    label: "Three reflective warning triangles",
    category: "Required equipment",
  },
  {
    id: "body_fluid_kit",
    label: "Body fluid clean-up kit",
    category: "Required equipment",
  },
  {
    id: "seat_belt_cutter",
    label: "Seat belt cutter",
    category: "Required equipment",
  },
  {
    id: "fire_blanket",
    label:
      "Fire / evacuation blanket (only for wheelchair-equipped vehicles)",
    category: "Required equipment",
  },
  {
    id: "child_reminder",
    label:
      "Child reminder system present and working (2018 and newer vehicles)",
    category: "Required equipment",
  },
  {
    id: "wheelchair_lift",
    label: "Wheelchair lift, if installed",
    category: "Required equipment",
  },
];

type AnswersState = Record<string, AnswerValue | null>;


/**
 * Same AnswerButton UI as on main driver page
 */
function AnswerButton({
  value,
  selected,
  label,
  onClick,
}: {
  value: AnswerValue;
  selected: boolean;
  label: string;
  onClick: () => void;
}) {
  const baseClasses =
    "flex-1 min-w-[70px] rounded-lg md:rounded-2xl border px-2.5 py-1.5 md:px-4 md:py-3 text-[11px] md:text-sm font-semibold text-center transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70";

  let colorClasses = "";

  if (value === "pass") {
    colorClasses = selected
      ? "border-emerald-500 bg-emerald-500 text-slate-950 shadow-lg"
      : "border-emerald-500/40 bg-slate-900/70 text-emerald-200 hover:bg-emerald-500/10";
  } else if (value === "fail") {
    colorClasses = selected
      ? "border-red-500 bg-red-500 text-slate-950 shadow-lg"
      : "border-red-500/50 bg-slate-900/70 text-red-200 hover:bg-red-500/10";
  } else {
    // "na"
    colorClasses = selected
      ? "border-slate-400 bg-slate-400 text-slate-950 shadow-lg"
      : "border-slate-500/50 bg-slate-900/70 text-slate-200 hover:bg-slate-600/10";
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`${baseClasses} ${colorClasses}`}
    >
      <div className="flex flex-col items-center justify-center gap-0.5">
        <span className="text-[11px] uppercase tracking-[0.18em]">
          {label}
        </span>
        <span className="text-xs md:text-sm">
          {value === "pass" ? "Pass" : value === "fail" ? "Fail" : "N/A"}
        </span>
      </div>
    </button>
  );
}

export default function PreTripPage() {
  const router = useRouter();

  // Session & vehicle
  const [session, setSession] = useState<DriverSession | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loadingVehicle, setLoadingVehicle] = useState(false);

  // Form state
  const [odometer, setOdometer] = useState("");
  const [shift, setShift] = useState<ShiftType>("");
  const [answers, setAnswers] = useState<AnswersState>({});
  const [notes, setNotes] = useState("");
  const [signatureName, setSignatureName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load session from localStorage (same key as Driver Portal)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const raw = window.localStorage.getItem("transafeDriverSession");
    if (!raw) {
      router.push("/driver");
      return;
    }

    try {
      const parsed = JSON.parse(raw) as DriverSession;
      if (!parsed.driverId || !parsed.driverName || !parsed.vehicleId) {
        router.push("/driver");
        return;
      }
      setSession(parsed);
    } catch {
      router.push("/driver");
    }
  }, [router]);

  // Load vehicle info for display and for inspections table
  useEffect(() => {
    if (!session?.vehicleId) return;

    const loadVehicle = async () => {
      setLoadingVehicle(true);
      try {
        const res = await fetch("/api/admin/vehicles");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load vehicles");
        const vehicles: Vehicle[] = json.vehicles || [];
        const match = vehicles.find((v) => v.id === session.vehicleId);
        setVehicle(match ?? null);
      } catch (err) {
        console.error("Failed to load vehicle for pre-trip page", err);
      } finally {
        setLoadingVehicle(false);
      }
    };

    void loadVehicle();
  }, [session?.vehicleId]);

  const groupedChecklist = useMemo(() => {
    const groups: Record<string, ChecklistItem[]> = {};
    for (const item of PRE_CHECKLIST) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    }
    return groups;
  }, []);

  const updateAnswer = (itemId: string, value: AnswerValue) => {
    setAnswers((prev) => ({
      ...prev,
      [itemId]: value,
    }));
  };

  const allAnswered =
    PRE_CHECKLIST.length > 0 &&
    PRE_CHECKLIST.every((item) => !!answers[item.id]);

  const canSubmit =
    !!session &&
    !!shift &&
    !!odometer.trim() &&
    !!signatureName.trim() &&
    allAnswered &&
    !submitting;

    const handleSubmit = async () => {
    if (!session || !vehicle) {
      setError(
        "Missing driver or vehicle information. Please return to the Driver Portal.",
      );
      return;
    }

    if (!canSubmit) return;

    setSubmitting(true);
    setSubmitMessage(null);
    setError(null);

    try {
      // Build answers payload with labels as keys
      const answersPayload: Record<string, string> = {};
      for (const item of PRE_CHECKLIST) {
        const val = answers[item.id];
        answersPayload[item.label] = val ?? "";
      }

      // Derive overall status
      let overallStatus: string | null = null;
      const values = Object.values(answers) as (AnswerValue | null)[];
      if (values.includes("fail")) {
        overallStatus = "fail";
      } else if (values.includes("pass")) {
        overallStatus = "pass";
      } else {
        overallStatus = "unknown";
      }

      // Submit inspection via API route (also handles starting work session)
      const res = await fetch("/api/driver/inspections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driver_id: session.driverId,
          driver_name: session.driverName.trim(),
          driver_license_number: session.licenseNumber ?? null,
          vehicle_id: vehicle.id,
          vehicle_label: vehicle.label,
          inspection_type: "pre",
          shift,
          answers: answersPayload,
          overall_status: overallStatus,
          notes: notes || null,
          signature_name: signatureName.trim(),
          odometer_reading: odometer.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to submit inspection");

      // Show confirmation message
      setSubmitMessage(
        "Pre-trip inspection submitted successfully. Thank you for completing your daily check.",
      );

      // Optionally reset form state (not strictly necessary since we'll redirect)
      setShift("");
      setOdometer("");
      setAnswers({});
      setNotes("");
      setSignatureName("");

      // After a short pause, send driver back to the main Driver Portal
      setTimeout(() => {
        router.push("/driver");
      }, 1200);
    } catch (err: any) {
      console.error("Failed to submit pre-trip inspection", err);
      setError(
        err?.message ??
          "Failed to submit inspection. Please retry or contact admin.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!session) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <section className="card">
          <p className="text-sm text-slate-200/80">
            Loading your pre-trip inspection…
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      {/* Header */}
      <section className="card space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-300">
          Pre Trip Inspection
        </p>
        <h1 className="text-lg font-semibold text-slate-50">
          Pre Trip Inspection Checklist
        </h1>
        <p className="text-sm text-slate-300">
          Driver:{" "}
          <span className="font-semibold text-slate-100">
            {session.driverName.trim()}
          </span>
          {session.licenseNumber && (
            <>
              {" "}
              • License:{" "}
              <span className="font-semibold text-slate-100">
                {session.licenseNumber}
              </span>
            </>
          )}
        </p>
        {vehicle && (
          <>
            <p className="text-[11px] text-slate-400">
              Vehicle ID:{" "}
              <span className="font-semibold text-slate-100">
                {vehicle.label || "N/A"}
              </span>{" "}
              • Plate:{" "}
              <span className="font-semibold text-slate-100">
                {vehicle.plate || "N/A"}
              </span>
            </p>
            <p className="text-[11px] text-slate-400">
              Year/Make/Model:{" "}
              <span className="font-semibold text-slate-100">
                {vehicle.year ?? ""} {vehicle.make ?? ""}{" "}
                {vehicle.model ?? ""}
              </span>
            </p>
          </>
        )}
        {loadingVehicle && (
          <p className="text-[11px] text-slate-400">Loading vehicle...</p>
        )}
      </section>

      {/* Legend */}
      <section className="card space-y-2">
        <div className="flex flex-wrap gap-2 text-[11px]">
          <div className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded bg-emerald-600" />{" "}
            PASS
          </div>
          <div className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded bg-red-600" /> FAIL
          </div>
          <div className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded bg-slate-600" /> N/A
          </div>
        </div>
        <p className="text-[11px] text-slate-400">
          Complete this full checklist <span className="font-semibold">before</span>{" "}
          you start driving to clock in for the day.
        </p>
      </section>

      {/* Error / success messages */}
      {error && (
        <section className="card border border-red-500/60 bg-red-950/40">
          <p className="text-xs font-medium text-red-200">{error}</p>
        </section>
      )}

      {submitMessage && (
        <section className="card border-emerald-500/60 bg-emerald-900/20">
          <p className="text-xs font-medium text-emerald-100">
            {submitMessage}
          </p>
        </section>
      )}

      {/* Main form card */}
      <section className="card space-y-4">
        {/* Odometer */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
            Odometer (required)
          </label>
          <input
            type="text"
            value={odometer}
            onChange={(e) => setOdometer(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
            placeholder="Current odometer reading (e.g. 123456)"
          />
        </div>

        {/* Shift selector */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
            Shift
          </label>
          <div className="flex gap-2">
            {(["AM", "Midday", "PM"] as ShiftType[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setShift(s)}
                className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition active:scale-[0.96] ${
                  shift === s
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-900 text-slate-100 ring-1 ring-white/10 hover:bg-slate-800"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Checklist */}
        <div className="space-y-3">
          {Object.entries(groupedChecklist).map(
            ([category, itemsInCategory]) => (
              <div key={category} className="space-y-1.5">
                <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                  {category}
                </h3>
                <div className="space-y-1.5 rounded-xl bg-slate-950/40 p-2">
                  {itemsInCategory.map((item) => {
                    const value = answers[item.id];
                    return (
                      <div
                        key={item.id}
                        className="flex flex-col gap-2 rounded-lg border-b border-white/5 px-2 py-2 last:border-0 md:flex-row md:items-center md:justify-between md:gap-4 hover:bg-slate-900/40"
                      >
                        <p className="text-[13px] text-slate-100 md:flex-1 md:text-xs">
                          {item.label}
                        </p>
                        <div className="flex w-full gap-1.5 md:w-auto md:gap-1">
                          <AnswerButton
                            value="pass"
                            label="P"
                            selected={value === "pass"}
                            onClick={() => updateAnswer(item.id, "pass")}
                          />
                          <AnswerButton
                            value="fail"
                            label="F"
                            selected={value === "fail"}
                            onClick={() => updateAnswer(item.id, "fail")}
                          />
                          <AnswerButton
                            value="na"
                            label="N"
                            selected={value === "na"}
                            onClick={() => updateAnswer(item.id, "na")}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ),
          )}
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
            Notes / defects (if anything failed)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-[70px] w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
            placeholder="Describe any failed items, defects, or other notes."
          />
        </div>

        {/* Signature */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
            Signature (type your full name)
          </label>
          <input
            type="text"
            value={signatureName}
            onChange={(e) => setSignatureName(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
            placeholder="Type your name to certify this inspection"
          />
          <p className="text-[11px] text-slate-400">
            By typing your name you certify that you have completed this
            pre-trip inspection truthfully on today&apos;s date.
          </p>
        </div>

        {/* Submit button + hints */}
        <button
          type="button"
          onClick={handleSubmit}
          className={`btn-primary w-full text-sm ${
            !canSubmit ? "cursor-not-allowed opacity-50" : ""
          }`}
          disabled={!canSubmit}
        >
          {submitting ? "Submitting..." : "Submit pre-trip inspection"}
        </button>

        {!allAnswered && (
          <p className="mt-1 text-[11px] text-amber-300">
            Please select Pass, Fail, or N/A for every checklist item before
            submitting.
          </p>
        )}
        {!odometer.trim() && (
          <p className="mt-1 text-[11px] text-amber-300">
            Please enter the current odometer reading.
          </p>
        )}
        {!shift && (
          <p className="mt-1 text-[11px] text-amber-300">
            Please choose your shift (AM, Midday, or PM).
          </p>
        )}
        {!signatureName.trim() && (
          <p className="mt-1 text-[11px] text-amber-300">
            Type your name in the signature field to enable submission.
          </p>
        )}
      </section>

      {/* Back link */}
      <section className="card">
        <Link
          href="/driver"
          className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100 ring-1 ring-white/15 hover:bg-slate-800 active:scale-[0.97]"
        >
          ← Back to Driver Portal
        </Link>
      </section>
    </div>
  );
}

