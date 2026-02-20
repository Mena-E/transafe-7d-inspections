"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type Direction = "AM" | "MIDDAY" | "PM";

type StopType =
  | "pickup_home"
  | "dropoff_home"
  | "pickup_school"
  | "dropoff_school"
  | "other";

type RouteRecord = {
  id: string;
  name: string;
  direction: Direction;
  school_id: string | null;
  effective_start_date: string | null;
  effective_end_date: string | null;
  rate_per_mile: number | null;
  estimated_round_trip_mileage: number | null;
  effective_daily_rate: number | null;
  is_active: boolean;
};

type SchoolOption = {
  id: string;
  name: string | null;
  address: string | null;
};

type StudentOption = {
  id: string;
  full_name: string;
  pickup_address: string | null;
  pickup_city: string | null;   // NEW
  pickup_state: string | null;  // NEW
  pickup_zip: string | null;    // NEW
  school_id: string | null;
};


type StopRecord = {
  id: string;
  sequence: number;
  stop_type: StopType;
  student_id: string | null;
  school_id: string | null;
  address: string | null;
  planned_time: string | null;
  notes: string | null;
  student_name: string | null;
  school_name: string | null;
};

type DriverOption = {
  id: string;
  full_name: string;
  is_active: boolean;
};

type VehicleOption = {
  id: string;
  label: string;
  is_active: boolean;
};

type AssignmentRow = {
  id: string | null;
  day_of_week: number; // 0 = Sun ... 6 = Sat
  driver_id: string | null;
  vehicle_id: string | null;
  is_active: boolean;
  notes: string | null;
};

const DIRECTION_OPTIONS: { value: Direction; label: string }[] = [
  { value: "AM", label: "AM (morning)" },
  { value: "MIDDAY", label: "MIDDAY (midday)" },
  { value: "PM", label: "PM (afternoon)" },
];

const STOP_TYPE_LABELS: Record<StopType, string> = {
  pickup_home: "Pickup – home",
  dropoff_home: "Dropoff – home",
  pickup_school: "Pickup – school",
  dropoff_school: "Dropoff – school",
  other: "Other",
};

const STOP_TYPES_BY_MODE: Record<"student" | "school" | "other", StopType[]> = {
  // Student stop = home stop (we only want home-type stop_types here)
  student: ["pickup_home", "dropoff_home"],
  // School stop = school stop (we only want school-type stop_types here)
  school: ["pickup_school", "dropoff_school"],
  // Other stop = generic
  other: ["other"],
};


const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseNumberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const n = Number(value.trim());
  if (Number.isNaN(n)) return null;
  return n;
}

export default function EditRoutePage() {
  const params = useParams();
  const routeId = (params?.id as string) ?? "";

  // -------- ROUTE META STATE --------
  const [route, setRoute] = useState<RouteRecord | null>(null);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);

  const [name, setName] = useState("");
  const [direction, setDirection] = useState<Direction | "">("");
  const [schoolId, setSchoolId] = useState<string>("");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [ratePerMile, setRatePerMile] = useState("");
  const [estimatedMileage, setEstimatedMileage] = useState("");
  const [dailyRate, setDailyRate] = useState("");

  const [isActive, setIsActive] = useState(true);

  // -------- STOPS STATE --------
  const [stops, setStops] = useState<StopRecord[]>([]);
  const [stopFormMode, setStopFormMode] = useState<"student" | "school" | "other">("student");
  const [newStopStudentId, setNewStopStudentId] = useState("");
  const [newStopSchoolId, setNewStopSchoolId] = useState("");
  const [newStopType, setNewStopType] = useState<StopType>("pickup_home");
  const [newStopAddress, setNewStopAddress] = useState("");
  const [newStopTime, setNewStopTime] = useState("");
  const [newStopNotes, setNewStopNotes] = useState("");

  // -------- ASSIGNMENTS STATE --------
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);

  // -------- UX STATE --------
  const [loading, setLoading] = useState(true);
  const [loadingStops, setLoadingStops] = useState(false);
  const [loadingAssignments, setLoadingAssignments] = useState(false);

  const [savingMeta, setSavingMeta] = useState(false);
  const [savingStops, setSavingStops] = useState(false);
  const [savingAssignments, setSavingAssignments] = useState(false);

  const [metaError, setMetaError] = useState<string | null>(null);
  const [stopsError, setStopsError] = useState<string | null>(null);
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null);

  // -------- LOAD EVERYTHING --------
  useEffect(() => {
    let isMounted = true;

    if (!routeId) {
      setMetaError("Missing route ID in URL.");
      setLoading(false);
      return () => {
        isMounted = false;
      };
    }

    async function loadAll() {
      setLoading(true);
      setLoadingStops(true);
      setLoadingAssignments(true);
      setMetaError(null);
      setStopsError(null);
      setAssignmentsError(null);

      try {
        const [
          routeRes,
          schoolsRes,
          studentsRes,
          stopsRes,
          driversRes,
          vehiclesRes,
          assignmentsRes,
        ] = await Promise.all([
          fetch(`/api/admin/routes?id=${routeId}`).then((r) => r.json()),
          fetch("/api/admin/schools").then((r) => r.json()),
          fetch("/api/admin/students").then((r) => r.json()),
          fetch(`/api/admin/route-stops?route_id=${routeId}`).then((r) => r.json()),
          fetch("/api/admin/drivers").then((r) => r.json()),
          fetch("/api/admin/vehicles").then((r) => r.json()),
          fetch(`/api/admin/route-assignments?route_id=${routeId}`).then((r) => r.json()),
        ]);

        // ----- ROUTE META -----
        if (routeRes.error) throw new Error(routeRes.error);
        const routeData = routeRes.route as RouteRecord;
        if (!isMounted) return;

        setRoute(routeData);
        setName(routeData.name ?? "");
        setDirection((routeData.direction as Direction) ?? "");
        setSchoolId(routeData.school_id ?? "");
        setStartDate(routeData.effective_start_date ?? "");
        setEndDate(routeData.effective_end_date ?? "");
        setRatePerMile(
          routeData.rate_per_mile != null ? String(routeData.rate_per_mile) : "",
        );
        setEstimatedMileage(
          routeData.estimated_round_trip_mileage != null
            ? String(routeData.estimated_round_trip_mileage)
            : "",
        );
        setDailyRate(
          routeData.effective_daily_rate != null
            ? String(routeData.effective_daily_rate)
            : "",
        );
        setIsActive(routeData.is_active);

        // ----- SCHOOLS & STUDENTS -----
        if (!schoolsRes.error && schoolsRes.schools) {
          setSchools(schoolsRes.schools as SchoolOption[]);
        }

        const studentsData = (studentsRes.students || []) as StudentOption[];
        setStudents(studentsData);

        const schoolNameMap = new Map<string, string>();
        (schoolsRes.schools || []).forEach((s: any) => {
          if (s.id) schoolNameMap.set(s.id, s.name || "Unnamed school");
        });

        const studentNameMap = new Map<string, string>();
        studentsData.forEach((st) => {
          studentNameMap.set(st.id, st.full_name);
        });

        // ----- STOPS -----
if (!stopsRes.error && stopsRes.stops) {
  const rawStops = stopsRes.stops as any[];

  // Fast lookup for schools (name + address)
  const schoolMap = new Map<string, SchoolOption>();
  (schoolsRes.schools || []).forEach((s: any) => {
    if (s.id) {
      schoolMap.set(s.id, s as SchoolOption);
      schoolNameMap.set(s.id, s.name || "Unnamed school");
    }
  });

  const mappedStops: StopRecord[] = rawStops
    .map((row) => {
      let effectiveAddress: string | null = row.address ?? null;

      const st = row.student_id
        ? studentsData.find((s) => s.id === row.student_id)
        : undefined;

      const stopType = (row.stop_type || "other") as StopType;

      // For HOME stops, use student's pickup address
      if (
        (stopType === "pickup_home" || stopType === "dropoff_home") &&
        st
      ) {
        const parts: string[] = [];

        if (st.pickup_address && st.pickup_address.trim()) {
          parts.push(st.pickup_address.trim());
        }
        if (st.pickup_city && st.pickup_city.trim()) {
          parts.push(st.pickup_city.trim());
        }

        const stateZipParts: string[] = [];
        if (st.pickup_state && st.pickup_state.trim()) {
          stateZipParts.push(st.pickup_state.trim());
        }
        if (st.pickup_zip && st.pickup_zip.trim()) {
          stateZipParts.push(st.pickup_zip.trim());
        }
        if (stateZipParts.length > 0) {
          parts.push(stateZipParts.join(" "));
        }

        const fullAddress = parts.join(", ");
        if (fullAddress) {
          effectiveAddress = fullAddress;
        }
      }

      // For SCHOOL stops, use the school's address
      if (
        (stopType === "pickup_school" || stopType === "dropoff_school")
      ) {
        const schoolIdForStop: string | null =
          row.school_id ?? (st?.school_id ?? null);

        if (schoolIdForStop) {
          const sc = schoolMap.get(schoolIdForStop);
          if (sc?.address && sc.address.trim()) {
            effectiveAddress = sc.address.trim();
          }
        }
      }

      return {
        id: row.id,
        sequence: row.sequence ?? 0,
        stop_type: stopType,
        student_id: row.student_id,
        school_id: row.school_id,
        address: effectiveAddress,
        planned_time: row.planned_time,
        notes: row.notes,
        student_name: row.student_id
          ? studentNameMap.get(row.student_id) || null
          : null,
        school_name: row.school_id
          ? schoolNameMap.get(row.school_id) || null
          : null,
      } as StopRecord;
    })
    .sort((a, b) => a.sequence - b.sequence);

  if (isMounted) setStops(mappedStops);
}

        // ----- DRIVERS & VEHICLES -----
        if (!driversRes.error && driversRes.drivers) {
          setDrivers(driversRes.drivers as DriverOption[]);
        }
        if (!vehiclesRes.error && vehiclesRes.vehicles) {
          setVehicles(vehiclesRes.vehicles as VehicleOption[]);
        }

        // ----- ASSIGNMENTS -----
        const baseAssignments: AssignmentRow[] = Array.from(
          { length: 7 },
          (_, day) => ({
            id: null,
            day_of_week: day,
            driver_id: null,
            vehicle_id: null,
            is_active: true,
            notes: "",
          }),
        );

        if (!assignmentsRes.error && assignmentsRes.assignments) {
          (assignmentsRes.assignments as any[]).forEach((row) => {
            const idx = baseAssignments.findIndex(
              (a) => a.day_of_week === row.day_of_week,
            );
            if (idx !== -1) {
              baseAssignments[idx] = {
                id: row.id,
                day_of_week: row.day_of_week,
                driver_id: row.driver_id,
                vehicle_id: row.vehicle_id,
                is_active: row.is_active ?? true,
                notes: row.notes ?? "",
              };
            }
          });
        }

        if (isMounted) setAssignments(baseAssignments);
      } catch (err: any) {
        console.error("Error loading route detail page:", err);
        if (isMounted) {
          setMetaError(err?.message ?? "Failed to load route.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
          setLoadingStops(false);
          setLoadingAssignments(false);
        }
      }
    }

    loadAll();

    return () => {
      isMounted = false;
    };
  }, [routeId]);

  // -------- META SAVE --------
  const handleSaveMeta = async (e: any) => {
    e.preventDefault();
    if (!route) return;

    if (!name.trim()) {
      setMetaError("Route name is required.");
      return;
    }
    if (!direction) {
      setMetaError("Direction (AM, MIDDAY, or PM) is required.");
      return;
    }

    setSavingMeta(true);
    setMetaError(null);

    try {
      const payload = {
        name: name.trim(),
        direction: direction as Direction,
        school_id: schoolId || null,
        effective_start_date: startDate || null,
        effective_end_date: endDate || null,
        rate_per_mile: parseNumberOrNull(ratePerMile),
        estimated_round_trip_mileage: parseNumberOrNull(estimatedMileage),
        effective_daily_rate: parseNumberOrNull(dailyRate),
        is_active: isActive,
      };

      const res = await fetch("/api/admin/routes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: route.id, ...payload }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update route.");
    } catch (err: any) {
      console.error("Error updating route meta:", err);
      setMetaError(err?.message ?? "Failed to update route.");
    } finally {
      setSavingMeta(false);
    }
  };

    // -------- STOPS HELPERS --------
  const handleStopFieldChange = (
    stopId: string,
    field: "planned_time" | "notes" | "address",
    value: string,
  ) => {
    setStops((prev) =>
      prev.map((s) =>
        s.id === stopId
          ? {
              ...s,
              [field]: value || null,
            }
          : s,
      ),
    );
  };

  const handleMoveStop = (stopId: string, dir: "up" | "down") => {
    setStops((prev) => {
      const idx = prev.findIndex((s) => s.id === stopId);
      if (idx === -1) return prev;

      const newIdx = dir === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;

      // Remove the stop from its old position and insert it at the new index
      const copy = [...prev];
      const [moved] = copy.splice(idx, 1);
      copy.splice(newIdx, 0, moved);

      return copy;
    });
  };

  const handleDeleteStop = async (stopId: string) => {
    const confirmed = window.confirm(
      "Remove this stop from the route? This cannot be undone.",
    );
    if (!confirmed) return;

    setSavingStops(true);
    setStopsError(null);

    try {
      const res = await fetch(`/api/admin/route-stops?id=${stopId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to delete stop.");

      // Just remove it from local array; sequence will be normalized on save
      setStops((prev) => prev.filter((s) => s.id !== stopId));
    } catch (err: any) {
      console.error("Error deleting stop:", err);
      setStopsError(err?.message ?? "Failed to delete stop.");
    } finally {
      setSavingStops(false);
    }
  };

   const handleAddStop = async () => {
  if (!route && !routeId) return;

  setStopsError(null);

  const isStudentMode = stopFormMode === "student" || stopFormMode === "school";

  // 1) Require a student for student + school stops
  if (isStudentMode && !newStopStudentId) {
    setStopsError("Select a student for this stop.");
    return;
  }

  if (stopFormMode === "school" && !newStopStudentId) {
    setStopsError("Select a student for this school stop.");
    return;
  }

  setSavingStops(true);

  try {
    const nextSequence = stops.length > 0 ? stops.length + 1 : 1;

    // Resolve student_id
    const studentId = isStudentMode ? newStopStudentId || null : null;

    // Resolve school_id (for school stops we prefer the student's school)
    let schoolId: string | null = null;
    if (stopFormMode === "school") {
      // First use whatever the admin picked in the school dropdown
      if (newStopSchoolId) {
        schoolId = newStopSchoolId;
      } else if (studentId) {
        const st = students.find((s) => s.id === studentId);
        if (st?.school_id) {
          schoolId = st.school_id;
        }
      }
    }

    const insertPayload = {
      route_id: route?.id ?? routeId,
      sequence: nextSequence,
      stop_type: newStopType,
      student_id: studentId,
      school_id: schoolId,
      address: newStopAddress || null,
      planned_time: newStopTime || null,
      notes: newStopNotes || null,
    };

    console.log("Inserting stop with payload:", insertPayload);

    const res = await fetch("/api/admin/route-stops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(insertPayload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to add stop.");

    const row = json.stop as any;

    const student =
      row.student_id &&
      students.find((st) => st.id === row.student_id)?.full_name;
    const school =
      row.school_id &&
      schools.find((sc) => sc.id === row.school_id)?.name;

    const newStop: StopRecord = {
      id: row.id,
      sequence: row.sequence ?? nextSequence,
      stop_type: (row.stop_type || "other") as StopType,
      student_id: row.student_id,
      school_id: row.school_id,
      address: row.address,
      planned_time: row.planned_time,
      notes: row.notes,
      student_name: student || null,
      school_name: (school as string) || null,
    };

    // Append to the end in the UI
    setStops((prev) => [...prev, newStop]);

    // Reset form (keep mode & type)
    setNewStopStudentId("");
    setNewStopSchoolId("");
    setNewStopAddress("");
    setNewStopTime("");
    setNewStopNotes("");
  } catch (err: any) {
    console.error("Error adding stop:", err);
    setStopsError(err?.message ?? "Failed to add stop.");
  } finally {
    setSavingStops(false);
  }
};

  const handleSaveStops = async () => {
    if (!route && !routeId) return;
    setSavingStops(true);
    setStopsError(null);

    try {
      // Use the current array order as the truth and number 1..N
      const payload = stops.map((s, index) => ({
        id: s.id,
        route_id: route?.id ?? routeId,
        sequence: index + 1,
        stop_type: s.stop_type,
        student_id: s.student_id,
        school_id: s.school_id,
        address: s.address || null,
        planned_time: s.planned_time || null,
        notes: s.notes || null,
      }));

      console.log("Saving stops upsert payload:", payload);

      const res = await fetch("/api/admin/route-stops", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save stops.");
    } catch (err: any) {
      console.error("Error saving stops:", err);
      setStopsError(err?.message ?? "Failed to save stops.");
    } finally {
      setSavingStops(false);
    }
  };

  // When selecting student/school, help the admin by pre-filling address if empty
 const handleSelectNewStudent = (id: string) => {
  setNewStopStudentId(id);

  // Clear related fields if nothing is selected
  if (!id) {
    if (stopFormMode === "school") {
      setNewStopSchoolId("");
    }
    return;
  }

  const st = students.find((s) => s.id === id);
  if (!st) return;

  if (stopFormMode === "student") {

    // For student/home stops, prefill HOME address
    if (!newStopAddress) {
      const parts: string[] = [];

      if (st.pickup_address && st.pickup_address.trim()) {
        parts.push(st.pickup_address.trim());
      }
      if (st.pickup_city && st.pickup_city.trim()) {
        parts.push(st.pickup_city.trim());
      }

      const stateZipParts: string[] = [];
      if (st.pickup_state && st.pickup_state.trim()) {
        stateZipParts.push(st.pickup_state.trim());
      }
      if (st.pickup_zip && st.pickup_zip.trim()) {
        stateZipParts.push(st.pickup_zip.trim());
      }
      if (stateZipParts.length > 0) {
        parts.push(stateZipParts.join(" "));
      }

      const fullAddress = parts.join(", ");
      setNewStopAddress(fullAddress || "");
    }
  } else if (stopFormMode === "school") {
    // For school stops, link the student's school and prefill SCHOOL address
    const schoolId = st.school_id || "";
    setNewStopSchoolId(schoolId);

    if (schoolId && !newStopAddress) {
      const sc = schools.find((s) => s.id === schoolId);
      if (sc?.address && sc.address.trim()) {
        setNewStopAddress(sc.address.trim());
      }
    }
  }
};

  const handleSelectNewSchool = (id: string) => {
  setNewStopSchoolId(id);
  if (!id) return;

  const sc = schools.find((s) => s.id === id);
  if (sc && !newStopAddress) {
    // If the school has an address, prefill it for this stop
    setNewStopAddress(sc.address || "");
  }
};

  // -------- ASSIGNMENTS HELPERS --------
  const reloadAssignments = async () => {
    if (!routeId) return;
    setLoadingAssignments(true);
    setAssignmentsError(null);

    try {
      const res = await fetch(`/api/admin/route-assignments?route_id=${routeId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to refresh assignments.");

      const base: AssignmentRow[] = Array.from({ length: 7 }, (_, day) => ({
        id: null,
        day_of_week: day,
        driver_id: null,
        vehicle_id: null,
        is_active: true,
        notes: "",
      }));

      (json.assignments || []).forEach((row: any) => {
        const idx = base.findIndex((b) => b.day_of_week === row.day_of_week);
        if (idx !== -1) {
          base[idx] = {
            id: row.id,
            day_of_week: row.day_of_week,
            driver_id: row.driver_id,
            vehicle_id: row.vehicle_id,
            is_active: row.is_active ?? true,
            notes: row.notes ?? "",
          };
        }
      });

      setAssignments(base);
    } catch (err: any) {
      console.error("Error reloading assignments:", err);
      setAssignmentsError(err?.message ?? "Failed to refresh assignments.");
    } finally {
      setLoadingAssignments(false);
    }
  };

  const handleAssignmentChange = (
    day: number,
    field: "driver_id" | "vehicle_id",
    value: string,
  ) => {
    setAssignments((prev) =>
      prev.map((row) =>
        row.day_of_week === day
          ? {
              ...row,
              [field]: value || null,
            }
          : row,
      ),
    );
  };

 const handleSaveAssignments = async () => {
  if (!route && !routeId) {
    setAssignmentsError("Route is not loaded yet.");
    return;
  }

  setSavingAssignments(true);
  setAssignmentsError(null);

  try {
    const res = await fetch("/api/admin/route-assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        route_id: route?.id ?? routeId,
        assignments,
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to save assignments.");

    // Refresh from the response so ids and values stay in sync
    const base: AssignmentRow[] = Array.from({ length: 7 }, (_, day) => ({
      id: null,
      day_of_week: day,
      driver_id: null,
      vehicle_id: null,
      is_active: true,
      notes: "",
    }));

    (json.assignments || []).forEach((row: any) => {
      const idx = base.findIndex((b) => b.day_of_week === row.day_of_week);
      if (idx !== -1) {
        base[idx] = {
          id: row.id,
          day_of_week: row.day_of_week,
          driver_id: row.driver_id,
          vehicle_id: row.vehicle_id,
          is_active: row.is_active ?? true,
          notes: row.notes ?? "",
        };
      }
    });

    setAssignments(base);
  } catch (err: any) {
    console.error("Error saving assignments:", err);
    setAssignmentsError(
      err?.message ?? "Failed to save driver/vehicle assignments.",
    );
  } finally {
    setSavingAssignments(false);
  }
};

  // -------- RENDER --------

  if (loading) {
    return (
      <div className="card">
        <p className="text-sm text-slate-300">Loading route…</p>
      </div>
    );
  }

  if (!route) {
    return (
      <div className="space-y-4">
        <section className="card flex items-center justify-between">
          <h1 className="text-lg font-semibold text-white">Route details</h1>
          <Link href="/admin#routes" className="btn-ghost px-3 py-1 text-[11px]">
            ← Back to Routes
          </Link>
        </section>

        <section className="card">
          <p className="text-sm text-rose-400">
            {metaError || "Route not found."}
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <section className="card">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold text-white">
              Edit route – {route.name}
            </h1>
            <p className="text-xs text-slate-400">
              Update route details, stops, and driver/vehicle assignments.
            </p>
          </div>
          <Link href="/admin#routes" className="btn-ghost px-3 py-1 text-[11px]">
            ← Back to Routes
          </Link>
        </div>
      </section>

      {/* === ROUTE META FORM (ANCHOR) === */}
      <section className="card">
        <form onSubmit={handleSaveMeta} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            {/* Name */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-200">
                Route name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
              />
              <p className="text-[10px] text-slate-500">
                Example: &ldquo;Brookline – AM Route 1&rdquo;.
              </p>
            </div>

            {/* Direction */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-200">
                Direction <span className="text-rose-400">*</span>
              </label>
              <select
                value={direction}
                onChange={(e) =>
                  setDirection(e.target.value as Direction | "")
                }
                className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
              >
                <option value="">Select direction…</option>
                {DIRECTION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Primary school */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-200">
                Primary school (optional)
              </label>
              <select
                value={schoolId}
                onChange={(e) => setSchoolId(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
              >
                <option value="">No primary school</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name || "Unnamed school"}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-200">
                Route status
              </label>
              <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-slate-900 px-3 py-2">
                <button
                  type="button"
                  onClick={() => setIsActive(true)}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                    isActive
                      ? "bg-emerald-500 text-slate-950 shadow"
                      : "bg-slate-800 text-slate-100"
                  }`}
                >
                  Active
                </button>
                <button
                  type="button"
                  onClick={() => setIsActive(false)}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                    !isActive
                      ? "bg-rose-500 text-slate-950 shadow"
                      : "bg-slate-800 text-slate-100"
                  }`}
                >
                  Inactive
                </button>
              </div>
              <p className="text-[10px] text-slate-500">
                Inactive routes stay in the system but won&apos;t show on driver
                dashboards.
              </p>
            </div>
          </div>

          {/* Dates */}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-200">
                Effective start date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  e.currentTarget.blur(); // closes the native date picker on most browsers
                }}

                className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-200">
                Effective end date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                    setEndDate(e.target.value);
                    e.currentTarget.blur();
                }}

                className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
              />
            </div>
          </div>

          {/* Pricing & mileage */}
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-200">
                Effective daily rate
              </label>
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={dailyRate}
                  onChange={(e) => setDailyRate(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                  placeholder="e.g. 250.00"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-200">
                Estimated round-trip mileage
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.1"
                  value={estimatedMileage}
                  onChange={(e) => setEstimatedMileage(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                  placeholder="e.g. 35.5"
                />
                <span className="text-xs text-slate-400">mi</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-200">
                Rate per mile
              </label>
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={ratePerMile}
                  onChange={(e) => setRatePerMile(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                  placeholder="e.g. 7.50"
                />
                <span className="text-xs text-slate-400">/mi</span>
              </div>
            </div>
          </div>

          {metaError && (
            <p className="text-xs font-medium text-rose-400">{metaError}</p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={savingMeta || !name.trim() || !direction}
              className="btn-primary px-4 py-2 text-xs"
            >
              {savingMeta ? "Saving…" : "Save route details"}
            </button>
          </div>
        </form>
      </section>

      {/* === ROUTE STOPS SECTION (ANCHOR) === */}
      <section className="card space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">
              Stops
            </h2>
            <p className="text-[11px] text-slate-400">
              Ordered list of student and school stops for this route.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
            <span>{stops.length} stops</span>
            {savingStops && <span>Saving…</span>}
          </div>
        </div>

        {/* Add stop form */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 space-y-3">
          <div className="flex flex-wrap gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => {
                setStopFormMode("student");
                setNewStopType("pickup_home");
              }}
              className={`rounded-full px-3 py-1 font-semibold transition ${
                stopFormMode === "student"
                  ? "bg-emerald-500 text-slate-950"
                  : "bg-slate-800 text-slate-100"
              }`}
            >
              Student stop
            </button>
            <button
              type="button"
              onClick={() => {
                setStopFormMode("school");
                setNewStopType("pickup_school");
              }}
              className={`rounded-full px-3 py-1 font-semibold transition ${
                stopFormMode === "school"
                  ? "bg-emerald-500 text-slate-950"
                  : "bg-slate-800 text-slate-100"
              }`}
            >
              School stop
            </button>
            <button
              type="button"
              onClick={() => {
                setStopFormMode("other");
                setNewStopType("other");
              }}
              className={`rounded-full px-3 py-1 font-semibold transition ${
                stopFormMode === "other"
                  ? "bg-emerald-500 text-slate-950"
                  : "bg-slate-800 text-slate-100"
              }`}
            >
              Other stop
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {/* Student / School / Label */}
                          {/* Student / School / Label */}
            <div className="space-y-2">
              {/* STUDENT STOP */}
              {stopFormMode === "student" && (
                <>
                  <label className="text-[11px] font-medium text-slate-200">
                    Student
                  </label>
                  <select
                    value={newStopStudentId}
                    onChange={(e) => handleSelectNewStudent(e.target.value)}
                    className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                  >
                    <option value="">Select student…</option>
                    {students.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.full_name}
                      </option>
                    ))}
                  </select>
                </>
              )}

              {/* SCHOOL STOP – student + school */}
              {stopFormMode === "school" && (
                <>
                  <label className="text-[11px] font-medium text-slate-200">
                    Student for this school stop
                  </label>
                  <select
                    value={newStopStudentId}
                    onChange={(e) => handleSelectNewStudent(e.target.value)}
                    className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                  >
                    <option value="">Select student…</option>
                    {students.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.full_name}
                      </option>
                    ))}
                  </select>

                  <label className="text-[11px] font-medium text-slate-200">
                    School (auto-filled from student, can override)
                  </label>
                  <select
                    value={newStopSchoolId}
                    onChange={(e) => handleSelectNewSchool(e.target.value)}
                    className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                  >
                    <option value="">Select school…</option>
                    {schools.map((sc) => (
                      <option key={sc.id} value={sc.id}>
                        {sc.name || "Unnamed school"}
                      </option>
                    ))}
                  </select>

                  <p className="text-[10px] text-slate-500">
                    Choose the student first; we&apos;ll auto-select their school
                    and address. You can change the school if needed.
                  </p>
                </>
              )}

              {/* OTHER STOP */}
              {stopFormMode === "other" && (
                <>
                  <label className="text-[11px] font-medium text-slate-200">
                    Label / notes
                  </label>
                  <input
                    type="text"
                    value={newStopNotes}
                    onChange={(e) => setNewStopNotes(e.target.value)}
                    placeholder="e.g. Fuel stop or layover"
                    className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
                  />
                </>
              )}
            </div>

            {/* Stop type */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-200">
                Stop type
              </label>
              <select
                value={newStopType}
                onChange={(e) => setNewStopType(e.target.value as StopType)}
                className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
              >
                {STOP_TYPES_BY_MODE[stopFormMode].map((value) => (
                  <option key={value} value={value}>
                    {STOP_TYPE_LABELS[value]}
                  </option>
                ))}

              </select>
            </div>

            {/* Planned time */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-200">
                Planned time (optional)
              </label>
              <input
                type="time"
                value={newStopTime}
                onChange={(e) => setNewStopTime(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
              />
            </div>
          </div>

          {/* Address */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-200">
              Address for this stop
            </label>
            <input
              type="text"
              value={newStopAddress}
              onChange={(e) => setNewStopAddress(e.target.value)}
              placeholder="Street, city, state…"
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-emerald-500/60 focus:border-emerald-500 focus:ring-2"
            />
            <p className="text-[10px] text-slate-500">
              You can paste the student&apos;s home address or the school
              address here.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleAddStop}
              disabled={savingStops}
              className="btn-primary px-4 py-2 text-xs"
            >
              {savingStops ? "Adding…" : "Add stop"}
            </button>
          </div>

          {stopsError && (
            <p className="text-xs font-medium text-rose-400">{stopsError}</p>
          )}
        </div>

        {/* Stops table */}
        <div className="overflow-x-auto rounded-xl bg-slate-950/60">
          {loadingStops ? (
            <div className="p-3 text-[11px] text-slate-400">
              Loading stops…
            </div>
          ) : stops.length === 0 ? (
            <div className="p-3 text-[11px] text-slate-400">
              No stops yet. Add a student or school stop above.
            </div>
          ) : (
            <table className="min-w-full text-[11px] text-slate-100">
              <thead className="bg-slate-900/90">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">#</th>
                  <th className="px-3 py-2 text-left font-semibold">Type</th>
                  <th className="px-3 py-2 text-left font-semibold">Who</th>
                  <th className="px-3 py-2 text-left font-semibold">Address</th>
                  <th className="px-3 py-2 text-left font-semibold">
                    Planned time
                  </th>
                  <th className="px-3 py-2 text-left font-semibold">Notes</th>
                  <th className="px-3 py-2 text-right font-semibold">
                    Reorder
                  </th>
                  <th className="px-3 py-2 text-right font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {stops.map((stop, idx) => (
                  <tr
                    key={stop.id}
                    className={
                      idx % 2 === 0
                        ? "bg-slate-950/70"
                        : "bg-slate-900/70"
                    }
                  >
                    <td className="px-3 py-2 align-top">{idx + 1}</td>
                    <td className="px-3 py-2 align-top">
                      <span className="inline-flex rounded-full bg-slate-800 px-2 py-0.5 text-[10px]">
                        {STOP_TYPE_LABELS[stop.stop_type]}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex flex-col">
                        {stop.student_name && (
                          <span className="font-medium">
                            {stop.student_name}
                          </span>
                        )}
                        {stop.school_name && (
                          <span className="text-slate-300">
                            {stop.school_name}
                          </span>
                        )}
                        {!stop.student_name && !stop.school_name && (
                          <span className="text-slate-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <input
                        type="text"
                        value={stop.address || ""}
                        onChange={(e) =>
                          handleStopFieldChange(
                            stop.id,
                            "address",
                            e.target.value,
                          )
                        }
                        className="w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/60"
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <input
                        type="time"
                        value={stop.planned_time || ""}
                        onChange={(e) =>
                          handleStopFieldChange(
                            stop.id,
                            "planned_time",
                            e.target.value,
                          )
                        }
                        className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/60"
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <input
                        type="text"
                        value={stop.notes || ""}
                        onChange={(e) =>
                          handleStopFieldChange(
                            stop.id,
                            "notes",
                            e.target.value,
                          )
                        }
                        className="w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/60"
                        placeholder="Optional"
                      />
                    </td>
                    <td className="px-3 py-2 align-top text-right">
                      <div className="flex flex-col items-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleMoveStop(stop.id, "up")}
                          className="btn-ghost px-2 py-1 text-[10px]"
                        >
                          ↑ Up
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveStop(stop.id, "down")}
                          className="btn-ghost px-2 py-1 text-[10px]"
                        >
                          ↓ Down
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteStop(stop.id)}
                        className="btn-ghost px-2 py-1 text-[10px] text-rose-300 hover:text-rose-200"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleSaveStops}
            disabled={savingStops || stops.length === 0}
            className="btn-primary px-4 py-2 text-xs"
          >
            {savingStops ? "Saving…" : "Save stop order & details"}
          </button>
        </div>
      </section>

      {/* === ROUTE ASSIGNMENTS SECTION (ANCHOR) === */}
      <section className="card space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">
              Driver & vehicle assignments
            </h2>
            <p className="text-[11px] text-slate-400">
              Assign one driver and vehicle per weekday. Drivers will see
              today&apos;s active routes in their portal.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
            {loadingAssignments && <span>Loading assignments…</span>}
            {savingAssignments && <span>Saving…</span>}
          </div>
        </div>

        {assignmentsError && (
          <p className="text-xs font-medium text-rose-400">
            {assignmentsError}
          </p>
        )}

        <div className="overflow-x-auto rounded-xl bg-slate-950/60">
          <table className="min-w-full text-[11px] text-slate-100">
            <thead className="bg-slate-900/90">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Day</th>
                <th className="px-3 py-2 text-left font-semibold">Driver</th>
                <th className="px-3 py-2 text-left font-semibold">Vehicle</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((row) => (
                <tr
                  key={row.day_of_week}
                  className={
                    row.day_of_week % 2 === 0
                      ? "bg-slate-950/70"
                      : "bg-slate-900/70"
                  }
                >
                  <td className="px-3 py-2 align-top">
                    <span className="font-semibold">
                      {WEEKDAY_LABELS[row.day_of_week]}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <select
                      value={row.driver_id || ""}
                      onChange={(e) =>
                        handleAssignmentChange(
                          row.day_of_week,
                          "driver_id",
                          e.target.value,
                        )
                      }
                      className="w-full rounded-xl border border-white/15 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/60"
                    >
                      <option value="">No driver</option>
                      {drivers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.full_name}
                          {!d.is_active ? " (inactive)" : ""}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <select
                      value={row.vehicle_id || ""}
                      onChange={(e) =>
                        handleAssignmentChange(
                          row.day_of_week,
                          "vehicle_id",
                          e.target.value,
                        )
                      }
                      className="w-full rounded-xl border border-white/15 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/60"
                    >
                      <option value="">No vehicle</option>
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.label}
                          {!v.is_active ? " (inactive)" : ""}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSaveAssignments}
            disabled={savingAssignments}
            className="btn-primary px-4 py-2 text-xs"
          >
            {savingAssignments ? "Saving…" : "Save assignments"}
          </button>
        </div>
      </section>
    </div>
  );
}
