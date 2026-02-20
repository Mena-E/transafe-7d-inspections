import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const schoolId = searchParams.get("schoolId");
    const routeId = searchParams.get("routeId");
    const driverId = searchParams.get("driverId");
    const status = searchParams.get("status");
    const studentSearch = searchParams.get("studentSearch");

    // Query attendance_records with joins to students, routes, and drivers
    let query = supabaseAdmin
      .from("attendance_records")
      .select(
        `
        id,
        student_id,
        route_id,
        driver_id,
        record_date,
        status,
        recorded_at,
        latitude,
        longitude,
        notes,
        students ( id, full_name, school_id ),
        routes ( id, name, direction ),
        drivers ( id, full_name )
        `
      )
      .order("record_date", { ascending: false })
      .order("recorded_at", { ascending: false });

    // Apply date range filters
    if (startDate) {
      query = query.gte("record_date", startDate);
    }
    if (endDate) {
      query = query.lte("record_date", endDate);
    }

    // Apply direct column filters
    if (routeId) {
      query = query.eq("route_id", routeId);
    }
    if (driverId) {
      query = query.eq("driver_id", driverId);
    }
    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Map joined data into flat records
    let records = (data || []).map((row: any) => ({
      id: row.id,
      student_id: row.student_id,
      student_name: row.students?.full_name || "Unknown",
      student_school_id: row.students?.school_id || null,
      route_id: row.route_id,
      route_name: row.routes?.name || "N/A",
      route_direction: row.routes?.direction ?? null,
      driver_id: row.driver_id,
      driver_name: row.drivers?.full_name || "N/A",
      record_date: row.record_date,
      status: row.status,
      recorded_at: row.recorded_at,
      latitude: row.latitude,
      longitude: row.longitude,
      notes: row.notes,
    }));

    // Apply school filter (requires checking the student's school_id)
    if (schoolId) {
      records = records.filter(
        (r: any) => r.student_school_id === schoolId
      );
    }

    // Apply student name search filter
    if (studentSearch) {
      const q = studentSearch.toLowerCase();
      records = records.filter((r: any) =>
        r.student_name.toLowerCase().includes(q)
      );
    }

    return NextResponse.json({ records });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
