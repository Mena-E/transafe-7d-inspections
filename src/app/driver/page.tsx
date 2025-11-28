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
    "flex-1 min-w-[80px] rounded-xl md:rounded-2xl border px-3 py-2 md:px-4 md:py-3 text-xs md:text-sm font-semibold text-center transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70";

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

  // Restore previous driver info from localStorage
  // - transafeDriverLastLogin: used to prefill the login form (survives logout)
  // - transafeDriverSession: used to auto-open the portal ONLY when explicitly
  //   returning from the Time Log page (flagged via sessionStorage).
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1) Prefill login from last login info (even after logout)
    const lastLoginRaw = window.localStorage.getItem("transafeDriverLastLogin");
    if (lastLoginRaw) {
      try {
        const last = JSON.parse(lastLoginRaw) as {
          driverName?: string;
          vehicleId?: string;
        };
        if (last.driverName) {
          setDriverName((prev) => prev || last.driverName!);
        }
        if (last.vehicleId) {
          setSelectedVehicleId((prev) => prev || last.vehicleId!);
        }
      } catch (err) {
        console.error("Failed to parse transafeDriverLastLogin", err);
      }
    }

    // 2) Optionally restore full session when coming back from Time Log
    const storedSession = window.localStorage.getItem("transafeDriverSession");
    if (!storedSession || isSessionReady) return;

    // We use a one-shot flag in sessionStorage set by the Time Log page
    const fromTimeLog =
      window.sessionStorage.getItem("transafeReturnFromTimeLog") === "1";

    if (!fromTimeLog) return;

    try {
      const parsed = JSON.parse(storedSession) as {
        driverId: string;
        driverName: string;
        licenseNumber: string | null;
        vehicleId: string;
      };

      if (!parsed.driverId || !parsed.driverName || !parsed.vehicleId) return;

      setCurrentDriver({
        id: parsed.driverId,
        full_name: parsed.driverName,
        license_number: parsed.licenseNumber,
        is_active: true,
        created_at: "",
      });
      setIsSessionReady(true);
    } catch (err) {
      console.error("Failed to restore driver session from localStorage", err);
    } finally {
      // Clear the flag so this only happens once per return
      window.sessionStorage.removeItem("transafeReturnFromTimeLog");
    }
  }, [isSessionReady]);

  // ==== TIME TRACKING STATE ====
  const [clockBaseSeconds, setClockBaseSeconds] = useState(0); // completed time today
  const [activeSince, setActiveSince] = useState<Date | null>(null); // when current session started
  const [displaySeconds, setDisplaySeconds] = useState(0); // what we show
  const [weekBaseSeconds, setWeekBaseSeconds] = useState(0); // weekly total excluding live ticking

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
      // silent fail for history
    } finally {
      setLoadingHistory(false);
    }
  }

  // Load 90-day history after session is ready
  useEffect(() => {
    if (!isSessionReady || !driverName.trim()) return;
    fetchHistoryForDriver(currentDriver?.full_name ?? driverName.trim());
  }, [isSessionReady, driverName]);

  // ==== TIME TRACKING: LOAD TODAY + WEEK ====

  const loadTimeForTodayAndWeek = async (driverId: string) => {
    const todayStr = getTodayDateString();
    const weekStartStr = getWeekStartDateString();

    try {
      // Today entries
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
      setDisplaySeconds(baseSeconds); // will be updated by effect if active

      // Weekly entries (Mon–Fri)
      // We use week start (Monday) and today as upper bound, which is enough
      const { data: weekData, error: weekErr } = await supabase
        .from("driver_time_entries")
        .select("duration_seconds, work_date, start_time, end_time")
        .eq("driver_id", driverId)
        .gte("work_date", weekStartStr)
        .lte("work_date", todayStr);

      if (weekErr) throw weekErr;

      let weekSeconds = 0;
      (weekData as TimeEntry[] | null)?.forEach((entry) => {
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
          weekSeconds += dur;
        }
      });

      setWeekBaseSeconds(weekSeconds);
    } catch (err: any) {
      console.error("Failed to load driver time summary", err);
      // don't show as fatal error; time tracking is secondary to inspections
    }
  };
    // When a driver session becomes ready, load today's and this week's time
  useEffect(() => {
    if (!isSessionReady || !currentDriver?.id) return;
    loadTimeForTodayAndWeek(currentDriver.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSessionReady, currentDriver?.id]);

  // Tick displaySeconds when we have an active session
  useEffect(() => {
    if (!activeSince) {
      // no active session; show just the base
      setDisplaySeconds(clockBaseSeconds);
      return;
    }

    const startMs = activeSince.getTime();

    const update = () => {
      const nowMs = Date.now();
      const elapsed = Math.max(0, Math.floor((nowMs - startMs) / 1000));
      setDisplaySeconds(clockBaseSeconds + elapsed);
    };

    update(); // initial
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [activeSince, clockBaseSeconds]);

  // Weekly display should include live ticking portion from today
  const weeklyDisplaySeconds = useMemo(() => {
    const liveTodayDelta = displaySeconds - clockBaseSeconds;
    return weekBaseSeconds + Math.max(0, liveTodayDelta);
  }, [weekBaseSeconds, displaySeconds, clockBaseSeconds]);

  // ==== SESSION HANDLERS ====

    const handleStartSession = async () => {
    // Normalize the name: trim and collapse multiple spaces
    const normalizeName = (name: string) =>
      name.trim().replace(/\s+/g, " ");

    const inputName = normalizeName(driverName);

    if (!inputName || !selectedVehicleId) {
      setError("Please enter your name and select a vehicle.");
      return;
    }

    setError(null);
    setSubmitMessage(null);
    setLoadingDriverLookup(true);

    try {
      const { data, error: drvErr } = await supabase
        .from("drivers")
        .select("*")
        // Case-insensitive match on full_name
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
      setCurrentDriver(driver);

      if (typeof window !== "undefined") {
        // Session payload: used for active session restoration (from time-log)
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

        // Simple keys used by the Time Log page
        window.localStorage.setItem("transafeDriverId", driver.id);
        window.localStorage.setItem("transafeDriverName", driver.full_name);

        // "Remember me" info: survives logout, only used to prefill login form
        const lastLoginPayload = {
          driverName: driver.full_name,
          vehicleId: selectedVehicleId,
        };
        window.localStorage.setItem(
          "transafeDriverLastLogin",
          JSON.stringify(lastLoginPayload),
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
    // Clear driver session state
    setIsSessionReady(false);
    setCurrentDriver(null);
    setDriverName("");
    setSelectedVehicleId("");
    setSelectedInspectionType(null);
    setShift("");
    setOdometer("");
    setAnswers({});
    setNotes("");
    setSignatureName("");
    setSubmitMessage(null);
    setError(null);

    // Reset time tracking state
    setClockBaseSeconds(0);
    setActiveSince(null);
    setDisplaySeconds(0);
    setWeekBaseSeconds(0);

    // Clear any persisted driver data so there is no silent auto-login
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("transafeDriverId");
      window.localStorage.removeItem("transafeDriverName");
      window.localStorage.removeItem("transafeDriverSession");
    }

    // 🚀 Send them back to the landing page
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
      // Check if there is already an open session for today
      const { data: existing, error: existingErr } = await supabase
        .from("driver_time_entries")
        .select("id, start_time, end_time")
        .eq("driver_id", currentDriver.id)
        .eq("work_date", todayStr)
        .is("end_time", null)
        .maybeSingle();

      if (existingErr && existingErr.code !== "PGRST116") {
        // PGRST116 = no rows; ignore
        throw existingErr;
      }

      if (existing && !existing.end_time) {
        // Session already running; just sync clock to this start_time
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
      // baseSeconds stays the same; ticking effect will add live time
    } catch (err: any) {
      console.error("Failed to start work session", err);
      // Don't block inspection submission because of time tracking
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
        // If no open session, just ignore
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

      // Update in-memory totals
      setClockBaseSeconds((prev) => prev + duration);
      setWeekBaseSeconds((prev) => prev + duration);
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

      // TIME TRACKING HOOK:
      // - Pre-trip: start / resume today's work clock
      // - Post-trip: stop work clock
      if (selectedInspectionType === "pre") {
        await startWorkSessionIfNeeded();
      } else if (selectedInspectionType === "post") {
        await stopWorkSessionIfRunning();
      }

      setSubmitMessage(
        "Inspection submitted successfully. Thank you for completing your daily check.",
      );

      // Refresh history using the canonical driver name
      fetchHistoryForDriver(currentDriver?.full_name ?? driverName.trim());

      // Reset form but keep session active and clock running / stopped as set above
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

  // 1) Pre-session: enter name + select vehicle
  if (!isSessionReady) {
    return (
      <div className="space-y-4">
        <section className="card">
          <h1 className="mb-2 text-xl font-semibold">Driver Portal</h1>
          <p className="text-sm text-slate-200/80">
            Please enter your name and select your assigned vehicle to begin
            your daily inspection.
          </p>
        </section>

        {error && (
          <section className="card border border-red-500/50 bg-red-950/40">
            <p className="text-xs font-medium text-red-200">{error}</p>
          </section>
        )}

        <section className="card space-y-4">
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

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-100">
              Assigned vehicle
            </label>
            <select
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
            >
              <option value="">
                {loadingVehicles ? "Loading vehicles..." : "Select a vehicle"}
              </option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400">
              If your vehicle is missing, ask your admin to add it in the Admin
              Portal.
            </p>
          </div>

          <button
            type="button"
            onClick={handleStartSession}
            className="btn-primary w-full"
            disabled={
              !driverName.trim() ||
              !selectedVehicleId ||
              loadingVehicles ||
              loadingDriverLookup
            }
          >
            {loadingDriverLookup
              ? "Checking driver…"
              : "Continue to inspection options"}
          </button>
        </section>
      </div>
    );
  }

  // 2) Session ready – show inspection selection, form, and history
  return (
    <div className="space-y-4">
      {/* Header with game clock */}
      <section className="card flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="mb-1 text-xl font-semibold">Driver Portal</h1>
          <p className="text-xs text-slate-200/80">
            Signed in as{" "}
            <span className="font-semibold text-emerald-200">
              {driverName.trim()}
            </span>
          </p>
          <p className="text-[11px] text-slate-300">
            License #: {currentDriver?.license_number ?? "N/A"}
          </p>
          <p className="mt-1 text-sm font-medium text-slate-100">
            Vehicle: {vehicleMainLine}
          </p>
          {selectedVehicle && (
            <p className="text-[11px] text-slate-300">
              Label: {selectedVehicle.label} • Plate:{" "}
              {selectedVehicle.plate || "N/A"}
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          {/* Game-style daily clock */}
          <div className="rounded-2xl bg-slate-900 px-3 py-1.5 text-right ring-1 ring-emerald-500/60">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
              Today&apos;s clock
            </p>
            <p className="font-mono text-lg font-semibold text-emerald-300">
              {formatDuration(displaySeconds)}
            </p>
          </div>

          {/* Weekly tally */}
          <div className="rounded-2xl bg-slate-900 px-3 py-1.5 text-right ring-1 ring-slate-600/70">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Week total (Mon–Fri)
            </p>
            <p className="font-mono text-sm font-semibold text-slate-100">
              {formatDuration(weeklyDisplaySeconds)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Future: Time log link (placeholder for now) */}
            <Link
              href="/driver/time-log"
              className="btn-ghost px-3 py-1 text-[11px]"
            >
              Time log
            </Link>
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

      <section className="grid gap-4 sm:grid-cols-2">
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
          className={`card text-left transition ${
            selectedInspectionType === "pre" ? "ring-2 ring-emerald-500" : ""
          }`}
        >
          <h2 className="mb-1 text-base font-semibold">
            Start <span className="text-emerald-300">Pre-trip</span> inspection
          </h2>
          <p className="text-sm text-slate-200/80">
            Complete the full pre-trip checklist before you leave your first
            pickup or the school.
          </p>
        </button>

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
          className={`card text-left transition ${
            selectedInspectionType === "post" ? "ring-2 ring-emerald-500" : ""
          }`}
        >
          <h2 className="mb-1 text-base font-semibold">
            Start <span className="text-emerald-300">Post-trip</span> inspection
          </h2>
          <p className="text-sm text-slate-200/80">
            Complete the post-trip checklist after you finish your last drop and
            secure the vehicle.
          </p>
        </button>
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
          <p className="text-xs text-slate-300">
            Select <strong>Pre-trip</strong> or <strong>Post-trip</strong> to
            begin. The full checklist will appear here.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
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
                  <p className="text-[11px] text-slate-400">
                    Vehicle:{" "}
                    <span className="font-semibold text-slate-100">
                      {selectedVehicle.year ?? ""}{" "}
                      {selectedVehicle.make ?? ""}{" "}
                      {selectedVehicle.model ?? ""}
                    </span>{" "}
                    (Label: {selectedVehicle.label || "N/A"}, Plate:{" "}
                    {selectedVehicle.plate || "N/A"})
                  </p>
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
                  <div key={category} className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                      {category}
                    </h3>
                    <div className="space-y-2 rounded-xl bg-slate-950/40 p-2">
                      {itemsInCategory.map((item) => {
                        const value = answers[item.id];
                        return (
                          <div
                            key={item.id}
                            className="flex flex-col gap-3 rounded-lg border-b border-white/5 px-2 py-3 last:border-0 md:flex-row md:items-center md:justify-between md:gap-4 md:border-none md:py-2 hover:bg-slate-900/40"
                          >
                            {/* Question Text: Larger and bold on mobile for readability */}
                            <p className="text-sm font-medium text-slate-100 md:flex-1 md:text-xs md:font-normal">
                              {item.label}
                            </p>

                            {/* Buttons: Full width row on mobile, compact on desktop */}
                            <div className="flex w-full gap-2 md:w-auto md:gap-1">
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
                !canSubmit ? "opacity-50 cursor-not-allowed" : ""
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
          <p className="text-[11px] text-slate-400">
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
                <div>
                  <p className="font-semibold text-slate-100">
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
                  href={`/inspection/${rec.id}`}
                  className="btn-ghost text-[11px]"
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

