import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const driverId = req.nextUrl.searchParams.get("driverId");
    const date = req.nextUrl.searchParams.get("date");

    if (!driverId) {
      return NextResponse.json(
        { error: "driverId is required" },
        { status: 400 }
      );
    }

    const targetDate = date || new Date().toISOString().slice(0, 10);

    // Load all time entries for this driver on the target date
    const { data: entries, error } = await supabaseAdmin
      .from("time_entries")
      .select("*")
      .eq("driver_id", driverId)
      .eq("work_date", targetDate)
      .order("start_time", { ascending: true });

    if (error) throw error;

    let baseSeconds = 0;
    let activeSince: string | null = null;

    for (const entry of entries || []) {
      if (entry.end_time) {
        // Completed entry - calculate duration in seconds
        const start = new Date(entry.start_time).getTime();
        const end = new Date(entry.end_time).getTime();
        baseSeconds += Math.floor((end - start) / 1000);
      } else {
        // Open entry - this is the active session
        activeSince = entry.start_time;
      }
    }

    return NextResponse.json({ baseSeconds, activeSince });
  } catch (err: any) {
    console.error("Time entry error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
