import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      student_id,
      route_id,
      route_stop_id,
      household_id,
      driver_id,
      status,
      latitude,
      longitude,
    } = body;

    if (!student_id || !route_id || !driver_id || !status) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const today = new Date().toISOString().slice(0, 10);

    // Delete existing record for this student at this specific stop
    // (handles status changes at the same stop, e.g. picked_up → absent)
    let deleteQuery = supabaseAdmin
      .from("attendance_records")
      .delete()
      .eq("student_id", student_id)
      .eq("route_id", route_id)
      .eq("record_date", today);

    if (route_stop_id) {
      deleteQuery = deleteQuery.eq("route_stop_id", route_stop_id);
    }

    await deleteQuery;

    // Also delete any record with the same status across all stops
    // (prevents unique constraint violation on idx_attendance_unique
    //  which spans student_id, route_id, record_date, status)
    await supabaseAdmin
      .from("attendance_records")
      .delete()
      .eq("student_id", student_id)
      .eq("route_id", route_id)
      .eq("record_date", today)
      .eq("status", status);

    // Insert new record
    const { data, error } = await supabaseAdmin
      .from("attendance_records")
      .insert({
        student_id,
        route_id,
        route_stop_id: route_stop_id || null,
        household_id: household_id || null,
        driver_id,
        record_date: today,
        status,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ record: data });
  } catch (err: any) {
    console.error("Attendance error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
