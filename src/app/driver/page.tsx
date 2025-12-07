"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

// ==== TYPES ====

type Driver = {
  id: string;
  full_name: string;
  license_number: string | null;
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

type InspectionType = "pre" | "post" | null;
type ShiftType = "AM" | "Midday" | "PM" | "";
type AnswerValue = "pass" | "fail" | "na";

type ChecklistItem = {
  id: string;
  label: string;
  category: string;
};

type AnswersState = Record<string, AnswerValue | null>;

type TimeEntry = {
  id: string;
  work_date: string; // "YYYY-MM-DD"
  start_time: string;
  end_time: string | null;
  duration_seconds: number | null;
};

// ==== TODAY'S ROUTES TYPES ====

type DriverRouteSummary = {
  id: string;
  name: string;
  direction: "AM" | "MIDDAY" | "PM";
  is_active: boolean;
  effective_start_date: string | null;
  effective_end_date: string | null;
};

type RouteStopForDriver = {
  id: string;
  route_id: string;
  sequence: number;
  address: string | null;
  planned_time: string | null;

  // NEW fields we’re actually using in the UI
  stop_type:
    | "pickup_home"
    | "dropoff_home"
    | "pickup_school"
    | "dropoff_school"
    | "other";

  student_name: string | null;
  primary_guardian_name: string | null;
  primary_guardian_phone: string | null;

  // school fields (you said DB columns are name + phone)
  name: string | null;  // school name
  phone: string | null; // school phone
};


/**
 * Pre-trip checklist – based on the official RMV 7D form (paraphrased).
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
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Decide whether this stop is "Pick up" or "Drop off"
function getStopAction(
  direction: "AM" | "MIDDAY" | "PM",
  isSchoolStop: boolean,
): "Pick up" | "Drop off" {
  if (direction === "AM") {
    // Morning: homes = pick up, school = drop off
    return isSchoolStop ? "Drop off" : "Pick up";
  } 
  if (direction === "MIDDAY"){
    // Midday: school = pick up, homes = drop off
    return isSchoolStop ? "Pick up" : "Drop off";
  }
  else {
    // Afternoon: school = pick up, homes = drop off
    return isSchoolStop ? "Pick up" : "Drop off";
  }
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

  // ==== TIME TRACKING STATE ====
  const [clockBaseSeconds, setClockBaseSeconds] = useState(0);
  const [activeSince, setActiveSince] = useState<Date | null>(null);
  const [displaySeconds, setDisplaySeconds] = useState(0);

  // ==== TODAY'S ROUTES STATE ====
  const [todayRoutesLoading, setTodayRoutesLoading] = useState(false);
  const [todayRoutesError, setTodayRoutesError] = useState<string | null>(null);
  const [todayRoutes, setTodayRoutes] = useState<DriverRouteSummary[]>([]);
  const [todayRouteStops, setTodayRouteStops] = useState<
    Record<string, RouteStopForDriver[]>
  >({});

  const [completingRouteId, setCompletingRouteId] = useState<string | null>(null);

  // Restore previous driver session from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;

    const restoreSession = async () => {
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
            pin: null,
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

// ==== LOAD TODAY'S ROUTES FOR THIS DRIVER ====
const loadTodayRoutes = async (driverId: string) => {
  setTodayRoutesLoading(true);
  setTodayRoutesError(null);

  try {
    const todayStr = getTodayDateString();

    // Use LOCAL time for today's date and day-of-week
    // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const today = new Date();
    const todayDow = today.getDay();

    // 1) Load ONLY assignments for THIS driver AND THIS day_of_week
    const { data: assignmentData, error: assignmentErr } = await supabase
      .from("driver_route_assignments")
      .select("id, route_id, day_of_week, is_active")
      .eq("driver_id", driverId)
      .eq("is_active", true)
      .eq("day_of_week", todayDow);

    if (assignmentErr) throw assignmentErr;

    const assignments = (assignmentData || []) as any[];

    // 2) If NO assignments for today's day_of_week, then "Today's routes" should be empty
    if (!assignments || assignments.length === 0) {
      setTodayRoutes([]);
      setTodayRouteStops({});
      return;
    }

    // 3) Collect the set of route IDs from today's assignments
    const routeIds = Array.from(
      new Set(
        assignments
          .map((row: any) => row.route_id)
          .filter((id: string | null) => !!id),
      ),
    ) as string[];

    if (routeIds.length === 0) {
      setTodayRoutes([]);
      setTodayRouteStops({});
      return;
    }

    // 4) Load routes + raw stops
    const [
      { data: routesData, error: routesErr },
      { data: stopsData, error: stopsErr },
      { data: completionsData, error: completionsErr },
    ] = await Promise.all([
      supabase
        .from("routes")
        .select(
          "id, name, direction, is_active, effective_start_date, effective_end_date",
        )
        .in("id", routeIds),
      supabase
        .from("route_stops")
        .select(
          "id, route_id, sequence, address, planned_time, stop_type, student_id, school_id",
        )
        .in("route_id", routeIds)
        .order("sequence", { ascending: true }),
      supabase
        .from("driver_route_completions")
        .select("route_id")
        .eq("driver_id", driverId)
        .eq("work_date", todayStr)
        .in("route_id", routeIds),
    ]);

    if (routesErr) throw routesErr;
    if (stopsErr) throw stopsErr;
    if (completionsErr) throw completionsErr;

    // Completed routes for today for this driver
    const completedRouteIdsToday = new Set(
      ((completionsData || []) as any[]).map((row: any) => row.route_id),
    );

    // 5) Collect student_ids and school_ids from these stops
    const studentIdsSet = new Set<string>();
    const schoolIdsSet = new Set<string>();

    (stopsData || []).forEach((row: any) => {
      if (row.student_id) {
        studentIdsSet.add(row.student_id as string);
      }
      if (row.school_id) {
        schoolIdsSet.add(row.school_id as string);
      }
    });

    const studentIds = Array.from(studentIdsSet);

    const studentsById = new Map<
      string,
      {
        id: string;
        full_name: string | null;
        primary_guardian_name: string | null;
        primary_guardian_phone: string | null;
        pickup_address: string | null;
        pickup_city: string | null;
        pickup_state: string | null;
        pickup_zip: string | null;
        school_id: string | null;
      }
    >();

    const schoolsById = new Map<
      string,
      {
        name: string | null;
        phone: string | null;
        address: string | null;
      }
    >();

    // 5a) Load students
    if (studentIds.length > 0) {
      const { data: studentsData, error: studentsErr } = await supabase
        .from("students")
        .select(
          "id, full_name, primary_guardian_name, primary_guardian_phone, pickup_address, pickup_city, pickup_state, pickup_zip, school_id",
        )
        .in("id", studentIds);

      if (studentsErr) throw studentsErr;

      (studentsData || []).forEach((st: any) => {
        studentsById.set(st.id, {
          id: st.id,
          full_name: st.full_name ?? null,
          primary_guardian_name: st.primary_guardian_name ?? null,
          primary_guardian_phone: st.primary_guardian_phone ?? null,
          pickup_address: st.pickup_address ?? null,
          pickup_city: st.pickup_city ?? null,
          pickup_state: st.pickup_state ?? null,
          pickup_zip: st.pickup_zip ?? null,
          school_id: st.school_id ?? null,
        });

        if (st.school_id) {
          schoolIdsSet.add(st.school_id as string);
        }
      });
    }

    // 5b) Load schools
    const schoolIdArray = Array.from(schoolIdsSet);
    if (schoolIdArray.length > 0) {
      const { data: schoolsData, error: schoolsErr } = await supabase
        .from("schools")
        .select("id, name, phone, address")
        .in("id", schoolIdArray);

      if (schoolsErr) throw schoolsErr;

      (schoolsData || []).forEach((sc: any) => {
        schoolsById.set(sc.id, {
          name: sc.name ?? null,
          phone: sc.phone ?? null,
          address: sc.address ?? null,
        });
      });
    }

    // 6) Filter routes that are active today and NOT marked complete
    const filteredRoutes = (routesData || []).filter((r: any) => {
      const startOk =
        !r.effective_start_date ||
        new Date(r.effective_start_date) <= today;
      const endOk =
        !r.effective_end_date || new Date(r.effective_end_date) >= today;
      const isCompleted = completedRouteIdsToday.has(r.id);
      return startOk && endOk && r.is_active && !isCompleted;
    }) as any[];

    if (filteredRoutes.length === 0) {
      setTodayRoutes([]);
      setTodayRouteStops({});
      return;
    }

    const activeRouteIds = new Set(filteredRoutes.map((r: any) => r.id));

    // 7) Build stops map only for active, non-completed routes
    const stopsMap: Record<string, RouteStopForDriver[]> = {};

    (stopsData || []).forEach((row: any) => {
      if (!activeRouteIds.has(row.route_id)) return;

      const stopTypeRaw =
        (row.stop_type as RouteStopForDriver["stop_type"]) || "other";

      const isHomeStop =
        stopTypeRaw === "pickup_home" || stopTypeRaw === "dropoff_home";
      const isSchoolStop =
        stopTypeRaw === "pickup_school" || stopTypeRaw === "dropoff_school";

      const student =
        row.student_id && studentsById.size > 0
          ? studentsById.get(row.student_id)
          : null;

      let school =
        row.school_id && schoolsById.size > 0
          ? schoolsById.get(row.school_id)
          : null;

      if (!school && student?.school_id && schoolsById.size > 0) {
        const fromStudent = schoolsById.get(student.school_id);
        if (fromStudent) {
          school = fromStudent;
        }
      }

      let effectiveAddress: string | null = row.address ?? null;

      if (isHomeStop && student) {
        const parts: string[] = [];

        if (student.pickup_address && student.pickup_address.trim()) {
          parts.push(student.pickup_address.trim());
        }
        if (student.pickup_city && student.pickup_city.trim()) {
          parts.push(student.pickup_city.trim());
        }

        const stateZipParts: string[] = [];
        if (student.pickup_state && student.pickup_state.trim()) {
          stateZipParts.push(student.pickup_state.trim());
        }
        if (student.pickup_zip && student.pickup_zip.trim()) {
          stateZipParts.push(student.pickup_zip.trim());
        }
        if (stateZipParts.length > 0) {
          parts.push(stateZipParts.join(" "));
        }

        const fullAddress = parts.join(", ");
        if (fullAddress) {
          effectiveAddress = fullAddress;
        }
      } else if (isSchoolStop && school?.address) {
        effectiveAddress = school.address;
      }

      const stop: RouteStopForDriver = {
        id: row.id,
        route_id: row.route_id,
        sequence: row.sequence,
        address: effectiveAddress,
        planned_time: row.planned_time,
        stop_type: stopTypeRaw,
        student_name: student?.full_name ?? null,
        primary_guardian_name: student?.primary_guardian_name ?? null,
        primary_guardian_phone: student?.primary_guardian_phone ?? null,
        name: school?.name ?? null,
        phone: school?.phone ?? null,
      };

      if (!stopsMap[row.route_id]) {
        stopsMap[row.route_id] = [];
      }

      stopsMap[row.route_id].push(stop);
    });

    setTodayRoutes(
      filteredRoutes.map((r: any) => ({
        id: r.id,
        name: r.name,
        direction: r.direction,
        is_active: r.is_active,
        effective_start_date: r.effective_start_date,
        effective_end_date: r.effective_end_date,
      })),
    );
    setTodayRouteStops(stopsMap);
  } catch (err: any) {
    console.error("Failed to load today's routes for driver", err);
    setTodayRoutesError(
      err?.message ??
        "Failed to load today's routes. Please contact admin.",
    );
  } finally {
    setTodayRoutesLoading(false);
  }
};

  // When a driver session becomes ready, load today's time and today's routes
  useEffect(() => {
    if (!isSessionReady || !currentDriver?.id) return;
    loadTimeForToday(currentDriver.id);
    loadTodayRoutes(currentDriver.id);
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

      if (!driver.pin || driver.pin.trim() === "") {
        setError(
          "This driver does not have a PIN set yet. Please contact your admin.",
        );
        setLoadingDriverLookup(false);
        return;
      }

      if (driver.pin.trim() !== driverPin.trim()) {
        setError("Name, vehicle, or PIN is incorrect.");
        setLoadingDriverLookup(false);
        return;
      }

      setCurrentDriver(driver);

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
    setDriverPin("");
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
      // keep transafeRecentDriver on purpose
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

  // ==== TIME TRACKING HELPERS ====
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

    const handleMarkRouteComplete = async (routeId: string) => {
    if (!currentDriver) return;

    // Ask the driver to confirm before marking the route as complete
    const confirmed = window.confirm(
      "Are you sure you want to mark this route as COMPLETE for today? Once confirmed, it will disappear from today's list on this device."
    );

    if (!confirmed) {
      // Driver changed their mind – do nothing.
      return;
    }

    const todayStr = getTodayDateString();
    setCompletingRouteId(routeId);

    try {
      const { error: insertErr } = await supabase
        .from("driver_route_completions")
        .upsert(
          {
            driver_id: currentDriver.id,
            route_id: routeId,
            work_date: todayStr,
          },
          {
            onConflict: "driver_id,route_id,work_date",
          },
        );

      if (insertErr) throw insertErr;

      // Optimistically remove this route from today's list
      setTodayRoutes((prev) => prev.filter((r) => r.id !== routeId));
      setTodayRouteStops((prev) => {
        const copy = { ...prev };
        delete copy[routeId];
        return copy;
      });
    } catch (err) {
      console.error("Failed to mark route as complete", err);
      setTodayRoutesError(
        "Could not mark route as complete. Please try again or contact admin.",
      );
    } finally {
      setCompletingRouteId(null);
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

  // 1) Pre-session screen
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
              ? "Checking driver…"
              : "Continue to driver dashboard"}
          </button>
        </section>
      </div>
    );
  }

  // 2) Session ready – main driver view
  return (
          <div className="space-y-5">
        {/* Header with live clock */}
        <section className="card flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
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

          <div className="flex w-full flex-col gap-2 md:w-auto md:items-end">
            <div className="w-full rounded-2xl bg-slate-900 px-3 py-2 text-center md:text-right ring-1 ring-emerald-500/60">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                Today&apos;s hours
              </p>
              <p className="font-mono text-lg font-semibold text-emerald-300">
                {formatDuration(displaySeconds)}
              </p>
            </div>
                {/* Footer logout - bottom of driver portal */}
          </div>
        </section>

            {/* Pre / Post selection – now two stacked full-width tabs */}
      <section className="card space-y-3">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Inspections
          </p>
          <p className="text-sm text-slate-200/90">
            Choose{" "}
            <span className="font-semibold">Pre Trip</span> to start your shift,
            and{" "}
            <span className="font-semibold">Post Trip</span> to close it out.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {/* Pre Trip – green tab */}
          <Link
            href="/driver/pre-trip"
            className="block w-full rounded-2xl bg-emerald-600 px-4 py-3 text-center text-sm font-semibold text-slate-950 shadow-md ring-1 ring-emerald-400/70 hover:bg-emerald-500 hover:ring-emerald-300 active:scale-[0.97] sm:text-base"
          >
            Pre Trip Inspection
          </Link>

          {/* Post Trip – navy tab */}
          <Link
            href="/driver/post-trip"
            className="block w-full rounded-2xl bg-slate-800 px-4 py-3 text-center text-sm font-semibold text-slate-50 shadow-md ring-1 ring-slate-500/70 hover:bg-slate-700 hover:ring-slate-400 active:scale-[0.97] sm:text-base"
          >
            Post Trip Inspection
          </Link>
        </div>

        <p className="text-[11px] leading-snug text-slate-400">
          Tapping a tab will open the full checklist on its own page. Your time
          clock remains linked to your inspections as before.
        </p>
      </section>

      {/* Quick nav */}
      <section className="card px-2 py-2">
        <nav className="grid grid-cols-3 gap-2 text-xs sm:text-sm">
          <Link
            href="/driver/time-log"
            className="flex items-center justify-center rounded-xl bg-slate-900 px-3 py-2 font-semibold text-slate-100 ring-1 ring-white/10 hover:bg-slate-800 active:scale-[0.97]"
          >
            Time Log
          </Link>
          <Link
            href="/driver/inspections"
            className="flex items-center justify-center rounded-xl bg-slate-900 px-3 py-2 font-semibold text-slate-100 ring-1 ring-white/10 hover:bg-slate-800 active:scale-[0.97]"
          >
            Inspections History
          </Link>
          <Link
            href="/driver/help"
            className="flex items-center justify-center rounded-xl bg-slate-900 px-3 py-2 font-semibold text-slate-100 ring-1 ring-white/10 hover:bg-slate-800 active:scale-[0.97]"
          >
            Help
          </Link>
        </nav>
      </section>

      {/* === TODAY'S ROUTES SECTION === */}
      <section className="card space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold uppercase tracking-[0.16em] text-slate-200">
              Today&apos;s routes
            </h2>
            <p className="text-xs text-slate-300">
              Based on your weekly route assignments for today.
            </p>
          </div>
          {todayRoutesLoading && (
            <p className="text-xs text-slate-300">Loading…</p>
          )}
        </div>

        {todayRoutesError && (
          <p className="text-sm font-medium text-rose-300">
            {todayRoutesError}
          </p>
        )}

        {!todayRoutesLoading &&
          !todayRoutesError &&
          todayRoutes.length === 0 && (
            <p className="text-sm text-slate-200">
              You have no active routes assigned for today.
            </p>
          )}

        {todayRoutes.length > 0 && (
          <div className="space-y-4">
            {todayRoutes.map((route) => {
              const stops = todayRouteStops[route.id] || [];

              return (
                <div
                  key={route.id}
                  className="rounded-2xl border border-white/10 bg-slate-950/80 p-4 space-y-4"
                >
                  {/* Header */}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {route.direction === "AM"
                          ? "Morning route"
                          : route.direction === "MIDDAY"
                          ? "Midday route"
                          : "Afternoon route"}
                      </p>
                      <h3 className="text-lg font-semibold text-slate-50">
                        {route.name}
                      </h3>
                    </div>
                    <div className="text-xs text-slate-300 text-right">
                      {route.effective_start_date && (
                        <span>
                          Starts:{" "}
                          <span className="font-medium text-slate-100">
                            {route.effective_start_date}
                          </span>
                        </span>
                      )}
                      {route.effective_end_date && (
                        <span>
                          {" "}
                          • Ends:{" "}
                          <span className="font-medium text-slate-100">
                            {route.effective_end_date}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Subtle divider */}
                  <div className="border-t border-white/10" />

                  {/* Stops list */}
                  {stops.length === 0 ? (
                    <p className="mt-1 text-sm text-slate-300">
                      No stops have been added to this route yet. Contact the
                      office if this looks wrong.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {stops.map((stop) => {
                        // Determine home vs school based on stop_type
                        const isHomeStop =
                          stop.stop_type === "pickup_home" ||
                          stop.stop_type === "dropoff_home";

                        const isSchoolStop =
                          stop.stop_type === "pickup_school" ||
                          stop.stop_type === "dropoff_school";

                        // Decide Pick up vs Drop off strictly from stop_type
                        let actionLabel = "Stop";
                        if (
                          stop.stop_type === "pickup_home" ||
                          stop.stop_type === "pickup_school"
                        ) {
                          actionLabel = "Pick up";
                        } else if (
                          stop.stop_type === "dropoff_home" ||
                          stop.stop_type === "dropoff_school"
                        ) {
                          actionLabel = "Drop off";
                        }

                        // Student name to show after the action
                        const studentLabel =
                          stop.student_name || "student";

                        // Contacts logic – home stops: guardian; school stops: school
                        const canCallGuardian =
                          isHomeStop &&
                          !!stop.primary_guardian_name &&
                          !!stop.primary_guardian_phone;

                        const canCallSchool =
                          isSchoolStop && !!stop.name && !!stop.phone;

                        return (
                          <div
                            key={stop.id}
                            className="flex items-start gap-3 rounded-2xl bg-slate-900/90 px-3 py-3"
                          >
                            {/* Sequence number */}
                            <span className="mt-1 w-7 text-sm font-semibold text-slate-400">
                              {stop.sequence}.
                            </span>

                            {/* Main stop content */}
                            <div className="flex-1 space-y-1.5">
                              {/* Planned time – first line, more prominent */}
                              {stop.planned_time && (
                                <p className="inline-flex items-center rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200">
                                  Planned:{" "}
                                  <span className="ml-2 text-sm font-bold tracking-normal text-emerald-100">
                                    {stop.planned_time}
                                  </span>
                                </p>
                              )}

                              {/* Action + student name */}
                              <p className="text-base font-semibold text-slate-50">
                                {actionLabel} {studentLabel}
                              </p>

                              {/* Address */}
                              <p className="text-sm text-slate-200">
                                {stop.address || "Address not set"}
                              </p>

                              {/* For school stops, also show the school name clearly */}
                              {isSchoolStop && stop.name && (
                                <p className="text-sm text-slate-300">
                                  School:{" "}
                                  <span className="font-medium text-slate-100">
                                    {stop.name}
                                  </span>
                                </p>
                              )}

                              {/* Navigation buttons */}
                              {stop.address && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      // Open this stop in Google Maps
                                      const dest = encodeURIComponent(
                                        stop.address as string,
                                      );
                                      window.location.href = `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
                                    }}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/70 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 active:scale-[0.97]"
                                  >
                                    {/* Simple map pin icon */}
                                    <svg
                                      aria-hidden="true"
                                      className="h-4 w-4"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <path
                                        d="M12 2.75C8.824 2.75 6.25 5.324 6.25 8.5C6.25 12.438 10.06 16.41 11.52 17.84C11.79 18.11 12.21 18.11 12.48 17.84C13.94 16.41 17.75 12.438 17.75 8.5C17.75 5.324 15.176 2.75 12 2.75Z"
                                        stroke="currentColor"
                                        strokeWidth="1.6"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                      <circle
                                        cx="12"
                                        cy="8.5"
                                        r="2.25"
                                        stroke="currentColor"
                                        strokeWidth="1.6"
                                      />
                                    </svg>
                                    <span className="text-sm">Maps</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      // Open this stop in Waze
                                      const dest = encodeURIComponent(
                                        stop.address as string,
                                      );
                                      // Waze universal link – will open the app if installed, or website otherwise
                                      window.location.href = `https://waze.com/ul?q=${dest}&navigate=yes`;
                                    }}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/70 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-200 active:scale-[0.97]"
                                  >
                                    {/* Simple car/bubble icon */}
                                    <svg
                                      aria-hidden="true"
                                      className="h-4 w-4"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <path
                                        d="M4.5 14.5C4.5 11.462 6.962 9 10 9H14C17.038 9 19.5 11.462 19.5 14.5C19.5 16.985 17.485 19 15 19H14L12 21L10.5 19.75"
                                        stroke="currentColor"
                                        strokeWidth="1.6"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                      <circle
                                        cx="9.25"
                                        cy="14.5"
                                        r="1.5"
                                        fill="currentColor"
                                      />
                                      <circle
                                        cx="15"
                                        cy="14.5"
                                        r="1.5"
                                        fill="currentColor"
                                      />
                                    </svg>
                                    <span className="text-sm">Waze</span>
                                  </button>
                                </div>
                              )}
                              {/* Contacts – only show what's appropriate for this stop type */}
                              {(canCallGuardian || canCallSchool) && (
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  {canCallGuardian && (
                                    <a
                                      href={`tel:${stop.primary_guardian_phone}`}
                                      className="inline-flex items-center rounded-full border border-emerald-500/70 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 active:scale-[0.97]"
                                    >
                                      Call guardian:{" "}
                                      <span className="ml-1">
                                        {stop.primary_guardian_name}
                                      </span>
                                    </a>
                                  )}
                                  {canCallSchool && (
                                    <a
                                      href={`tel:${stop.phone}`}
                                      className="inline-flex items-center rounded-full border border-emerald-500/70 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 active:scale-[0.97]"
                                    >
                                      Call school:{" "}
                                      <span className="ml-1">
                                        {stop.name}
                                      </span>
                                    </a>
                                  )}
                                </div>
                              )}

                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Route complete button */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => handleMarkRouteComplete(route.id)}
                      disabled={
                        !!completingRouteId &&
                        completingRouteId === route.id
                      }
                      className={`w-full rounded-xl border px-4 py-2.5 text-sm font-semibold transition active:scale-[0.97] ${
                        completingRouteId === route.id
                          ? "cursor-wait border-emerald-500/60 bg-emerald-900/40 text-emerald-100"
                          : "border-emerald-500/40 bg-slate-900/60 text-emerald-200 hover:bg-emerald-500/10"
                      }`}
                    >
                      {completingRouteId === route.id
                        ? "Marking route as complete..."
                        : "Mark this route as complete for today"}
                    </button>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Once marked complete, this route will disappear from
                      today&apos;s list. You can still see overall route
                      details in the Admin Portal.
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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

            {/* Inspections info – now handled on separate pages */}
      <section className="card space-y-2">
        <h2 className="text-sm font-semibold text-slate-50">
          Daily inspections
        </h2>
        <p className="text-sm text-slate-300">
          Use the{" "}
          <span className="font-semibold text-emerald-300">
            Pre Trip Inspection
          </span>{" "}
          and{" "}
          <span className="font-semibold text-slate-200">
            Post Trip Inspection
          </span>{" "}
          buttons above to complete your daily checks. Your time clock will
          still start after a completed pre-trip and stop after a completed
          post-trip.
        </p>
        <p className="text-[11px] text-slate-400">
          If something looks wrong or you have trouble submitting an inspection,
          contact the Transafe office.
        </p>
      </section>

            {/* App sign-out footer */}
      <section className="mt-2 border-t border-slate-800 pt-3 text-[11px] text-slate-500">
        <button
          type="button"
          onClick={handleLogout}
          className="font-semibold text-slate-200 underline-offset-2 hover:underline"
        >
          Sign out of app
        </button>
        <p className="mt-1 leading-snug text-slate-500">
          This only signs you out of the Transafe app. It does not clock you
          out. Your work hours are tracked separately when you start and end
          your shifts.
        </p>
      </section>
    </div>
  );
}
