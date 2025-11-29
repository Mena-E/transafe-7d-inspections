  "use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

type Driver = {
  id: string;
  full_name: string;
  license_number: string | null;
  is_active: boolean;
  pin: string | null;       // NEW
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

type InspectionType = "pre" | "post" | null;
type ShiftType = "AM" | "Midday" | "PM" | "";
type AnswerValue = "pass" | "fail" | "na";

type ChecklistItem = {
  id: string;
  label: string;
  category: string;
};

type AnswersState = Record<string, AnswerValue | null>;

type InspectionRecord = {
  id: string;
  driver_name: string;
  vehicle_label: string | null;
  inspection_type: "pre" | "post";
  shift: string | null;
  inspection_date: string;
  submitted_at: string;
  overall_status: string | null;
  answers: Record<string, string> | null;
  signature_name: string;
  driver_license_number: string | null;
  odometer_reading: string | null;
};

type TimeEntry = {
  id: string;
  work_date: string; // "YYYY-MM-DD"
  start_time: string;
  end_time: string | null;
  duration_seconds: number | null;
};

/**
 * Pre-trip checklist – based on the official RMV 7D form
 * (paraphrased to avoid quoting it verbatim).
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

/**
 * Post-trip checklist – based on the RMV 7D post-trip form (paraphrased).
 */
const POST_CHECKLIST: ChecklistItem[] = [
  {
    id: "seat_check",
    label: "Checked in, around and under every seat",
    category: "Interior & children check",
  },
  {
    id: "no_children",
    label:
      "Confirmed no sleeping or hiding children; child reminder system disengaged (if installed)",
    category: "Interior & children check",
  },
  {
    id: "items_left",
    label:
      "Verified no backpacks, clothing or other items left; inspected for rips in seats, trip hazards, broken seats",
    category: "Interior & children check",
  },
  {
    id: "walk_around",
    label: "Walked around exterior – checked for any irregularities",
    category: "Exterior walk-around",
  },
];

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
        {/* Short label (P / F / N) */}
        <span className="text-[11px] uppercase tracking-[0.18em]">
          {label}
        </span>
        {/* Full word for clarity */}
        <span className="text-xs md:text-sm">
          {value === "pass" ? "Pass" : value === "fail" ? "Fail" : "N/A"}
        </span>
      </div>
    </button>
  );
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

// Format seconds as HH:MM:SS (e.g. 03:12:05)
function formatDuration(totalSeconds: number): string {
  const secs = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  const seconds = secs % 60;

  const hh = hours.toString().padStart(2, "0");
  const mm = minutes.toString().padStart(2, "0");
  const ss = seconds.toString().padStart(2, "0");

  return `${hh}:${mm}:${ss}`;
}

function getTodayDateString() {
  const now = new Date();
  // Use local date; toISOString gives UTC, so we build manually
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeekStartDateString(): string {
  const now = new Date();
  const day = now.getDay(); // 0 (Sun) - 6 (Sat)
  // We want Monday as week start; treat Sunday as 6 days after previous Monday
  const diff = (day + 6) % 7; // 0 for Mon, 1 for Tue, ..., 6 for Sun
  const monday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - diff,
  );
  const year = monday.getFullYear();
  const month = `${monday.getMonth() + 1}`.padStart(2, "0");
  const date = `${monday.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${date}`;
}

export default function DriverPage() {
  const router = useRouter();
  const [driverName, setDriverName] = useState("");
  const [driverPin, setDriverPin] = useState("");
  const [currentDriver, setCurrentDriver] = useState<Driver | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");

  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [loadingDriverLookup, setLoadingDriverLookup] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isSessionReady, setIsSessionReady] = useState(false);
  const [selectedInspectionType, setSelectedInspectionType] =
    useState<InspectionType>(null);

  const [shift, setShift] = useState<ShiftType>("");
  const [odometer, setOdometer] = useState("");
  const [answers, setAnswers] = useState<AnswersState>({});
  const [notes, setNotes] = useState("");
  const [signatureName, setSignatureName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  const [history, setHistory] = useState<InspectionRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Restore previous driver session from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;

    const restoreSession = async () => {
      // 1) Preferred: new unified session key
      const stored = window.localStorage.getItem("transafeDriverSession");
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as {
            driverId: string;
            driverName: string;
            licenseNumber: string | null;
            vehicleId: string;
          };

          if (!parsed.driverId || !parsed.driverName) {
            return;
          }

         setCurrentDriver({
            id: parsed.driverId,
            full_name: parsed.driverName,
            license_number: parsed.licenseNumber,
            is_active: true,
            pin: null, // we don't know the PIN from localStorage; session is already established
            created_at: "",
          });


          setDriverName(parsed.driverName);
          if (parsed.vehicleId) {
            setSelectedVehicleId(parsed.vehicleId);
          }
          setIsSessionReady(true);
          return;
        } catch (err) {
          console.error(
            "Failed to restore driver session from transafeDriverSession",
            err,
          );
        }
      }

      // 2) Fallback: older keys
      const fallbackId = window.localStorage.getItem("transafeDriverId");
      const fallbackName = window.localStorage.getItem("transafeDriverName");

      if (!fallbackId && !fallbackName) {
        return;
      }

      try {
        let driver: Driver | null = null;

        if (fallbackId) {
          const { data, error } = await supabase
            .from("drivers")
            .select("*")
            .eq("id", fallbackId)
            .maybeSingle();

          if (!error) {
            driver = (data as Driver | null) ?? null;
          }
        }

        if (!driver && fallbackName) {
          const { data, error } = await supabase
            .from("drivers")
            .select("*")
            .ilike("full_name", fallbackName)
            .eq("is_active", true)
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();

          if (!error) {
            driver = (data as Driver | null) ?? null;
          }
        }

        if (!driver) return;

        setCurrentDriver(driver);
        setDriverName(driver.full_name);
        setIsSessionReady(true);

        const sessionPayload = {
          driverId: driver.id,
          driverName: driver.full_name,
          licenseNumber: driver.license_number,
          vehicleId: "",
        };
        window.localStorage.setItem(
          "transafeDriverSession",
          JSON.stringify(sessionPayload),
        );
      } catch (err) {
        console.error("Failed to restore driver session from legacy keys", err);
      }
    };

    void restoreSession();
  }, []);

    // ==== TIME TRACKING STATE ====
  const [clockBaseSeconds, setClockBaseSeconds] = useState(0); // completed time today
  const [activeSince, setActiveSince] = useState<Date | null>(null); // when current session started
  const [displaySeconds, setDisplaySeconds] = useState(0); // what we show

  // Prefill login form from the last used driver (even after logout)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isSessionReady) return;

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
  }, [isSessionReady, driverName, selectedVehicleId]);

  // Load active vehicles
  useEffect(() => {
    const loadVehicles = async () => {
      setLoadingVehicles(true);
      setError(null);
      try {
        const { data, error: vehError } = await supabase
          .from("vehicles")
          .select("*")
          .eq("is_active", true)
          .order("label", { ascending: true });

        if (vehError) throw vehError;
        setVehicles((data as Vehicle[]) || []);
      } catch (err: any) {
        console.error(err);
        setError(
          err?.message ??
            "Could not load vehicles. Please contact your supervisor.",
        );
      } finally {
        setLoadingVehicles(false);
      }
    };

    loadVehicles();
  }, []);

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedVehicleId),
    [vehicles, selectedVehicleId],
  );

  // Nicely formatted vehicle line
  const vehicleMainLine = useMemo(() => {
    if (!selectedVehicle) return "Unknown vehicle";
    const parts = [
      selectedVehicle.year ?? "",
      selectedVehicle.make ?? "",
      selectedVehicle.model ?? "",
    ]
      .map((p) => (p == null ? "" : String(p)))
      .join(" ")
      .trim();
    return parts || selectedVehicle.label;
  }, [selectedVehicle]);

  const currentChecklist: ChecklistItem[] =
    selectedInspectionType === "pre"
      ? PRE_CHECKLIST
      : selectedInspectionType === "post"
        ? POST_CHECKLIST
        : [];

  const groupedChecklist = useMemo(() => {
    const groups: Record<string, ChecklistItem[]> = {};
    for (const item of currentChecklist) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    }
    return groups;
  }, [currentChecklist]);

  async function fetchHistoryForDriver(name: string) {
    if (!name) return;
    setLoadingHistory(true);
    try {
      const since = new Date();
      since.setDate(since.getDate() - 90);

      const { data, error: histErr } = await supabase
        .from("inspections")
        .select("*")
        .eq("driver_name", name)
        .gte("submitted_at", since.toISOString())
        .order("submitted_at", { ascending: false });

      if (histErr) throw histErr;
      setHistory((data as InspectionRecord[]) || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  }

  // Load 90-day history after session is ready
  useEffect(() => {
    if (!isSessionReady || !driverName.trim()) return;
    fetchHistoryForDriver(currentDriver?.full_name ?? driverName.trim());
  }, [isSessionReady, driverName, currentDriver?.full_name]);

    const loadTimeForToday = async (driverId: string) => {
    const todayStr = getTodayDateString();

    try {
      const { data: todayData, error: todayErr } = await supabase
        .from("driver_time_entries")
        .select("id, work_date, start_time, end_time, duration_seconds")
        .eq("driver_id", driverId)
        .eq("work_date", todayStr)
        .order("start_time", { ascending: true });

      if (todayErr) throw todayErr;

      let baseSeconds = 0;
      let activeStart: Date | null = null;

      (todayData as TimeEntry[] | null)?.forEach((entry) => {
        if (entry.end_time) {
          const dur =
            entry.duration_seconds ??
            Math.max(
              0,
              Math.floor(
                (new Date(entry.end_time).getTime() -
                  new Date(entry.start_time).getTime()) /
                  1000,
              ),
            );
          baseSeconds += dur;
        } else {
          // open session
          activeStart = new Date(entry.start_time);
        }
      });

      setClockBaseSeconds(baseSeconds);
      setActiveSince(activeStart);
      setDisplaySeconds(baseSeconds);
    } catch (err: any) {
      console.error("Failed to load driver time summary", err);
    }
  };

  // When a driver session becomes ready, load today's and this week's time
    useEffect(() => {
    if (!isSessionReady || !currentDriver?.id) return;
    loadTimeForToday(currentDriver.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSessionReady, currentDriver?.id]);

  // Tick displaySeconds when we have an active session
  useEffect(() => {
    if (!activeSince) {
      setDisplaySeconds(clockBaseSeconds);
      return;
    }

    const startMs = activeSince.getTime();

    const update = () => {
      const nowMs = Date.now();
      const elapsed = Math.max(0, Math.floor((nowMs - startMs) / 1000));
      setDisplaySeconds(clockBaseSeconds + elapsed);
    };

    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [activeSince, clockBaseSeconds]);

  // ==== SESSION HANDLERS ====

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
  setSubmitMessage(null);
  setLoadingDriverLookup(true);

  try {
    const { data, error: drvErr } = await supabase
      .from("drivers")
      .select("*")
      .ilike("full_name", inputName)
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (drvErr) throw drvErr;

    if (!data || data.length === 0) {
      setError(
        "No active driver found with that name. Please contact your admin to register you.",
      );
      setLoadingDriverLookup(false);
      return;
    }

    const driver = data[0] as Driver;

    // NEW: enforce that this driver has a PIN set
    if (!driver.pin || driver.pin.trim() === "") {
      setError(
        "This driver does not have a PIN set yet. Please contact your admin.",
      );
      setLoadingDriverLookup(false);
      return;
    }

    // NEW: compare entered PIN with stored PIN
    if (driver.pin.trim() !== driverPin.trim()) {
      // generic error so attackers can't tell which field is wrong
      setError("Name, vehicle, or PIN is incorrect.");
      setLoadingDriverLookup(false);
      return;
    }

    setCurrentDriver(driver);

    // Persist session
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

    setIsSessionReady(true);
    setSelectedInspectionType(null);
    setShift("");
    setOdometer("");
    setAnswers({});
    setNotes("");
    setSignatureName("");
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

const handleLogout = () => {
  setIsSessionReady(false);
  setCurrentDriver(null);
  setDriverName("");
  setDriverPin("");       // NEW: clear PIN
  setSelectedVehicleId("");
  setSelectedInspectionType(null);
  setShift("");
  setOdometer("");
  setAnswers({});
  setNotes("");
  setSignatureName("");
  setSubmitMessage(null);
  setError(null);

  setClockBaseSeconds(0);
  setActiveSince(null);
  setDisplaySeconds(0);

  if (typeof window !== "undefined") {
    window.localStorage.removeItem("transafeDriverId");
    window.localStorage.removeItem("transafeDriverName");
    window.localStorage.removeItem("transafeDriverSession");
    // NOTE: we keep transafeRecentDriver on purpose to prefill next time
  }

  router.push("/");
};

  const updateAnswer = (itemId: string, value: AnswerValue) => {
    setAnswers((prev) => ({
      ...prev,
      [itemId]: value,
    }));
  };

  const allAnswered =
    currentChecklist.length > 0 &&
    currentChecklist.every((item) => !!answers[item.id]);

  const canSubmit =
    !!selectedInspectionType &&
    !!shift &&
    !!odometer.trim() &&
    !!signatureName.trim() &&
    allAnswered &&
    !submitting;

  // ==== TIME TRACKING HELPERS (start/stop work session) ====

  const startWorkSessionIfNeeded = async () => {
    if (!currentDriver) return;
    const todayStr = getTodayDateString();

    try {
      const { data: existing, error: existingErr } = await supabase
        .from("driver_time_entries")
        .select("id, start_time, end_time")
        .eq("driver_id", currentDriver.id)
        .eq("work_date", todayStr)
        .is("end_time", null)
        .maybeSingle();

      if (existingErr && existingErr.code !== "PGRST116") {
        throw existingErr;
      }

      if (existing && !existing.end_time) {
        setActiveSince(new Date(existing.start_time));
        return;
      }

      const now = new Date();
      const nowIso = now.toISOString();

      const { data: insertData, error: insertErr } = await supabase
        .from("driver_time_entries")
        .insert({
          driver_id: currentDriver.id,
          work_date: todayStr,
          start_time: nowIso,
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      const entry = insertData as TimeEntry;
      setActiveSince(new Date(entry.start_time));
    } catch (err: any) {
      console.error("Failed to start work session", err);
    }
  };

  const stopWorkSessionIfRunning = async () => {
    if (!currentDriver) return;
    const todayStr = getTodayDateString();

    try {
      const { data: openEntry, error: openErr } = await supabase
        .from("driver_time_entries")
        .select("id, start_time")
        .eq("driver_id", currentDriver.id)
        .eq("work_date", todayStr)
        .is("end_time", null)
        .order("start_time", { ascending: false })
        .limit(1)
        .single();

      if (openErr) {
        setActiveSince(null);
        return;
      }

      const entry = openEntry as TimeEntry;
      const now = new Date();
      const start = new Date(entry.start_time);
      const duration = Math.max(
        0,
        Math.floor((now.getTime() - start.getTime()) / 1000),
      );

      const { error: updateErr } = await supabase
        .from("driver_time_entries")
        .update({
          end_time: now.toISOString(),
          duration_seconds: duration,
        })
        .eq("id", entry.id);

      if (updateErr) throw updateErr;

      setClockBaseSeconds((prev) => prev + duration);
      setActiveSince(null);
    } catch (err: any) {
      console.error("Failed to stop work session", err);
    }
  };

  const handleSubmitInspection = async () => {
    if (!canSubmit || !selectedInspectionType || !selectedVehicle) return;

    setSubmitting(true);
    setSubmitMessage(null);
    setError(null);

    try {
      const answersPayload: Record<string, string> = {};
      for (const item of currentChecklist) {
        const val = answers[item.id];
        answersPayload[item.label] = val ?? "";
      }

      let overallStatus: string | null = null;
      const values = Object.values(answers) as (AnswerValue | null)[];
      if (values.includes("fail")) {
        overallStatus = "fail";
      } else if (values.includes("pass")) {
        overallStatus = "pass";
      } else {
        overallStatus = "unknown";
      }

      const { error: insertErr } = await supabase.from("inspections").insert({
        driver_id: currentDriver?.id ?? null,
        driver_name: currentDriver?.full_name ?? driverName.trim(),
        driver_license_number: currentDriver?.license_number ?? null,
        vehicle_id: selectedVehicle.id,
        vehicle_label: selectedVehicle.label,
        inspection_type: selectedInspectionType,
        shift,
        answers: answersPayload,
        overall_status: overallStatus,
        notes: notes || null,
        signature_name: signatureName.trim(),
        odometer_reading: odometer.trim(),
      });

      if (insertErr) throw insertErr;

      if (selectedInspectionType === "pre") {
        await startWorkSessionIfNeeded();
      } else if (selectedInspectionType === "post") {
        await stopWorkSessionIfRunning();
      }

      setSubmitMessage(
        "Inspection submitted successfully. Thank you for completing your daily check.",
      );

      fetchHistoryForDriver(currentDriver?.full_name ?? driverName.trim());

      setSelectedInspectionType(null);
      setShift("");
      setOdometer("");
      setAnswers({});
      setNotes("");
      setSignatureName("");
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Failed to submit inspection. Please retry.");
    } finally {
      setSubmitting(false);
    }
  };

// 1) Pre-session: enter name + PIN + select vehicle
if (!isSessionReady) {
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
            placeholder="4–6 digit PIN"
          />
          <p className="text-[11px] text-slate-400">
            This is your personal secret code. Do not share it with anyone.
          </p>
        </div>

        {/* Vehicle – disabled until PIN is entered */}
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
            !driverPin.trim() || // require PIN
            !selectedVehicleId ||
            loadingVehicles ||
            loadingDriverLookup
          }
        >
          {loadingDriverLookup
            ? "Checking driver…"
            : "Continue to driver dashboard"}
        </button>
      </section>
    </div>
  );
}

  // 2) Session ready – show inspection selection, form, and history
  return (
    <div className="space-y-5">
      {/* Header with clocks – mobile-first layout */}
           {/* Header with live clock – mobile-first layout */}
      <section className="card flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        {/* Driver + vehicle info */}
        <div className="space-y-1">
          <h1 className="mb-1 text-lg font-semibold md:text-xl">
            Driver Portal
          </h1>
          <p className="text-sm text-slate-200/80">
            Signed in as{" "}
            <span className="font-semibold text-emerald-200">
              {driverName.trim()}
            </span>
          </p>
          <p className="text-xs text-slate-300">
            License #: {currentDriver?.license_number ?? "N/A"}
          </p>
                     {selectedVehicle ? (
            <>
              <p className="mt-1 text-sm font-semibold text-emerald-200">
                Vehicle ID: {selectedVehicle.label}
              </p>
              <p className="text-xs font-medium text-slate-100">
                Plate: {selectedVehicle.plate || "N/A"}
              </p>
              {vehicleMainLine && (
                <p className="text-[11px] text-slate-400">
                  Year/Make/Model: {vehicleMainLine}
                </p>
              )}
            </>
          ) : (
            <p className="mt-1 text-sm font-medium text-slate-100">
              Vehicle: {vehicleMainLine}
            </p>
          )}

        </div>

        {/* Today clock + actions */}
        <div className="flex w-full flex-col items-center gap-3 md:w-auto md:items-end">
          <div className="rounded-2xl bg-slate-900 px-3 py-2 text-center md:text-right ring-1 ring-emerald-500/60">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
              Today&apos;s clock
            </p>
            <p className="font-mono text-lg font-semibold text-emerald-300">
              {formatDuration(displaySeconds)}
            </p>
          </div>

          <div className="flex w-full justify-start gap-2 md:justify-end">
            <Link
              href="/driver/time-log"
              className="btn-ghost flex-1 px-3 py-1 text-xs md:flex-none md:text-[11px]"
            >
              Time log
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="btn-ghost flex-1 px-3 py-1 text-xs md:flex-none md:text-[11px]"
            >
              Log out
            </button>
          </div>
        </div>
      </section>

      {/* Pre / Post selection */}
     <section className="space-y-3">
  {/* Instruction text above buttons */}
  <div className="space-y-1">
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
      Pre-trip to clock in; post-trip to clock out.
    </p>
    <p className="text-sm text-slate-200/90">
      Select <span className="font-semibold">Pre-trip</span> or{" "}
      <span className="font-semibold">Post-trip</span> below to do your
      daily inspection.
    </p>
  </div>

  {/* Buttons laid out side by side */}
  <div className="grid gap-4 sm:grid-cols-2">
    {/* PRE-TRIP CARD */}
    <button
      type="button"
      onClick={() => {
        setSelectedInspectionType("pre");
        setShift("");
        setOdometer("");
        setAnswers({});
        setNotes("");
        setSignatureName("");
        setSubmitMessage(null);
      }}
      className={`group relative flex h-full flex-col justify-between rounded-2xl border px-4 py-3 text-left shadow-sm transition active:scale-[0.97] ${
        selectedInspectionType === "pre"
          ? "border-emerald-500/80 bg-emerald-900/30 shadow-lg"
          : "border-white/10 bg-slate-950/60 hover:border-emerald-400/70 hover:bg-slate-900/80"
      }`}
    >
      <div className="space-y-1.5">
        <p className="inline-flex items-center rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
          Pre-trip
        </p>
        <h2 className="text-base font-semibold text-slate-50">
          Start your <span className="text-emerald-300">Pre-trip</span> inspection
        </h2>
        <p className="text-sm text-slate-300">
          Complete the full checklist before you start driving to start your route.
        </p>
      </div>
      <p className="mt-3 text-xs font-semibold text-emerald-300 group-hover:text-emerald-200">
        Tap to begin →
      </p>
    </button>

    {/* POST-TRIP CARD */}
    <button
      type="button"
      onClick={() => {
        setSelectedInspectionType("post");
        setShift("");
        setOdometer("");
        setAnswers({});
        setNotes("");
        setSignatureName("");
        setSubmitMessage(null);
      }}
      className={`group relative flex h-full flex-col justify-between rounded-2xl border px-4 py-3 text-left shadow-sm transition active:scale-[0.97] ${
        selectedInspectionType === "post"
          ? "border-emerald-500/80 bg-emerald-900/30 shadow-lg"
          : "border-white/10 bg-slate-950/60 hover:border-emerald-400/70 hover:bg-slate-900/80"
      }`}
    >
      <div className="space-y-1.5">
        <p className="inline-flex items-center rounded-full bg-slate-500/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200">
          Post-trip
        </p>
        <h2 className="text-base font-semibold text-slate-50">
          Start your <span className="text-emerald-300">Post-trip</span> inspection
        </h2>
        <p className="text-sm text-slate-300">
          Finish your route, check every seat and the exterior, then secure the vehicle.
        </p>
      </div>
      <p className="mt-3 text-xs font-semibold text-emerald-300 group-hover:text-emerald-200">
        Tap to begin →
      </p>
    </button>
  </div>
</section>

      {error && (
        <section className="card border border-red-500/50 bg-red-950/40">
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

      {/* Active inspection form */}
      <section className="card space-y-4">
        {selectedInspectionType === null ? (
          <p className="text-xs text-slate-300 sm:text-sm">
            Select <strong>Pre-trip</strong> or <strong>Post-trip</strong> to
            begin. The full checklist will appear here.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <h2 className="text-base font-semibold">
                  {selectedInspectionType === "pre"
                    ? "Pre-trip inspection checklist"
                    : "Post-trip inspection checklist"}
                </h2>
                <p className="text-[11px] text-slate-400">
                  Driver:{" "}
                  <span className="font-semibold text-slate-100">
                    {driverName.trim()}
                  </span>{" "}
                  • License:{" "}
                  <span className="font-semibold text-slate-100">
                    {currentDriver?.license_number ?? "N/A"}
                  </span>
                </p>
                  {selectedVehicle && (
                  <>
                    <p className="text-[11px] text-slate-400">
                      Vehicle ID:{" "}
                      <span className="font-semibold text-slate-100">
                        {selectedVehicle.label || "N/A"}
                      </span>{" "}
                      • Plate:{" "}
                      <span className="font-semibold text-slate-100">
                        {selectedVehicle.plate || "N/A"}
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Year/Make/Model:{" "}
                      <span className="font-semibold text-slate-100">
                        {selectedVehicle.year ?? ""}{" "}
                        {selectedVehicle.make ?? ""}{" "}
                        {selectedVehicle.model ?? ""}
                      </span>
                    </p>
                  </>
                )}

              </div>

              <div className="flex gap-2 text-[11px]">
                <div className="flex items-center gap-1">
                  <span className="inline-block h-3 w-3 rounded bg-emerald-600" />{" "}
                  PASS
                </div>
                <div className="flex items-center gap-1">
                  <span className="inline-block h-3 w-3 rounded bg-red-600" />{" "}
                  FAIL
                </div>
                <div className="flex items-center gap-1">
                  <span className="inline-block h-3 w-3 rounded bg-slate-600" />{" "}
                  N/A
                </div>
              </div>
            </div>

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
                            {/* Question Text */}
                            <p className="text-[13px] text-slate-100 md:flex-1 md:text-xs">
                              {item.label}
                            </p>

                            {/* Buttons: full-width row on mobile, compact on desktop */}
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
                By typing your name you certify that you have completed this{" "}
                {selectedInspectionType === "pre"
                  ? "pre-trip"
                  : "post-trip"}{" "}
                inspection truthfully on today&apos;s date.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSubmitInspection}
              className={`btn-primary w-full text-sm ${
                !canSubmit ? "cursor-not-allowed opacity-50" : ""
              }`}
              disabled={!canSubmit}
            >
              {submitting ? "Submitting..." : "Submit inspection"}
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
          </>
        )}
      </section>

      {/* 90-day history */}
      <section className="card space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">
            Last 90 days – your inspections
          </h2>
          <span className="text-[11px] text-slate-400">
            {loadingHistory
              ? "Loading…"
              : history.length === 0
                ? "No records"
                : `${history.length} record${
                    history.length === 1 ? "" : "s"
                  }`}
          </span>
        </div>

        {history.length === 0 && !loadingHistory ? (
          <p className="text-[11px] text-slate-400 sm:text-xs">
            Once you submit inspections, they will appear here for up to 90 days
            for audit purposes.
          </p>
        ) : (
          <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl bg-slate-950/40 p-2 text-xs">
            {history.map((rec) => (
              <div
                key={rec.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-slate-900/70 p-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-semibold text-slate-100">
                    {rec.inspection_type === "pre" ? "Pre-trip" : "Post-trip"} •{" "}
                    {formatDateTime(rec.submitted_at || rec.inspection_date)}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Shift: {rec.shift || "N/A"} • Status:{" "}
                    {rec.overall_status
                      ? rec.overall_status.toUpperCase()
                      : "N/A"}
                  </p>
                </div>
                <Link
                  href={`/inspection/${rec.id}?from=driver`}
                  className="btn-ghost shrink-0 px-3 py-1 text-[11px]"
                >
                  Open form
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
