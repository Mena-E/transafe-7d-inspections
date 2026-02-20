import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * GET /api/driver/time-entries?driverId=...&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 *
 * Returns time entries for a driver within a date range.
 * Used by the driver time-log page to display weekly summaries.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const driverId = searchParams.get("driverId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!driverId) {
      return NextResponse.json(
        { error: "driverId is required" },
        { status: 400 }
      );
    }

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("driver_time_entries")
      .select(
        "id, driver_id, work_date, start_time, end_time, duration_seconds"
      )
      .eq("driver_id", driverId)
      .gte("work_date", startDate)
      .lte("work_date", endDate)
      .order("work_date", { ascending: false })
      .order("start_time", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ entries: data });
  } catch (err: any) {
    console.error("Time entries error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to load time entries" },
      { status: 500 }
    );
  }
}
