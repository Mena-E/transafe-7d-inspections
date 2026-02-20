import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("mode");
    const weekStart = searchParams.get("weekStart");
    const weekEnd = searchParams.get("weekEnd");
    const driverId = searchParams.get("driverId");

    // Live clock mode: get open entries for today + all drivers
    if (mode === "live") {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

      const [driversRes, entriesRes] = await Promise.all([
        supabaseAdmin
          .from("drivers")
          .select("id, full_name, license_number, is_active"),
        supabaseAdmin
          .from("driver_time_entries")
          .select("id, driver_id, work_date, start_time, end_time")
          .eq("work_date", todayStr)
          .is("end_time", null),
      ]);

      if (driversRes.error) throw driversRes.error;
      if (entriesRes.error) throw entriesRes.error;

      return NextResponse.json({
        drivers: driversRes.data || [],
        entries: entriesRes.data || [],
      });
    }

    // Driver-specific week query
    if (driverId && weekStart && weekEnd) {
      const [driverRes, entriesRes] = await Promise.all([
        supabaseAdmin
          .from("drivers")
          .select("id, full_name, license_number")
          .eq("id", driverId)
          .maybeSingle(),
        supabaseAdmin
          .from("driver_time_entries")
          .select("id, driver_id, work_date, start_time, end_time, duration_seconds")
          .eq("driver_id", driverId)
          .gte("work_date", weekStart)
          .lte("work_date", weekEnd)
          .order("work_date", { ascending: true })
          .order("start_time", { ascending: true }),
      ]);

      if (driverRes.error) throw driverRes.error;
      if (entriesRes.error) throw entriesRes.error;

      return NextResponse.json({
        driver: driverRes.data,
        entries: entriesRes.data || [],
      });
    }

    // Default: week range query (original behavior)
    if (!weekStart || !weekEnd) {
      return NextResponse.json(
        { error: "Missing weekStart or weekEnd query parameters" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("driver_time_entries")
      .select("id, driver_id, work_date, start_time, end_time, duration_seconds")
      .gte("work_date", weekStart)
      .lte("work_date", weekEnd);

    if (error) throw error;
    return NextResponse.json({ entries: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
