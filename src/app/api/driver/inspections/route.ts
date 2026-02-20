import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * GET /api/driver/inspections?driverId=...&driverName=...
 *
 * Returns the last 90 days of inspection records for a driver.
 * Filters by driverId if provided, otherwise falls back to driverName.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const driverId = searchParams.get("driverId");
    const driverName = searchParams.get("driverName");
    const date = searchParams.get("date");
    const type = searchParams.get("type");

    if (!driverId && !driverName) {
      return NextResponse.json(
        { error: "driverId or driverName is required" },
        { status: 400 }
      );
    }

    let query = supabaseAdmin
      .from("inspections")
      .select(
        "id,driver_id,driver_name,vehicle_label,inspection_type,shift,submitted_at,inspection_date,overall_status"
      )
      .order("submitted_at", { ascending: false });

    if (driverId) {
      query = query.eq("driver_id", driverId);
    } else {
      query = query.eq("driver_name", driverName!);
    }

    if (date) {
      query = query.eq("inspection_date", date);
    } else {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      query = query.gte("submitted_at", ninetyDaysAgo.toISOString());
    }

    if (type) {
      query = query.eq("inspection_type", type);
    }

    const shift = searchParams.get("shift");
    if (shift) {
      query = query.eq("shift", shift);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ inspections: data });
  } catch (err: any) {
    console.error("Inspection history error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to load inspection history" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      driver_id,
      driver_name,
      driver_license_number,
      vehicle_id,
      vehicle_label,
      inspection_type,
      shift,
      answers,
      overall_status,
      notes,
      signature_name,
      odometer_reading,
    } = body;

    if (!driver_id || !vehicle_id || !inspection_type) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const today = new Date().toISOString().slice(0, 10);
    const nowISO = new Date().toISOString();

    // Insert the inspection record
    const { data: inspection, error: inspErr } = await supabaseAdmin
      .from("inspections")
      .insert({
        driver_id,
        driver_name: driver_name || null,
        driver_license_number: driver_license_number || null,
        vehicle_id,
        vehicle_label: vehicle_label || null,
        inspection_type,
        shift: shift || null,
        answers: answers || {},
        overall_status: overall_status || null,
        notes: notes || null,
        signature_name: signature_name || null,
        odometer_reading: odometer_reading ?? null,
      })
      .select()
      .single();

    if (inspErr) throw inspErr;

    // Handle time tracking based on inspection type
    if (inspection_type === "pre") {
      // Start a work session - create a time entry if none is currently open
      const { data: openEntries, error: openErr } = await supabaseAdmin
        .from("driver_time_entries")
        .select("id")
        .eq("driver_id", driver_id)
        .eq("work_date", today)
        .is("end_time", null);

      if (openErr) throw openErr;

      if (!openEntries || openEntries.length === 0) {
        const { error: timeErr } = await supabaseAdmin
          .from("driver_time_entries")
          .insert({
            driver_id,
            work_date: today,
            start_time: nowISO,
            end_time: null,
          });

        if (timeErr) throw timeErr;
      }
    } else if (inspection_type === "post") {
      // Stop the work session - close any open time entry
      const { data: openEntries, error: openErr } = await supabaseAdmin
        .from("driver_time_entries")
        .select("id, start_time")
        .eq("driver_id", driver_id)
        .eq("work_date", today)
        .is("end_time", null)
        .order("start_time", { ascending: false })
        .limit(1);

      if (openErr) throw openErr;

      if (openEntries && openEntries.length > 0) {
        const entry = openEntries[0];
        const start = new Date(entry.start_time);
        const now = new Date(nowISO);
        const durationSeconds = Math.max(
          0,
          Math.floor((now.getTime() - start.getTime()) / 1000)
        );

        const { error: closeErr } = await supabaseAdmin
          .from("driver_time_entries")
          .update({
            end_time: nowISO,
            duration_seconds: durationSeconds,
          })
          .eq("id", entry.id);

        if (closeErr) throw closeErr;
      }
    }

    return NextResponse.json({ inspection });
  } catch (err: any) {
    console.error("Inspection error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
