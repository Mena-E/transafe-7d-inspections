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
      .from("driver_time_entries")
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { driver_id, action } = body;

    if (!driver_id || !action) {
      return NextResponse.json(
        { error: "driver_id and action are required" },
        { status: 400 }
      );
    }

    const today = new Date().toISOString().slice(0, 10);

    if (action === "pause") {
      const { data: openEntry, error: findErr } = await supabaseAdmin
        .from("driver_time_entries")
        .select("*")
        .eq("driver_id", driver_id)
        .eq("work_date", today)
        .is("end_time", null)
        .maybeSingle();

      if (findErr) throw findErr;

      if (!openEntry) {
        return NextResponse.json(
          { error: "No open time entry found to pause" },
          { status: 404 }
        );
      }

      const now = new Date().toISOString();
      const startMs = new Date(openEntry.start_time).getTime();
      const endMs = new Date(now).getTime();
      const durationSeconds = Math.floor((endMs - startMs) / 1000);

      const { error: updateErr } = await supabaseAdmin
        .from("driver_time_entries")
        .update({ end_time: now, duration_seconds: durationSeconds })
        .eq("id", openEntry.id);

      if (updateErr) throw updateErr;

      return NextResponse.json({ paused: true });
    }

    if (action === "resume") {
      const { data: existing } = await supabaseAdmin
        .from("driver_time_entries")
        .select("id")
        .eq("driver_id", driver_id)
        .eq("work_date", today)
        .is("end_time", null)
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          { error: "An open time entry already exists" },
          { status: 409 }
        );
      }

      const now = new Date().toISOString();
      const { error: insertErr } = await supabaseAdmin
        .from("driver_time_entries")
        .insert({
          driver_id,
          work_date: today,
          start_time: now,
          end_time: null,
        });

      if (insertErr) throw insertErr;

      return NextResponse.json({ resumed: true, activeSince: now });
    }

    return NextResponse.json(
      { error: "Invalid action. Use 'pause' or 'resume'." },
      { status: 400 }
    );
  } catch (err: any) {
    console.error("Time POST error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
