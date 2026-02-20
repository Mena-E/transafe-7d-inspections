import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

interface RouteStop {
  id: string;
  route_id: string;
  sequence: number;
  address: string;
  planned_time: string | null;
  stop_type: string;
  student_name: string | null;
  student_id: string | null;
  primary_guardian_name: string | null;
  primary_guardian_phone: string | null;
  name: string | null;
  phone: string | null;
  household_id: string | null;
  household_students: string[];
  household_student_ids: string[];
}

export async function GET(req: NextRequest) {
  try {
    const driverId = req.nextUrl.searchParams.get("driverId");
    if (!driverId) {
      return NextResponse.json(
        { error: "driverId is required" },
        { status: 400 }
      );
    }

    // 1. Get today's date and day of week
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const dayOfWeek = now.getDay(); // 0=Sun, 6=Sat

    // 2. Load driver_route_assignments for this driver and day_of_week
    const { data: assignments, error: assignErr } = await supabaseAdmin
      .from("driver_route_assignments")
      .select("*")
      .eq("driver_id", driverId)
      .eq("day_of_week", dayOfWeek);

    if (assignErr) throw assignErr;

    // 3. If no assignments, return empty
    if (!assignments || assignments.length === 0) {
      return NextResponse.json({ routes: [], stopsMap: {}, attendance: {} });
    }

    // 4. Collect route IDs
    const routeIds = assignments.map((a) => a.route_id);

    // 5. Load routes, route_stops, and completions in parallel
    const [routesRes, stopsRes, completionsRes] = await Promise.all([
      supabaseAdmin.from("routes").select("*").in("id", routeIds),
      supabaseAdmin
        .from("route_stops")
        .select("*")
        .in("route_id", routeIds)
        .order("sequence", { ascending: true }),
      supabaseAdmin
        .from("driver_route_completions")
        .select("*")
        .eq("driver_id", driverId)
        .eq("work_date", today),
    ]);

    if (routesRes.error) throw routesRes.error;
    if (stopsRes.error) throw stopsRes.error;
    if (completionsRes.error) throw completionsRes.error;

    const completedRouteIds = new Set(
      (completionsRes.data || []).map((c) => c.route_id)
    );

    // 6. Filter out completed and inactive routes
    const allAssignedRoutes = (routesRes.data || []).filter(
      (r) => r.is_active !== false
    );
    const activeRoutes = allAssignedRoutes.filter(
      (r) => !completedRouteIds.has(r.id)
    );

    // Total assigned route counts (before completion filtering) for shift gating
    const totalRouteCounts = {
      AM: allAssignedRoutes.filter(
        (r) => r.direction === "AM" || r.direction === "MIDDAY"
      ).length,
      PM: allAssignedRoutes.filter((r) => r.direction === "PM").length,
    };

    // 7. For each stop, load student and school data, build effective addresses
    const stops = stopsRes.data || [];

    // Collect unique student IDs and school IDs for batch loading
    const studentIds = [
      ...new Set(stops.filter((s) => s.student_id).map((s) => s.student_id)),
    ];
    const schoolIds = [
      ...new Set(stops.filter((s) => s.school_id).map((s) => s.school_id)),
    ];

    const [studentsRes, schoolsRes] = await Promise.all([
      studentIds.length > 0
        ? supabaseAdmin
            .from("students")
            .select(
              "id, full_name, pickup_address, household_id, primary_guardian_name, primary_guardian_phone, school_id"
            )
            .in("id", studentIds)
        : Promise.resolve({ data: [], error: null }),
      schoolIds.length > 0
        ? supabaseAdmin
            .from("schools")
            .select("id, name, address, phone")
            .in("id", schoolIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (studentsRes.error) throw studentsRes.error;
    if (schoolsRes.error) throw schoolsRes.error;

    const studentsMap = new Map(
      (studentsRes.data || []).map((s) => [s.id, s])
    );
    const schoolsMap = new Map(
      (schoolsRes.data || []).map((s) => [s.id, s])
    );

    // Also load schools for students (to get school names for student stops)
    const studentSchoolIds = [
      ...new Set(
        (studentsRes.data || [])
          .filter((s) => s.school_id)
          .map((s) => s.school_id)
      ),
    ].filter((id) => !schoolsMap.has(id));

    if (studentSchoolIds.length > 0) {
      const { data: extraSchools, error: extraSchoolErr } = await supabaseAdmin
        .from("schools")
        .select("id, name, address, phone")
        .in("id", studentSchoolIds);

      if (extraSchoolErr) throw extraSchoolErr;
      (extraSchools || []).forEach((s) => schoolsMap.set(s.id, s));
    }

    // Build the stops map grouped by route
    const stopsMap: Record<string, RouteStop[]> = {};

    // Filter stops to only active routes
    const activeRouteIds = new Set(activeRoutes.map((r) => r.id));

    for (const routeId of activeRouteIds) {
      const routeStops = stops.filter((s) => s.route_id === routeId);

      // 8. Group stops by household (home stops) or school (school stops)
      const processedStops: RouteStop[] = [];
      const householdGroups = new Map<string, typeof routeStops>();
      const schoolGroups = new Map<string, typeof routeStops>();

      for (const stop of routeStops) {
        const student = stop.student_id
          ? studentsMap.get(stop.student_id)
          : null;
        const school = stop.school_id ? schoolsMap.get(stop.school_id) : null;
        const householdId = student?.household_id || stop.household_id || null;
        const isSchoolStop =
          stop.stop_type === "dropoff_school" ||
          stop.stop_type === "pickup_school";

        if (isSchoolStop && stop.school_id) {
          // Group school stops by school_id + stop_type
          const schoolKey = `${stop.school_id}:${stop.stop_type}`;
          if (!schoolGroups.has(schoolKey)) {
            schoolGroups.set(schoolKey, []);
          }
          schoolGroups.get(schoolKey)!.push(stop);
        } else if (householdId) {
          // Group home stops by household
          if (!householdGroups.has(householdId)) {
            householdGroups.set(householdId, []);
          }
          householdGroups.get(householdId)!.push(stop);
        } else {
          // Ungrouped stop
          const effectiveAddress =
            stop.address || school?.address || student?.pickup_address || "";

          processedStops.push({
            id: stop.id,
            route_id: stop.route_id,
            sequence: stop.sequence,
            address: effectiveAddress,
            planned_time: stop.planned_time || null,
            stop_type: stop.stop_type || "student",
            student_name: student?.full_name || null,
            student_id: stop.student_id || null,
            primary_guardian_name:
              student?.primary_guardian_name || null,
            primary_guardian_phone:
              student?.primary_guardian_phone || null,
            name: school?.name || null,
            phone: school?.phone || null,
            household_id: householdId,
            household_students: student?.full_name
              ? [student.full_name]
              : [],
            household_student_ids: stop.student_id
              ? [stop.student_id]
              : [],
          });
        }
      }

      // Process school groups — merge students going to the same school
      for (const [, groupStops] of schoolGroups) {
        const firstStop = groupStops[0];
        const school = firstStop.school_id
          ? schoolsMap.get(firstStop.school_id)
          : null;

        const studentNames: string[] = [];
        const studentIds: string[] = [];
        const seenStudentIds = new Set<string>();
        for (const gs of groupStops) {
          if (gs.student_id && seenStudentIds.has(gs.student_id)) continue;
          if (gs.student_id) seenStudentIds.add(gs.student_id);
          const stu = gs.student_id ? studentsMap.get(gs.student_id) : null;
          if (stu?.full_name) {
            studentNames.push(stu.full_name);
            if (gs.student_id) studentIds.push(gs.student_id);
          }
        }

        processedStops.push({
          id: firstStop.id,
          route_id: firstStop.route_id,
          sequence: firstStop.sequence,
          address: school?.address || firstStop.address || "",
          planned_time: firstStop.planned_time || null,
          stop_type: firstStop.stop_type || "dropoff_school",
          student_name: studentNames.join(", "),
          student_id: firstStop.student_id || null,
          primary_guardian_name: null,
          primary_guardian_phone: null,
          name: school?.name || null,
          phone: school?.phone || null,
          household_id: null,
          household_students: studentNames,
          household_student_ids: studentIds,
        });
      }

      // Process household groups — merge students in the same household
      for (const [householdId, groupStops] of householdGroups) {
        const firstStop = groupStops[0];
        const firstStudent = firstStop.student_id
          ? studentsMap.get(firstStop.student_id)
          : null;

        const studentNames: string[] = [];
        const studentIds: string[] = [];
        const seenStudentIds = new Set<string>();
        for (const gs of groupStops) {
          if (gs.student_id && seenStudentIds.has(gs.student_id)) continue;
          if (gs.student_id) seenStudentIds.add(gs.student_id);
          const stu = gs.student_id ? studentsMap.get(gs.student_id) : null;
          if (stu?.full_name) {
            studentNames.push(stu.full_name);
            if (gs.student_id) studentIds.push(gs.student_id);
          }
        }

        const effectiveAddress =
          firstStop.address || firstStudent?.pickup_address || "";

        processedStops.push({
          id: firstStop.id,
          route_id: firstStop.route_id,
          sequence: firstStop.sequence,
          address: effectiveAddress,
          planned_time: firstStop.planned_time || null,
          stop_type: firstStop.stop_type || "student",
          student_name: studentNames.join(", "),
          student_id: firstStop.student_id || null,
          primary_guardian_name:
            firstStudent?.primary_guardian_name ||
            null,
          primary_guardian_phone:
            firstStudent?.primary_guardian_phone ||
            null,
          name: null,
          phone: null,
          household_id: householdId,
          household_students: studentNames,
          household_student_ids: studentIds,
        });
      }

      // Sort by sequence
      processedStops.sort((a, b) => a.sequence - b.sequence);
      stopsMap[routeId] = processedStops;
    }

    // 9. Load existing attendance records for today
    const { data: attendanceData, error: attendErr } = await supabaseAdmin
      .from("attendance_records")
      .select("*")
      .eq("driver_id", driverId)
      .eq("record_date", today);

    if (attendErr) throw attendErr;

    // Build attendance map keyed by "studentId:stopId" so pickup and dropoff
    // records for the same student are tracked independently
    const attendance: Record<string, string> = {};
    for (const rec of attendanceData || []) {
      if (rec.route_stop_id) {
        attendance[`${rec.student_id}:${rec.route_stop_id}`] = rec.status;
      }
      // Also store by student_id alone as fallback
      attendance[rec.student_id] = rec.status;
    }

    // 10. Return
    return NextResponse.json({
      routes: activeRoutes,
      stopsMap,
      attendance,
      totalRouteCounts,
    });
  } catch (err: any) {
    console.error("Driver routes error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
